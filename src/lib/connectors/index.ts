import type { Method } from "@/lib/registry/schema";
import { arxivConnector } from "./arxiv";
import { biorxivConnector } from "./biorxiv";
import { ctgovConnector } from "./ctgov";
import { githubSearchConnector } from "./github-search";
import { hfModelsConnector } from "./hf-models";
import { hfPapersConnector } from "./hf-papers";
import { pageMonitorConnector } from "./page-monitor";
import { rssConnector } from "./rss";
import type { Connector } from "./types";

export type { Connector, NormalizedItem } from "./types";

const connectors: Record<Exclude<Method, "manual">, Connector<unknown>> = {
  rss: rssConnector as Connector<unknown>,
  arxiv: arxivConnector as Connector<unknown>,
  "hf-papers": hfPapersConnector as Connector<unknown>,
  "hf-models": hfModelsConnector as Connector<unknown>,
  "github-search": githubSearchConnector as Connector<unknown>,
  biorxiv: biorxivConnector as Connector<unknown>,
  ctgov: ctgovConnector as Connector<unknown>,
  "page-monitor": pageMonitorConnector as Connector<unknown>,
};

/** undefined for `manual` sources: they are listed, never fetched. */
export function connectorFor(method: Method): Connector<unknown> | undefined {
  return method === "manual" ? undefined : connectors[method];
}
