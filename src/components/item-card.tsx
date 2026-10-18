import Link from "next/link";
import { compact, hostOf, timeAgo } from "@/lib/format";
import type { FeedItem } from "@/lib/queries";
import { registry } from "@/lib/registry";
import { ExternalLink, LayerBadge } from "./ui";

const SIGNAL_LABEL: Record<string, (n: number) => string> = {
  hn_points: (n) => `▲ ${compact(n)} HN`,
  hf_upvotes: (n) => `▲ ${compact(n)} HF`,
  stars: (n) => `★ ${compact(n)}`,
};

export function ItemCard({ item, compactView = false }: { item: FeedItem; compactView?: boolean }) {
  const { sources, domains } = registry();
  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id;
  const domainName = (slug: string) => domains.find((d) => d.slug === slug)?.name ?? slug;

  const signals = item.mentions.flatMap((m) =>
    Object.entries(m.signals)
      .filter(([k]) => SIGNAL_LABEL[k])
      .map(([k, v]) => ({ key: `${m.sourceId}:${k}`, label: SIGNAL_LABEL[k](v) })),
  );
  const extraSources = item.mentions.filter((m) => m.sourceId !== item.firstSourceId);

  return (
    <article className="group border-b border-line py-4 last:border-b-0">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
        <LayerBadge layer={item.layer} />
        <Link href={`/sources/${item.firstSourceId}`} className="font-medium text-muted hover:text-accent">
          {sourceName(item.firstSourceId)}
        </Link>
        {extraSources.length > 0 && (
          <span title={extraSources.map((m) => sourceName(m.sourceId)).join(", ")} className="text-accent">
            +{extraSources.length} source{extraSources.length > 1 ? "s" : ""}
          </span>
        )}
        <span aria-hidden>·</span>
        <time dateTime={item.sortAt} title={new Date(item.sortAt).toISOString()}>
          {timeAgo(item.sortAt)}
        </time>
        <span aria-hidden>·</span>
        <span>{hostOf(item.url)}</span>
      </div>

      <h3 className="text-[15px] font-medium leading-snug">
        <ExternalLink href={item.url} className="hover:text-accent hover:underline">
          {item.title}
        </ExternalLink>
      </h3>

      {!compactView && item.excerpt && (
        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted">{item.excerpt}</p>
      )}

      {!compactView && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          {item.domains.map((d) => (
            <Link
              key={d}
              href={`/d/${d}`}
              className="rounded-md bg-surface-2 px-1.5 py-0.5 text-muted hover:text-accent"
            >
              {domainName(d)}
            </Link>
          ))}
          {signals.map((s) => (
            <span key={s.key} className="rounded-md px-1.5 py-0.5 font-medium text-warn">
              {s.label}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
