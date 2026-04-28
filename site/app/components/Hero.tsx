import type { ReportBundle } from "../../lib/types";

export function Hero({ report }: { report: ReportBundle }) {
  const ds = report.run.config?.datasets as string[] | undefined;
  const dbs = report.run.config?.databases as string[] | undefined;
  return (
    <section className="hero-gradient">
      <div className="container" style={{ padding: "96px 0 64px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <span className="pill"><span className="swatch" style={{ color: "var(--accent)" }} /> Open benchmark</span>
          <span className="pill">ann-benchmarks datasets</span>
          <span className="pill">HNSW index sweep</span>
          <span className="pill">Recall@10</span>
        </div>
        <h1 style={{ maxWidth: 920 }}>{report.narrative.headline}</h1>
        <p
          className="muted"
          style={{ marginTop: 16, fontSize: 18, maxWidth: 720, lineHeight: 1.55 }}
        >
          A reproducible Kubernetes-hosted comparison of {(dbs ?? []).map(s => s).join(", ") || "Qdrant, Weaviate, and pgvector"}{" "}
          on {(ds ?? []).join(", ") || "ann-benchmarks datasets"}. Recall, p50/p99 latency,
          and throughput across an ef_search sweep.
        </p>
        <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="#results" className="pill" style={{ background: "var(--accent)", color: "white", borderColor: "transparent" }}>
            See the results &rarr;
          </a>
          <a href="#per-database" className="pill">Database breakdown</a>
          <a href="#raw" className="pill">Raw data</a>
        </div>
      </div>
    </section>
  );
}
