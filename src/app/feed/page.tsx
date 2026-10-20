import type { Metadata } from "next";
import Link from "next/link";
import {
  FeedResults,
  feedHref,
  HiddenNote,
  LayerRow,
  readFeedParams,
  SortRow,
  toFilters,
  TopicRow,
  type FeedParams,
  type Search,
} from "@/components/feed";
import { FilterLink, FilterRow, LAYER_LABEL, PageHeader } from "@/components/ui";
import { getFeed, getTagCounts } from "@/lib/queries";
import { registry, type Layer } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "All items" };

const DEFAULT_SORT = "week";

export default async function FeedPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = readFeedParams(await searchParams, DEFAULT_SORT);
  const href = feedHref("/feed", params, DEFAULT_SORT);
  const { domains, sources, topics } = registry();
  const [{ items, total, hidden }, tagCounts] = await Promise.all([
    getFeed(toFilters(params)),
    params.domain ? getTagCounts(30, params.domain) : Promise.resolve([]),
  ]);

  // Active filters inside the collapsed panel, each with a link that removes it.
  const active: { label: string; clear: Partial<FeedParams> }[] = [];
  if (params.domain)
    active.push({ label: domains.find((d) => d.slug === params.domain)?.short ?? params.domain, clear: { domain: undefined, tag: undefined } });
  if (params.layer) active.push({ label: LAYER_LABEL[params.layer as Layer] ?? params.layer, clear: { layer: undefined } });
  if (params.tag) active.push({ label: topics.find((t) => t.slug === params.tag)?.name ?? params.tag, clear: { tag: undefined } });
  if (params.source) active.push({ label: sources.find((s) => s.id === params.source)?.name ?? params.source, clear: { source: undefined } });

  return (
    <>
      <PageHeader title="All items">
        {!params.domain && "Every domain in one list. "}
        {total.toLocaleString()} items, {params.sort === "newest" ? "newest first" : "highest ranked first"}.
        An item reported by several sources appears once, marked +N.
      </PageHeader>

      <form action="/feed" className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Search titles and abstracts"
          className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm"
          aria-label="Search"
        />
        {(["domain", "layer", "tag", "source"] as const).map(
          (k) => params[k] && <input key={k} type="hidden" name={k} value={params[k]} />,
        )}
        {params.sort !== DEFAULT_SORT && <input type="hidden" name="sort" value={params.sort} />}
        {params.all && <input type="hidden" name="all" value="1" />}
      </form>

      <div className="mb-6 border-b border-line pb-2">
        <SortRow params={params} href={href} />
        <details className="py-1.5 text-sm" open={Boolean(params.domain || params.layer || params.tag)}>
          <summary className="cursor-pointer list-none text-muted hover:text-ink">
            <span className="inline-grid w-14 text-faint">Filters</span>
            {active.length ? (
              <span className="inline-flex flex-wrap gap-x-3">
                {active.map((a) => (
                  <span key={a.label} className="text-ink">
                    {a.label}{" "}
                    <Link href={href(a.clear)} className="text-faint hover:text-ink" aria-label={`Remove ${a.label}`}>
                      ×
                    </Link>
                  </span>
                ))}
              </span>
            ) : (
              "domain, layer"
            )}
          </summary>
          <div className="mt-1">
            <FilterRow label="Domain">
              <FilterLink href={href({ domain: undefined, tag: undefined })} active={!params.domain}>
                All
              </FilterLink>
              {domains.map((d) => (
                <FilterLink key={d.slug} href={href({ domain: d.slug, tag: undefined })} active={params.domain === d.slug}>
                  {d.short}
                </FilterLink>
              ))}
            </FilterRow>
            <LayerRow params={params} href={href} />
            {params.domain && <TopicRow params={params} href={href} domain={params.domain} counts={tagCounts} />}
          </div>
        </details>
      </div>

      <HiddenNote params={params} href={href} hidden={hidden} />
      <FeedResults params={params} href={href} items={items} total={total} hideDomains={Boolean(params.domain)} />
    </>
  );
}
