import type { Metadata } from "next";
import Link from "next/link";
import { Card, ExternalLink, LayerBadge, PageHeader, Section } from "@/components/ui";
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
  const domainName = (slug: string) => domains.find((d) => d.slug === slug)?.name ?? slug;
  const automatic = sources.filter((s) => s.method !== "manual");
  const manual = sources.filter((s) => s.method === "manual");
  const failing = automatic.filter((s) => health[s.id]?.lastError);

  return (
    <>
      <PageHeader title="Sources" kicker={`${automatic.length} automatic · ${manual.length} manual`}>
        A paper on arXiv is the earliest signal, a working repo is stronger evidence, a product release shows
        someone thinks it&apos;s ready, and customer adoption shows it creates value. No single source covers all
        four stages.
      </PageHeader>

      {failing.length > 0 && (
        <div className="mb-6 rounded-xl border border-bad/40 bg-surface px-4 py-3 text-sm">
          <span className="font-medium text-bad">{failing.length} failing:</span>{" "}
          {failing.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link href={`/sources/${s.id}`} className="underline">
                {s.name}
              </Link>
            </span>
          ))}
        </div>
      )}

      <Section title="Automatic">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-faint">
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-2 py-2 font-medium">Layer</th>
                <th className="px-2 py-2 font-medium">Method</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 text-right font-medium">Items 7d</th>
                <th className="px-4 py-2 text-right font-medium">Last success</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {automatic.map((s) => {
                const h = health[s.id];
                return (
                  <tr key={s.id} className="align-top">
                    <td className="px-4 py-2.5">
                      <Link href={`/sources/${s.id}`} className="font-medium hover:text-accent">
                        {s.name}
                      </Link>
                      <div className="text-xs text-faint">{s.domains.map(domainName).join(", ")}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      <LayerBadge layer={s.layer} />
                    </td>
                    <td className="px-2 py-2.5 text-xs text-muted">
                      {METHOD_LABEL[s.method]} · {s.frequency}
                    </td>
                    <td className="px-2 py-2.5">
                      <SourceStatus source={s} health={h} />
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{h?.items7d ?? 0}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted">{timeAgo(h?.lastSuccessAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Manual check">
        <div className="grid gap-3 sm:grid-cols-2">
          {manual.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-baseline justify-between gap-2">
                <ExternalLink href={s.homepage} className="font-medium hover:text-accent hover:underline">
                  {s.name} ↗
                </ExternalLink>
                <span className="text-xs text-faint">{s.frequency}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{s.reliability}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Universal sources">
        <Card className="divide-y divide-line">
          {reference.universalSources.map((u) => (
            <div key={u.name} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[180px_1fr_1fr]">
              <ExternalLink href={u.url} className="font-medium hover:text-accent hover:underline">
                {u.name}
              </ExternalLink>
              <span className="text-muted">{u.provides}</span>
              <span className="text-muted">{u.advantage}</span>
            </div>
          ))}
        </Card>
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Commercial intelligence layer">
          <Card className="divide-y divide-line">
            {reference.commercialSignals.map((c) => (
              <div key={c.signal} className="px-4 py-2.5 text-sm">
                <div className="font-medium">{c.signal}</div>
                <div className="text-muted">{c.tells}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                  {c.sources.map((s) => (
                    <ExternalLink key={s.name} href={s.url} className="text-accent hover:underline">
                      {s.name}
                    </ExternalLink>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </Section>

        <div>
          <Section title="Publications">
            <Card className="divide-y divide-line">
              {reference.publications.map((p) => (
                <div key={p.name} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                  <span>
                    <ExternalLink href={p.url} className="font-medium hover:text-accent hover:underline">
                      {p.name}
                    </ExternalLink>
                    {p.priority && <span className="ml-1.5 text-[11px] font-medium text-accent">priority</span>}
                  </span>
                  <span className="text-right text-xs text-muted">{p.focus}</span>
                </div>
              ))}
            </Card>
          </Section>

          <Section title="Periodic reviews">
            <Card className="divide-y divide-line">
              {reference.periodicReviews.map((r) => (
                <div key={r.name} className="px-4 py-2.5 text-sm">
                  <ExternalLink href={r.url} className="font-medium hover:text-accent hover:underline">
                    {r.name}
                  </ExternalLink>
                  <span className="ml-1.5 text-xs text-faint">{hostOf(r.url)}</span>
                  <p className="text-muted">{r.note}</p>
                </div>
              ))}
            </Card>
          </Section>
        </div>
      </div>
    </>
  );
}
