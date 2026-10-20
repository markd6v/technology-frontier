import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  FeedResults,
  feedHref,
  HiddenNote,
  LayerRow,
  readFeedParams,
  SortRow,
  toFilters,
  TopicRow,
  type Search,
} from "@/components/feed";
import { Empty } from "@/components/ui";
import { getFeed, getTagCounts } from "@/lib/queries";
import { getDomain, registry } from "@/lib/registry";
import { DomainHeader } from "./domain-header";

export const dynamic = "force-dynamic";

// The home page already shows each domain's week; a month gives quieter domains a useful list.
const DEFAULT_SORT = "month";
const TOPIC_DAYS = 30;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Search> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = getDomain((await params).slug);
  return { title: d?.name ?? "Domain" };
}

export default async function DomainPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const domain = getDomain(slug);
  if (!domain) notFound();

  const feed = { ...readFeedParams(await searchParams, DEFAULT_SORT), domain: slug, source: undefined, q: undefined };
  const href = feedHref(`/d/${slug}`, { ...feed, domain: undefined }, DEFAULT_SORT);
  const [{ items, total, hidden }, tagCounts] = await Promise.all([
    getFeed(toFilters(feed)),
    getTagCounts(TOPIC_DAYS, slug),
  ]);
  const automatic = registry().sources.some((s) => s.domains.includes(slug) && s.method !== "manual");

  return (
    <>
      <DomainHeader domain={domain} tab="feed" />

      <div className="mb-6 border-b border-line pb-2">
        <SortRow params={feed} href={href} />
        <LayerRow params={feed} href={href} />
        <TopicRow params={feed} href={href} domain={slug} counts={tagCounts} />
      </div>

      <HiddenNote params={feed} href={href} hidden={hidden} />
      {automatic || total ? (
        <FeedResults params={feed} href={href} items={items} total={total} hideDomains />
      ) : (
        <Empty>No automatic source covers this domain yet. The About tab lists research and product links to check.</Empty>
      )}
    </>
  );
}
