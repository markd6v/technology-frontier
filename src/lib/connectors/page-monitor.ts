import * as cheerio from "cheerio";
import { z } from "zod";
import { isAllowedByRobots, type Http } from "@/lib/http";
import { canonicalizeUrl } from "@/lib/pipeline/canonicalize";
import { excerpt, parseDate, stripHtml } from "@/lib/text";
import { defineConnector, type NormalizedItem } from "./types";

const config = z.object({
  listUrl: z.url(),
  linkSelector: z.string(),
  allowPrefix: z.url(),
  minLinks: z.number().int().positive().default(3),
  /** New links fetched per run (each is one extra request). */
  maxNewPerRun: z.number().int().positive().default(15),
});

type MonitorData = {
  seenLinks?: string[];
  lastLinkCount?: number;
  robots?: { fetchedAt: string; body: string };
};

const SEEN_CAP = 500;
const ROBOTS_TTL_MS = 24 * 3600_000;

export class MonitorGuardError extends Error {}

/** Pulls item links out of a listing page. Exported for tests. */
export function extractLinks(html: string, baseUrl: string, selector: string, allowPrefix: string): string[] {
  const $ = cheerio.load(html);
  const prefix = canonicalizeUrl(allowPrefix);
  const out = new Set<string>();
  $(selector).each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: string;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    const canonical = canonicalizeUrl(abs);
    if (canonical.startsWith(prefix) && canonical !== prefix.replace(/\/$/, "")) out.add(canonical);
  });
  return [...out];
}

/** Title, description and date from an article page's <head>. Exported for tests. */
export function extractMeta(html: string) {
  const $ = cheerio.load(html);
  const meta = (sel: string) => $(sel).attr("content")?.trim() || undefined;
  const title = meta('meta[property="og:title"]') ?? stripHtml($("title").first().text()) ?? undefined;
  const description = meta('meta[property="og:description"]') ?? meta('meta[name="description"]');
  const date =
    meta('meta[property="article:published_time"]') ??
    meta('meta[name="publish_date"]') ??
    meta('meta[name="date"]') ??
    $("time[datetime]").first().attr("datetime");
  return { title: title || undefined, description, publishedAt: parseDate(date) };
}

async function robotsAllows(http: Http, url: string, data: MonitorData, now: Date) {
  let robots = data.robots;
  if (!robots || now.getTime() - new Date(robots.fetchedAt).getTime() > ROBOTS_TTL_MS) {
    let body = "";
    try {
      body = (await http.get(new URL("/robots.txt", url).toString())).text;
    } catch {
      body = ""; // no robots.txt → allowed
    }
    robots = { fetchedAt: now.toISOString(), body };
  }
  return { allowed: isAllowedByRobots(robots.body, url), robots };
}

export const pageMonitorConnector = defineConnector({
  method: "page-monitor",
  configSchema: config,
  async fetch({ config, state, http, now }) {
    const data = state.data as MonitorData;
    const { allowed, robots } = await robotsAllows(http, config.listUrl, data, now);
    if (!allowed) throw new MonitorGuardError(`robots.txt disallows ${config.listUrl}`);

    const res = await http.get(config.listUrl, { accept: "text/html" });
    const links = extractLinks(res.text, res.url, config.linkSelector, config.allowPrefix);

    // Breakage guard (REQUIREMENTS §4): markup changed → error, no items.
    if (links.length < config.minLinks) {
      throw new MonitorGuardError(
        `selector matched ${links.length} links (< minLinks ${config.minLinks}); page markup may have changed`,
      );
    }
    if (data.lastLinkCount && links.length < data.lastLinkCount * 0.2) {
      throw new MonitorGuardError(`link count dropped from ${data.lastLinkCount} to ${links.length}`);
    }

    const firstRun = !data.seenLinks;
    const seen = new Set(data.seenLinks ?? []);
    const fresh = links.filter((l) => !seen.has(l)).slice(0, config.maxNewPerRun);

    const items: NormalizedItem[] = [];
    for (const link of fresh) {
      try {
        const page = await http.get(link, { accept: "text/html" });
        const meta = extractMeta(page.text);
        if (!meta.title) continue;
        items.push({
          url: link,
          title: meta.title,
          publishedAt: meta.publishedAt ?? (firstRun ? undefined : now),
          excerpt: excerpt(meta.description),
        });
        seen.add(link);
      } catch {
        // Leave it unseen; retried next run.
      }
    }

    const seenLinks = [...links.filter((l) => seen.has(l)), ...[...seen].filter((l) => !links.includes(l))].slice(
      0,
      SEEN_CAP,
    );
    return {
      items,
      state: { data: { ...data, robots, seenLinks, lastLinkCount: links.length } satisfies MonitorData },
    };
  },
});
