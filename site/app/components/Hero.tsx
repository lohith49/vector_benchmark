import type { ReportBundle } from "../../lib/types";

export function Hero({ report }: { report: ReportBundle }) {
  const ds = report.run.config?.datasets as string[] | undefined;
  const dbs = report.run.config?.databases as string[] | undefined;
  const ef = report.run.config?.ef_search_values as number[] | undefined;
  const total = report.results.length;

  const overview = [
    { label: "Databases", value: String((dbs ?? []).length || "—") },
    { label: "Datasets", value: String((ds ?? []).length || "—") },
    { label: "ef_search points", value: String((ef ?? []).length || "—") },
    { label: "Result rows", value: String(total) },
  ];

  return (
    <section className="hero-gradient">
      <div className="container hero-inner">
        <div className="hero-pills">
          <span className="pill pill-live"><span className="pulse" aria-hidden /> Live benchmark</span>
          <span className="pill">ann-benchmarks datasets</span>
          <span className="pill">HNSW index sweep</span>
          <span className="pill">Recall@10</span>
        </div>
        <h1 className="hero-title">{report.narrative.headline}</h1>
        <p className="hero-sub">
          A reproducible Kubernetes-hosted comparison of {(dbs ?? []).join(", ") || "Qdrant, Weaviate, and pgvector"}{" "}
          on {(ds ?? []).join(", ") || "ann-benchmarks datasets"}. Recall, p50/p99 latency,
          and throughput across an ef_search sweep.
        </p>

        <div className="hero-cta">
          <a href="#kpis" className="btn-primary">See the leaderboard &rarr;</a>
          <a href="#per-database" className="btn-ghost">Database breakdown</a>
          <a href="#raw" className="btn-ghost">Raw data</a>
        </div>

        <div className="hero-overview">
          {overview.map(o => (
            <div className="hero-stat" key={o.label}>
              <div className="hero-stat-value">{o.value}</div>
              <div className="hero-stat-label">{o.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
