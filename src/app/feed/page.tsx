import type { Metadata } from "next";
import Link from "next/link";
import { ItemList } from "@/components/item-list";
import { Empty, FilterLink, FilterRow, LAYER_LABEL, PageHeader } from "@/components/ui";
import { getFeed, PAGE_SIZE, type FeedFilters } from "@/lib/queries";
import { KINDS, LAYERS, registry, type Layer } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Latest" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

function hrefWith(current: FeedFilters, patch: Partial<FeedFilters>) {
  const next = { ...current, ...patch, page: patch.page };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v != null && v !== "" && !(k === "page" && v === 1)) params.set(k, String(v));
  const qs = params.toString();
  return qs ? `/feed?${qs}` : "/feed";
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { domains, sources } = registry();
  const filters: FeedFilters = {
    domain: one(sp.domain),
    layer: one(sp.layer),
    kind: one(sp.kind),
    source: one(sp.source),
    q: one(sp.q),
    page: Math.max(1, Number(one(sp.page)) || 1),
  };
  const { items, total } = await getFeed(filters);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const automaticSources = sources.filter((s) => s.method !== "manual");
  const sourceName = sources.find((s) => s.id === filters.source)?.name;
  const fieldCls = "rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm";

  return (
    <>
      <PageHeader title="Latest">
        {total.toLocaleString()} items, newest first. An item reported by several sources appears once, marked +N.
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
        {(["domain", "layer", "source", "kind"] as const).map(
          (k) => filters[k] && <input key={k} type="hidden" name={k} value={filters[k]} />,
        )}
      </form>

      <div className="mb-8 border-b border-line pb-2">
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
            {(["domain", "layer", "q"] as const).map(
              (k) => filters[k] && <input key={k} type="hidden" name={k} value={filters[k]} />,
            )}
            <button className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-faint">Apply</button>
          </form>
        </details>
      </div>

      {items.length ? (
        <ItemList items={items} hideDomains={Boolean(filters.domain)} />
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
