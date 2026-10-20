import Link from "next/link";
import type { ReactNode } from "react";
import type { Layer, Tier } from "@/lib/registry/schema";

export const LAYER_LABEL: Record<Layer, string> = {
  scientific: "Scientific",
  engineering: "Engineering",
  product: "Product",
};

export const LAYER_QUESTION: Record<Layer, string> = {
  scientific: "What has become possible for the first time?",
  engineering: "What has become reproducible, open, and practical to build on?",
  product: "What has been released for people to use?",
};

export const TIER_LABEL: Record<Tier, string> = {
  deep: "Deep coverage, reviewed daily",
  regular: "Regular coverage, reviewed weekly",
  broad: "Broad coverage, summarised monthly",
};

/** A row of text links where one is the current choice. Used for feed filters. */
export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] items-baseline py-1.5 text-sm">
      <span className="text-faint">{label}</span>
      <div className="flex flex-wrap gap-x-4 gap-y-1">{children}</div>
    </div>
  );
}

export function FilterLink({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`shrink-0 ${active ? "text-ink underline decoration-1 underline-offset-[6px]" : "text-muted hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}

export function PageHeader({ title, kicker, children }: { title: string; kicker?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8">
      {kicker && <div className="mb-2 text-sm text-faint">{kicker}</div>}
      <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {children && <div className="mt-3 text-base leading-relaxed text-muted">{children}</div>}
    </header>
  );
}

export function Section({
  title,
  action,
  id,
  children,
}: {
  title: string;
  action?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-6 first:mt-0">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-xl font-semibold tracking-tight">{title}</h2>
        {action && <div className="shrink-0 text-sm">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Ruled list: hairlines between rows, no boxes. */
export function Rows({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`divide-y divide-line border-y border-line ${className}`}>{children}</div>;
}

export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-accent hover:underline">
      {children}
    </Link>
  );
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-sm text-faint">{children}</p>;
}
