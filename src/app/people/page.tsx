import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, PageHeader, Rows, Section } from "@/components/ui";
import { registry, type Person } from "@/lib/registry";

export const metadata: Metadata = { title: "People" };

function Name({ p }: { p: Person }) {
  return p.url ? (
    <ExternalLink href={p.url} className="hover:underline">
      {p.name}
    </ExternalLink>
  ) : (
    <span>{p.name}</span>
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
      <PageHeader title="People">
        People whose work or analysis helps make sense of new results. Chosen for their contributions, technical
        insight, or closeness to important work, not follower counts. For people who publish rarely, follow their
        papers and organizations instead.
      </PageHeader>

      <Section title="Shortlist">
        <Rows>
          {shortlist.map((p) => (
            <div key={`${p.context}:${p.name}`} className="py-3">
              <div className="flex items-baseline justify-between gap-4">
                <Name p={p} />
                <span className="shrink-0 text-sm text-faint">{p.context}</span>
              </div>
              <p className="text-sm text-muted">{p.focus}</p>
            </div>
          ))}
        </Rows>
      </Section>

      <Section title="Cross-disciplinary interpreters">
        <p className="mb-3 text-muted">
          They read widely, test new releases, and explain what a result does and doesn&apos;t show. Treat their
          views as informed opinion, not independent confirmation.
        </p>
        <Rows>
          {reference.interpreters.map((p) => (
            <div key={p.name} className="py-3">
              <Name p={p} />
              <p className="text-sm text-muted">
                {p.focus}. {p.why}
              </p>
            </div>
          ))}
        </Rows>
      </Section>

      <Section title="Specialists by domain">
        {domains.map((d) => (
          <div key={d.slug} className="mt-6 first:mt-0">
            <h3 className="border-b border-line pb-1.5 text-sm text-faint">
              <Link href={`/d/${d.slug}`} className="hover:text-ink">
                {d.name}
              </Link>
            </h3>
            <ul className="divide-y divide-line">
              {d.people.map((p) => (
                <li key={p.name} className="py-2.5">
                  <Name p={p} />
                  <span className="text-muted"> — {p.focus}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>
    </>
  );
}
