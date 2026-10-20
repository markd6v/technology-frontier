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

type ItemProps = { item: FeedItem; hideDomains?: boolean; showDate?: boolean };

function Item({ item, hideDomains, showDate }: ItemProps) {
  const { sources, domains, topics } = registry();
  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id;
  const extra = item.mentions.filter((m) => m.sourceId !== item.firstSourceId);
  const signals = item.mentions.flatMap((m) =>
    Object.entries(m.signals)
      .filter(([k]) => SIGNAL_LABEL[k])
      .map(([k, v]) => SIGNAL_LABEL[k](v)),
  );
  const offTopic = item.relevant === false;

  const meta: React.ReactNode[] = [];
  if (item.quality != null) {
    meta.push(
      <Link key="q" href="/framework#scores" className="tabular-nums text-ink" title={`Quality ${item.quality} of 100`}>
        {item.quality}
      </Link>,
    );
  }
  if (showDate) meta.push(<span key="date">{dayLabel(item.sortAt)}</span>);
  meta.push(
    <Link key="src" href={`/sources/${item.firstSourceId}`} className="hover:text-ink">
      {sourceName(item.firstSourceId)}
      {extra.length > 0 && (
        <span className="text-ink" title={extra.map((m) => sourceName(m.sourceId)).join(", ")}>
          {" "}
          +{extra.length}
        </span>
      )}
    </Link>,
  );
  if (!hideDomains) {
    for (const slug of item.domains) {
      meta.push(
        <Link key={slug} href={`/d/${slug}`} className="hover:text-ink">
          {domains.find((d) => d.slug === slug)?.short ?? slug}
        </Link>,
      );
    }
  }
  for (const slug of item.tags.slice(0, 3)) {
    meta.push(
      <Link key={`t-${slug}`} href={`/feed?tag=${slug}`} className="hover:text-ink">
        #{topics.find((t) => t.slug === slug)?.name.toLowerCase() ?? slug}
      </Link>,
    );
  }
  if (offTopic) meta.push(<span key="off">off-topic</span>);
  if (signals.length) meta.push(<span key="sig" className="text-ink">{signals.join(" ")}</span>);

  return (
    <li className={`py-3 ${offTopic ? "opacity-60" : ""}`}>
      <ExternalLink
        href={item.url}
        className="font-serif text-[17px] leading-snug text-ink decoration-faint hover:underline sm:text-lg"
      >
        {item.title}
      </ExternalLink>
      {item.takeaway && <p className="mt-0.5 text-[15px] leading-snug text-muted">{item.takeaway}</p>}
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

/**
 * Items newest first under day headings, or with `flat` in the order given (e.g. by rank),
 * each showing its own date.
 */
export function ItemList({ items, hideDomains, flat }: { items: FeedItem[]; hideDomains?: boolean; flat?: boolean }) {
  if (flat) {
    return (
      <ul className="divide-y divide-line border-t border-line">
        {items.map((item) => (
          <Item key={item.id} item={item} hideDomains={hideDomains} showDate />
        ))}
      </ul>
    );
  }
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
