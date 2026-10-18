import Link from "next/link";
import { compact, dayLabel } from "@/lib/format";
import type { FeedItem } from "@/lib/queries";
import { registry } from "@/lib/registry";
import { ExternalLink } from "./ui";

const SIGNAL_LABEL: Record<string, (n: number) => string> = {
  hn_points: (n) => `▲ ${compact(n)}`,
  hf_upvotes: (n) => `▲ ${compact(n)}`,
  stars: (n) => `★ ${compact(n)}`,
};

function Item({ item, hideDomains }: { item: FeedItem; hideDomains?: boolean }) {
  const { sources, domains } = registry();
  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id;
  const extra = item.mentions.filter((m) => m.sourceId !== item.firstSourceId);
  const signals = item.mentions.flatMap((m) =>
    Object.entries(m.signals)
      .filter(([k]) => SIGNAL_LABEL[k])
      .map(([k, v]) => SIGNAL_LABEL[k](v)),
  );

  const meta: React.ReactNode[] = [
    <Link key="src" href={`/sources/${item.firstSourceId}`} className="hover:text-ink">
      {sourceName(item.firstSourceId)}
      {extra.length > 0 && (
        <span className="text-ink" title={extra.map((m) => sourceName(m.sourceId)).join(", ")}>
          {" "}
          +{extra.length}
        </span>
      )}
    </Link>,
  ];
  if (!hideDomains) {
    for (const slug of item.domains) {
      meta.push(
        <Link key={slug} href={`/d/${slug}`} className="hover:text-ink">
          {domains.find((d) => d.slug === slug)?.short ?? slug}
        </Link>,
      );
    }
  }
  meta.push(<span key="layer">{item.layer}</span>);
  if (signals.length) meta.push(<span key="sig" className="text-ink">{signals.join(" ")}</span>);

  return (
    <li className="py-3">
      <ExternalLink
        href={item.url}
        className="font-serif text-[17px] leading-snug text-ink decoration-faint hover:underline sm:text-lg"
      >
        {item.title}
      </ExternalLink>
      <div className="mt-1 flex flex-wrap gap-x-2 text-[13px] text-faint">
        {meta.map((m, i) => (
          <span key={i} className="flex gap-x-2">
            {i > 0 && <span aria-hidden>·</span>}
            {m}
          </span>
        ))}
      </div>
    </li>
  );
}

/** Items grouped under day headings, newest first. */
export function ItemList({ items, hideDomains }: { items: FeedItem[]; hideDomains?: boolean }) {
  const groups: { day: string; items: FeedItem[] }[] = [];
  for (const item of items) {
    const day = dayLabel(item.sortAt);
    if (groups.at(-1)?.day === day) groups.at(-1)!.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return (
    <div>
      {groups.map((g) => (
        <section key={g.day} className="mt-6 first:mt-0">
          <h3 className="border-b border-line pb-1.5 text-sm text-faint">{g.day}</h3>
          <ul className="divide-y divide-line">
            {g.items.map((item) => (
              <Item key={item.id} item={item} hideDomains={hideDomains} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
