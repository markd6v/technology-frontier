import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { LlmClient, LlmResponse } from "./client";

const TIMEOUT_MS = 5 * 60_000;

/** The parts of `claude -p --output-format json` this client reads. */
const resultSchema = z.object({
  subtype: z.string(),
  is_error: z.boolean(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
  total_cost_usd: z.number().optional(),
  usage: z
    .object({
      input_tokens: z.number().default(0),
      output_tokens: z.number().default(0),
      cache_read_input_tokens: z.number().default(0),
      cache_creation_input_tokens: z.number().default(0),
    })
    .optional(),
  modelUsage: z.record(z.string(), z.unknown()).optional(),
});

export type ClaudeCodeResponse = LlmResponse & {
  /** What the CLI says the call would have cost on the API; nothing is billed on a subscription. */
  apiEquivalentUsd: number;
};

/**
 * Runs each request through the local Claude Code CLI in headless mode, so it is covered by the
 * Claude subscription it is logged in with instead of API billing. Only for the owner's own
 * machine (ARCHITECTURE §8.5): the login never goes to Vercel or CI.
 *
 * Same safety posture as the API client (§8.4): no tools, no MCP servers, an empty working
 * directory, and output constrained to the JSON schema.
 */
export function claudeCodeClient({ bin = "claude" }: { bin?: string } = {}): LlmClient {
  return {
    async complete(req): Promise<ClaudeCodeResponse> {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "frontier-assess-"));
      const args = [
        "-p",
        "--model", req.model,
        "--effort", req.effort,
        "--output-format", "json",
        "--json-schema", JSON.stringify(jsonSchema(req.schema)),
        "--system-prompt", req.system,
        "--tools", "",
        "--strict-mcp-config",
        "--no-session-persistence",
      ];
      // An API key in the environment would take precedence over the subscription login.
      const env = { ...process.env };
      delete env.ANTHROPIC_API_KEY;
      delete env.ANTHROPIC_AUTH_TOKEN;
      try {
        const stdout = await run(bin, args, req.user, { cwd, env });
        return parseResult(stdout, req.model);
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
}

/** The CLI's validator only knows draft-07, so drop zod's draft 2020-12 `$schema` marker. */
export function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const out = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete out.$schema;
  return out;
}

export function parseResult(stdout: string, requestedModel: string): ClaudeCodeResponse {
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    throw new Error(`claude CLI printed no JSON result: ${stdout.slice(0, 300)}`);
  }
  const r = resultSchema.parse(json);
  const u = r.usage;
  const models = Object.keys(r.modelUsage ?? {});
  return {
    // The CLI returns structured output through a tool call; a clean finish is "success".
    stopReason: r.subtype === "success" && !r.is_error ? "end_turn" : r.subtype,
    text: r.structured_output !== undefined ? JSON.stringify(r.structured_output) : null,
    model: models.length === 1 ? models[0] : requestedModel,
    usage: {
      input: u?.input_tokens ?? 0,
      output: u?.output_tokens ?? 0,
      cacheRead: u?.cache_read_input_tokens ?? 0,
      cacheWrite: u?.cache_creation_input_tokens ?? 0,
    },
    apiEquivalentUsd: r.total_cost_usd ?? 0,
  };
}

function run(bin: string, args: string[], input: string, opts: { cwd: string; env: NodeJS.ProcessEnv }) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(bin, args, { ...opts, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`claude CLI timed out after ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`could not run ${bin}: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      // The CLI exits non-zero on errors but still prints a JSON result worth reading.
      if (stdout.trim()) resolve(stdout);
      else reject(new Error(`claude CLI exited ${code}: ${stderr.trim().slice(0, 500)}`));
    });
    child.stdin.end(input);
  });
}
