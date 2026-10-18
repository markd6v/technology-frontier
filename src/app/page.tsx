import Link from "next/link";
import { ItemList } from "@/components/item-list";
import { Empty, LAYER_LABEL, MoreLink, PageHeader, Section } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getFeed, getLayerBoard, getSourceHealth } from "@/lib/queries";
import { LAYERS, registry, type Layer } from "@/lib/registry";

export const dynamic = "force-dynamic";

const DAYS = 7;
const LAYER_ABBR: Record<Layer, string> = { scientific: "Sci", engineering: "Eng", product: "Prod" };
const GRID = "grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] gap-x-3 sm:grid-cols-[7.5rem_repeat(3,minmax(0,1fr))] sm:gap-x-4";

export default async function Home() {
  const { domains, sources } = registry();
  const automatic = sources.filter((s) => s.method !== "manual");
  const [board, latest, health] = await Promise.all([getLayerBoard(DAYS), getFeed({}), getSourceHealth()]);

  const healthy = automatic.filter((s) => health[s.id]?.lastSuccessAt && !health[s.id]?.lastError).length;
  const lastSuccess = Object.values(health)
    .map((h) => h.lastSuccessAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <>
      <PageHeader title="Where the frontier is moving">
        New results, engineering work and releases from the last {DAYS} days, by domain. Every item comes from a
        paper, a lab, or an official release channel. <MoreLink href="/framework">How to read this</MoreLink>
      </PageHeader>

      <div role="table" aria-label={`Items per domain and layer, last ${DAYS} days`} className="text-sm">
        <div role="row" className={`${GRID} border-b border-line pb-2 text-faint`}>
          <span role="columnheader" />
          {LAYERS.map((l) => (
            <span key={l} role="columnheader" title={LAYER_LABEL[l as Layer]}>
              <span className="sm:hidden">{LAYER_ABBR[l as Layer]}</span>
              <span className="max-sm:hidden">{LAYER_LABEL[l as Layer]}</span>
            </span>
          ))}
        </div>
        {domains.map((d) => {
          const row = board[d.slug] ?? {};
          const max = Math.max(1, ...LAYERS.map((l) => row[l]?.n ?? 0));
          return (
            <div key={d.slug} role="row" className={`${GRID} border-b border-line py-3`}>
              <Link role="rowheader" href={`/d/${d.slug}`} className="truncate font-medium hover:underline">
                {d.short}
              </Link>
              {LAYERS.map((l) => {
                const cell = row[l];
                if (!cell) {
                  return (
                    <span key={l} role="cell" className="text-faint">
                      –
                    </span>
                  );
                }
                return (
                  <Link
                    key={l}
                    role="cell"
                    href={`/feed?domain=${d.slug}&layer=${l}`}
                    className="group min-w-0"
                    title={cell.topTitle}
                  >
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{cell.n}</span>
                      <span className="h-1 flex-1 rounded-full bg-wash">
                        <span
                          className="block h-1 rounded-full bg-ink/70"
                          style={{ width: `${Math.max(6, (cell.n / max) * 100)}%` }}
                        />
                      </span>
                    </span>
                    <span className="mt-1 hidden text-[13px] leading-snug text-muted group-hover:text-ink sm:line-clamp-2">
                      {cell.topTitle}
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      <Section title="Latest" action={<MoreLink href="/feed">All items</MoreLink>}>
        {latest.items.length ? (
          <ItemList items={latest.items.slice(0, 10)} />
        ) : (
          <Empty>No items yet. Run `npm run job ingest`.</Empty>
        )}
      </Section>

      <p className="mt-10 text-sm text-faint">
        <Link href="/sources" className="hover:text-ink">
          {healthy} of {automatic.length} sources healthy
        </Link>
        {lastSuccess && <> · last fetch {timeAgo(lastSuccess)}</>}
      </p>
    </>
  );
}
