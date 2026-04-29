"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DB_COLORS, DB_LABEL } from "../../lib/colors";
import type { Result } from "../../lib/types";

/** Bar chart: p50 / p99 latency at the highest ef_search value per (db, dataset). */
export function LatencyChart({ results }: { results: Result[] }) {
  // For each (dataset, database), pick the row with the largest ef_search (the most-tuned).
  const byPair = new Map<string, Result>();
  for (const r of results) {
    const key = `${r.dataset}::${r.database}`;
    const existing = byPair.get(key);
    if (!existing || r.ef_search > existing.ef_search) byPair.set(key, r);
  }
  const datasets = Array.from(new Set(results.map(r => r.dataset)));
  const dbs = Array.from(new Set(results.map(r => r.database)));

  const data = datasets.map(ds => {
    const row: Record<string, string | number> = { dataset: ds };
    for (const db of dbs) {
      const r = byPair.get(`${ds}::${db}`);
      row[`${db}_p50`] = r ? Number(r.p50_ms.toFixed(2)) : 0;
      row[`${db}_p99`] = r ? Number(r.p99_ms.toFixed(2)) : 0;
    }
    return row;
  });

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" />
          <XAxis dataKey="dataset" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            label={{
              value: "latency (ms)",
              angle: -90,
              position: "insideLeft",
              style: { fill: "var(--text-tertiary)", fontSize: 12 },
            }}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-3)", fillOpacity: 0.45 }}
            wrapperStyle={{ outline: "none" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--separator-strong)",
              borderRadius: 12,
              boxShadow: "var(--shadow-card-strong)",
              color: "var(--text)",
              fontSize: 13,
            }}
            itemStyle={{ color: "var(--text)" }}
            labelStyle={{ color: "var(--text-secondary)", fontWeight: 600 }}
            formatter={(value: number) => [`${Number(value).toFixed(2)} ms`, ""]}
          />
          <Legend wrapperStyle={{ paddingTop: 8 }} />
          {dbs.map(db => [
            <Bar
              key={`${db}-p50`}
              dataKey={`${db}_p50`}
              name={`${DB_LABEL[db] ?? db} p50`}
              fill={DB_COLORS[db] ?? "var(--accent)"}
              radius={[4, 4, 0, 0]}
              fillOpacity={0.55}
            />,
            <Bar
              key={`${db}-p99`}
              dataKey={`${db}_p99`}
              name={`${DB_LABEL[db] ?? db} p99`}
              fill={DB_COLORS[db] ?? "var(--accent)"}
              radius={[4, 4, 0, 0]}
            />,
          ])}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
