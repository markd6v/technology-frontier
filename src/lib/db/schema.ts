import { sql, type SQL } from "drizzle-orm";
import {
  bigserial,
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const tstz = (name: string) => timestamp(name, { withTimezone: true });

/** Mirror of content/sources.yaml, synced on every ingest run. */
export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull(),
  method: text("method").notNull(),
  kind: text("kind").notNull(),
  layer: text("layer").notNull(),
  domains: text("domains").array().notNull(),
  frequency: text("frequency").notNull(),
  config: jsonb("config").notNull(),
  configHash: text("config_hash").notNull(),
  inRegistry: boolean("in_registry").notNull().default(true),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

export const sourceState = pgTable("source_state", {
  sourceId: text("source_id")
    .primaryKey()
    .references(() => sources.id),
  cursor: jsonb("cursor"),
  etag: text("etag"),
  lastModified: text("last_modified"),
  lastRunAt: tstz("last_run_at"),
  lastSuccessAt: tstz("last_success_at"),
  lastError: text("last_error"),
  lastErrorAt: tstz("last_error_at"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lastFetchedCount: integer("last_fetched_count"),
  lastNewCount: integer("last_new_count"),
  nextDueAt: tstz("next_due_at").notNull().defaultNow(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
});

export const items = pgTable(
  "items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    canonicalUrl: text("canonical_url").notNull(),
    url: text("url").notNull(),
    externalKind: text("external_kind"),
    externalId: text("external_id"),
    firstSourceId: text("first_source_id")
      .notNull()
      .references(() => sources.id),
    title: text("title").notNull(),
    authors: text("authors").array(),
    publishedAt: tstz("published_at"),
    fetchedAt: tstz("fetched_at").notNull().defaultNow(),
    /** published_at clamped to fetched_at; what the feed sorts by. */
    sortAt: tstz("sort_at").notNull(),
    excerpt: text("excerpt"),
    abstract: text("abstract"),
    /** The assessment's domains once assessed; the source's before that. */
    domains: text("domains").array().notNull(),
    /** What the first source (or connector) said, kept so an assessment can be undone. */
    sourceDomains: text("source_domains").array().notNull(),
    layer: text("layer").notNull(),
    kind: text("kind").notNull(),
    tier: text("tier").notNull(),
    status: text("status").notNull().default("new"),
    /** Topic slugs from content/topics.yaml, copied from item_assessments. */
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    /** 0–100 from the R§7 scores; null until assessed. */
    quality: smallint("quality"),
    /** Quality plus corroboration and source signals (pipeline/rank.ts); what "Top" sorts by. */
    rank: real("rank"),
    search: tsvector("search").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('english', coalesce(${items.title}, '') || ' ' || coalesce(${items.excerpt}, '') || ' ' || coalesce(${items.abstract}, ''))`,
    ),
  },
  (t) => [
    uniqueIndex("items_canonical_url_uq").on(t.canonicalUrl),
    uniqueIndex("items_external_uq")
      .on(t.externalKind, t.externalId)
      .where(sql`${t.externalId} is not null`),
    index("items_sort_at_idx").on(t.sortAt.desc()),
    index("items_domains_idx").using("gin", t.domains),
    index("items_search_idx").using("gin", t.search),
    index("items_first_source_idx").on(t.firstSourceId, t.sortAt.desc()),
    index("items_tags_idx").using("gin", t.tags),
    index("items_rank_idx").on(t.rank.desc()),
  ],
);

/** One Claude API call, with what it cost. Sums of cost_usd enforce the monthly cap. */
export const llmCalls = pgTable(
  "llm_calls",
  {
    id: serial("id").primaryKey(),
    purpose: text("purpose").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    status: text("status").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6, mode: "number" }).notNull().default(0),
    itemCount: integer("item_count").notNull().default(0),
    error: text("error"),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [index("llm_calls_created_idx").on(t.createdAt.desc())],
);

/** The LLM's reading of one item (ARCHITECTURE §7.2). Re-written when the prompt version changes. */
export const itemAssessments = pgTable(
  "item_assessments",
  {
    itemId: bigint("item_id", { mode: "number" })
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    assessedAt: tstz("assessed_at").notNull().defaultNow(),
    relevant: boolean("relevant").notNull(),
    domains: text("domains").array().notNull(),
    topics: text("topics").array().notNull(),
    proposedTopics: text("proposed_topics").array().notNull(),
    contribution: text("contribution").notNull(),
    artifacts: text("artifacts").array().notNull(),
    novelty: smallint("novelty").notNull(),
    magnitude: smallint("magnitude").notNull(),
    evidence: smallint("evidence").notNull(),
    breadth: smallint("breadth").notNull(),
    maturity: smallint("maturity").notNull(),
    quality: smallint("quality").notNull(),
    takeaway: text("takeaway").notNull(),
    rationale: text("rationale").notNull(),
    llmCallId: integer("llm_call_id").references(() => llmCalls.id),
  },
  (t) => [index("item_assessments_version_idx").on(t.promptVersion)],
);

/** Every time a source reports an item: same paper via arXiv + HF + HN = 1 item, 3 mentions. */
export const itemMentions = pgTable(
  "item_mentions",
  {
    itemId: bigint("item_id", { mode: "number" })
      .notNull()
      .references(() => items.id),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    seenOn: date("seen_on").notNull(),
    seenAt: tstz("seen_at").notNull().defaultNow(),
    url: text("url").notNull(),
    signals: jsonb("signals").$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.sourceId, t.seenOn] }),
    index("item_mentions_source_idx").on(t.sourceId, t.seenAt.desc()),
  ],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: serial("id").primaryKey(),
    job: text("job").notNull(),
    trigger: text("trigger").notNull(),
    startedAt: tstz("started_at").notNull().defaultNow(),
    finishedAt: tstz("finished_at"),
    status: text("status").notNull().default("running"),
    stats: jsonb("stats").$type<Record<string, unknown>>().notNull().default({}),
    error: text("error"),
  },
  (t) => [index("job_runs_job_idx").on(t.job, t.startedAt.desc())],
);

export type ItemRow = typeof items.$inferSelect;
export type SourceStateRow = typeof sourceState.$inferSelect;
export type ItemAssessmentRow = typeof itemAssessments.$inferSelect;
