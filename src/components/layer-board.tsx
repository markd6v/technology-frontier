import Link from "next/link";
import { Fragment } from "react";
import { LAYER_LABEL, TIER_LABEL } from "@/components/ui";
import type { BoardCell } from "@/lib/queries";
import { LAYERS, TIERS, type Domain, type Layer } from "@/lib/registry";

const LAYER_ABBR: Record<Layer, string> = { scientific: "Sci", engineering: "Eng", product: "Prod" };
const GRID = "grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] gap-x-3 sm:grid-cols-[7.5rem_repeat(3,minmax(0,1fr))] sm:gap-x-4";

/** Items per domain × layer, grouped by coverage tier, each cell linking to that slice of the domain's week. */
export function LayerBoard({
  domains,
  board,
  days,
}: {
  domains: Domain[];
  board: Record<string, Record<string, BoardCell>>;
  days: number;
}) {
  return (
    <div role="table" aria-label={`Items per domain and layer, last ${days} days`} className="text-sm">
      <div role="row" className={`${GRID} border-b border-line pb-2 text-faint`}>
        <span role="columnheader" />
        {LAYERS.map((l) => (
          <span key={l} role="columnheader" title={LAYER_LABEL[l as Layer]}>
            <span className="sm:hidden">{LAYER_ABBR[l as Layer]}</span>
            <span className="max-sm:hidden">{LAYER_LABEL[l as Layer]}</span>
          </span>
        ))}
      </div>
      {TIERS.map((tier) => (
        <Fragment key={tier}>
          <div role="row" className="border-b border-line pt-5 pb-1.5 text-faint">
            <span role="cell">{TIER_LABEL[tier]}</span>
          </div>
          {domains
            .filter((d) => d.tier === tier)
            .map((d) => {
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
                        href={`/d/${d.slug}?sort=week&layer=${l}`}
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
        </Fragment>
      ))}
    </div>
  );
}
