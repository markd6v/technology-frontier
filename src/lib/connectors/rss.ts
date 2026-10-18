import Parser from "rss-parser";
import { z } from "zod";
import { excerpt, parseDate, stripHtml } from "@/lib/text";
import { defineConnector, type NormalizedItem } from "./types";

const config = z.object({
  url: z.url(),
  maxItems: z.number().int().positive().default(30),
  /** Paywalled sources: keep the title and link only (REQUIREMENTS §2 content rule). */
  titlesOnly: z.boolean().default(false),
  /** hnrss.org: link to the article, keep points/comments as signals. */
  hn: z.boolean().default(false),
});

type FeedItem = Parser.Item & { "content:encodedSnippet"?: string; id?: string; summary?: string };

const parser = new Parser<Record<string, unknown>, FeedItem>({ timeout: 0 });

export function parseHnDescription(html: string | undefined) {
  const text = html ?? "";
  const num = (re: RegExp) => {
    const m = text.match(re);
    return m ? Number(m[1]) : undefined;
  };
  const hnId = text.match(/news\.ycombinator\.com\/item\?id=(\d+)/)?.[1];
  return { points: num(/Points:\s*(\d+)/), comments: num(/#\s*Comments:\s*(\d+)/), hnId };
}

export const rssConnector = defineConnector({
  method: "rss",
  configSchema: config,
  async fetch({ config, state, http }) {
    const res = await http.get(config.url, {
      etag: state.etag,
      lastModified: state.lastModified,
      accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
    });
    if (res.notModified) return { items: [] };

    const feed = await parser.parseString(res.text);
    const items: NormalizedItem[] = [];
    for (const entry of feed.items.slice(0, config.maxItems)) {
      const url = entry.link?.trim();
      const title = entry.title ? stripHtml(entry.title) : undefined;
      if (!url || !title) continue;

      if (config.hn) {
        const hn = parseHnDescription(entry.content ?? entry.contentSnippet);
        const signals: Record<string, number> = {};
        if (hn.points != null) signals.hn_points = hn.points;
        if (hn.comments != null) signals.hn_comments = hn.comments;
        items.push({
          url,
          title,
          publishedAt: parseDate(entry.isoDate ?? entry.pubDate),
          authors: entry.creator ? [entry.creator] : undefined,
          signals,
        });
        continue;
      }

      const body = entry.contentSnippet ?? entry.summary ?? entry["content:encodedSnippet"] ?? entry.content;
      items.push({
        url,
        title,
        publishedAt: parseDate(entry.isoDate ?? entry.pubDate),
        authors: entry.creator ? [entry.creator] : undefined,
        excerpt: config.titlesOnly ? undefined : excerpt(body),
      });
    }
    return { items, state: { etag: res.etag ?? null, lastModified: res.lastModified ?? null } };
  },
});
