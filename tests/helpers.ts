import fs from "node:fs";
import path from "node:path";
import type { ConnectorContext } from "@/lib/connectors/types";
import type { Http } from "@/lib/http";
import { sourceSchema, type Source } from "@/lib/registry/schema";

export const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");

/** Fake Http: first route whose pattern matches the URL answers; records requested URLs. */
export function fakeHttp(routes: [RegExp, string][]): Http & { requested: string[] } {
  const requested: string[] = [];
  return {
    requested,
    async get(url) {
      requested.push(url);
      const hit = routes.find(([re]) => re.test(url));
      if (!hit) throw new Error(`no fixture for ${url}`);
      return { status: 200, url, text: hit[1], notModified: false };
    },
  };
}

export function testSource(overrides: Partial<Source> = {}): Source {
  return sourceSchema.parse({
    id: "test",
    name: "Test",
    domains: ["ai"],
    kind: "research",
    layer: "scientific",
    method: "rss",
    homepage: "https://example.com",
    frequency: "daily",
    priority: 1,
    reliability: "test",
    ...overrides,
  });
}

export function ctx<C>(config: C, http: Http, data: Record<string, unknown> = {}): ConnectorContext<C> {
  return {
    source: testSource(),
    config,
    http,
    now: new Date("2026-10-18T08:00:00Z"),
    state: { cursor: null, etag: null, lastModified: null, data },
  };
}
