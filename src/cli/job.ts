/**
 * Run a job locally without the HTTP layer.
 *   npm run job ingest                  # sources that are due
 *   npm run job ingest -- --force       # every automatic source
 *   npm run job ingest -- --source=hf-daily-papers,lwn --force
 *   npm run job assess -- --limit=40 --dry-run
 *   npm run job assess -- --retag       # also redo items from older prompt versions
 *   npm run job hourly | rank | maintenance
 */
import { parseArgs } from "node:util";
import { closeDb } from "@/lib/db";
import { isJobName, runJob } from "@/lib/jobs";
import type { IngestResult } from "@/lib/pipeline/ingest";
import type { assessItems } from "@/lib/pipeline/assess";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    force: { type: "boolean", default: false },
    source: { type: "string" },
    limit: { type: "string" },
    retag: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const name = positionals[0];
if (!name || !isJobName(name)) {
  console.error(
    "usage: npm run job <hourly|ingest|assess|rank|maintenance> [-- --force] [--source=a,b] [--limit=N] [--retag] [--dry-run]",
  );
  process.exit(1);
}

function printIngest(stats: IngestResult) {
  for (const s of stats.sources) {
    const status = s.ok ? "ok  " : "FAIL";
    console.log(`${status} ${s.sourceId.padEnd(24)} fetched=${String(s.fetched).padStart(4)} new=${String(s.inserted).padStart(4)} ${s.ms}ms${s.error ? `  ${s.error}` : ""}`);
  }
  if (stats.skippedForTime.length) console.log(`skipped (time budget): ${stats.skippedForTime.join(", ")}`);
  console.log(`total new items: ${stats.inserted}`);
}

function printAssess(stats: Awaited<ReturnType<typeof assessItems>>) {
  for (const r of stats.rows ?? []) {
    const scores = [r.novelty, r.magnitude, r.evidence, r.breadth, r.maturity].join("");
    console.log(
      `${String(r.quality).padStart(3)} ${scores} ${r.relevant ? " " : "✗"} ${r.contribution.padEnd(20)} ` +
        `${r.domains.join(",")} [${r.topics.join(", ")}]${r.proposedTopics.length ? ` +(${r.proposedTopics.join(", ")})` : ""}\n` +
        `    #${r.itemId} ${r.takeaway}\n    ${r.rationale}`,
    );
  }
  console.log(
    `assessed ${stats.assessed} of ${stats.candidates} in ${stats.calls} calls, $${stats.costUsd.toFixed(4)}` +
      (stats.failedCalls ? `, ${stats.failedCalls} failed` : "") +
      (stats.unknownIds ? `, ${stats.unknownIds} unknown ids dropped` : "") +
      (stats.invalid ? `, ${stats.invalid} invalid results` : "") +
      (stats.stoppedBy ? ` — stopped: ${stats.stoppedBy}` : ""),
  );
  for (const e of stats.errors) console.log(`  error: ${e}`);
}

try {
  const result = await runJob(name, "cli", {
    force: values.force,
    sourceIds: values.source?.split(",").map((s) => s.trim()),
    limit: values.limit ? Number(values.limit) : undefined,
    retag: values.retag,
    dryRun: values["dry-run"],
  });
  if (result.skipped) {
    console.log(result.reason);
  } else {
    const stats = result.stats as Record<string, unknown>;
    if (name === "ingest") printIngest(stats as IngestResult);
    else if (name === "hourly" || name === "assess") {
      if (stats.ingest) printIngest(stats.ingest as IngestResult);
      printAssess(stats.assess as Awaited<ReturnType<typeof assessItems>>);
      if (stats.rank) console.log(`ranked ${(stats.rank as { ranked: number }).ranked} items`);
    } else console.log(JSON.stringify(stats, null, 2));
  }
} finally {
  await closeDb();
}
