import { createHash } from "node:crypto";
import { and, eq, inArray, lte, notInArray, or } from "drizzle-orm";
import { connectorFor, type NormalizedItem } from "@/lib/connectors";
import type { ConnectorState } from "@/lib/connectors/types";
import { db, schema, type Database } from "@/lib/db";
import { createHttp, type Http } from "@/lib/http";
import { registry, type Frequency, type Source, type Tier } from "@/lib/registry";
import { canonicalizeUrl } from "./canonicalize";

const FREQUENCY_MS: Record<Frequency, number> = {
  // Slightly under the nominal period so an hourly trigger at :15 always finds hourly sources due.
  hourly: 50 * 60_000,
  daily: 23 * 3600_000,
  weekly: 6.5 * 86_400_000,
  yearly: 360 * 86_400_000,
};
const MAX_BACKOFF_MS = 24 * 3600_000;
const TIER_RANK: Record<Tier, number> = { deep: 0, regular: 1, broad: 2 };

/** Drizzle wraps driver errors as "Failed query: <sql>"; the useful part is the cause. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? err.cause.message : undefined;
    return cause ?? err.message;
  }
  return String(err);
}

export type SourceRunResult = {
  sourceId: string;
  ok: boolean;
  fetched: number;
  inserted: number;
  ms: number;
  error?: string;
};

export type IngestResult = {
  sources: SourceRunResult[];
  skippedForTime: string[];
  inserted: number;
};

function hashConfig(source: Source) {
  return createHash("sha256").update(JSON.stringify(source.config)).digest("hex").slice(0, 16);
}

/** Upserts content/sources.yaml into the DB; sources removed from YAML are kept but disabled. */
export async function syncSources(database: Database = db()) {
  const { sources } = registry();
  const now = new Date();
  for (const s of sources) {
    const row = {
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      method: s.method,
      kind: s.kind,
      layer: s.layer,
      domains: s.domains,
      frequency: s.frequency,
      config: s.config,
      configHash: hashConfig(s),
      inRegistry: true,
      updatedAt: now,
    };
    await database.insert(schema.sources).values(row).onConflictDoUpdate({ target: schema.sources.id, set: row });
    await database.insert(schema.sourceState).values({ sourceId: s.id }).onConflictDoNothing();
  }
  const ids = sources.map((s) => s.id);
  await database
    .update(schema.sources)
    .set({ inRegistry: false, enabled: false, updatedAt: now })
    .where(notInArray(schema.sources.id, ids));
  return sources.length;
}

function tierFor(domains: string[]): Tier {
  const byslug = new Map(registry().domains.map((d) => [d.slug, d.tier]));
  const tiers = domains.map((d) => byslug.get(d) ?? "broad");
  return tiers.sort((a, b) => TIER_RANK[a] - TIER_RANK[b])[0] ?? "broad";
}

async function upsertItem(tx: Database, source: Source, item: NormalizedItem, now: Date) {
  const canonicalUrl = canonicalizeUrl(item.url);
  const domains = item.domains?.length ? item.domains : source.domains;
  const sortAt = item.publishedAt && item.publishedAt < now ? item.publishedAt : now;

  const match = item.externalId
    ? or(
        and(eq(schema.items.externalKind, item.externalKind!), eq(schema.items.externalId, item.externalId)),
        eq(schema.items.canonicalUrl, canonicalUrl),
      )
    : eq(schema.items.canonicalUrl, canonicalUrl);

  const columns = {
    id: schema.items.id,
    abstract: schema.items.abstract,
    excerpt: schema.items.excerpt,
    authors: schema.items.authors,
    publishedAt: schema.items.publishedAt,
  };
  let [existing] = await tx.select(columns).from(schema.items).where(match).limit(1);
  let inserted = false;

  if (!existing) {
    const rows = await tx
      .insert(schema.items)
      .values({
        canonicalUrl,
        url: item.url,
        externalKind: item.externalKind ?? null,
        externalId: item.externalId ?? null,
        firstSourceId: source.id,
        title: item.title.slice(0, 500),
        authors: item.authors?.length ? item.authors : null,
        publishedAt: item.publishedAt ?? null,
        fetchedAt: now,
        sortAt,
        excerpt: item.excerpt ?? null,
        abstract: item.abstract ?? null,
        domains,
        layer: source.layer,
        kind: source.kind,
        tier: tierFor(domains),
      })
      .onConflictDoNothing()
      .returning(columns);
    if (rows[0]) {
      existing = rows[0];
      inserted = true;
    } else {
      [existing] = await tx.select(columns).from(schema.items).where(match).limit(1);
    }
  } else {
    // Fill gaps a later source knows more about (e.g. HF first, then the arXiv abstract).
    const patch: Partial<typeof schema.items.$inferInsert> = {};
    if (!existing.abstract && item.abstract) patch.abstract = item.abstract;
    if (!existing.excerpt && item.excerpt) patch.excerpt = item.excerpt;
    if (!existing.authors?.length && item.authors?.length) patch.authors = item.authors;
    if (!existing.publishedAt && item.publishedAt) patch.publishedAt = item.publishedAt;
    if (Object.keys(patch).length) {
      await tx.update(schema.items).set(patch).where(eq(schema.items.id, existing.id));
    }
  }
  if (!existing) return false;

  await tx
    .insert(schema.itemMentions)
    .values({
      itemId: existing.id,
      sourceId: source.id,
      seenOn: now.toISOString().slice(0, 10),
      seenAt: now,
      url: item.url,
      signals: item.signals ?? {},
    })
    .onConflictDoUpdate({
      target: [schema.itemMentions.itemId, schema.itemMentions.sourceId, schema.itemMentions.seenOn],
      set: { signals: item.signals ?? {}, seenAt: now },
    });
  return inserted;
}

/** Fetches one source and stores its items. Never throws: failures are recorded on source_state. */
export async function ingestSource(
  source: Source,
  { http = createHttp(), database = db(), now = new Date() }: { http?: Http; database?: Database; now?: Date } = {},
): Promise<SourceRunResult> {
  const started = Date.now();
  const connector = connectorFor(source.method);
  if (!connector) return { sourceId: source.id, ok: true, fetched: 0, inserted: 0, ms: 0 };

  const [stateRow] = await database
    .select()
    .from(schema.sourceState)
    .where(eq(schema.sourceState.sourceId, source.id));
  const state: ConnectorState = {
    cursor: stateRow?.cursor ?? null,
    etag: stateRow?.etag ?? null,
    lastModified: stateRow?.lastModified ?? null,
    data: stateRow?.data ?? {},
  };

  try {
    const config = connector.configSchema.parse(source.config);
    const result = await connector.fetch({ source, config, state, http, now });

    let inserted = 0;
    await database.transaction(async (tx) => {
      for (const item of result.items) {
        if (await upsertItem(tx as unknown as Database, source, item, now)) inserted++;
      }
      await tx
        .update(schema.sourceState)
        .set({
          cursor: result.state?.cursor !== undefined ? result.state.cursor : state.cursor,
          etag: result.state?.etag !== undefined ? result.state.etag : state.etag,
          lastModified: result.state?.lastModified !== undefined ? result.state.lastModified : state.lastModified,
          data: result.state?.data ?? state.data,
          lastRunAt: now,
          lastSuccessAt: now,
          lastError: null,
          consecutiveFailures: 0,
          lastFetchedCount: result.items.length,
          lastNewCount: inserted,
          nextDueAt: new Date(now.getTime() + FREQUENCY_MS[source.frequency]),
        })
        .where(eq(schema.sourceState.sourceId, source.id));
    });
    return { sourceId: source.id, ok: true, fetched: result.items.length, inserted, ms: Date.now() - started };
  } catch (err) {
    const message = errorMessage(err);
    const failures = (stateRow?.consecutiveFailures ?? 0) + 1;
    const backoff = Math.min(MAX_BACKOFF_MS, 15 * 60_000 * 2 ** (failures - 1));
    await database
      .update(schema.sourceState)
      .set({
        lastRunAt: now,
        lastError: message.slice(0, 1000),
        lastErrorAt: now,
        consecutiveFailures: failures,
        nextDueAt: new Date(now.getTime() + backoff),
      })
      .where(eq(schema.sourceState.sourceId, source.id));
    return { sourceId: source.id, ok: false, fetched: 0, inserted: 0, ms: Date.now() - started, error: message };
  }
}

export type IngestOptions = {
  /** Only these sources (still respects nextDueAt unless force). */
  sourceIds?: string[];
  /** Ignore nextDueAt. */
  force?: boolean;
  /** Stop starting new sources after this long (Vercel Hobby functions cap at 300 s). */
  budgetMs?: number;
  concurrency?: number;
};

export async function runIngest(opts: IngestOptions = {}): Promise<IngestResult> {
  const { budgetMs = 240_000, concurrency = 4 } = opts;
  const deadline = Date.now() + budgetMs;
  const database = db();
  await syncSources(database);

  const automatic = registry().sources.filter(
    (s) => s.enabled && s.method !== "manual" && (!opts.sourceIds || opts.sourceIds.includes(s.id)),
  );
  const due = opts.force
    ? automatic
    : await (async () => {
        if (!automatic.length) return [];
        const rows = await database
          .select({ id: schema.sourceState.sourceId })
          .from(schema.sourceState)
          .where(
            and(
              inArray(
                schema.sourceState.sourceId,
                automatic.map((s) => s.id),
              ),
              lte(schema.sourceState.nextDueAt, new Date()),
            ),
          )
          .orderBy(schema.sourceState.nextDueAt);
        const byId = new Map(automatic.map((s) => [s.id, s]));
        return rows.map((r) => byId.get(r.id)!).filter(Boolean);
      })();

  const http = createHttp();
  const queue = [...due];
  const results: SourceRunResult[] = [];
  const skippedForTime: string[] = [];

  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      if (Date.now() > deadline) {
        skippedForTime.push(next.id);
        continue;
      }
      results.push(await ingestSource(next, { http, database }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));

  return { sources: results, skippedForTime, inserted: results.reduce((n, r) => n + r.inserted, 0) };
}
