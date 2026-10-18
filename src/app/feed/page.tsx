import type { Metadata } from "next";
import Link from "next/link";
import { ItemCard } from "@/components/item-card";
import { Card, Chip, Empty, LAYER_LABEL, PageHeader } from "@/components/ui";
import { getFeed, PAGE_SIZE, type FeedFilters } from "@/lib/queries";
import { KINDS, LAYERS, registry, type Layer } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Feed" };

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
  const selectCls = "w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm";

  return (
    <>
      <PageHeader title="Feed" kicker={`${total.toLocaleString()} items`}>
        Everything the sources reported, newest first. When one item turns up in several sources, it&apos;s merged
        and marked with “+N sources”.
      </PageHeader>

      <form action="/feed" className="mb-4 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search titles and abstracts…"
          className={selectCls}
          aria-label="Search"
        />
        <select name="domain" defaultValue={filters.domain ?? ""} className={selectCls} aria-label="Domain">
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
        <select name="kind" defaultValue={filters.kind ?? ""} className={selectCls} aria-label="Source type">
          <option value="">All source types</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select name="source" defaultValue={filters.source ?? ""} className={selectCls} aria-label="Source">
          <option value="">All sources</option>
          {automaticSources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {filters.layer && <input type="hidden" name="layer" value={filters.layer} />}
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white dark:text-black">Apply</button>
      </form>

      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        <Chip href={hrefWith(filters, { layer: undefined, page: 1 })} active={!filters.layer}>
          All layers
        </Chip>
        {LAYERS.map((l) => (
          <Chip key={l} href={hrefWith(filters, { layer: l, page: 1 })} active={filters.layer === l}>
            {LAYER_LABEL[l as Layer]}
          </Chip>
        ))}
        {(filters.q || filters.domain || filters.kind || filters.source || filters.layer) && (
          <Link href="/feed" className="ml-2 text-xs text-accent hover:underline">
            Clear filters
          </Link>
        )}
      </div>

      <Card className="px-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
        {!items.length && (
          <div className="py-6">
            <Empty>Nothing matches these filters.</Empty>
          </div>
        )}
      </Card>

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
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
