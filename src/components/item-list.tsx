import Link from "next/link";
import { compact, dayLabel } from "@/lib/format";
import type { FeedItem } from "@/lib/queries";
import { registry, type Layer } from "@/lib/registry";
import { ExternalLink, LAYER_LABEL } from "./ui";

const SIGNAL_LABEL: Record<string, (n: number) => string> = {
  hn_points: (n) => `▲ ${compact(n)}`,
  hf_upvotes: (n) => `▲ ${compact(n)}`,
  stars: (n) => `★ ${compact(n)}`,
};

/** `ranked` lists show each item's date and quality score, since neither follows from its position. */
type ItemProps = { item: FeedItem; hideDomains?: boolean; ranked?: boolean };

function Item({ item, hideDomains, ranked }: ItemProps) {
  const { sources, domains, topics, config } = registry();
  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id;
  const extra = item.mentions.filter((m) => m.sourceId !== item.firstSourceId);
  const signals = item.mentions.flatMap((m) =>
    Object.entries(m.signals)
      .filter(([k]) => SIGNAL_LABEL[k])
      .map(([k, v]) => SIGNAL_LABEL[k](v)),
  );
  const offTopic = item.relevant === false;
  // What lists hide by default; only visible after "Show all".
  const dimmed = offTopic || (item.quality != null && item.quality < config.feed.minQuality);

  const meta: React.ReactNode[] = [];
  if (ranked && item.quality != null) {
    meta.push(
      <Link key="q" href="/framework#scores" className="tabular-nums text-ink" title={`Quality ${item.quality} of 100`}>
        {item.quality}
      </Link>,
    );
  }
  if (ranked) meta.push(<span key="date">{dayLabel(item.sortAt)}</span>);
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
  meta.push(<span key="layer">{LAYER_LABEL[item.layer as Layer] ?? item.layer}</span>);
  if (!hideDomains) {
    for (const slug of item.domains) {
      meta.push(
        <Link key={slug} href={`/d/${slug}`} className="hover:text-ink">
          {domains.find((d) => d.slug === slug)?.short ?? slug}
        </Link>,
      );
    }
  }
  if (offTopic) meta.push(<span key="off">off-topic</span>);
  if (signals.length) meta.push(<span key="sig" className="text-ink">{signals.join(" ")}</span>);

  // Topics are chips rather than dot-separated text, so multi-word topics stay apart from each other and from the meta.
  const tags = item.tags.slice(0, 3).map((slug) => {
    const topic = topics.find((t) => t.slug === slug);
    return (
      <Link
        key={slug}
        href={topic ? `/d/${topic.domain}?tag=${slug}` : `/feed?tag=${slug}`}
        className="rounded-sm bg-wash px-1.5 text-muted ring-1 ring-line ring-inset hover:text-ink"
      >
        {topic?.name ?? slug}
      </Link>
    );
  });

  return (
    <li className={`py-3 ${dimmed ? "opacity-60" : ""}`}>
      <ExternalLink
        href={item.url}
        className="font-serif text-[17px] leading-snug text-ink decoration-faint hover:underline sm:text-lg"
      >
        {item.title}
      </ExternalLink>
      {item.takeaway && <p className="mt-0.5 text-[15px] leading-snug text-muted">{item.takeaway}</p>}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-faint">
        {meta.map((m, i) => (
          <span key={i} className="flex gap-x-2">
            {i > 0 && <span aria-hidden>·</span>}
            {m}
          </span>
        ))}
        {tags.length > 0 && <span className="flex flex-wrap gap-1.5 sm:ml-1">{tags}</span>}
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
          <Item key={item.id} item={item} hideDomains={hideDomains} ranked />
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
