import { gte, sql } from "drizzle-orm";
import { schema, type Database } from "@/lib/db";

export type BudgetCheck = { ok: true } | { ok: false; reason: string };

/**
 * REQUIREMENTS §4 Phase 1: a hard monthly cap, spread over the month. A call may go ahead only if,
 * at its worst-case cost, the month stays under the cap and today stays under 1.5× the daily
 * allowance ((cap − spent before today) ÷ days left, today included). Jobs run one at a time
 * (lib/jobs.ts), so reading the sum and then calling can't race another job.
 */
export async function checkBudget(
  database: Database,
  { worstUsd, capUsd, now = new Date() }: { worstUsd: number; capUsd: number; now?: Date },
): Promise<BudgetCheck> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [row] = await database
    .select({
      month: sql<number>`coalesce(sum(${schema.llmCalls.costUsd}), 0)::float8`,
      today: sql<number>`coalesce(sum(${schema.llmCalls.costUsd}) filter (where ${schema.llmCalls.createdAt} >= ${dayStart.toISOString()}), 0)::float8`,
    })
    .from(schema.llmCalls)
    .where(gte(schema.llmCalls.createdAt, monthStart));
  return budgetDecision({ month: row.month, today: row.today, worstUsd, capUsd, now });
}

export function budgetDecision({
  month,
  today,
  worstUsd,
  capUsd,
  now,
}: {
  month: number;
  today: number;
  worstUsd: number;
  capUsd: number;
  now: Date;
}): BudgetCheck {
  if (month + worstUsd > capUsd) {
    return { ok: false, reason: `monthly cap: $${month.toFixed(2)} of $${capUsd} spent` };
  }
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysLeft = daysInMonth - now.getUTCDate() + 1;
  const allowance = ((capUsd - (month - today)) / daysLeft) * 1.5;
  if (today + worstUsd > allowance) {
    return { ok: false, reason: `daily allowance: $${today.toFixed(2)} of $${allowance.toFixed(2)} spent today` };
  }
  return { ok: true };
}
