import { z } from "zod";
import { excerpt, parseDate } from "@/lib/text";
import { defineConnector } from "./types";

const config = z.object({
  createdWithinDays: z.number().int().positive().default(30),
  minStars: z.number().int().nonnegative().default(100),
  perPage: z.number().int().positive().max(100).default(50),
});

const response = z.object({
  items: z.array(
    z.object({
      full_name: z.string(),
      html_url: z.url(),
      description: z.string().nullable(),
      stargazers_count: z.number(),
      forks_count: z.number(),
      language: z.string().nullable(),
      created_at: z.string(),
      owner: z.object({ login: z.string() }),
    }),
  ),
});

/** Stand-in for GitHub Trending (no official API): new repos ranked by stars. */
export const githubSearchConnector = defineConnector({
  method: "github-search",
  configSchema: config,
  async fetch({ config, http, now }) {
    const since = new Date(now.getTime() - config.createdWithinDays * 86_400_000).toISOString().slice(0, 10);
    const q = encodeURIComponent(`created:>${since} stars:>=${config.minStars}`);
    const res = await http.get(
      `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${config.perPage}`,
      { accept: "application/vnd.github+json" },
    );
    const { items } = response.parse(JSON.parse(res.text));
    return {
      items: items.map((r) => ({
        url: r.html_url,
        externalKind: "github" as const,
        externalId: r.full_name.toLowerCase(),
        title: r.description ? `${r.full_name}: ${r.description}` : r.full_name,
        authors: [r.owner.login],
        publishedAt: parseDate(r.created_at),
        excerpt: excerpt([r.language, r.description].filter(Boolean).join(" · ")),
        signals: { stars: r.stargazers_count, forks: r.forks_count },
      })),
    };
  },
});
