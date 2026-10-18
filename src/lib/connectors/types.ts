import type { z } from "zod";
import type { Http } from "@/lib/http";
import type { Method, Source } from "@/lib/registry/schema";

export type NormalizedItem = {
  url: string;
  externalKind?: "arxiv" | "doi" | "nct" | "github" | "hn";
  externalId?: string;
  title: string;
  authors?: string[];
  publishedAt?: Date;
  /** Plain text, ≤300 chars. */
  excerpt?: string;
  /** Only where the source licenses redistribution of metadata (arXiv, bioRxiv, CT.gov, HF). */
  abstract?: string;
  /** Per-mention numbers: hn_points, stars, upvotes… */
  signals?: Record<string, number>;
  /** Overrides the source's domains for this item (e.g. per-query CT.gov domains). */
  domains?: string[];
};

export type ConnectorState = {
  cursor: unknown;
  etag: string | null;
  lastModified: string | null;
  data: Record<string, unknown>;
};

export type ConnectorContext<C> = {
  source: Source;
  config: C;
  state: ConnectorState;
  http: Http;
  now: Date;
};

export type ConnectorResult = {
  items: NormalizedItem[];
  /** Fields to merge into source_state. */
  state?: Partial<ConnectorState>;
};

export type Connector<C = unknown> = {
  method: Exclude<Method, "manual">;
  configSchema: z.ZodType<C>;
  fetch(ctx: ConnectorContext<C>): Promise<ConnectorResult>;
};

export function defineConnector<C>(c: Connector<C>): Connector<C> {
  return c;
}
