import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemList } from "@/components/item-list";
import { Empty, ExternalLink, MoreLink, PageHeader, Rows, Section, TIER_LABEL } from "@/components/ui";
import { hostOf } from "@/lib/format";
import { getFeed, getTagCounts } from "@/lib/queries";
import { getDomain, registry } from "@/lib/registry";

export const dynamic = "force-dynamic";

const TOP_DAYS = 30;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const d = getDomain((await params).slug);
  return { title: d?.name ?? "Domain" };
}

function LinkList({ links }: { links: { name: string; url: string; note?: string }[] }) {
  return (
    <Rows>
      {links.map((l) => (
        <div key={l.name + l.url} className="py-2.5">
          <ExternalLink href={l.url} className="hover:underline">
            {l.name}
          </ExternalLink>
          <span className="ml-2 text-sm text-faint">{hostOf(l.url)}</span>
          {l.note && <p className="text-sm text-muted">{l.note}</p>}
        </div>
      ))}
    </Rows>
  );
}

export default async function DomainPage({ params }: Params) {
  const { slug } = await params;
  const domain = getDomain(slug);
  if (!domain) notFound();

  const { sources, reference, topics } = registry();
  const tracked = sources.filter((s) => s.domains.includes(slug));
  const crossings = reference.crossDomain.filter((c) => c.domains.includes(slug));
  const [{ items, total }, top, tagCounts] = await Promise.all([
    getFeed({ domain: slug }),
    getFeed({ domain: slug, sort: "top", days: TOP_DAYS }),
    getTagCounts(TOP_DAYS, slug),
  ]);
  const topicName = (t: string) => topics.find((x) => x.slug === t)?.name ?? t;

  return (
    <>
      <PageHeader
        title={domain.name}
        kicker={
          <>
            <Link href="/domains" className="hover:text-ink">
              Domains
            </Link>{" "}
            · {TIER_LABEL[domain.tier]} · relevance {domain.relevance.toLowerCase()}
          </>
        }
      >
        <p>{domain.summary}</p>
        <p className="mt-2 text-sm text-faint">{domain.subfields.join(" · ")}</p>
      </PageHeader>

      {tagCounts.length > 0 && (
        <p className="-mt-4 mb-8 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={`Topics, last ${TOP_DAYS} days`}>
          {tagCounts.slice(0, 12).map((t) => (
            <Link key={t.tag} href={`/feed?domain=${slug}&tag=${t.tag}`} className="text-muted hover:text-ink">
              {topicName(t.tag)} <span className="tabular-nums text-faint">{t.n}</span>
            </Link>
          ))}
        </p>
      )}

      {top.items.length > 0 && (
        <Section
          title="Top this month"
          action={
            top.total > 8 ? <MoreLink href={`/feed?domain=${slug}&sort=top&days=${TOP_DAYS}`}>More</MoreLink> : null
          }
        >
          <ItemList items={top.items.slice(0, 8)} hideDomains flat />
        </Section>
      )}

      <Section
        title="Latest"
        action={total > 10 ? <MoreLink href={`/feed?domain=${slug}`}>All {total.toLocaleString()} items</MoreLink> : null}
      >
        {items.length ? (
          <ItemList items={items.slice(0, 10)} hideDomains />
        ) : (
          <Empty>
            {tracked.some((s) => s.method !== "manual")
              ? "No items yet."
              : "No automatic source covers this domain yet. Use the research and product links below."}
          </Empty>
        )}
      </Section>

      <Section title="Signals to watch">
        <ul className="list-disc space-y-1 pl-5 marker:text-faint">
          {domain.signals.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Section>

      {domain.notes?.length ? (
        <Section title="Keep in mind">
          <div className="space-y-3 border-l-2 border-line pl-4 text-muted">
            {domain.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Research">
        <LinkList links={domain.research} />
        {domain.conferences && (
          <p className="mt-2 text-sm text-muted">Key conferences: {domain.conferences.join(", ")}</p>
        )}
      </Section>

      <Section title="Product updates">
        <LinkList links={domain.products} />
      </Section>

      <Section title="People">
        <Rows>
          {domain.people.map((p) => (
            <div key={p.name} className="py-2.5">
              {p.url ? (
                <ExternalLink href={p.url} className="hover:underline">
                  {p.name}
                </ExternalLink>
              ) : (
                p.name
              )}
              {p.priority && <span className="ml-2 text-sm text-faint">shortlist</span>}
              <p className="text-sm text-muted">{p.focus}</p>
            </div>
          ))}
        </Rows>
      </Section>

      {crossings.length > 0 && (
        <Section title="Intersections">
          <Rows>
            {crossings.map((c) => (
              <p key={c.pair} className="py-2.5">
                {c.pair}
                <span className="text-muted"> — {c.why}</span>
              </p>
            ))}
          </Rows>
        </Section>
      )}

      <p className="mt-12 text-sm text-faint">
        Tracked sources:{" "}
        {tracked.length
          ? tracked.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <Link href={`/sources/${s.id}`} className="hover:text-ink">
                  {s.name}
                </Link>
                {s.method === "manual" && " (manual)"}
              </span>
            ))
          : "none yet"}
      </p>
    </>
  );
}
