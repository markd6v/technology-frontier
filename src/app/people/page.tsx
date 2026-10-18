import type { Metadata } from "next";
import Link from "next/link";
import { Card, ExternalLink, PageHeader, Section } from "@/components/ui";
import { registry, type Person } from "@/lib/registry";

export const metadata: Metadata = { title: "People" };

function Name({ p }: { p: Person }) {
  return p.url ? (
    <ExternalLink href={p.url} className="font-medium hover:text-accent hover:underline">
      {p.name}
    </ExternalLink>
  ) : (
    <span className="font-medium">{p.name}</span>
  );
}

export default function PeoplePage() {
  const { domains, reference } = registry();
  const shortlist = [
    ...domains.flatMap((d) => d.people.filter((p) => p.priority).map((p) => ({ ...p, context: d.name }))),
    ...reference.interpreters.filter((p) => p.priority).map((p) => ({ ...p, context: "Interpreter" })),
  ];

  return (
    <>
      <PageHeader title="People" kicker="Who recognizes the implications earliest">
        Chosen for their contributions, technical insight, or closeness to important work, not follower counts.
        For people who publish rarely, follow their papers and organizations instead of their social feeds.
      </PageHeader>

      <Section title="Shortlist">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortlist.map((p) => (
            <Card key={`${p.context}:${p.name}`} className="p-4">
              <Name p={p} />
              <div className="text-xs text-accent">{p.context}</div>
              <p className="mt-1 text-sm text-muted">{p.focus}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Cross-disciplinary interpreters">
        <p className="mb-3 max-w-3xl text-sm text-muted">
          They connect developments across industries and explain the economics. Investors and founders have a
          stake in the technologies they promote, so treat their views as hypotheses, not independent confirmation.
        </p>
        <Card className="divide-y divide-line">
          {reference.interpreters.map((p) => (
            <div key={p.name} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[200px_1fr_1fr]">
              <Name p={p} />
              <span className="text-muted">{p.focus}</span>
              <span className="text-muted">{p.why}</span>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Specialists by domain">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {domains.map((d) => (
            <Card key={d.slug} className="p-4">
              <Link href={`/d/${d.slug}`} className="font-semibold hover:text-accent">
                {d.name}
              </Link>
              <ul className="mt-2 space-y-1.5 text-sm">
                {d.people.map((p) => (
                  <li key={p.name}>
                    <Name p={p} />
                    <span className="text-muted"> — {p.focus}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
