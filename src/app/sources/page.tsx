import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, PageHeader, Rows, Section } from "@/components/ui";
import { hostOf, timeAgo } from "@/lib/format";
import { SourceStatus } from "@/components/source-status";
import { getSourceHealth } from "@/lib/queries";
import { registry } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sources" };

const METHOD_LABEL: Record<string, string> = {
  rss: "RSS/Atom",
  arxiv: "arXiv API",
  "hf-papers": "HF API",
  "github-search": "GitHub API",
  biorxiv: "bioRxiv API",
  ctgov: "CT.gov API",
  "page-monitor": "Page monitor",
  manual: "Manual",
};

export default async function SourcesPage() {
  const { sources, domains, reference } = registry();
  const health = await getSourceHealth();
  const domainName = (slug: string) => domains.find((d) => d.slug === slug)?.short ?? slug;
  const automatic = sources.filter((s) => s.method !== "manual");
  const manual = sources.filter((s) => s.method === "manual");
  const failing = automatic.filter((s) => health[s.id]?.lastError);

  return (
    <>
      <PageHeader title="Sources">
        A paper on arXiv is the earliest signal, a working repo is stronger evidence, a product release shows
        someone thinks it&apos;s ready, and customer adoption shows it creates value. No single source covers all
        four stages.
      </PageHeader>

      {failing.length > 0 && (
        <p className="mb-8 border-l-2 border-bad pl-4">
          <span className="text-bad">{failing.length} failing:</span>{" "}
          {failing.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link href={`/sources/${s.id}`} className="underline">
                {s.name}
              </Link>
            </span>
          ))}
        </p>
      )}

      <Section title={`Automatic · ${automatic.length}`}>
        <Rows>
          {automatic.map((s) => {
            const h = health[s.id];
            return (
              <div key={s.id} className="py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <Link href={`/sources/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                  <span className="flex shrink-0 gap-3 text-sm">
                    <SourceStatus source={s} health={h} />
                    <span className="w-10 text-right tabular-nums text-faint" title="Items in 7 days">
                      {h?.items7d ?? 0}
                    </span>
                  </span>
                </div>
                <p className="text-sm text-faint">
                  {s.domains.map(domainName).join(", ")} · {s.layer} · {METHOD_LABEL[s.method]}, {s.frequency} · last
                  success {timeAgo(h?.lastSuccessAt)}
                </p>
              </div>
            );
          })}
        </Rows>
      </Section>

      <Section title={`Manual check · ${manual.length}`}>
        <Rows>
          {manual.map((s) => (
            <div key={s.id} className="py-3">
              <div className="flex items-baseline justify-between gap-4">
                <ExternalLink href={s.homepage} className="hover:underline">
                  {s.name} ↗
                </ExternalLink>
                <span className="text-sm text-faint">{s.frequency}</span>
              </div>
              <p className="text-sm text-muted">{s.reliability}</p>
            </div>
          ))}
        </Rows>
      </Section>

      <Section title="Universal sources">
        <Rows>
          {reference.universalSources.map((u) => (
            <div key={u.name} className="py-3">
              <ExternalLink href={u.url} className="hover:underline">
                {u.name}
              </ExternalLink>
              <p className="text-sm text-muted">
                {u.provides}. {u.advantage}
              </p>
            </div>
          ))}
        </Rows>
      </Section>

      <Section title="Commercial intelligence">
        <Rows>
          {reference.commercialSignals.map((c) => (
            <div key={c.signal} className="py-3">
              <div>{c.signal}</div>
              <p className="text-sm text-muted">{c.tells}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 text-sm">
                {c.sources.map((s) => (
                  <ExternalLink key={s.name} href={s.url} className="text-accent hover:underline">
                    {s.name}
                  </ExternalLink>
                ))}
              </div>
            </div>
          ))}
        </Rows>
      </Section>

      <Section title="Publications">
        <Rows>
          {reference.publications.map((p) => (
            <div key={p.name} className="py-3">
              <ExternalLink href={p.url} className="hover:underline">
                {p.name}
              </ExternalLink>
              {p.priority && <span className="ml-2 text-sm text-faint">priority</span>}
              <p className="text-sm text-muted">{p.focus}</p>
            </div>
          ))}
        </Rows>
      </Section>

      <Section title="Periodic reviews">
        <Rows>
          {reference.periodicReviews.map((r) => (
            <div key={r.name} className="py-3">
              <ExternalLink href={r.url} className="hover:underline">
                {r.name}
              </ExternalLink>
              <span className="ml-2 text-sm text-faint">{hostOf(r.url)}</span>
              <p className="text-sm text-muted">{r.note}</p>
            </div>
          ))}
        </Rows>
      </Section>
    </>
  );
}
