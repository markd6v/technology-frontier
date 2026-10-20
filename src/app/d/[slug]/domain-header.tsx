import Link from "next/link";
import { PageHeader, TIER_LABEL } from "@/components/ui";
import type { Domain } from "@/lib/registry";

/** Shared by the domain's feed and About pages, with tabs between them. */
export function DomainHeader({ domain, tab }: { domain: Domain; tab: "feed" | "about" }) {
  const tabs = [
    { key: "feed", label: "Items", href: `/d/${domain.slug}` },
    { key: "about", label: "About", href: `/d/${domain.slug}/about` },
  ] as const;
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
        {domain.summary}
      </PageHeader>
      <nav className="-mt-4 mb-6 flex gap-5 border-b border-line text-sm" aria-label={`${domain.short} sections`}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px border-b pb-2 ${tab === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
