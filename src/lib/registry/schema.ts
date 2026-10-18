import { z } from "zod";

export const TIERS = ["deep", "regular", "broad"] as const;
export const LAYERS = ["scientific", "engineering", "product", "commercial"] as const;
export const KINDS = ["research", "product", "newsletter", "community", "commercial-data"] as const;
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
});

export const referenceSchema = z.object({
  crossDomain: z.array(
    z.object({ pair: z.string(), domains: z.array(z.string()), why: z.string() }),
  ),
  universalSources: z.array(
    z.object({ name: z.string(), url: z.url(), provides: z.string(), advantage: z.string() }),
  ),
  periodicReviews: z.array(link),
  commercialSignals: z.array(
    z.object({ signal: z.string(), sources: z.array(link), tells: z.string() }),
  ),
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

export type Domain = z.infer<typeof domainSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type Person = z.infer<typeof person>;
