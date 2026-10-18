import type { SourceHealth } from "@/lib/queries";
import type { Source } from "@/lib/registry/schema";

export function SourceStatus({ source, health }: { source: Source; health?: SourceHealth }) {
  if (source.method === "manual") return <span className="text-faint">manual</span>;
  if (!health?.lastRunAt) return <span className="text-faint">not run yet</span>;
  if (health.lastError) {
    return (
      <span className="text-bad" title={health.lastError}>
        failing ×{health.consecutiveFailures}
      </span>
    );
  }
  return <span className="text-ok">ok</span>;
}
