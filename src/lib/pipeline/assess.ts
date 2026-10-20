import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type Database } from "@/lib/db";
import { checkBudget, type BudgetCheck } from "@/lib/llm/budget";
import { claudeCodeClient } from "@/lib/llm/claude-code";
import { anthropicClient, costUsd, type LlmClient, type LlmRequest, type LlmResponse } from "@/lib/llm/client";
import * as prompt from "@/lib/llm/prompts/assess.v1";
import { registry, type ScoreWeights } from "@/lib/registry";
import { excerpt } from "@/lib/text";
import { errorMessage, tierFor } from "./ingest";
import { qualityScore } from "./rank";

export const PROMPT_VERSION = prompt.version;
const ABSTRACT_CHARS = 1500;
/** Rough chars per token, only for the worst-case budget estimate. */
const CHARS_PER_TOKEN = 3;

export type Candidate = {
  id: number;
  title: string;
  firstSourceId: string;
  kind: string;
  layer: string;
  authors: string[] | null;
  publishedAt: Date | null;
  excerpt: string | null;
  abstract: string | null;
  sourceDomains: string[];
};

export type AssessmentRow = typeof schema.itemAssessments.$inferInsert;

export function toInput(item: Candidate, sourceName: (id: string) => string): prompt.AssessInput {
  const text = item.abstract ? excerpt(item.abstract, ABSTRACT_CHARS) : (item.excerpt ?? undefined);
  return {
    id: item.id,
    source: sourceName(item.firstSourceId),
    sourceKind: item.kind,
    layer: item.layer,
    title: item.title,
    ...(item.authors?.length ? { authors: item.authors.slice(0, 3) } : {}),
    ...(item.publishedAt ? { published: item.publishedAt.toISOString().slice(0, 10) } : {}),
    ...(text ? { text } : {}),
  };
}

export type Interpreted =
  | { ok: true; results: prompt.AssessResult[]; unknownIds: number; invalid: number }
  | { ok: false; error: string };

const envelope = z.object({ items: z.array(z.unknown()) });

/**
 * Checks the stop reason before reading anything, then each item on its own, so one bad item
 * doesn't cost the batch. Keeps only ids that were in the batch, once each.
 */
export function interpretResponse(res: LlmResponse, ids: Set<number>): Interpreted {
  if (res.stopReason !== "end_turn") return { ok: false, error: `stop_reason ${res.stopReason}` };
  if (!res.text) return { ok: false, error: "no output" };
  let json: unknown;
  try {
    json = JSON.parse(res.text);
  } catch {
    return { ok: false, error: "output is not JSON" };
  }
  const parsed = envelope.safeParse(json);
  if (!parsed.success) return { ok: false, error: "output has no items array" };
  const seen = new Set<number>();
  const results: prompt.AssessResult[] = [];
  let unknownIds = 0;
  let invalid = 0;
  for (const raw of parsed.data.items) {
    const item = prompt.resultSchema.safeParse(raw);
    if (!item.success) invalid++;
    else if (!ids.has(item.data.id) || seen.has(item.data.id)) unknownIds++;
    else {
      seen.add(item.data.id);
      results.push(item.data);
    }
  }
  return { ok: true, results, unknownIds, invalid };
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];
const tidy = (s: string) => s.trim().toLowerCase().slice(0, 40);

export function toAssessment(
  r: prompt.AssessResult,
  item: Pick<Candidate, "id" | "sourceDomains">,
  meta: { model: string; weights: ScoreWeights; llmCallId: number | null; now: Date },
): AssessmentRow {
  const { domains: knownDomains, topics: knownTopics } = registry();
  const domainSet = new Set(knownDomains.map((d) => d.slug));
  const topicSet = new Set(knownTopics.map((t) => t.slug));
  const domains = uniq(r.domains.filter((d) => domainSet.has(d))).slice(0, 3);
  // A topic the model made up is a proposal for the list, not a tag.
  const topics = uniq(r.topics.filter((t) => topicSet.has(t))).slice(0, 4);
  const proposed = [...r.topics.filter((t) => !topicSet.has(t)), ...r.proposed_topics].map(tidy).filter(Boolean);
  return {
    itemId: item.id,
    promptVersion: PROMPT_VERSION,
    model: meta.model,
    assessedAt: meta.now,
    relevant: r.relevant,
    domains: domains.length ? domains : item.sourceDomains,
    topics,
    proposedTopics: uniq(proposed.filter((t) => !topicSet.has(t))).slice(0, 2),
    contribution: r.contribution,
    artifacts: uniq(r.artifacts),
    novelty: r.novelty,
    magnitude: r.magnitude,
    evidence: r.evidence,
    breadth: r.breadth,
    maturity: r.maturity,
    quality: qualityScore(r, meta.weights),
    takeaway: r.takeaway.trim().slice(0, 300),
    rationale: r.rationale.trim().slice(0, 400),
    llmCallId: meta.llmCallId,
  };
}

/** "api" calls are billed and count toward the cap; "subscription" calls run through the local Claude Code CLI. */
export type Billing = "api" | "subscription";

export type CallRecord = {
  status: "ok" | "failed";
  billing: Billing;
  model: string;
  usage: LlmResponse["usage"];
  costUsd: number;
  itemCount: number;
  error?: string;
};

export type BatchDeps = {
  llm: LlmClient;
  billing: Billing;
  checkBudget: (worstUsd: number) => Promise<BudgetCheck>;
  recordCall: (call: CallRecord) => Promise<number | null>;
  write: (rows: AssessmentRow[]) => Promise<void>;
};

export type AssessStats = {
  candidates: number;
  assessed: number;
  calls: number;
  /** Billed cost; 0 for subscription calls. */
  costUsd: number;
  /** What the same calls would cost on the API (the CLI's own figure for subscription calls). */
  apiEquivalentUsd: number;
  failedCalls: number;
  unknownIds: number;
  /** Results that didn't match the item schema (e.g. a score of 6); those items are retried next run. */
  invalid: number;
  /** Why the run stopped before going through every candidate. */
  stoppedBy?: string;
  errors: string[];
  rows: AssessmentRow[];
};

/** Sends each batch to the model in turn, stopping on the budget or the deadline. Never throws. */
export async function processBatches(
  batches: Candidate[][],
  deps: BatchDeps,
  { now = new Date(), deadline = Infinity }: { now?: Date; deadline?: number } = {},
): Promise<AssessStats> {
  const { domains, topics, sources, config } = registry();
  const cfg = config.llm.assess;
  const price = config.llm.prices[cfg.model];
  const outputSchema = prompt.outputSchema(domains, topics);
  const system = prompt.buildSystem(domains, topics);
  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id;

  const stats: AssessStats = {
    candidates: batches.reduce((n, b) => n + b.length, 0),
    assessed: 0,
    calls: 0,
    costUsd: 0,
    apiEquivalentUsd: 0,
    failedCalls: 0,
    unknownIds: 0,
    invalid: 0,
    errors: [],
    rows: [],
  };

  for (const batch of batches) {
    if (Date.now() > deadline) {
      stats.stoppedBy = "time budget";
      break;
    }
    const req: LlmRequest = {
      model: cfg.model,
      effort: cfg.effort,
      maxTokens: cfg.maxTokens,
      system,
      user: prompt.buildUser(batch.map((i) => toInput(i, sourceName))),
      schema: outputSchema,
    };
    const worstUsd =
      (((system.length + req.user.length) / CHARS_PER_TOKEN) * price.input + req.maxTokens * price.output) / 1_000_000;
    const budget = await deps.checkBudget(worstUsd);
    if (!budget.ok) {
      stats.stoppedBy = budget.reason;
      break;
    }

    let res: LlmResponse;
    try {
      res = await deps.llm.complete(req);
    } catch (err) {
      // The SDK already retried; an error here means nothing usable came back.
      const error = errorMessage(err);
      stats.failedCalls++;
      stats.errors.push(error);
      await deps.recordCall({
        status: "failed",
        billing: deps.billing,
        model: cfg.model,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        costUsd: 0,
        itemCount: batch.length,
        error,
      });
      continue;
    }

    const listCost = costUsd(res.usage, config.llm.prices[res.model] ?? price);
    const cost = deps.billing === "api" ? listCost : 0;
    stats.calls++;
    stats.costUsd += cost;
    stats.apiEquivalentUsd += "apiEquivalentUsd" in res ? Number(res.apiEquivalentUsd) : listCost;
    const byId = new Map(batch.map((i) => [i.id, i]));
    const interpreted = interpretResponse(res, new Set(byId.keys()));
    const callId = await deps.recordCall({
      status: interpreted.ok ? "ok" : "failed",
      billing: deps.billing,
      model: res.model,
      usage: res.usage,
      costUsd: cost,
      itemCount: batch.length,
      error: interpreted.ok ? undefined : interpreted.error,
    });
    if (!interpreted.ok) {
      stats.failedCalls++;
      stats.errors.push(interpreted.error);
      continue;
    }
    stats.unknownIds += interpreted.unknownIds;
    stats.invalid += interpreted.invalid;
    const rows = interpreted.results.map((r) =>
      toAssessment(r, byId.get(r.id)!, { model: res.model, weights: config.scoreWeights, llmCallId: callId, now }),
    );
    await deps.write(rows);
    stats.assessed += rows.length;
    stats.rows.push(...rows);
  }
  stats.costUsd = Math.round(stats.costUsd * 1e6) / 1e6;
  stats.apiEquivalentUsd = Math.round(stats.apiEquivalentUsd * 1e6) / 1e6;
  return stats;
}

export type AssessOptions = {
  /** At most this many items per run. */
  limit?: number;
  /** Also re-assess items whose assessment came from an older prompt version. */
  retag?: boolean;
  /** Call the model and record the cost, but write no assessments. */
  dryRun?: boolean;
  /** Epoch ms after which no new request is started. */
  deadline?: number;
  llm?: LlmClient;
  database?: Database;
  now?: Date;
};

/** Assesses unassessed items, newest first (ARCHITECTURE §7.2). */
export async function assessItems(opts: AssessOptions = {}): Promise<Omit<AssessStats, "rows"> & { rows?: AssessmentRow[] }> {
  const { limit = 200, retag = false, dryRun = false, database = db(), now = new Date() } = opts;
  const provider = opts.llm ? { llm: opts.llm, billing: "api" as const } : defaultProvider();
  if (!provider) {
    return {
      candidates: 0,
      assessed: 0,
      calls: 0,
      costUsd: 0,
      apiEquivalentUsd: 0,
      failedCalls: 0,
      unknownIds: 0,
      invalid: 0,
      errors: [],
      stoppedBy: "no LLM configured (set ANTHROPIC_API_KEY, or ASSESS_PROVIDER=claude-code locally)",
    };
  }
  const { config } = registry();
  const { items, itemAssessments } = schema;

  const candidates = await database
    .select({
      id: items.id,
      title: items.title,
      firstSourceId: items.firstSourceId,
      kind: items.kind,
      layer: items.layer,
      authors: items.authors,
      publishedAt: items.publishedAt,
      excerpt: items.excerpt,
      abstract: items.abstract,
      sourceDomains: items.sourceDomains,
    })
    .from(items)
    .leftJoin(itemAssessments, sql`${itemAssessments.itemId} = ${items.id}`)
    .where(
      retag
        ? sql`${itemAssessments.itemId} is null or ${itemAssessments.promptVersion} <> ${PROMPT_VERSION}`
        : sql`${itemAssessments.itemId} is null`,
    )
    .orderBy(sql`${items.sortAt} desc`)
    .limit(limit);

  const size = config.llm.assess.batchSize;
  const batches: Candidate[][] = [];
  for (let i = 0; i < candidates.length; i += size) batches.push(candidates.slice(i, i + size));

  const stats = await processBatches(
    batches,
    {
      ...provider,
      // Subscription calls aren't billed, so only API calls count toward the cap.
      checkBudget: async (worstUsd) =>
        provider.billing === "subscription"
          ? { ok: true }
          : checkBudget(database, { worstUsd, capUsd: config.llm.monthlyCapUsd }),
      recordCall: async (c) => {
        const [row] = await database
          .insert(schema.llmCalls)
          .values({
            purpose: "assess",
            billing: c.billing,
            model: c.model,
            promptVersion: PROMPT_VERSION,
            status: c.status,
            inputTokens: c.usage.input,
            outputTokens: c.usage.output,
            cacheReadTokens: c.usage.cacheRead,
            cacheWriteTokens: c.usage.cacheWrite,
            costUsd: c.costUsd,
            itemCount: c.itemCount,
            error: c.error?.slice(0, 1000) ?? null,
          })
          .returning({ id: schema.llmCalls.id });
        return row.id;
      },
      write: dryRun ? async () => {} : (rows) => writeAssessments(database, rows),
    },
    { now, deadline: opts.deadline },
  );
  // Rows only matter for a dry run's printout; otherwise they'd bloat job_runs.stats.
  return dryRun ? stats : { ...stats, rows: undefined };
}

/**
 * ASSESS_PROVIDER=claude-code (set only on the owner's machine) uses the local Claude Code CLI and
 * its subscription; otherwise ANTHROPIC_API_KEY selects the API. Neither → assessment is skipped.
 */
function defaultProvider(): { llm: LlmClient; billing: Billing } | undefined {
  if (process.env.ASSESS_PROVIDER === "claude-code") {
    return { llm: claudeCodeClient({ bin: process.env.CLAUDE_BIN || "claude" }), billing: "subscription" };
  }
  if (process.env.ANTHROPIC_API_KEY) return { llm: anthropicClient(), billing: "api" };
  return undefined;
}

async function writeAssessments(database: Database, rows: AssessmentRow[]) {
  if (!rows.length) return;
  await database.transaction(async (tx) => {
    for (const row of rows) {
      const { itemId, ...set } = row;
      await tx
        .insert(schema.itemAssessments)
        .values(row)
        .onConflictDoUpdate({ target: schema.itemAssessments.itemId, set });
      await tx
        .update(schema.items)
        .set({ domains: row.domains, tier: tierFor(row.domains), tags: row.topics, quality: row.quality })
        .where(sql`${schema.items.id} = ${itemId}`);
    }
  });
}
