import { and, arrayOverlaps, count, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db, schema } from "@/lib/db";
import { registry } from "@/lib/registry";

const REVALIDATE = 300;
const { items, itemMentions, itemAssessments, sourceState } = schema;

export type FeedFilters = {
  domain?: string;
  layer?: string;
  kind?: string;
  source?: string;
  tag?: string;
  q?: string;
  /** "top" sorts by rank within the last `days` (all time if unset). */
  sort?: "newest" | "top";
  days?: number;
  page?: number;
  /** Rows per page; defaults to PAGE_SIZE. */
  limit?: number;
  /** Include off-topic and low-scoring items (config feed.minQuality), which lists hide by default. */
  all?: boolean;
};

export type FeedItem = {
  id: number;
  url: string;
  title: string;
  excerpt: string | null;
  authors: string[] | null;
  sortAt: string;
  domains: string[];
  layer: string;
  kind: string;
  firstSourceId: string;
  tags: string[];
  quality: number | null;
  rank: number | null;
  /** LLM-written; render as plain text only. */
  takeaway: string | null;
  relevant: boolean | null;
  contribution: string | null;
  mentions: { sourceId: string; signals: Record<string, number> }[];
};

export const PAGE_SIZE = 40;

/** Not marked off-topic, and not assessed below feed.minQuality. Unassessed items stay visible. */
function visible(): SQL {
  return sql`(${items.quality} is null or ${items.quality} >= ${registry().config.feed.minQuality})
    and not exists (select 1 from ${itemAssessments} a where a.item_id = ${items.id} and a.relevant = false)`;
}

function where(f: FeedFilters): SQL | undefined {
  const conds: SQL[] = [];
  if (f.domain) conds.push(arrayOverlaps(items.domains, [f.domain]));
  if (f.layer) conds.push(eq(items.layer, f.layer));
  if (f.kind) conds.push(eq(items.kind, f.kind));
  if (f.tag) conds.push(arrayOverlaps(items.tags, [f.tag]));
  if (f.sort === "top" && f.days) conds.push(gte(items.sortAt, new Date(Date.now() - f.days * 86_400_000)));
  if (f.source) {
    conds.push(
      sql`exists (select 1 from ${itemMentions} m where m.item_id = ${items.id} and m.source_id = ${f.source})`,
    );
  }
  if (f.q?.trim()) conds.push(sql`${items.search} @@ websearch_to_tsquery('english', ${f.q.trim()})`);
  if (!f.all) conds.push(visible());
  return conds.length ? and(...conds) : undefined;
}

async function attachMentions(rows: Omit<FeedItem, "mentions">[]): Promise<FeedItem[]> {
  if (!rows.length) return [];
  // Latest signals per (item, source).
  const mentions = await db()
    .selectDistinctOn([itemMentions.itemId, itemMentions.sourceId], {
      itemId: itemMentions.itemId,
      sourceId: itemMentions.sourceId,
      signals: itemMentions.signals,
    })
    .from(itemMentions)
    .where(
      inArray(
        itemMentions.itemId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(itemMentions.itemId, itemMentions.sourceId, desc(itemMentions.seenAt));
  const byItem = new Map<number, FeedItem["mentions"]>();
  for (const m of mentions) {
    const list = byItem.get(m.itemId) ?? [];
    list.push({ sourceId: m.sourceId, signals: m.signals });
    byItem.set(m.itemId, list);
  }
  return rows.map((r) => ({
    ...r,
    mentions: (byItem.get(r.id) ?? []).sort((a, b) =>
      a.sourceId === r.firstSourceId ? -1 : b.sourceId === r.firstSourceId ? 1 : 0,
    ),
  }));
}

const feedColumns = {
  id: items.id,
  url: items.url,
  title: items.title,
  excerpt: items.excerpt,
  authors: items.authors,
  sortAt: sql<string>`${items.sortAt}`,
  domains: items.domains,
  layer: items.layer,
  kind: items.kind,
  firstSourceId: items.firstSourceId,
  tags: items.tags,
  quality: items.quality,
  rank: items.rank,
  takeaway: itemAssessments.takeaway,
  relevant: itemAssessments.relevant,
  contribution: itemAssessments.contribution,
};

const withAssessment = sql`${itemAssessments.itemId} = ${items.id}`;
const newestFirst = [desc(items.sortAt), desc(items.id)];
const topFirst = [sql`${items.rank} desc nulls last`, ...newestFirst];

export const getFeed = unstable_cache(
  /** `hidden` counts the items these filters match that are left out because `all` is unset. */
  async (f: FeedFilters): Promise<{ items: FeedItem[]; total: number; hidden: number }> => {
    const page = Math.max(1, f.page ?? 1);
    const limit = f.limit ?? PAGE_SIZE;
    const filter = where(f);
    const [rows, [{ total, matching }]] = await Promise.all([
      db()
        .select(feedColumns)
        .from(items)
        .leftJoin(itemAssessments, withAssessment)
        .where(filter)
        .orderBy(...(f.sort === "top" ? topFirst : newestFirst))
        .limit(limit)
        .offset((page - 1) * limit),
      db()
        .select({
          total: f.all ? count() : sql<number>`(count(*) filter (where ${visible()}))::int`,
          matching: count(),
        })
        .from(items)
        .where(where({ ...f, all: true })),
    ]);
    return { items: await attachMentions(rows), total, hidden: matching - total };
  },
  ["feed"],
  { revalidate: REVALIDATE, tags: ["items"] },
);

export const getLatestByDomain = unstable_cache(
  async (slugs: string[], perDomain: number): Promise<Record<string, FeedItem[]>> => {
    const out: Record<string, FeedItem[]> = {};
    await Promise.all(
      slugs.map(async (slug) => {
        const rows = await db()
          .select(feedColumns)
          .from(items)
          .leftJoin(itemAssessments, withAssessment)
          .where(arrayOverlaps(items.domains, [slug]))
          .orderBy(...newestFirst)
          .limit(perDomain);
        out[slug] = await attachMentions(rows);
      }),
    );
    return out;
  },
  ["latest-by-domain"],
  { revalidate: REVALIDATE, tags: ["items"] },
);

export type SourceHealth = {
  sourceId: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  lastFetchedCount: number | null;
  lastNewCount: number | null;
  nextDueAt: string;
  items7d: number;
};

export const getSourceHealth = unstable_cache(
  async (): Promise<Record<string, SourceHealth>> => {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [states, counts] = await Promise.all([
      db().select().from(sourceState),
      db()
        .select({ sourceId: itemMentions.sourceId, n: sql<number>`count(distinct ${itemMentions.itemId})::int` })
        .from(itemMentions)
        .where(gte(itemMentions.seenAt, since))
        .groupBy(itemMentions.sourceId),
    ]);
    const countBy = new Map(counts.map((c) => [c.sourceId, c.n]));
    const iso = (d: Date | null) => (d ? d.toISOString() : null);
    return Object.fromEntries(
      states.map((s) => [
        s.sourceId,
        {
          sourceId: s.sourceId,
          lastRunAt: iso(s.lastRunAt),
          lastSuccessAt: iso(s.lastSuccessAt),
          lastError: s.lastError,
          consecutiveFailures: s.consecutiveFailures,
          lastFetchedCount: s.lastFetchedCount,
          lastNewCount: s.lastNewCount,
          nextDueAt: s.nextDueAt.toISOString(),
          items7d: countBy.get(s.sourceId) ?? 0,
        },
      ]),
    );
  },
  ["source-health"],
  { revalidate: REVALIDATE, tags: ["sources", "items"] },
);

export const getTotals = unstable_cache(
  async () => {
    const dayAgo = new Date(Date.now() - 86_400_000);
    const [[all], [today], [multi]] = await Promise.all([
      db().select({ n: count() }).from(items),
      db().select({ n: count() }).from(items).where(gte(items.fetchedAt, dayAgo)),
      db()
        .select({ n: sql<number>`count(*)::int` })
        .from(
          sql`(select item_id from ${itemMentions} group by item_id having count(distinct source_id) > 1) x`,
        ),
    ]);
    return { items: all.n, last24h: today.n, multiSource: multi.n };
  },
  ["totals"],
  { revalidate: REVALIDATE, tags: ["items"] },
);

export type BoardCell = { n: number; topTitle: string };

/**
 * Items per domain × layer over the last `days`, with the top-ranked headline in each cell.
 * Counts only what lists show by default (see `visible`).
 */
export const getLayerBoard = unstable_cache(
  async (days: number): Promise<Record<string, Record<string, BoardCell>>> => {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await db().execute<{ domain: string; layer: string; n: number; top_title: string }>(sql`
      with recent as (
        select unnest(i.domains) as domain, i.layer, i.title, i.sort_at, i.rank,
               (select count(distinct m.source_id) from ${itemMentions} m where m.item_id = i.id) as srcs
        from ${items} i
        where i.sort_at >= ${since.toISOString()}
          and (i.quality is null or i.quality >= ${registry().config.feed.minQuality})
          and not exists (select 1 from ${itemAssessments} a where a.item_id = i.id and a.relevant = false)
      )
      select domain, layer, count(*)::int as n,
             (array_agg(title order by rank desc nulls last, srcs desc, sort_at desc))[1] as top_title
      from recent
      group by domain, layer`);
    const out: Record<string, Record<string, BoardCell>> = {};
    for (const r of rows) (out[r.domain] ??= {})[r.layer] = { n: r.n, topTitle: r.top_title };
    return out;
  },
  ["layer-board"],
  { revalidate: REVALIDATE, tags: ["items"] },
);

/** Items per tag over the last `days`, most used first; optionally within one domain. */
export const getTagCounts = unstable_cache(
  async (days: number, domain?: string): Promise<{ tag: string; n: number }[]> => {
    const since = new Date(Date.now() - days * 86_400_000);
    const conds = [gte(items.sortAt, since)];
    if (domain) conds.push(arrayOverlaps(items.domains, [domain]));
    const rows = await db()
      .select({ tag: sql<string>`unnest(${items.tags})`, n: count() })
      .from(items)
      .where(and(...conds))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`, sql`1`);
    return rows;
  },
  ["tag-counts"],
  { revalidate: REVALIDATE, tags: ["items"] },
);

export type SourceQuality = { assessed: number; avgQuality: number | null; relevantShare: number | null };

/** Per first source over the last `days`: how much of what it brings in is worth reading. */
export const getSourceQuality = unstable_cache(
  async (days: number): Promise<Record<string, SourceQuality>> => {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await db()
      .select({
        sourceId: items.firstSourceId,
        assessed: sql<number>`count(${itemAssessments.itemId})::int`,
        avgQuality: sql<number | null>`round(avg(${itemAssessments.quality}))::int`,
        relevantShare: sql<number | null>`avg(case when ${itemAssessments.relevant} then 1.0 else 0.0 end)::float8`,
      })
      .from(items)
      .innerJoin(itemAssessments, withAssessment)
      .where(gte(items.sortAt, since))
      .groupBy(items.firstSourceId);
    return Object.fromEntries(rows.map(({ sourceId, ...q }) => [sourceId, q]));
  },
  ["source-quality"],
  { revalidate: REVALIDATE, tags: ["items"] },
);

/** Assessment backlog and the topics the model asked for that content/topics.yaml lacks. */
export const getAssessStatus = unstable_cache(
  async () => {
    const [[{ unassessed }], proposed] = await Promise.all([
      db()
        .select({ unassessed: count() })
        .from(items)
        .leftJoin(itemAssessments, withAssessment)
        .where(sql`${itemAssessments.itemId} is null`),
      db()
        .select({ topic: sql<string>`unnest(${itemAssessments.proposedTopics})`, n: count() })
        .from(itemAssessments)
        .groupBy(sql`1`)
        .orderBy(sql`2 desc`, sql`1`)
        .limit(20),
    ]);
    return { unassessed, proposed };
  },
  ["assess-status"],
  { revalidate: REVALIDATE, tags: ["items"] },
);
