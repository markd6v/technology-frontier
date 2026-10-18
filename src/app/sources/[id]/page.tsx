import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemList } from "@/components/item-list";
import { SourceStatus } from "@/components/source-status";
import { Empty, ExternalLink, MoreLink, PageHeader, Rows, Section } from "@/components/ui";
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
    ["Layer", source.layer],
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
          <Link href="/sources" className="hover:text-ink">
            Sources
          </Link>
        }
      >
        <ExternalLink href={source.homepage} className="text-accent hover:underline">
          {source.homepage} ↗
        </ExternalLink>
      </PageHeader>

      <Rows className="text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[8rem_1fr] gap-4 py-2">
            <span className="text-faint">{k}</span>
            <span>{v}</span>
          </div>
        ))}
        <div className="grid grid-cols-[8rem_1fr] gap-4 py-2">
          <span className="text-faint">Domains</span>
          <span className="flex flex-wrap gap-x-3">
            {source.domains.map((slug) => (
              <Link key={slug} href={`/d/${slug}`} className="text-accent hover:underline">
                {domains.find((d) => d.slug === slug)?.name ?? slug}
              </Link>
            ))}
          </span>
        </div>
      </Rows>

      {h?.lastError && (
        <Section title="Last error">
          <pre className="whitespace-pre-wrap break-words border-l-2 border-bad pl-4 font-mono text-xs text-bad">
            {h.lastError}
          </pre>
          <p className="mt-1 text-sm text-faint">{timeAgo(h.lastRunAt)}</p>
        </Section>
      )}

      <Section
        title="Items"
        action={
          feed.total > feed.items.length ? (
            <MoreLink href={`/feed?source=${id}`}>All {feed.total.toLocaleString()} items</MoreLink>
          ) : null
        }
      >
        {feed.items.length ? (
          <ItemList items={feed.items} />
        ) : (
          <Empty>
            {source.method === "manual"
              ? "This source is checked by hand. Open it with the link above."
              : "No items yet."}
          </Empty>
        )}
      </Section>
    </>
  );
}
