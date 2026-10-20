import { z } from "zod";

export const TIERS = ["deep", "regular", "broad"] as const;
export const LAYERS = ["scientific", "engineering", "product"] as const;
export const KINDS = ["research", "release", "benchmark", "press"] as const;
export const METHODS = [
  "rss",
  "arxiv",
  "hf-papers",
  "github-search",
  "biorxiv",
  "ctgov",
  "page-monitor",
  "manual",
] as const;
export const FREQUENCIES = ["hourly", "daily", "weekly", "yearly"] as const;

export type Tier = (typeof TIERS)[number];
export type Layer = (typeof LAYERS)[number];
export type Kind = (typeof KINDS)[number];
export type Method = (typeof METHODS)[number];
export type Frequency = (typeof FREQUENCIES)[number];

const link = z.object({
  name: z.string(),
  url: z.url(),
  note: z.string().optional(),
});

const person = z.object({
  name: z.string(),
  focus: z.string(),
  priority: z.boolean().optional(),
  url: z.url().optional(),
});

export const domainSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  short: z.string(),
  tier: z.enum(TIERS),
  relevance: z.string(),
  summary: z.string(),
  subfields: z.array(z.string()),
  research: z.array(link),
  conferences: z.array(z.string()).optional(),
  products: z.array(link),
  people: z.array(person),
  signals: z.array(z.string()),
  notes: z.array(z.string()).optional(),
});

/** Applied to every fetched item before it is stored. Patterns are case-insensitive regexes. */
export const sourceFilterSchema = z.object({
  /** Keep only items tagged with one of these feed categories. */
  categories: z.array(z.string()).min(1).optional(),
  includeTitle: z.string().optional(),
  excludeTitle: z.string().optional(),
  excludeUrl: z.string().optional(),
});

export const sourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  domains: z.array(z.string()).min(1),
  kind: z.enum(KINDS),
  layer: z.enum(LAYERS),
  method: z.enum(METHODS),
  homepage: z.url(),
  frequency: z.enum(FREQUENCIES),
  priority: z.number().int().min(1).max(3),
  reliability: z.string(),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
  filter: sourceFilterSchema.optional(),
});

export const referenceSchema = z.object({
  crossDomain: z.array(
    z.object({ pair: z.string(), domains: z.array(z.string()), why: z.string() }),
  ),
  universalSources: z.array(
    z.object({ name: z.string(), url: z.url(), provides: z.string(), advantage: z.string() }),
  ),
  periodicReviews: z.array(link),
  publications: z.array(
    z.object({
      name: z.string(),
      url: z.url(),
      focus: z.string(),
      priority: z.boolean().optional(),
    }),
  ),
  interpreters: z.array(person.extend({ why: z.string() })),
});

export const topicSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  about: z.string(),
});

/** content/topics.yaml: domain slug → its topics. */
export const topicsSchema = z.record(z.string(), z.array(topicSchema).min(1).max(12));

const usd = z.number().nonnegative();
const scoreWeightsSchema = z.object({
  novelty: z.number().min(0),
  magnitude: z.number().min(0),
  evidence: z.number().min(0),
  breadth: z.number().min(0),
  maturity: z.number().min(0),
});

export const configSchema = z.object({
  scoreWeights: scoreWeightsSchema,
  rank: z.object({
    unassessed: z.number(),
    perExtraSource: z.number(),
    maxSourceBonus: z.number(),
    maxUpvoteBonus: z.number(),
    upvotesForMax: z.number().positive(),
    sourcePriority: z.record(z.string(), z.number()),
    notRelevant: z.number(),
  }),
  llm: z.object({
    monthlyCapUsd: usd,
    assess: z.object({
      model: z.string(),
      effort: z.enum(["low", "medium", "high", "xhigh", "max"]),
      batchSize: z.number().int().min(1).max(50),
      maxTokens: z.number().int().positive(),
    }),
    prices: z.record(z.string(), z.object({ input: usd, output: usd, cacheRead: usd, cacheWrite: usd })),
  }),
});

export type Domain = z.infer<typeof domainSchema>;
export type Topic = z.infer<typeof topicSchema> & { domain: string };
export type Config = z.infer<typeof configSchema>;
export type ScoreWeights = z.infer<typeof scoreWeightsSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type SourceFilter = z.infer<typeof sourceFilterSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type Person = z.infer<typeof person>;
