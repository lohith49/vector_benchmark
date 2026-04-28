import type { Narrative } from "../../lib/types";

const ITEMS: { key: keyof Narrative["recommendation"]; title: string; tag: string }[] = [
  { key: "if_low_latency_critical", title: "Low-latency critical", tag: "Latency-bound" },
  { key: "if_high_recall_critical", title: "High-recall critical", tag: "Recall-bound" },
  { key: "if_postgres_already", title: "Already on Postgres", tag: "Operational" },
  { key: "if_managed_simplicity", title: "Want managed simplicity", tag: "Ops cost" },
];

export function Recommendation({ rec }: { rec: Narrative["recommendation"] }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
      {ITEMS.map(it => (
        <div className="card card-tight" key={it.key}>
          <div className="pill" style={{ marginBottom: 10 }}>{it.tag}</div>
          <h4 style={{ marginBottom: 6 }}>{it.title}</h4>
          <p className="muted" style={{ fontSize: 14 }}>{rec[it.key]}</p>
        </div>
      ))}
    </div>
  );
}
