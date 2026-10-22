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

/** rss-parser gives RSS categories as strings and Atom ones as `{ $: { term } }` objects. */
function categoriesOf(entry: FeedItem): string[] | undefined {
  const raw = (entry.categories ?? []) as unknown[];
  const out = raw.flatMap((c) => {
    if (typeof c === "string") return [c.trim()];
    const o = c as { _?: string; $?: { term?: string } };
    return [o.$?.term ?? o._ ?? ""].map((t) => t.trim());
  });
  const kept = out.filter(Boolean);
  return kept.length ? kept : undefined;
}

/** `creator` is a string, or an object when the feed nests `<author><name>` (e.g. blog.google). */
function authorsOf(entry: FeedItem): string[] | undefined {
  const raw = entry.creator as unknown;
  const o = raw as { name?: unknown } | undefined;
  const name = typeof raw === "string" ? raw : Array.isArray(o?.name) ? o.name[0] : o?.name;
  return typeof name === "string" && name.trim() ? [name.trim()] : undefined;
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
    // Some publishers (e.g. nature.com) answer datacenter IPs with an HTML cookie/bot page.
    if (/^\s*(<!doctype html|<html)/i.test(res.text)) {
      throw new Error(`got an HTML page instead of a feed from ${res.url} (likely a cookie or bot check)`);
    }

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
        // No authors: dc:creator is the HN submitter, not the article's author.
        items.push({ url, title, publishedAt: parseDate(entry.isoDate ?? entry.pubDate), signals });
        continue;
      }

      const body = entry.contentSnippet ?? entry.summary ?? entry["content:encodedSnippet"] ?? entry.content;
      items.push({
        url,
        title,
        publishedAt: parseDate(entry.isoDate ?? entry.pubDate),
        authors: authorsOf(entry),
        excerpt: config.titlesOnly ? undefined : excerpt(body),
        categories: categoriesOf(entry),
      });
    }
    return { items, state: { etag: res.etag ?? null, lastModified: res.lastModified ?? null } };
  },
});
