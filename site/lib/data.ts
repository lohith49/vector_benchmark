import fs from "node:fs";
import path from "node:path";
import type { ReportBundle } from "./types";

// Re-export client-safe constants for convenience on the server side.
export { DB_COLORS, DB_LABEL } from "./colors";

/** Loads results.json from /public at build time. Falls back to a placeholder so
 *  `next build` does not fail before the user has run the benchmark. */
export function loadReport(): ReportBundle {
  const p = path.join(process.cwd(), "public", "results.json");
  if (!fs.existsSync(p)) {
    return placeholder();
  }
  const raw = fs.readFileSync(p, "utf8");
  const data = JSON.parse(raw) as ReportBundle;
  return data;
}

function placeholder(): ReportBundle {
  return {
    generated_at: new Date().toISOString(),
    model: "n/a",
    run: {
      id: "no-run-yet",
      started_at: new Date().toISOString(),
      host: "—",
      platform: "—",
      config: { note: "Run `make bench && make report` to populate this site." },
    },
    results: [],
    narrative: {
      headline: "Run the benchmark to populate this report.",
      tl_dr: [
        "No benchmark data yet.",
        "Run `make up && make datasets && make pf-bg && make bench && make report`.",
        "Then `make site` will rebuild this page with the results.",
      ],
      per_database: {},
      recommendation: {
        if_low_latency_critical: "Pending benchmark data.",
        if_high_recall_critical: "Pending benchmark data.",
        if_postgres_already: "Pending benchmark data.",
        if_managed_simplicity: "Pending benchmark data.",
      },
      caveats: ["Benchmark has not been run yet."],
    },
  };
}
