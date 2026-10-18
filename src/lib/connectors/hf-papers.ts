import { z } from "zod";
import { normalizeArxivId } from "@/lib/pipeline/canonicalize";
import { excerpt, parseDate } from "@/lib/text";
import { defineConnector } from "./types";

const config = z.object({}).default({});

const response = z.array(
  z.object({
    paper: z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string().optional(),
      upvotes: z.number().optional(),
      publishedAt: z.string().optional(),
      authors: z.array(z.object({ name: z.string().optional() })).optional(),
    }),
    publishedAt: z.string().optional(),
    numComments: z.number().optional(),
  }),
);

/** HF Daily Papers are arXiv papers: they dedupe onto the arXiv item and add an upvotes mention. */
export const hfPapersConnector = defineConnector({
  method: "hf-papers",
  configSchema: config,
  async fetch({ http }) {
    const res = await http.get("https://huggingface.co/api/daily_papers", { accept: "application/json" });
    const papers = response.parse(JSON.parse(res.text));
    return {
      items: papers.map(({ paper, publishedAt, numComments }) => {
        const id = normalizeArxivId(paper.id);
        const signals: Record<string, number> = {};
        if (paper.upvotes != null) signals.hf_upvotes = paper.upvotes;
        if (numComments != null) signals.hf_comments = numComments;
        return {
          url: `https://arxiv.org/abs/${id}`,
          externalKind: "arxiv" as const,
          externalId: id,
          title: paper.title.replace(/\s+/g, " ").trim(),
          authors: paper.authors?.flatMap((a) => a.name ?? []).slice(0, 20),
          publishedAt: parseDate(paper.publishedAt ?? publishedAt),
          excerpt: excerpt(paper.summary),
          abstract: paper.summary,
          signals,
        };
      }),
    };
  },
});
