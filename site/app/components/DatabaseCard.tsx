import { DB_COLORS, DB_LABEL } from "../../lib/colors";
import type { Narrative, Result } from "../../lib/types";

type DBNarrative = Narrative["per_database"][string];

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
  // Find the highest recall achieved on each dataset.
  const byDataset = new Map<string, number>();
  for (const r of rows) {
    byDataset.set(r.dataset, Math.max(byDataset.get(r.dataset) ?? 0, r.recall_at_k));
  }
  // Median p50 across all rows for that DB.
  const p50s = rows.map(r => r.p50_ms).sort((a, b) => a - b);
  const medP50 = p50s.length ? p50s[Math.floor(p50s.length / 2)] : 0;
  const bestRecall = rows.length ? Math.max(...rows.map(r => r.recall_at_k)) : 0;
  const peakQps = rows.length ? Math.max(...rows.map(r => r.qps)) : 0;

  return (
    <article className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: DB_COLORS[db] ?? "var(--accent)",
          }}
        />
        <h3>{DB_LABEL[db] ?? db}</h3>
      </div>
      <p className="muted" style={{ marginBottom: 18 }}>{info.summary}</p>

      <div className="metric-row" style={{ marginBottom: 20 }}>
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

      <h4 style={{ marginBottom: 8 }}>Strengths</h4>
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

      <div style={{ marginTop: 20, padding: 14, background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--separator)" }}>
        <div className="subtle" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
          Best fit
        </div>
        <div style={{ fontSize: 15 }}>{info.best_use_case}</div>
      </div>
    </article>
  );
}
