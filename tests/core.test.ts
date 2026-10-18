import { describe, expect, it } from "vitest";
import { isAllowedByRobots } from "@/lib/http";
import { arxivIdFromUrl, canonicalizeUrl } from "@/lib/pipeline/canonicalize";
import { passesFilter } from "@/lib/pipeline/ingest";
import { loadRegistry } from "@/lib/registry";
import { excerpt, stripHtml } from "@/lib/text";

describe("canonicalizeUrl", () => {
  it.each([
    ["http://www.Example.com/post/?utm_source=x&utm_medium=y#top", "https://example.com/post"],
    ["https://example.com/a?b=2&a=1&ref=hn", "https://example.com/a?a=1&b=2"],
    ["https://arxiv.org/pdf/2610.21185v2", "https://arxiv.org/abs/2610.21185"],
    ["http://arxiv.org/abs/2610.21185v1", "https://arxiv.org/abs/2610.21185"],
    ["https://arxiv.org/html/2610.21185v3#S2", "https://arxiv.org/abs/2610.21185"],
    ["https://example.com/", "https://example.com/"],
    ["not a url", "not a url"],
  ])("%s → %s", (input, expected) => {
    expect(canonicalizeUrl(input)).toBe(expected);
  });

  it("extracts old-style arXiv ids", () => {
    expect(arxivIdFromUrl("https://arxiv.org/abs/hep-th/9901001v2")).toBe("hep-th/9901001");
  });
});

describe("text", () => {
  it("strips tags and decodes entities", () => {
    expect(stripHtml("<p>A &amp; B&#39;s <b>bold</b>&nbsp;move</p>")).toBe("A & B's bold move");
  });

  it("caps excerpts at 300 chars on a word boundary", () => {
    const long = "word ".repeat(200);
    const e = excerpt(long)!;
    expect(e.length).toBeLessThanOrEqual(300);
    expect(e.endsWith("word…")).toBe(true);
    expect(excerpt("short")).toBe("short");
    expect(excerpt("")).toBeUndefined();
  });
});

describe("robots.txt", () => {
  const robots = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private/\nAllow: /private/ok\n";
  it("applies only the * group, longest match wins", () => {
    expect(isAllowedByRobots(robots, "https://x.com/news/a")).toBe(true);
    expect(isAllowedByRobots(robots, "https://x.com/private/a")).toBe(false);
    expect(isAllowedByRobots(robots, "https://x.com/private/ok/1")).toBe(true);
    expect(isAllowedByRobots("", "https://x.com/anything")).toBe(true);
  });
});

describe("content registry", () => {
  it("loads and cross-validates content/", () => {
    const r = loadRegistry();
    expect(r.domains).toHaveLength(15);
    expect(r.sources.length).toBeGreaterThanOrEqual(20);
    const automatic = r.sources.filter((s) => s.method !== "manual");
    expect(automatic.length).toBeGreaterThanOrEqual(16);
  });
});

describe("source filter", () => {
  const item = (title: string, categories?: string[], url = "https://example.com/a") => ({ url, title, categories });

  it("keeps everything without a filter", () => {
    expect(passesFilter(undefined, item("Anything"))).toBe(true);
  });

  it("matches categories case-insensitively and drops untagged items", () => {
    const f = { categories: ["Research"] };
    expect(passesFilter(f, item("A", ["research"]))).toBe(true);
    expect(passesFilter(f, item("B", ["Company"]))).toBe(false);
    expect(passesFilter(f, item("C"))).toBe(false);
  });

  it("applies include and exclude patterns", () => {
    const f = { includeTitle: "^Introducing", excludeTitle: "\\bads?\\b", excludeUrl: "/team/" };
    expect(passesFilter(f, item("Introducing Claude 5"))).toBe(true);
    expect(passesFilter(f, item("Barclays scales Claude"))).toBe(false);
    expect(passesFilter(f, item("Introducing ads"))).toBe(false);
    expect(passesFilter(f, item("Introducing X", undefined, "https://x.com/research/team/a"))).toBe(false);
  });

  it("the registry's OpenAI release filter drops business posts", () => {
    const f = loadRegistry().sources.find((s) => s.id === "openai-releases")!.filter;
    expect(passesFilter(f, item("Introducing GPT-6.1 Sol", ["Product"]))).toBe(true);
    expect(passesFilter(f, item("ChatGPT Ads expands to Southeast Asia and Taiwan", ["Product"]))).toBe(false);
    expect(passesFilter(f, item("Introducing ChatGPT for Financial Services", ["Product"]))).toBe(false);
    expect(passesFilter(f, item("How Itaú is building generative AI", []))).toBe(false);
  });
});

describe("driverUrl", () => {
  it("drops libpq-only options Neon adds, keeps sslmode", async () => {
    const { driverUrl } = await import("@/lib/db");
    const out = new URL(driverUrl("postgres://u:p@ep-x-pooler.neon.tech/db?sslmode=require&channel_binding=require"));
    expect(out.searchParams.get("sslmode")).toBe("require");
    expect(out.searchParams.has("channel_binding")).toBe(false);
  });
});
