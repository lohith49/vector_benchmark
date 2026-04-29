import type { Narrative } from "../../lib/types";

const ITEMS: {
  key: keyof Narrative["recommendation"];
  title: string;
  tag: string;
  icon: string;
  accent: string;
}[] = [
  {
    key: "if_low_latency_critical",
    title: "Low-latency critical",
    tag: "Latency-bound",
    accent: "var(--accent)",
    icon: "⚡",
  },
  {
    key: "if_high_recall_critical",
    title: "High-recall critical",
    tag: "Recall-bound",
    accent: "var(--green)",
    icon: "◎",
  },
  {
    key: "if_postgres_already",
    title: "Already on Postgres",
    tag: "Operational",
    accent: "var(--orange)",
    icon: "❖",
  },
  {
    key: "if_managed_simplicity",
    title: "Want managed simplicity",
    tag: "Ops cost",
    accent: "var(--indigo)",
    icon: "✦",
  },
];

export function Recommendation({ rec }: { rec: Narrative["recommendation"] }) {
  return (
    <div className="grid recommendation-grid">
      {ITEMS.map(it => (
        <div className="card card-tight rec-card" key={it.key} style={{ ["--rec-accent" as string]: it.accent }}>
          <div className="rec-icon" aria-hidden>{it.icon}</div>
          <div className="pill">{it.tag}</div>
          <h4 style={{ marginTop: 10, marginBottom: 6 }}>{it.title}</h4>
          <p className="muted" style={{ fontSize: 14 }}>{rec[it.key]}</p>
        </div>
      ))}
    </div>
  );
}
