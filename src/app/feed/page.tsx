import type { Metadata } from "next";
import Link from "next/link";
import { ItemList } from "@/components/item-list";
import { Empty, FilterLink, FilterRow, LAYER_LABEL, PageHeader } from "@/components/ui";
import { getFeed, getTagCounts, PAGE_SIZE, type FeedFilters } from "@/lib/queries";
import { KINDS, LAYERS, registry, type Layer } from "@/lib/registry";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const TAG_CHOICES = 10;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  return { title: one((await searchParams).sort) === "top" ? "Top" : "Latest" };
}

const SORTS: { label: string; sort?: "top"; days?: number }[] = [
  { label: "Newest" },
  { label: "Top this week", sort: "top", days: 7 },
  { label: "Top this month", sort: "top", days: 30 },
  { label: "Top all time", sort: "top" },
];

function hrefWith(current: FeedFilters, patch: Partial<FeedFilters>) {
  const next = { ...current, ...patch, page: patch.page };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v != null && v !== "" && !(k === "page" && v === 1)) params.set(k, String(v));
  const qs = params.toString();
  return qs ? `/feed?${qs}` : "/feed";
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { domains, sources, topics } = registry();
  const sort = one(sp.sort) === "top" ? "top" : undefined;
  const filters: FeedFilters = {
    domain: one(sp.domain),
    layer: one(sp.layer),
    kind: one(sp.kind),
    source: one(sp.source),
    tag: one(sp.tag),
    q: one(sp.q),
    sort,
    days: sort ? Number(one(sp.days)) || undefined : undefined,
    page: Math.max(1, Number(one(sp.page)) || 1),
  };
  const [{ items, total }, tagCounts] = await Promise.all([getFeed(filters), getTagCounts(30, filters.domain)]);
  const topicName = (slug: string) => topics.find((t) => t.slug === slug)?.name ?? slug;
  const tagChoices = tagCounts.slice(0, TAG_CHOICES).map((t) => t.tag);
  if (filters.tag && !tagChoices.includes(filters.tag)) tagChoices.push(filters.tag);
  const sortLabel = SORTS.find((o) => o.sort === filters.sort && o.days === filters.days)?.label;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const automaticSources = sources.filter((s) => s.method !== "manual");
  const sourceName = sources.find((s) => s.id === filters.source)?.name;
  const fieldCls = "rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm";

  return (
    <>
      <PageHeader title={filters.sort ? (sortLabel ?? "Top") : "Latest"}>
        {total.toLocaleString()} items, {filters.sort ? "highest ranked first" : "newest first"}. An item reported by
        several sources appears once, marked +N. The number before the source is its quality score out of 100.
      </PageHeader>

      <form action="/feed" className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search titles and abstracts"
          className={`${fieldCls} min-w-0 flex-1`}
          aria-label="Search"
        />
        {(["domain", "layer", "source", "kind", "tag", "sort", "days"] as const).map(
          (k) => filters[k] && <input key={k} type="hidden" name={k} value={filters[k]} />,
        )}
      </form>

      <div className="mb-8 border-b border-line pb-2">
        <FilterRow label="Sort">
          {SORTS.map((o) => (
            <FilterLink
              key={o.label}
              href={hrefWith(filters, { sort: o.sort, days: o.days, page: 1 })}
              active={filters.sort === o.sort && filters.days === o.days}
            >
              {o.label}
            </FilterLink>
          ))}
        </FilterRow>
        <FilterRow label="Domain">
          <FilterLink href={hrefWith(filters, { domain: undefined, page: 1 })} active={!filters.domain}>
            All
          </FilterLink>
          {domains.map((d) => (
            <FilterLink key={d.slug} href={hrefWith(filters, { domain: d.slug, page: 1 })} active={filters.domain === d.slug}>
              {d.short}
            </FilterLink>
          ))}
        </FilterRow>
        <FilterRow label="Layer">
          <FilterLink href={hrefWith(filters, { layer: undefined, page: 1 })} active={!filters.layer}>
            All
          </FilterLink>
          {LAYERS.map((l) => (
            <FilterLink key={l} href={hrefWith(filters, { layer: l, page: 1 })} active={filters.layer === l}>
              {LAYER_LABEL[l as Layer]}
            </FilterLink>
          ))}
        </FilterRow>

        {tagChoices.length > 0 && (
          <FilterRow label="Topic">
            <FilterLink href={hrefWith(filters, { tag: undefined, page: 1 })} active={!filters.tag}>
              All
            </FilterLink>
            {tagChoices.map((t) => (
              <FilterLink key={t} href={hrefWith(filters, { tag: t, page: 1 })} active={filters.tag === t}>
                {topicName(t)}
              </FilterLink>
            ))}
          </FilterRow>
        )}

        <details className="group py-1.5 text-sm" open={Boolean(filters.source || filters.kind)}>
          <summary className="cursor-pointer list-none text-muted hover:text-ink">
            <span className="text-faint">More</span>{" "}
            {sourceName || filters.kind ? (
              <>
                {[sourceName, filters.kind].filter(Boolean).join(", ")} ·{" "}
                <Link href={hrefWith(filters, { source: undefined, kind: undefined, page: 1 })} className="text-accent">
                  clear
                </Link>
              </>
            ) : (
              "source, type"
            )}
          </summary>
          <form action="/feed" className="mt-2 flex flex-wrap gap-2">
            <select name="source" defaultValue={filters.source ?? ""} className={fieldCls} aria-label="Source">
              <option value="">All sources</option>
              {automaticSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select name="kind" defaultValue={filters.kind ?? ""} className={fieldCls} aria-label="Source type">
              <option value="">All source types</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            {(["domain", "layer", "tag", "sort", "days", "q"] as const).map(
              (k) => filters[k] && <input key={k} type="hidden" name={k} value={filters[k]} />,
            )}
            <button className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-faint">Apply</button>
          </form>
        </details>
      </div>

      {items.length ? (
        <ItemList items={items} hideDomains={Boolean(filters.domain)} flat={Boolean(filters.sort)} />
      ) : (
        <Empty>Nothing matches these filters.</Empty>
      )}

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pagination">
          {filters.page! > 1 ? (
            <Link href={hrefWith(filters, { page: filters.page! - 1 })} className="text-accent hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-faint">
            Page {filters.page} of {pages}
          </span>
          {filters.page! < pages ? (
            <Link href={hrefWith(filters, { page: filters.page! + 1 })} className="text-accent hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
