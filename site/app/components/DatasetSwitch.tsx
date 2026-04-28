"use client";

import { useState } from "react";
import { ParetoChart } from "./ParetoChart";
import type { Result } from "../../lib/types";

export function DatasetSwitch({ results }: { results: Result[] }) {
  const datasets = Array.from(new Set(results.map(r => r.dataset)));
  const [active, setActive] = useState(datasets[0] ?? "");
  if (datasets.length === 0) {
    return <p className="muted">No data yet.</p>;
  }
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
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
      </div>
      <ParetoChart results={results} dataset={active} />
      <p className="subtle" style={{ marginTop: 8, fontSize: 13 }}>
        Each point is one ef_search value. Up-and-to-the-left is better (higher recall at lower latency).
        Lines connect the same database across the ef_search sweep.
      </p>
    </div>
  );
}
