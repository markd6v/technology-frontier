import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemCard } from "@/components/item-card";
import { SourceStatus } from "@/components/source-status";
import { Card, Empty, ExternalLink, LayerBadge, PageHeader, Section } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getFeed, getSourceHealth } from "@/lib/queries";
import { getSource, registry } from "@/lib/registry";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: getSource((await params).id)?.name ?? "Source" };
}

export default async function SourcePage({ params }: Params) {
  const { id } = await params;
  const source = getSource(id);
  if (!source) notFound();

  const { domains } = registry();
  const [health, feed] = await Promise.all([getSourceHealth(), getFeed({ source: id })]);
  const h = health[id];

  const facts: [string, React.ReactNode][] = [
    ["Status", <SourceStatus key="s" source={source} health={h} />],
    ["Layer", <LayerBadge key="l" layer={source.layer} />],
    ["Type", source.kind],
    ["Method", `${source.method} · ${source.frequency}`],
    ["Reliability", source.reliability],
  ];
  if (source.method !== "manual") {
    facts.push(
      ["Last success", timeAgo(h?.lastSuccessAt)],
      ["Next check", timeAgo(h?.nextDueAt)],
      ["Last run", h?.lastFetchedCount != null ? `${h.lastFetchedCount} fetched, ${h.lastNewCount ?? 0} new` : "—"],
      ["Items in 7 days", String(h?.items7d ?? 0)],
    );
  }

  return (
    <>
      <PageHeader
        title={source.name}
        kicker={
          <Link href="/sources" className="hover:text-accent">
            Sources
          </Link>
        }
      >
        <ExternalLink href={source.homepage} className="text-accent hover:underline">
          {source.homepage} ↗
        </ExternalLink>
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px] [&>*]:min-w-0">
        <Section title={`Items · ${feed.total.toLocaleString()}`}>
          <Card className="px-4">
            {feed.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
            {!feed.items.length && (
              <div className="py-6">
                <Empty>
                  {source.method === "manual"
                    ? "This source is checked by hand. Open it with the link above."
                    : "No items yet."}
                </Empty>
              </div>
            )}
          </Card>
          {feed.total > feed.items.length && (
            <Link href={`/feed?source=${id}`} className="mt-3 inline-block text-sm text-accent hover:underline">
              See all in the feed →
            </Link>
          )}
        </Section>

        <aside>
          <Section title="Details">
            <Card className="divide-y divide-line text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-2">
                  <span className="shrink-0 text-faint">{k}</span>
                  <span className="text-right">{v}</span>
                </div>
              ))}
            </Card>
          </Section>

          {h?.lastError && (
            <Section title="Last error">
              <pre className="whitespace-pre-wrap break-words rounded-xl border border-bad/40 bg-surface p-3 font-mono text-xs text-bad">
                {h.lastError}
              </pre>
              <p className="mt-1 text-xs text-faint">{timeAgo(h.lastRunAt)}</p>
            </Section>
          )}

          <Section title="Domains">
            <div className="flex flex-wrap gap-2 text-sm">
              {source.domains.map((slug) => (
                <Link key={slug} href={`/d/${slug}`} className="text-accent hover:underline">
                  {domains.find((d) => d.slug === slug)?.name ?? slug}
                </Link>
              ))}
            </div>
          </Section>
        </aside>
      </div>
    </>
  );
}
