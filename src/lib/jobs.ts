import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assessItems } from "@/lib/pipeline/assess";
import { pruneItems, runIngest, syncSources } from "@/lib/pipeline/ingest";
import { rankRecent } from "@/lib/pipeline/rank";

/** Vercel Hobby functions stop at 300 s; nothing new starts after this. */
const HOURLY_BUDGET_MS = 240_000;
/** An assess request can take a minute, so ingest leaves it this much of the budget. */
const ASSESS_RESERVE_MS = 90_000;

export type JobArgs = { sourceIds?: string[]; force?: boolean; limit?: number; retag?: boolean; dryRun?: boolean };

export const JOBS = {
  /** Hourly (GitHub Actions): fetch due sources, assess what's new, re-rank. */
  hourly: async (args: JobArgs) => {
    const deadline = Date.now() + HOURLY_BUDGET_MS;
    const ingest = await runIngest({ ...args, budgetMs: HOURLY_BUDGET_MS - ASSESS_RESERVE_MS });
    const assess = await assessItems({ deadline: deadline - 60_000 });
    const rank = await rankRecent();
    return { ingest, assess, rank };
  },
  /** Fetch only (the daily Vercel safety net, and local runs). */
  ingest: async (args: JobArgs) => runIngest(args),
  /** Assess unassessed items; `retag` also redoes those from older prompt versions. */
  assess: async (args: JobArgs) => {
    const assess = await assessItems({ limit: args.limit, retag: args.retag, dryRun: args.dryRun });
    return { assess, rank: args.dryRun ? undefined : await rankRecent() };
  },
  rank: async () => rankRecent(),
  /** Daily (Vercel Cron): registry sync, then drop items of removed sources. */
  maintenance: async () => ({ sources: await syncSources(), ...(await pruneItems()) }),
} as const;

export type JobName = keyof typeof JOBS;

export function isJobName(name: string): name is JobName {
  return Object.hasOwn(JOBS, name);
}

/** Stale "running" rows older than this don't block a new run (the function was killed). */
const LOCK_TTL_MS = 6 * 60_000;

/**
 * Runs a job with a job_runs record. Skips if the same job is already running —
 * a row lock instead of advisory locks, because Neon's pooler doesn't keep sessions.
 */
export async function runJob(name: JobName, trigger: string, args: JobArgs = {}) {
  const database = db();
  const running = await database
    .select({ id: schema.jobRuns.id })
    .from(schema.jobRuns)
    .where(
      and(
        eq(schema.jobRuns.job, name),
        eq(schema.jobRuns.status, "running"),
        gt(schema.jobRuns.startedAt, new Date(Date.now() - LOCK_TTL_MS)),
      ),
    )
    .limit(1);
  if (running.length) return { skipped: true as const, reason: `job ${name} already running (#${running[0].id})` };

  const [run] = await database.insert(schema.jobRuns).values({ job: name, trigger }).returning();
  try {
    const stats = await JOBS[name](args);
    await database
      .update(schema.jobRuns)
      .set({ status: "ok", finishedAt: new Date(), stats: stats as Record<string, unknown> })
      .where(eq(schema.jobRuns.id, run.id));
    return { skipped: false as const, runId: run.id, stats };
  } catch (err) {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    await database
      .update(schema.jobRuns)
      .set({ status: "failed", finishedAt: new Date(), error: message.slice(0, 4000) })
      .where(eq(schema.jobRuns.id, run.id));
    throw err;
  }
}
