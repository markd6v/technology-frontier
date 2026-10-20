import Link from "next/link";
import { ItemList } from "@/components/item-list";
import { Empty, FilterLink, FilterRow, LAYER_LABEL } from "@/components/ui";
import { PAGE_SIZE, type FeedFilters, type FeedItem } from "@/lib/queries";
import { LAYERS, registry, type Layer } from "@/lib/registry";

export type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export const SORTS = {
  week: { label: "Top this week", sort: "top", days: 7 },
  month: { label: "Top this month", sort: "top", days: 30 },
  newest: { label: "Newest", sort: undefined, days: undefined },
} as const;
export type SortKey = keyof typeof SORTS;
const isSort = (v: string | undefined): v is SortKey => v != null && v in SORTS;

/** What a feed URL asks for. `sort` is omitted from URLs when it equals the page's default. */
export type FeedParams = {
  sort: SortKey;
  domain?: string;
  layer?: string;
  tag?: string;
  source?: string;
  q?: string;
  all?: boolean;
  page: number;
};

export function readFeedParams(sp: Search, defaultSort: SortKey): FeedParams {
  const sort = one(sp.sort);
  return {
    sort: isSort(sort) ? sort : defaultSort,
    domain: one(sp.domain),
    layer: one(sp.layer),
    tag: one(sp.tag),
    source: one(sp.source),
    q: one(sp.q),
    all: one(sp.all) === "1",
    page: Math.max(1, Number(one(sp.page)) || 1),
  };
}

export function toFilters(p: FeedParams): FeedFilters {
  const { sort, days } = SORTS[p.sort];
  return { domain: p.domain, layer: p.layer, tag: p.tag, source: p.source, q: p.q, all: p.all, sort, days, page: p.page };
}

export type Href = (patch: Partial<FeedParams>) => string;

/** Builds links that change some params and keep the rest. Any change other than the page goes back to page 1. */
export function feedHref(base: string, current: FeedParams, defaultSort: SortKey): Href {
  return (patch) => {
    const next = { ...current, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.sort !== defaultSort) params.set("sort", next.sort);
    for (const k of ["domain", "layer", "tag", "source", "q"] as const) if (next[k]) params.set(k, next[k]);
    if (next.all) params.set("all", "1");
    if (next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };
}

export function SortRow({ params, href }: { params: FeedParams; href: Href }) {
  return (
    <FilterRow label="Sort">
      {(Object.keys(SORTS) as SortKey[]).map((k) => (
        <FilterLink key={k} href={href({ sort: k })} active={params.sort === k}>
          {SORTS[k].label}
        </FilterLink>
      ))}
    </FilterRow>
  );
}

export function LayerRow({ params, href }: { params: FeedParams; href: Href }) {
  return (
    <FilterRow label="Layer">
      <FilterLink href={href({ layer: undefined })} active={!params.layer}>
        All
      </FilterLink>
      {LAYERS.map((l) => (
        <FilterLink key={l} href={href({ layer: l })} active={params.layer === l}>
          {LAYER_LABEL[l as Layer]}
        </FilterLink>
      ))}
    </FilterRow>
  );
}

/**
 * The domain's own topics with item counts; tags from other domains on its items are left out.
 * The selected topic stays listed even when it has none.
 */
export function TopicRow({
  params,
  href,
  domain,
  counts,
}: {
  params: FeedParams;
  href: Href;
  domain: string;
  counts: { tag: string; n: number }[];
}) {
  const { topics } = registry();
  const own = counts.filter((c) => topics.some((t) => t.slug === c.tag && t.domain === domain));
  const shown = params.tag && !own.some((c) => c.tag === params.tag) ? [...own, { tag: params.tag, n: 0 }] : own;
  if (!shown.length) return null;
  return (
    <FilterRow label="Topic">
      <FilterLink href={href({ tag: undefined })} active={!params.tag}>
        All
      </FilterLink>
      {shown.map((t) => (
        <FilterLink key={t.tag} href={href({ tag: t.tag })} active={params.tag === t.tag}>
          {topics.find((x) => x.slug === t.tag)?.name ?? t.tag}
          {t.n > 0 && <span className="ml-1 text-xs tabular-nums text-faint">{t.n}</span>}
        </FilterLink>
      ))}
    </FilterRow>
  );
}

/** A line saying how many items the default view leaves out, with a link to show or hide them. */
export function HiddenNote({ params, href, hidden }: { params: FeedParams; href: Href; hidden: number }) {
  if (params.all) {
    return (
      <p className="mb-4 text-sm text-faint">
        Showing off-topic and low-scoring items too.{" "}
        <Link href={href({ all: undefined })} className="text-accent hover:underline">
          Hide them
        </Link>
      </p>
    );
  }
  if (!hidden) return null;
  return (
    <p className="mb-4 text-sm text-faint">
      {hidden.toLocaleString()} off-topic or low-scoring {hidden === 1 ? "item" : "items"} hidden.{" "}
      <Link href={href({ all: true })} className="text-accent hover:underline">
        Show all
      </Link>
    </p>
  );
}

export function FeedResults({
  params,
  href,
  items,
  total,
  hideDomains,
}: {
  params: FeedParams;
  href: Href;
  items: FeedItem[];
  total: number;
  hideDomains?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ranked = SORTS[params.sort].sort === "top";
  return (
    <>
      {items.length ? (
        <ItemList items={items} hideDomains={hideDomains} flat={ranked} />
      ) : (
        <Empty>Nothing matches these filters.</Empty>
      )}
      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pagination">
          {params.page > 1 ? (
            <Link href={href({ page: params.page - 1 })} className="text-accent hover:underline">
              ← {ranked ? "Previous" : "Newer"}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-faint">
            Page {params.page} of {pages}
          </span>
          {params.page < pages ? (
            <Link href={href({ page: params.page + 1 })} className="text-accent hover:underline">
              {ranked ? "Next" : "Older"} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
