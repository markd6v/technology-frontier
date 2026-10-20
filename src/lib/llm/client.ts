import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod/v4";
import type { Config } from "@/lib/registry";

export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };

export type LlmRequest = {
  model: string;
  effort: Config["llm"]["assess"]["effort"];
  maxTokens: number;
  /** Identical across calls, so it is cached. */
  system: string;
  user: string;
  schema: z.ZodType;
};

export type LlmResponse = {
  /** The JSON text of the structured output; null when the model returned none. */
  text: string | null;
  stopReason: string | null;
  /** Model that served the response (differs from the request when a fallback ran). */
  model: string;
  usage: Usage;
};

/** The one thing the pipeline needs from the API; tests pass a fake. */
export type LlmClient = { complete(req: LlmRequest): Promise<LlmResponse> };

export function anthropicClient(): LlmClient {
  // Two attempts at most: the hourly job has a 240 s budget and retries next hour anyway.
  const client = new Anthropic({ timeout: 120_000, maxRetries: 1 });
  return {
    async complete(req) {
      // No tools: the model can only return JSON matching the schema (ARCHITECTURE §8.4).
      // Thinking is adaptive by default on current models; effort sets how much.
      const response = await client.beta.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.user }],
        output_config: { effort: req.effort, format: betaZodOutputFormat(req.schema) },
      });
      const text = response.content
        .flatMap((b) => (b.type === "text" ? [b.text] : []))
        .join("");
      const u = response.usage;
      return {
        text: text || null,
        stopReason: response.stop_reason,
        model: response.model,
        usage: {
          input: u.input_tokens,
          output: u.output_tokens,
          cacheRead: u.cache_read_input_tokens ?? 0,
          cacheWrite: u.cache_creation_input_tokens ?? 0,
        },
      };
    },
  };
}

export function costUsd(usage: Usage, price: Config["llm"]["prices"][string]): number {
  return (
    (usage.input * price.input +
      usage.output * price.output +
      usage.cacheRead * price.cacheRead +
      usage.cacheWrite * price.cacheWrite) /
    1_000_000
  );
}
