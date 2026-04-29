"use client";

import { ReactNode, useState } from "react";
import { ParetoChart } from "./ParetoChart";
import { ThroughputChart } from "./ThroughputChart";
import type { Result } from "../../lib/types";

type Variant = "pareto" | "throughput";

const FOOTNOTE: Record<Variant, string> = {
  pareto:
    "Each point is one ef_search value. Up-and-to-the-left is better (higher recall at lower latency). Lines connect the same database across the ef_search sweep.",
  throughput:
    "Each point is one ef_search value. Up-and-to-the-right is better (higher recall at higher throughput).",
};

export function DatasetSwitch({
  results,
  variant = "pareto",
}: {
  results: Result[];
  variant?: Variant;
}) {
  const datasets = Array.from(new Set(results.map(r => r.dataset)));
  const [active, setActive] = useState(datasets[0] ?? "");
  if (datasets.length === 0) {
    return <p className="muted">No data yet.</p>;
  }
  let chart: ReactNode;
  if (variant === "throughput") chart = <ThroughputChart results={results} dataset={active} />;
  else chart = <ParetoChart results={results} dataset={active} />;

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="tabs" role="tablist" aria-label="Dataset">
          {datasets.map(d => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-pressed={active === d}
              onClick={() => setActive(d)}
            >
              {d}
            </button>
          ))}
        </div>
        <span className="subtle" style={{ fontSize: 12 }}>
          {datasets.length} dataset{datasets.length === 1 ? "" : "s"}
        </span>
      </div>
      {chart}
      <p className="subtle" style={{ marginTop: 8, fontSize: 13 }}>{FOOTNOTE[variant]}</p>
    </div>
  );
}
