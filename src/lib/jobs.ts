import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { pruneItems, runIngest, syncSources } from "@/lib/pipeline/ingest";

export const JOBS = {
  /** Hourly (GitHub Actions): fetch every source that is due. */
  ingest: async (args: { sourceIds?: string[]; force?: boolean }) => runIngest(args),
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
export async function runJob(name: JobName, trigger: string, args: Record<string, unknown> = {}) {
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
    const stats = await JOBS[name](args as never);
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
