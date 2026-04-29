import { DB_COLORS, DB_LABEL } from "../../lib/colors";
import type { Narrative, Result } from "../../lib/types";

type DBNarrative = Narrative["per_database"][string];

type Rank = { rank: number; total: number; metric: string };

function rankAmong(
  db: string,
  results: Result[],
  pick: (r: Result) => number,
  dir: "asc" | "desc",
  metric: string,
): Rank {
  const byDb = new Map<string, number>();
  for (const r of results) {
    const v = pick(r);
    const cur = byDb.get(r.database);
    if (cur === undefined) byDb.set(r.database, v);
    else byDb.set(r.database, dir === "desc" ? Math.max(cur, v) : Math.min(cur, v));
  }
  const sorted = [...byDb.entries()].sort((a, b) => (dir === "desc" ? b[1] - a[1] : a[1] - b[1]));
  const idx = sorted.findIndex(([d]) => d === db);
  return { rank: idx >= 0 ? idx + 1 : 0, total: sorted.length, metric };
}

const MEDAL: Record<number, { label: string; cls: string }> = {
  1: { label: "1st", cls: "medal-gold" },
  2: { label: "2nd", cls: "medal-silver" },
  3: { label: "3rd", cls: "medal-bronze" },
};

export function DatabaseCard({
  db,
  info,
  results,
}: {
  db: string;
  info: DBNarrative;
  results: Result[];
}) {
  const rows = results.filter(r => r.database === db);
  const p50s = rows.map(r => r.p50_ms).sort((a, b) => a - b);
  const medP50 = p50s.length ? p50s[Math.floor(p50s.length / 2)] : 0;
  const bestRecall = rows.length ? Math.max(...rows.map(r => r.recall_at_k)) : 0;
  const peakQps = rows.length ? Math.max(...rows.map(r => r.qps)) : 0;

  const ranks = [
    rankAmong(db, results, r => r.recall_at_k, "desc", "recall"),
    rankAmong(db, results, r => -r.p50_ms, "desc", "latency"),
    rankAmong(db, results, r => r.qps, "desc", "QPS"),
  ];
  const overallRank = Math.round(
    ranks.reduce((acc, r) => acc + r.rank, 0) / ranks.length,
  );
  const medal = MEDAL[overallRank] ?? { label: `#${overallRank}`, cls: "medal-default" };
  const color = DB_COLORS[db] ?? "var(--accent)";

  return (
    <article className="card db-card" style={{ ["--db-accent" as string]: color }}>
      <div className="db-card-bar" aria-hidden />
      <div className="db-card-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="db-dot" aria-hidden />
          <h3 style={{ margin: 0 }}>{DB_LABEL[db] ?? db}</h3>
        </div>
        <span className={`medal ${medal.cls}`} title="Average rank across recall, p50, QPS">
          {medal.label}
        </span>
      </div>

      <p className="muted" style={{ marginBottom: 18 }}>{info.summary}</p>

      <div className="metric-row" style={{ marginBottom: 18 }}>
        <div className="metric">
          <div className="label">Best recall@10</div>
          <div className="value">{bestRecall.toFixed(3)}</div>
        </div>
        <div className="metric">
          <div className="label">Median p50</div>
          <div className="value">{medP50.toFixed(2)} <span className="subtle" style={{ fontSize: 14 }}>ms</span></div>
        </div>
        <div className="metric">
          <div className="label">Peak QPS</div>
          <div className="value">{peakQps.toFixed(0)}</div>
        </div>
      </div>

      <div className="rank-row" aria-label="rank by metric">
        {ranks.map(r => (
          <div className="rank-chip" key={r.metric}>
            <span className="rank-num">#{r.rank}</span>
            <span className="rank-of subtle">/ {r.total}</span>
            <span className="rank-label">{r.metric}</span>
          </div>
        ))}
      </div>

      <h4 style={{ marginTop: 18, marginBottom: 8 }}>Strengths</h4>
      <ul className="bullet-list">
        {info.strengths.map((s, i) => <li key={i}>{s}</li>)}
      </ul>

      {info.weaknesses?.length > 0 && (
        <>
          <h4 style={{ marginTop: 18, marginBottom: 8 }}>Tradeoffs</h4>
          <ul className="bullet-list weakness">
            {info.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}

      <div className="best-fit">
        <div className="subtle" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
          Best fit
        </div>
        <div style={{ fontSize: 15 }}>{info.best_use_case}</div>
      </div>
    </article>
  );
}
