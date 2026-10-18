import Link from "next/link";
import type { ReactNode } from "react";
import type { Layer, Tier } from "@/lib/registry/schema";

export const LAYER_LABEL: Record<Layer, string> = {
  scientific: "Scientific",
  engineering: "Engineering",
  product: "Product",
  commercial: "Commercial",
};

export const LAYER_QUESTION: Record<Layer, string> = {
  scientific: "What has become technically possible?",
  engineering: "What has become reproducible, reliable, and affordable?",
  product: "What can ordinary people or businesses now accomplish?",
  commercial: "Where is adoption accelerating, and who is willing to pay?",
};

export const TIER_LABEL: Record<Tier, string> = {
  deep: "Deep · daily",
  regular: "Regular · weekly",
  broad: "Broad · monthly",
};

export function LayerBadge({ layer }: { layer: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: `var(--layer-${layer})`, background: `var(--layer-${layer}-soft)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: `var(--layer-${layer})` }} aria-hidden />
      {LAYER_LABEL[layer as Layer] ?? layer}
    </span>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  const tone = tier === "deep" ? "text-accent bg-accent-soft" : "text-muted bg-surface-2";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{TIER_LABEL[tier]}</span>;
}

export function Chip({ href, children, active }: { href?: string; children: ReactNode; active?: boolean }) {
  const cls = `inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${
    active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted"
  }`;
  return href ? (
    <Link href={href} className={`${cls} hover:border-accent hover:text-accent`}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}

export function PageHeader({ title, kicker, children }: { title: string; kicker?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8">
      {kicker && <div className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">{kicker}</div>}
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {children && <div className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted">{children}</div>}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-10 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface ${className}`}>{children}</div>;
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-faint">{children}</p>;
}
