import type { SourceHealth } from "@/lib/queries";
import type { Source } from "@/lib/registry/schema";

export function SourceStatus({ source, health }: { source: Source; health?: SourceHealth }) {
  if (source.method === "manual") return <span className="text-xs text-faint">manual check</span>;
  if (!health?.lastRunAt) return <span className="text-xs text-faint">not run yet</span>;
  if (health.lastError) {
    return (
      <span className="text-xs font-medium text-bad" title={health.lastError}>
        failing ×{health.consecutiveFailures}
      </span>
    );
  }
  return <span className="text-xs font-medium text-ok">ok</span>;
}
