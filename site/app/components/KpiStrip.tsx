import { DB_COLORS, DB_LABEL } from "../../lib/colors";
import type { Result } from "../../lib/types";

type Winner = {
  label: string;
  hint: string;
  value: string;
  unit?: string;
  db: string;
  detail: string;
  better: "higher" | "lower";
};

function rankBy<T>(rows: T[], key: (r: T) => number, dir: "asc" | "desc") {
  return [...rows].sort((a, b) => (dir === "asc" ? key(a) - key(b) : key(b) - key(a)));
}

function bestPerDB(results: Result[], pick: (r: Result) => number, dir: "asc" | "desc") {
  const map = new Map<string, Result>();
  for (const r of results) {
    const cur = map.get(r.database);
    if (!cur) map.set(r.database, r);
    else if (dir === "desc" ? pick(r) > pick(cur) : pick(r) < pick(cur)) map.set(r.database, r);
  }
  return rankBy([...map.values()], pick, dir);
}

export function KpiStrip({ results }: { results: Result[] }) {
  if (results.length === 0) {
    return (
      <div className="card card-tight muted" style={{ padding: 24 }}>
        No results to summarize. Run the benchmark to populate this dashboard.
      </div>
    );
  }

  // Use the highest-recall row per (db, dataset) as a "tuned" baseline for tail latency.
  const tuned = new Map<string, Result>();
  for (const r of results) {
    const key = `${r.database}::${r.dataset}`;
    const cur = tuned.get(key);
    if (!cur || r.ef_search > cur.ef_search) tuned.set(key, r);
  }
  const tunedRows = [...tuned.values()];

  const lowestP99 = rankBy(tunedRows, r => r.p99_ms, "asc")[0];
  const highestRecall = rankBy(results, r => r.recall_at_k, "desc")[0];
  const peakQps = rankBy(results, r => r.qps, "desc")[0];
  // Insert rate: n_train / insert_seconds (vectors per second).
  const ingest = bestPerDB(
    results,
    r => (r.insert_seconds > 0 ? r.n_train / r.insert_seconds : 0),
    "desc",
  )[0];

  const ingestRate = ingest && ingest.insert_seconds > 0 ? ingest.n_train / ingest.insert_seconds : 0;

  const winners: Winner[] = [
    {
      label: "Lowest p99 latency",
      hint: "@ highest recall tested",
      value: lowestP99.p99_ms.toFixed(2),
      unit: "ms",
      db: lowestP99.database,
      detail: `recall ${lowestP99.recall_at_k.toFixed(3)} · ef=${lowestP99.ef_search} · ${lowestP99.dataset}`,
      better: "lower",
    },
    {
      label: "Highest recall@10",
      hint: "best tuning point",
      value: highestRecall.recall_at_k.toFixed(3),
      db: highestRecall.database,
      detail: `p99 ${highestRecall.p99_ms.toFixed(1)} ms · ef=${highestRecall.ef_search} · ${highestRecall.dataset}`,
      better: "higher",
    },
    {
      label: "Peak QPS",
      hint: "single-thread query rate",
      value: peakQps.qps.toFixed(0),
      unit: "/s",
      db: peakQps.database,
      detail: `recall ${peakQps.recall_at_k.toFixed(3)} · ef=${peakQps.ef_search}`,
      better: "higher",
    },
    {
      label: "Fastest ingest",
      hint: "vectors/second written",
      value: ingestRate >= 1000 ? `${(ingestRate / 1000).toFixed(1)}k` : ingestRate.toFixed(0),
      unit: "/s",
      db: ingest.database,
      detail: `${ingest.n_train.toLocaleString()} in ${ingest.insert_seconds.toFixed(1)}s · ${ingest.dataset}`,
      better: "higher",
    },
  ];

  return (
    <div className="kpi-grid">
      {winners.map(w => {
        const color = DB_COLORS[w.db] ?? "var(--accent)";
        return (
          <div className="kpi" key={w.label} style={{ ["--kpi-accent" as string]: color }}>
            <div className="kpi-head">
              <span className="kpi-label">{w.label}</span>
              <span className="kpi-trend" aria-hidden>
                {w.better === "lower" ? "↓" : "↑"}
              </span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value">{w.value}</span>
              {w.unit && <span className="kpi-unit">{w.unit}</span>}
            </div>
            <div className="kpi-winner">
              <span className="kpi-dot" aria-hidden />
              <span className="kpi-db">{DB_LABEL[w.db] ?? w.db}</span>
              <span className="kpi-medal" aria-label="winner">★</span>
            </div>
            <div className="kpi-detail">{w.detail}</div>
            <div className="kpi-hint subtle">{w.hint}</div>
          </div>
        );
      })}
    </div>
  );
}
