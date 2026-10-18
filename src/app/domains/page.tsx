import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader, Section, TierBadge, TIER_LABEL } from "@/components/ui";
import { getDomainCounts } from "@/lib/queries";
import { registry, TIERS } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Domains" };

const TIER_INTRO = {
  deep: "Daily research and product monitoring. These are the fields where a software team can most quickly turn insight into an experiment.",
  regular: "Weekly reviews.",
  broad: "Weekly summaries plus monthly deep dives. Ingested and shown here, but they skip LLM triage until Phase 2.",
} as const;

export default async function DomainsPage() {
  const { domains, reference } = registry();
  const counts = await getDomainCounts(7);

  return (
    <>
      <PageHeader title="15 technology domains" kicker="Coverage">
        Relevance is a qualitative rating of entrepreneurial opportunity, not a ranking of technological
        importance. Coverage depth reflects where a technical founder can test ideas fastest.
      </PageHeader>

      {TIERS.map((tier) => (
        <Section key={tier} title={TIER_LABEL[tier]}>
          <p className="mb-3 max-w-3xl text-sm text-muted">{TIER_INTRO[tier]}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {domains
              .filter((d) => d.tier === tier)
              .map((d) => (
                <Link key={d.slug} href={`/d/${d.slug}`} className="group">
                  <Card className="h-full p-4 transition-colors group-hover:border-accent">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold group-hover:text-accent">{d.name}</h3>
                      <span className="shrink-0 text-xs tabular-nums text-faint">{counts[d.slug] ?? 0} / 7d</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{d.subfields.join(" · ")}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-faint">
                      <TierBadge tier={d.tier} />
                      <span>Relevance: {d.relevance}</span>
                    </div>
                  </Card>
                </Link>
              ))}
          </div>
        </Section>
      ))}

      <Section title="Cross-domain watchlist">
        <p className="mb-3 max-w-3xl text-sm text-muted">
          Specialists in one field may underestimate developments occurring in another.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reference.crossDomain.map((c) => (
            <Card key={c.pair} className="p-4">
              <h3 className="font-semibold">{c.pair}</h3>
              <p className="mt-1 text-sm text-muted">{c.why}</p>
              <div className="mt-2 flex gap-2 text-xs">
                {c.domains.map((slug) => (
                  <Link key={slug} href={`/d/${slug}`} className="text-accent hover:underline">
                    {domains.find((d) => d.slug === slug)?.name}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
