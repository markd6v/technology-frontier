import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Rows, Section, TIER_LABEL } from "@/components/ui";
import { getDomainCounts } from "@/lib/queries";
import { registry, TIERS } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Domains" };

const TIER_INTRO = {
  deep: "The fields moving fastest right now, and the ones a software engineer can most easily test first-hand.",
  regular: null,
  broad: "Ingested and shown here, but they skip LLM triage until Phase 2.",
} as const;

export default async function DomainsPage() {
  const { domains, reference } = registry();
  const counts = await getDomainCounts(7);
  const name = (slug: string) => domains.find((d) => d.slug === slug)?.short ?? slug;

  return (
    <>
      <PageHeader title="Domains">
        Relevance rates how much is changing in a field right now. Coverage depth reflects how closely it is
        followed. Counts are items in the last 7 days.
      </PageHeader>

      {TIERS.map((tier) => (
        <Section key={tier} title={TIER_LABEL[tier]}>
          {TIER_INTRO[tier] && <p className="mb-3 text-muted">{TIER_INTRO[tier]}</p>}
          <Rows>
            {domains
              .filter((d) => d.tier === tier)
              .map((d) => (
                <Link key={d.slug} href={`/d/${d.slug}`} className="group block py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-serif text-lg group-hover:underline">{d.name}</span>
                    <span className="shrink-0 text-sm tabular-nums text-faint">{counts[d.slug] ?? 0}</span>
                  </div>
                  <p className="text-sm text-muted">{d.subfields.join(" · ")}</p>
                </Link>
              ))}
          </Rows>
        </Section>
      ))}

      <Section title="Cross-domain watchlist">
        <p className="mb-3 text-muted">Specialists in one field may underestimate developments occurring in another.</p>
        <Rows>
          {reference.crossDomain.map((c) => (
            <div key={c.pair} className="py-3">
              <div className="flex items-baseline justify-between gap-4">
                <span>{c.pair}</span>
                <span className="flex shrink-0 gap-3 text-sm">
                  {c.domains.map((slug) => (
                    <Link key={slug} href={`/d/${slug}`} className="text-accent hover:underline">
                      {name(slug)}
                    </Link>
                  ))}
                </span>
              </div>
              <p className="text-sm text-muted">{c.why}</p>
            </div>
          ))}
        </Rows>
      </Section>
    </>
  );
}
