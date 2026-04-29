import type { ReportBundle } from "../../lib/types";

function fmt(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const ORDER = [
  "datasets",
  "databases",
  "ef_search_values",
  "hnsw_m",
  "hnsw_ef_construction",
  "dataset_limit",
  "query_limit",
];

const LABELS: Record<string, string> = {
  datasets: "Datasets",
  databases: "Databases",
  ef_search_values: "ef_search sweep",
  hnsw_m: "HNSW M",
  hnsw_ef_construction: "HNSW efConstruction",
  dataset_limit: "Vectors / dataset",
  query_limit: "Queries / run",
};

export function RunMetaPanel({ report }: { report: ReportBundle }) {
  const cfg = (report.run.config ?? {}) as Record<string, unknown>;
  const generated = new Date(report.generated_at);
  const started = new Date(report.run.started_at);
  const items = ORDER.filter(k => k in cfg).map(k => ({
    key: k,
    label: LABELS[k] ?? k,
    value: fmt(cfg[k]),
  }));
  // Append any extra config keys we don't have an order for.
  for (const [k, v] of Object.entries(cfg)) {
    if (!ORDER.includes(k)) items.push({ key: k, label: k, value: fmt(v) });
  }

  return (
    <div className="card runmeta">
      <div className="runmeta-head">
        <div>
          <div className="subtle" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Run configuration
          </div>
          <h3 style={{ marginTop: 4 }}>{report.narrative.headline.slice(0, 80)}</h3>
        </div>
        <div className="runmeta-stamp">
          <span className="status-dot" aria-hidden />
          <span>completed {generated.toLocaleDateString()} {generated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>

      <dl className="runmeta-grid">
        {items.map(it => (
          <div className="runmeta-item" key={it.key}>
            <dt>{it.label}</dt>
            <dd>{it.value}</dd>
          </div>
        ))}
        <div className="runmeta-item">
          <dt>Host</dt>
          <dd>{report.run.host} · {report.run.platform}</dd>
        </div>
        <div className="runmeta-item">
          <dt>Started</dt>
          <dd>{started.toLocaleString()}</dd>
        </div>
        <div className="runmeta-item">
          <dt>Report model</dt>
          <dd>{report.model}</dd>
        </div>
        <div className="runmeta-item">
          <dt>Run ID</dt>
          <dd className="mono" style={{ fontSize: 12 }}>{report.run.id}</dd>
        </div>
      </dl>
    </div>
  );
}
