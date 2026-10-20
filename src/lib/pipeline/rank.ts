import { sql } from "drizzle-orm";
import { db, schema, type Database } from "@/lib/db";
import { registry, type Config, type ScoreWeights } from "@/lib/registry";

export type Scores = Record<keyof ScoreWeights, number>;

/** REQUIREMENTS §7: Σ weight × (score − 1) / 4 × 100, so all-1s → 0 and all-5s → 100. */
export function qualityScore(scores: Scores, weights: ScoreWeights): number {
  let total = 0;
  for (const key of Object.keys(weights) as (keyof ScoreWeights)[]) {
    total += weights[key] * ((scores[key] - 1) / 4);
  }
  return Math.round(total * 100);
}

export type RankInput = {
  quality: number | null;
  relevant: boolean | null;
  /** Distinct sources that reported the item. */
  sources: number;
  hfUpvotes: number;
  /** Priority (1–3) of the item's first source. */
  priority: number;
};

/** What "Top" sorts by: the LLM's quality plus signals the sources themselves give. */
export function rankScore(input: RankInput, cfg: Config["rank"]): number {
  const base = input.quality ?? cfg.unassessed;
  const corroboration = Math.min(cfg.maxSourceBonus, Math.max(0, input.sources - 1) * cfg.perExtraSource);
  const upvotes =
    input.hfUpvotes > 0
      ? Math.min(cfg.maxUpvoteBonus, (cfg.maxUpvoteBonus * Math.log1p(input.hfUpvotes)) / Math.log1p(cfg.upvotesForMax))
      : 0;
  const priority = cfg.sourcePriority[String(input.priority)] ?? 0;
  const relevance = input.relevant === false ? cfg.notRelevant : 0;
  return Math.round((base + corroboration + upvotes + priority + relevance) * 10) / 10;
}

const RECENT_DAYS = 60;

/**
 * Recomputes rank for recent items (and any never ranked). Upvotes and mentions keep changing
 * after an item is stored, so this runs every hour rather than once per item.
 */
export async function rankRecent(database: Database = db(), now = new Date()) {
  const { sources, config } = registry();
  const priority = new Map(sources.map((s) => [s.id, s.priority]));
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000);

  const rows = await database.execute<{
    id: number;
    first_source_id: string;
    quality: number | null;
    relevant: boolean | null;
    sources: number;
    hf_upvotes: number;
  }>(sql`
    select i.id::int as id, i.first_source_id, i.quality, a.relevant,
           (select count(distinct m.source_id)::int from ${schema.itemMentions} m where m.item_id = i.id) as sources,
           (select coalesce(max((m.signals->>'hf_upvotes')::int), 0)::int from ${schema.itemMentions} m where m.item_id = i.id) as hf_upvotes
    from ${schema.items} i
    left join ${schema.itemAssessments} a on a.item_id = i.id
    where i.sort_at >= ${since.toISOString()} or i.rank is null`);

  if (!rows.length) return { ranked: 0 };
  const values = rows.map((r) => {
    const rank = rankScore(
      {
        quality: r.quality,
        relevant: r.relevant,
        sources: r.sources,
        hfUpvotes: r.hf_upvotes,
        priority: priority.get(r.first_source_id) ?? 2,
      },
      config.rank,
    );
    return sql`(${r.id}::bigint, ${rank}::real)`;
  });
  await database.execute(sql`
    update ${schema.items} i set rank = v.rank
    from (values ${sql.join(values, sql`, `)}) as v(id, rank)
    where i.id = v.id and i.rank is distinct from v.rank`);
  return { ranked: rows.length };
}
