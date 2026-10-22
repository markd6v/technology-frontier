import { z } from "zod";
import { excerpt, parseDate } from "@/lib/text";
import { defineConnector } from "./types";

const config = z
  .object({
    /** Models below this many likes are skipped; they are picked up on a later run if they climb. */
    minLikes: z.number().int().nonnegative().default(150),
    maxAgeDays: z.number().int().positive().default(30),
    /** Size of the trending list the candidates come from. */
    limit: z.number().int().positive().max(1000).default(100),
  })
  .default({ minLikes: 150, maxAgeDays: 30, limit: 100 });

const response = z.array(
  z.object({
    id: z.string(),
    author: z.string().optional(),
    likes: z.number().default(0),
    downloads: z.number().optional(),
    tags: z.array(z.string()).default([]),
    pipeline_tag: z.string().optional(),
    createdAt: z.string(),
  }),
);

/**
 * True for a quantization, adapter or merge of any model, or a fine-tune of another org's model.
 * A fine-tune of the org's own base model (its instruct or turbo variant) is a release in its own right.
 * Exported for tests.
 */
export function isDerivative(id: string, tags: string[]): boolean {
  const org = id.split("/")[0].toLowerCase();
  return tags.some((t) => {
    const m = t.match(/^base_model:(finetune|quantized|adapter|merge):(.+)$/);
    if (!m) return false;
    return m[1] !== "finetune" || m[2].split("/")[0].toLowerCase() !== org;
  });
}

/** New original models on the Hugging Face Hub: open-weight releases from any lab, gated by likes. */
export const hfModelsConnector = defineConnector({
  method: "hf-models",
  configSchema: config,
  async fetch({ config, http, now }) {
    const res = await http.get(`https://huggingface.co/api/models?sort=trendingScore&limit=${config.limit}&full=true`, {
      accept: "application/json",
    });
    const since = now.getTime() - config.maxAgeDays * 86_400_000;
    return {
      items: response
        .parse(JSON.parse(res.text))
        .filter((m) => m.likes >= config.minLikes && Date.parse(m.createdAt) >= since && !isDerivative(m.id, m.tags))
        .map((m) => {
          const license = m.tags.find((t) => t.startsWith("license:"))?.slice("license:".length);
          const signals: Record<string, number> = { hf_likes: m.likes };
          if (m.downloads != null) signals.hf_downloads = m.downloads;
          return {
            url: `https://huggingface.co/${m.id}`,
            title: m.id,
            authors: m.author ? [m.author] : undefined,
            publishedAt: parseDate(m.createdAt),
            excerpt: excerpt([m.pipeline_tag, license && `license ${license}`].filter(Boolean).join(" · ")),
            signals,
          };
        }),
    };
  },
});
