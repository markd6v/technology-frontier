import { loadRegistry } from "@/lib/registry";

try {
  const r = loadRegistry();
  const automatic = r.sources.filter((s) => s.method !== "manual").length;
  console.log(
    `content OK: ${r.domains.length} domains, ${r.sources.length} sources (${automatic} automatic), ` +
      `${r.reference.interpreters.length} interpreters, ${r.reference.publications.length} publications`,
  );
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
