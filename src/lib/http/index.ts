export const USER_AGENT =
  "TechnologyFrontierRadar/0.1 (+https://github.com/markdorof/technology-frontier)";

export type FetchResult = {
  status: number;
  url: string;
  text: string;
  etag?: string;
  lastModified?: string;
  notModified: boolean;
};

export type Http = {
  get(
    url: string,
    opts?: { etag?: string | null; lastModified?: string | null; accept?: string },
  ): Promise<FetchResult>;
};

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polite fetch: identifies itself, times out, honours conditional GET, retries once on 5xx/429. */
export function createHttp({ timeoutMs = 20_000 } = {}): Http {
  return {
    async get(url, opts = {}) {
      const headers: Record<string, string> = { "user-agent": USER_AGENT };
      if (opts.accept) headers.accept = opts.accept;
      if (opts.etag) headers["if-none-match"] = opts.etag;
      if (opts.lastModified) headers["if-modified-since"] = opts.lastModified;

      for (let attempt = 0; ; attempt++) {
        const res = await fetch(url, {
          headers,
          redirect: "follow",
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
        if ((res.status >= 500 || res.status === 429) && attempt === 0) {
          const retryAfter = Number(res.headers.get("retry-after"));
          await sleep(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000, 10_000));
          continue;
        }
        if (res.status === 304) {
          return { status: 304, url: res.url || url, text: "", notModified: true };
        }
        if (!res.ok) throw new HttpError(res.status, url);
        return {
          status: res.status,
          url: res.url || url,
          text: await res.text(),
          etag: res.headers.get("etag") ?? undefined,
          lastModified: res.headers.get("last-modified") ?? undefined,
          notModified: false,
        };
      }
    },
  };
}

/** Minimal robots.txt check for `User-agent: *` Disallow rules (enough for page monitors). */
export function isAllowedByRobots(robotsTxt: string, url: string): boolean {
  const pathname = new URL(url).pathname;
  let applies = false;
  const disallow: string[] = [];
  const allow: string[] = [];
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, key, value] = m;
    const k = key.toLowerCase();
    if (k === "user-agent") applies = value.trim() === "*";
    else if (applies && k === "disallow" && value) disallow.push(value.trim());
    else if (applies && k === "allow" && value) allow.push(value.trim());
  }
  const longest = (rules: string[]) =>
    Math.max(-1, ...rules.filter((r) => pathname.startsWith(r.replace(/\*.*$/, ""))).map((r) => r.length));
  return longest(allow) >= longest(disallow);
}
