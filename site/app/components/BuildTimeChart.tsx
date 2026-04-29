"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DB_COLORS, DB_LABEL } from "../../lib/colors";
import type { Result } from "../../lib/types";

/** Insert + index time per (db, dataset). One bar per database, stacked: insert / index. */
export function BuildTimeChart({ results }: { results: Result[] }) {
  // Take the first row per (db, dataset) — insert/index times are identical across ef_search.
  const byPair = new Map<string, Result>();
  for (const r of results) {
    const k = `${r.dataset}::${r.database}`;
    if (!byPair.has(k)) byPair.set(k, r);
  }
  const datasets = Array.from(new Set(results.map(r => r.dataset)));
  const dbs = Array.from(new Set(results.map(r => r.database)));

  // Wide format: one row per (dataset, db) — but Recharts bar chart wants one row per category.
  // We'll show category = `${db} · ${dataset}` so a single chart works for any dataset count.
  const data = [];
  for (const ds of datasets) {
    for (const db of dbs) {
      const r = byPair.get(`${ds}::${db}`);
      if (!r) continue;
      data.push({
        name: datasets.length > 1 ? `${DB_LABEL[db] ?? db} · ${ds}` : (DB_LABEL[db] ?? db),
        db,
        insert: Number(r.insert_seconds.toFixed(2)),
        index: Number(r.index_seconds.toFixed(2)),
      });
    }
  }

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" />
          <XAxis dataKey="name" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} interval={0} />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            label={{
              value: "seconds",
              angle: -90,
              position: "insideLeft",
              style: { fill: "var(--text-tertiary)", fontSize: 12 },
            }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--separator)",
              borderRadius: 12,
              boxShadow: "var(--shadow-card)",
              color: "var(--text)",
              fontSize: 13,
            }}
            formatter={(value: number, name: string) => [`${Number(value).toFixed(1)} s`, name]}
          />
          <Legend wrapperStyle={{ paddingTop: 8 }} />
          <Bar dataKey="insert" name="Insert" stackId="t" radius={[0, 0, 0, 0]} fillOpacity={0.5}>
            {data.map((d, i) => (
              <Cell key={i} fill={DB_COLORS[d.db] ?? "var(--accent)"} />
            ))}
          </Bar>
          <Bar dataKey="index" name="Index build" stackId="t" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={DB_COLORS[d.db] ?? "var(--accent)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
