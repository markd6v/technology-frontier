import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Rows, Section } from "@/components/ui";
import { hostOf } from "@/lib/format";
import { getDomain, registry } from "@/lib/registry";
import { DomainHeader } from "../domain-header";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const d = getDomain((await params).slug);
  return { title: d ? `About ${d.name}` : "Domain" };
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

export default async function DomainAboutPage({ params }: Params) {
  const { slug } = await params;
  const domain = getDomain(slug);
  if (!domain) notFound();

  const { sources, reference } = registry();
  const tracked = sources.filter((s) => s.domains.includes(slug));
  const crossings = reference.crossDomain.filter((c) => c.domains.includes(slug));

  return (
    <>
      <DomainHeader domain={domain} tab="about" />

      <Section title="Subfields">
        <p className="text-muted">{domain.subfields.join(" · ")}</p>
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
