import Link from "next/link";
import { ItemCard } from "@/components/item-card";
import { Card, Empty, LayerBadge, LAYER_QUESTION, PageHeader, Section, TierBadge } from "@/components/ui";
import { getDomainCounts, getFeed, getLatestByDomain, getSourceHealth, getTotals } from "@/lib/queries";
import { LAYERS, registry } from "@/lib/registry";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { domains, sources, reference } = registry();
  const deep = domains.filter((d) => d.tier === "deep");
  const automatic = sources.filter((s) => s.method !== "manual");

  const [latest, byDomain, counts, health, totals] = await Promise.all([
    getFeed({}),
    getLatestByDomain(
      deep.map((d) => d.slug),
      5,
    ),
    getDomainCounts(7),
    getSourceHealth(),
    getTotals(),
  ]);
  const healthy = automatic.filter((s) => health[s.id]?.lastSuccessAt && !health[s.id]?.lastError).length;

  return (
    <>
      <PageHeader title="What's moving at the technology frontier" kicker="Technology Frontier Radar">
        Research, engineering, product and commercial signals from {sources.length} sources across{" "}
        {domains.length} domains. The best opportunities often show up when the scientific and engineering layers
        are moving fast and the product and commercial layers haven&apos;t caught up yet.
      </PageHeader>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Items tracked", value: totals.items.toLocaleString() },
          { label: "New in 24 h", value: totals.last24h.toLocaleString() },
          { label: "Seen in 2+ sources", value: totals.multiSource.toLocaleString() },
          { label: "Sources healthy", value: `${healthy} / ${automatic.length}`, href: "/sources" },
        ].map((s) => (
          <Card key={s.label} className="px-4 py-3">
            <div className="text-xs text-faint">{s.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {s.href ? (
                <Link href={s.href} className="hover:text-accent">
                  {s.value}
                </Link>
              ) : (
                s.value
              )}
            </div>
          </Card>
        ))}
      </div>

      <Section title="Deep coverage · reviewed daily">
        <div className="grid gap-4 md:grid-cols-2">
          {deep.map((d) => (
            <Card key={d.slug} className="px-4 pt-3 pb-1">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/d/${d.slug}`} className="font-semibold hover:text-accent">
                  {d.name}
                </Link>
                <Link href={`/feed?domain=${d.slug}`} className="text-xs text-accent hover:underline">
                  All {counts[d.slug] ?? 0} this week →
                </Link>
              </div>
              {byDomain[d.slug]?.length ? (
                byDomain[d.slug].map((item) => <ItemCard key={item.id} item={item} compactView />)
              ) : (
                <div className="py-4">
                  <Empty>No items yet.</Empty>
                </div>
              )}
            </Card>
          ))}
        </div>
      </Section>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px] [&>*]:min-w-0">
        <Section title="Latest across all domains" action={<Link href="/feed" className="text-xs text-accent hover:underline">Open feed →</Link>}>
          <Card className="px-4">
            {latest.items.slice(0, 12).map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
            {!latest.items.length && (
              <div className="py-4">
                <Empty>No items yet. Run `npm run job ingest`.</Empty>
              </div>
            )}
          </Card>
        </Section>

        <div>
          <Section title="Four layers">
            <div className="space-y-2">
              {LAYERS.map((l) => (
                <Link key={l} href={`/feed?layer=${l}`} className="block rounded-lg border border-line bg-surface px-3 py-2 hover:border-accent">
                  <LayerBadge layer={l} />
                  <p className="mt-1 text-sm text-muted">{LAYER_QUESTION[l]}</p>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="All domains · items in 7 days">
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {domains.map((d) => (
                <li key={d.slug}>
                  <Link href={`/d/${d.slug}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:text-accent">
                    <span className="truncate">{d.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <TierBadge tier={d.tier} />
                      <span className="w-8 text-right tabular-nums text-faint">{counts[d.slug] ?? 0}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Cross-domain watchlist">
            <ul className="space-y-2 text-sm">
              {reference.crossDomain.map((c) => (
                <li key={c.pair}>
                  <span className="font-medium">{c.pair}</span>
                  <span className="text-muted"> — {c.why}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
