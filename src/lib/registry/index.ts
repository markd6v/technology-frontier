import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { connectorFor } from "@/lib/connectors";
import {
  domainSchema,
  referenceSchema,
  sourceSchema,
  type Domain,
  type Reference,
  type Source,
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
};

/** Loads and cross-validates everything in content/. Throws with every problem found. */
export function loadRegistry(): Registry {
  const domains = z.array(domainSchema).parse(readYaml("domains.yaml"));
  const sources = z.array(sourceSchema).parse(readYaml("sources.yaml"));
  const reference = referenceSchema.parse(readYaml("reference.yaml"));

  const problems: string[] = [];
  const slugs = new Set(domains.map((d) => d.slug));
  const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

  for (const d of dupes(domains.map((d) => d.slug))) problems.push(`duplicate domain slug: ${d}`);
  for (const s of dupes(sources.map((s) => s.id))) problems.push(`duplicate source id: ${s}`);

  for (const s of sources) {
    for (const d of s.domains) {
      if (!slugs.has(d)) problems.push(`source ${s.id}: unknown domain "${d}"`);
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
  return { domains, sources, reference };
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
