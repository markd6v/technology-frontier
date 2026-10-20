import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, PageHeader, Rows, Section } from "@/components/ui";
import { hostOf, timeAgo } from "@/lib/format";
import { SourceStatus } from "@/components/source-status";
import { getAssessStatus, getSourceHealth, getSourceQuality } from "@/lib/queries";
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

const QUALITY_DAYS = 30;

export default async function SourcesPage() {
  const { sources, domains, reference } = registry();
  const [health, quality, assess] = await Promise.all([
    getSourceHealth(),
    getSourceQuality(QUALITY_DAYS),
    getAssessStatus(),
  ]);
  const domainName = (slug: string) => domains.find((d) => d.slug === slug)?.short ?? slug;
  const automatic = sources.filter((s) => s.method !== "manual");
  const manual = sources.filter((s) => s.method === "manual");
  const failing = automatic.filter((s) => health[s.id]?.lastError);

  return (
    <>
      <PageHeader title="Sources">
        Only primary sources: peer-reviewed journals, curated preprints, lab research posts and official release
        channels. Business news, commentary and general tech news are left out, and each source can drop items by
        feed category or title.
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
            const q = quality[s.id];
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
                  {q && (
                    <span title={`${q.assessed} items assessed, last ${QUALITY_DAYS} days`}>
                      {" "}
                      · quality {q.avgQuality ?? "–"} · {Math.round((q.relevantShare ?? 0) * 100)}% on topic
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </Rows>
      </Section>

      <Section title="Assessment">
        <p className="text-muted">
          Each new item is read once by Claude, which picks its domains and topics and scores it (
          <Link href="/framework#scores" className="text-accent hover:underline">
            how
          </Link>
          ). Quality and on-topic share above cover the last {QUALITY_DAYS} days.{" "}
          {assess.unassessed > 0
            ? `${assess.unassessed} items are waiting to be assessed.`
            : "Every item has been assessed."}
        </p>
        {assess.proposed.length > 0 && (
          <p className="mt-3 text-sm text-faint">
            Topics Claude asked for that the list lacks:{" "}
            {assess.proposed.map((p, i) => (
              <span key={p.topic}>
                {i > 0 && ", "}
                <span className="text-muted">{p.topic}</span> {p.n}
              </span>
            ))}
            . Add the useful ones to <code>content/topics.yaml</code>.
          </p>
        )}
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
