import { describe, expect, it } from "vitest";
import { arxivConnector } from "@/lib/connectors/arxiv";
import { biorxivConnector } from "@/lib/connectors/biorxiv";
import { ctgovConnector } from "@/lib/connectors/ctgov";
import { githubSearchConnector } from "@/lib/connectors/github-search";
import { hfPapersConnector } from "@/lib/connectors/hf-papers";
import { extractLinks, extractMeta, MonitorGuardError, pageMonitorConnector } from "@/lib/connectors/page-monitor";
import { parseHnDescription, rssConnector } from "@/lib/connectors/rss";
import { ctx, fakeHttp, fixture } from "./helpers";

const parse = <C>(c: { configSchema: { parse(v: unknown): C } }, v: unknown) => c.configSchema.parse(v);

describe("rss", () => {
  it("parses a regular feed with ≤300-char excerpts", async () => {
    const http = fakeHttp([[/ieee/, fixture("ieee.xml")]]);
    const config = parse(rssConnector, { url: "https://spectrum.ieee.org/feeds/feed.rss" });
    const { items } = await rssConnector.fetch(ctx(config, http));
    expect(items).toHaveLength(3);
    for (const i of items) {
      expect(i.url).toMatch(/^https:\/\/spectrum\.ieee\.org\//);
      expect(i.title.length).toBeGreaterThan(5);
      expect(i.publishedAt).toBeInstanceOf(Date);
      expect((i.excerpt ?? "").length).toBeLessThanOrEqual(300);
    }
  });

  it("titlesOnly drops body text", async () => {
    const http = fakeHttp([[/ieee/, fixture("ieee.xml")]]);
    const config = parse(rssConnector, { url: "https://spectrum.ieee.org/feeds/feed.rss", titlesOnly: true });
    const { items } = await rssConnector.fetch(ctx(config, http));
    expect(items.every((i) => i.excerpt === undefined)).toBe(true);
  });

  it("hn mode links to the article and keeps points as signals", async () => {
    const http = fakeHttp([[/hnrss/, fixture("hn.xml")]]);
    const config = parse(rssConnector, { url: "https://hnrss.org/best", hn: true });
    const { items } = await rssConnector.fetch(ctx(config, http));
    expect(items).toHaveLength(3);
    expect(items[0].url).not.toMatch(/news\.ycombinator\.com/);
    expect(items[0].signals?.hn_points).toBeGreaterThan(0);
  });

  it("parses hnrss descriptions", () => {
    const d = parseHnDescription(
      '<p>Comments URL: <a href="https://news.ycombinator.com/item?id=123">x</a></p><p>Points: 465</p><p># Comments: 274</p>',
    );
    expect(d).toEqual({ points: 465, comments: 274, hnId: "123" });
  });
});

describe("arxiv", () => {
  it("normalizes ids and advances the cursor", async () => {
    const http = fakeHttp([[/export\.arxiv\.org/, fixture("arxiv.xml")]]);
    const config = parse(arxivConnector, { category: "cs.RO", maxResults: 3 });
    const { items, state } = await arxivConnector.fetch(ctx(config, http));
    expect(items).toHaveLength(3);
    for (const i of items) {
      expect(i.externalKind).toBe("arxiv");
      expect(i.externalId).toMatch(/^\d{4}\.\d{4,5}$/);
      expect(i.url).toBe(`https://arxiv.org/abs/${i.externalId}`);
      expect(i.authors?.length).toBeGreaterThan(0);
      expect(i.abstract?.length).toBeGreaterThan(50);
    }
    expect(typeof state?.cursor).toBe("string");

    const again = await arxivConnector.fetch({ ...ctx(config, http), state: { cursor: state!.cursor, etag: null, lastModified: null, data: {} } });
    expect(again.items).toHaveLength(0);
  });
});

describe("hf-papers", () => {
  it("maps papers onto arXiv identity with upvotes", async () => {
    const http = fakeHttp([[/huggingface/, fixture("hf.json")]]);
    const { items } = await hfPapersConnector.fetch(ctx(parse(hfPapersConnector, {}), http));
    expect(items).toHaveLength(3);
    expect(items[0].url).toMatch(/^https:\/\/arxiv\.org\/abs\//);
    expect(items[0].signals?.hf_upvotes).toBeTypeOf("number");
  });
});

describe("github-search", () => {
  it("builds a created:> query and keeps stars", async () => {
    const http = fakeHttp([[/api\.github\.com/, fixture("github.json")]]);
    const { items } = await githubSearchConnector.fetch(ctx(parse(githubSearchConnector, {}), http));
    expect(http.requested[0]).toContain(encodeURIComponent("created:>2026-09-18"));
    expect(items).toHaveLength(3);
    expect(items[0].signals?.stars).toBeGreaterThanOrEqual(100);
    expect(items[0].externalId).toBe(items[0].externalId?.toLowerCase());
  });
});

describe("biorxiv", () => {
  it("queries each category server-side", async () => {
    const http = fakeHttp([[/api\.biorxiv\.org/, fixture("biorxiv.json")]]);
    const config = parse(biorxivConnector, { categories: ["synthetic biology", "genomics"] });
    const { items } = await biorxivConnector.fetch(ctx(config, http));
    expect(http.requested).toHaveLength(2);
    expect(http.requested[0]).toContain("category=synthetic%20biology");
    expect(items).toHaveLength(6); // same fixture served for both categories
    expect(items[0].externalKind).toBe("doi");
  });
});

describe("ctgov", () => {
  it("tags items with per-query domains", async () => {
    const http = fakeHttp([[/clinicaltrials\.gov/, fixture("ctgov.json")]]);
    const config = parse(ctgovConnector, { queries: [{ label: "bci", term: "brain-computer interface", domains: ["neurotech"] }] });
    const { items } = await ctgovConnector.fetch(ctx(config, http));
    expect(items).toHaveLength(3);
    expect(items[0].url).toMatch(/^https:\/\/clinicaltrials\.gov\/study\/NCT\d+$/);
    expect(items[0].domains).toEqual(["neurotech"]);
    const params = new URL(http.requested[0]).searchParams;
    expect(params.get("filter.advanced")).toContain("AREA[Phase](PHASE1 OR PHASE2 OR PHASE3)");
  });
});

describe("page-monitor", () => {
  const config = parse(pageMonitorConnector, {
    listUrl: "https://www.pi.website/blog",
    linkSelector: 'a[href^="/blog/"]',
    allowPrefix: "https://www.pi.website/blog/",
    minLinks: 3,
  });

  it("extracts listing links and article meta", () => {
    const links = extractLinks(fixture("pi-blog.html"), "https://www.pi.website/blog", 'a[href^="/blog/"]', "https://www.pi.website/blog/");
    expect(links.length).toBeGreaterThanOrEqual(3);
    expect(links).toContain("https://pi.website/blog/openpi");
    const meta = extractMeta(fixture("pi-article.html"));
    expect(meta.title).toBe("Open Sourcing π0");
    expect(meta.publishedAt?.toISOString().slice(0, 10)).toBe("2025-02-04");
  });

  it("emits only unseen links and remembers them", async () => {
    const http = fakeHttp([
      [/robots\.txt$/, "User-agent: *\nDisallow:"],
      [/\/blog$/, fixture("pi-blog.html")],
      [/\/blog\/.+/, fixture("pi-article.html")],
    ]);
    const first = await pageMonitorConnector.fetch(ctx(config, http));
    expect(first.items.length).toBeGreaterThanOrEqual(3);
    const data = first.state!.data!;
    const second = await pageMonitorConnector.fetch(ctx(config, http, data));
    expect(second.items).toHaveLength(0);
  });

  it("trips the breakage guard when the selector stops matching", async () => {
    const http = fakeHttp([
      [/robots\.txt$/, ""],
      [/\/blog$/, "<html><body>redesigned</body></html>"],
    ]);
    await expect(pageMonitorConnector.fetch(ctx(config, http))).rejects.toBeInstanceOf(MonitorGuardError);
  });

  it("respects robots.txt", async () => {
    const http = fakeHttp([[/robots\.txt$/, "User-agent: *\nDisallow: /blog"]]);
    await expect(pageMonitorConnector.fetch(ctx(config, http))).rejects.toThrow(/robots\.txt/);
  });
});
