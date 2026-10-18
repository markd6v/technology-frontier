import { z } from "zod";
import { excerpt, parseDate } from "@/lib/text";
import { defineConnector, type NormalizedItem } from "./types";

const config = z.object({
  server: z.enum(["biorxiv", "medrxiv"]).default("biorxiv"),
  categories: z.array(z.string()).min(1),
  lookbackDays: z.number().int().positive().default(2),
  maxPages: z.number().int().positive().default(5),
});

const page = z.object({
  messages: z.array(z.object({ status: z.string(), total: z.union([z.string(), z.number()]).optional() })),
  collection: z.array(
    z.object({
      doi: z.string(),
      title: z.string(),
      authors: z.string(),
      date: z.string(),
      version: z.string(),
      category: z.string(),
      abstract: z.string().optional(),
    }),
  ),
});

const day = (d: Date) => d.toISOString().slice(0, 10);

export const biorxivConnector = defineConnector({
  method: "biorxiv",
  configSchema: config,
  async fetch({ config, http, now }) {
    const from = day(new Date(now.getTime() - config.lookbackDays * 86_400_000));
    const to = day(now);
    const items: NormalizedItem[] = [];

    // Server-side category filter: ~2 s per request vs. paging through every new paper.
    for (const category of config.categories) {
      for (let p = 0, cursor = 0; p < config.maxPages; p++) {
        const res = await http.get(
          `https://api.biorxiv.org/details/${config.server}/${from}/${to}/${cursor}/json?category=${encodeURIComponent(category)}`,
          { accept: "application/json" },
        );
        const data = page.parse(JSON.parse(res.text));
        if (data.collection.length === 0) break;
        for (const paper of data.collection) {
          items.push({
            url: `https://www.${config.server}.org/content/${paper.doi}v${paper.version}`,
            externalKind: "doi",
            externalId: paper.doi.toLowerCase(),
            title: paper.title.replace(/\s+/g, " ").trim(),
            authors: paper.authors.split(/;\s*/).filter(Boolean).slice(0, 20),
            publishedAt: parseDate(paper.date),
            excerpt: excerpt(paper.abstract),
            abstract: paper.abstract,
          });
        }
        cursor += data.collection.length;
        const total = Number(data.messages[0]?.total ?? 0);
        if (!total || cursor >= total) break;
      }
    }
    return { items };
  },
});
