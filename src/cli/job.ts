/**
 * Run a job locally without the HTTP layer.
 *   npm run job ingest                  # sources that are due
 *   npm run job ingest -- --force       # every automatic source
 *   npm run job ingest -- --source=arxiv-cs-ro,hf-daily-papers --force
 *   npm run job maintenance
 */
import { parseArgs } from "node:util";
import { closeDb } from "@/lib/db";
import { isJobName, runJob } from "@/lib/jobs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { force: { type: "boolean", default: false }, source: { type: "string" } },
});

const name = positionals[0];
if (!name || !isJobName(name)) {
  console.error(`usage: npm run job <ingest|maintenance> [-- --force] [--source=a,b]`);
  process.exit(1);
}

try {
  const result = await runJob(name, "cli", {
    force: values.force,
    sourceIds: values.source?.split(",").map((s) => s.trim()),
  });
  if (result.skipped) {
    console.log(result.reason);
  } else if (name === "ingest") {
    const stats = result.stats as Awaited<ReturnType<typeof import("@/lib/pipeline/ingest").runIngest>>;
    for (const s of stats.sources) {
      const status = s.ok ? "ok  " : "FAIL";
      console.log(`${status} ${s.sourceId.padEnd(24)} fetched=${String(s.fetched).padStart(4)} new=${String(s.inserted).padStart(4)} ${s.ms}ms${s.error ? `  ${s.error}` : ""}`);
    }
    if (stats.skippedForTime.length) console.log(`skipped (time budget): ${stats.skippedForTime.join(", ")}`);
    console.log(`total new items: ${stats.inserted}`);
  } else {
    console.log(JSON.stringify(result.stats, null, 2));
  }
} finally {
  await closeDb();
}
