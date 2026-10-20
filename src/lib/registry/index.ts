import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { connectorFor } from "@/lib/connectors";
import {
  configSchema,
  domainSchema,
  referenceSchema,
  sourceSchema,
  topicsSchema,
  type Config,
  type Domain,
  type Reference,
  type Source,
  type Topic,
} from "./schema";

export * from "./schema";

const CONTENT_DIR = path.join(process.cwd(), "content");

function readYaml(file: string): unknown {
  return parse(fs.readFileSync(path.join(CONTENT_DIR, file), "utf8"));
}

export type Registry = {
  domains: Domain[];
  sources: Source[];
  reference: Reference;
  topics: Topic[];
  config: Config;
};

/** Loads and cross-validates everything in content/. Throws with every problem found. */
export function loadRegistry(): Registry {
  const domains = z.array(domainSchema).parse(readYaml("domains.yaml"));
  const sources = z.array(sourceSchema).parse(readYaml("sources.yaml"));
  const reference = referenceSchema.parse(readYaml("reference.yaml"));
  const topics = Object.entries(topicsSchema.parse(readYaml("topics.yaml"))).flatMap(([domain, list]) =>
    list.map((t) => ({ ...t, domain })),
  );
  const config = configSchema.parse(readYaml("config.yaml"));

  const problems: string[] = [];
  const slugs = new Set(domains.map((d) => d.slug));
  const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

  for (const t of dupes(topics.map((t) => t.slug))) problems.push(`duplicate topic slug: ${t}`);
  for (const d of new Set(topics.map((t) => t.domain))) {
    if (!slugs.has(d)) problems.push(`topics.yaml: unknown domain "${d}"`);
  }
  for (const d of slugs) {
    if (!topics.some((t) => t.domain === d)) problems.push(`topics.yaml: domain "${d}" has no topics`);
  }
  const weightSum = Object.values(config.scoreWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1) > 1e-6) problems.push(`config.yaml: scoreWeights sum to ${weightSum}, not 1`);
  if (!config.llm.prices[config.llm.assess.model]) {
    problems.push(`config.yaml: no price for assess model "${config.llm.assess.model}"`);
  }

  for (const d of dupes(domains.map((d) => d.slug))) problems.push(`duplicate domain slug: ${d}`);
  for (const s of dupes(sources.map((s) => s.id))) problems.push(`duplicate source id: ${s}`);

  for (const s of sources) {
    for (const d of s.domains) {
      if (!slugs.has(d)) problems.push(`source ${s.id}: unknown domain "${d}"`);
    }
    for (const [key, pattern] of Object.entries(s.filter ?? {})) {
      if (typeof pattern !== "string") continue;
      try {
        new RegExp(pattern, "i");
      } catch {
        problems.push(`source ${s.id}: filter.${key} is not a valid regex`);
      }
    }
    const connector = connectorFor(s.method);
    if (connector) {
      const result = connector.configSchema.safeParse(s.config);
      if (!result.success) {
        problems.push(`source ${s.id}: invalid ${s.method} config: ${z.prettifyError(result.error)}`);
      }
    }
  }
  for (const c of reference.crossDomain) {
    for (const d of c.domains) {
      if (!slugs.has(d)) problems.push(`crossDomain "${c.pair}": unknown domain "${d}"`);
    }
  }

  if (problems.length) {
    throw new Error(`content/ registry is invalid:\n- ${problems.join("\n- ")}`);
  }
  return { domains, sources, reference, topics, config };
}

let cached: Registry | undefined;

export function registry(): Registry {
  cached ??= loadRegistry();
  return cached;
}

export function getDomain(slug: string): Domain | undefined {
  return registry().domains.find((d) => d.slug === slug);
}

export function getSource(id: string): Source | undefined {
  return registry().sources.find((s) => s.id === id);
}
