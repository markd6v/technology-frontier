import Parser from "rss-parser";
import { z } from "zod";
import { normalizeArxivId } from "@/lib/pipeline/canonicalize";
import { excerpt, parseDate, stripHtml } from "@/lib/text";
import { defineConnector, type NormalizedItem } from "./types";

const config = z.object({
  category: z.string(),
  maxResults: z.number().int().positive().max(500).default(100),
});

type Entry = Parser.Item & { id?: string; summary?: string; authors?: { name?: string[] }[] };
const parser = new Parser<Record<string, unknown>, Entry>({
  customFields: { item: [["author", "authors", { keepArray: true }]] },
});

/**
 * arXiv API (not the RSS listing, which is empty on weekends).
 * Cursor = newest `published` timestamp already seen; first run takes whatever the page holds.
 */
export const arxivConnector = defineConnector({
  method: "arxiv",
  configSchema: config,
  async fetch({ config, state, http }) {
    const url =
      `https://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(config.category)}` +
      `&sortBy=submittedDate&sortOrder=descending&max_results=${config.maxResults}`;
    const res = await http.get(url, { accept: "application/atom+xml" });
    const feed = await parser.parseString(res.text);

    const since = typeof state.cursor === "string" ? new Date(state.cursor) : undefined;
    let newest = since;
    const items: NormalizedItem[] = [];

    for (const e of feed.items) {
      const rawId = e.id?.match(/arxiv\.org\/abs\/(.+)$/)?.[1];
      if (!rawId || !e.title) continue;
      const id = normalizeArxivId(rawId);
      const published = parseDate(e.isoDate ?? e.pubDate);
      if (since && published && published <= since) continue;
      if (published && (!newest || published > newest)) newest = published;

      const abstract = e.summary ? stripHtml(e.summary) : undefined;
      items.push({
        url: `https://arxiv.org/abs/${id}`,
        externalKind: "arxiv",
        externalId: id,
        title: stripHtml(e.title),
        authors: e.authors?.flatMap((a) => a.name ?? []).slice(0, 20),
        publishedAt: published,
        excerpt: excerpt(abstract),
        abstract,
      });
    }
    return { items, state: { cursor: newest?.toISOString() ?? state.cursor } };
  },
});
