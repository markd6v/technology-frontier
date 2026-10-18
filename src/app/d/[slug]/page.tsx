import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemCard } from "@/components/item-card";
import { Card, Chip, Empty, ExternalLink, PageHeader, Section, TierBadge } from "@/components/ui";
import { hostOf } from "@/lib/format";
import { getFeed } from "@/lib/queries";
import { getDomain, registry } from "@/lib/registry";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const d = getDomain((await params).slug);
  return { title: d?.name ?? "Domain" };
}

function LinkList({ links }: { links: { name: string; url: string; note?: string }[] }) {
  return (
    <ul className="divide-y divide-line">
      {links.map((l) => (
        <li key={l.name + l.url} className="py-2">
          <ExternalLink href={l.url} className="text-sm font-medium hover:text-accent hover:underline">
            {l.name}
          </ExternalLink>
          <span className="ml-1.5 text-xs text-faint">{hostOf(l.url)}</span>
          {l.note && <p className="text-xs text-muted">{l.note}</p>}
        </li>
      ))}
    </ul>
  );
}

export default async function DomainPage({ params }: Params) {
  const { slug } = await params;
  const domain = getDomain(slug);
  if (!domain) notFound();

  const { sources, reference } = registry();
  const tracked = sources.filter((s) => s.domains.includes(slug));
  const crossings = reference.crossDomain.filter((c) => c.domains.includes(slug));
  const { items, total } = await getFeed({ domain: slug });

  return (
    <>
      <PageHeader
        title={domain.name}
        kicker={
          <span className="flex flex-wrap items-center gap-2 normal-case tracking-normal">
            <Link href="/domains" className="hover:text-accent">
              Domains
            </Link>
            <span>/</span>
            <TierBadge tier={domain.tier} />
            <span>Relevance: {domain.relevance}</span>
          </span>
        }
      >
        {domain.summary}
      </PageHeader>

      <div className="mb-8 flex flex-wrap gap-1.5">
        {domain.subfields.map((s) => (
          <Chip key={s}>{s}</Chip>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          <Section
            title={`Recent items · ${total.toLocaleString()}`}
            action={
              <Link href={`/feed?domain=${slug}`} className="text-xs text-accent hover:underline">
                Filter in feed →
              </Link>
            }
          >
            <Card className="px-4">
              {items.slice(0, 20).map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
              {!items.length && (
                <div className="py-6">
                  <Empty>
                    {tracked.some((s) => s.method !== "manual")
                      ? "No items yet."
                      : "No automatic source covers this domain yet. Use the research and product links."}
                  </Empty>
                </div>
              )}
            </Card>
          </Section>

          <div className="grid gap-6 md:grid-cols-2">
            <Section title="Research sources">
              <Card className="px-4 py-1">
                <LinkList links={domain.research} />
              </Card>
              {domain.conferences && (
                <p className="mt-2 text-xs text-muted">Key conferences: {domain.conferences.join(", ")}</p>
              )}
            </Section>
            <Section title="Product updates">
              <Card className="px-4 py-1">
                <LinkList links={domain.products} />
              </Card>
            </Section>
          </div>
        </div>

        <aside>
          <Section title="Signals to watch">
            <ul className="space-y-1.5 text-sm">
              {domain.signals.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Section>

          {domain.notes?.length ? (
            <Section title="Keep in mind">
              <div className="space-y-2">
                {domain.notes.map((n) => (
                  <p key={n} className="rounded-lg border-l-2 border-warn bg-surface px-3 py-2 text-sm text-muted">
                    {n}
                  </p>
                ))}
              </div>
            </Section>
          ) : null}

          <Section title="People">
            <ul className="space-y-2 text-sm">
              {domain.people.map((p) => (
                <li key={p.name}>
                  {p.url ? (
                    <ExternalLink href={p.url} className="font-medium hover:text-accent hover:underline">
                      {p.name}
                    </ExternalLink>
                  ) : (
                    <span className="font-medium">{p.name}</span>
                  )}
                  {p.priority && <span className="ml-1.5 text-[11px] font-medium text-accent">shortlist</span>}
                  <div className="text-xs text-muted">{p.focus}</div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Tracked sources">
            <ul className="space-y-1 text-sm">
              {tracked.map((s) => (
                <li key={s.id}>
                  <Link href={`/sources/${s.id}`} className="hover:text-accent">
                    {s.name}
                  </Link>
                  {s.method === "manual" && <span className="ml-1.5 text-xs text-faint">manual</span>}
                </li>
              ))}
              {!tracked.length && <li className="text-faint">None yet.</li>}
            </ul>
          </Section>

          {crossings.length > 0 && (
            <Section title="Intersections">
              <ul className="space-y-1.5 text-sm">
                {crossings.map((c) => (
                  <li key={c.pair}>
                    <span className="font-medium">{c.pair}</span>
                    <span className="text-muted"> — {c.why}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </aside>
      </div>
    </>
  );
}
