"use client";

import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { DB_COLORS, DB_LABEL } from "../../lib/colors";
import type { Result } from "../../lib/types";

/** QPS vs recall — connected by ef_search sweep. Up-and-to-the-right is better. */
export function ThroughputChart({
  results,
  dataset,
}: {
  results: Result[];
  dataset: string;
}) {
  const rows = results
    .filter(r => r.dataset === dataset)
    .sort((a, b) => a.ef_search - b.ef_search);
  const dbs = Array.from(new Set(rows.map(r => r.database)));
  const data = (db: string) =>
    rows
      .filter(r => r.database === db)
      .map(r => ({
        x: r.recall_at_k,
        y: r.qps,
        ef: r.ef_search,
      }));

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" />
          <XAxis
            type="number"
            dataKey="x"
            name="recall@10"
            domain={[0, 1]}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            label={{
              value: "recall@10",
              position: "insideBottom",
              offset: -8,
              style: { fill: "var(--text-tertiary)", fontSize: 12 },
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="QPS"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            label={{
              value: "queries / sec",
              angle: -90,
              position: "insideLeft",
              style: { fill: "var(--text-tertiary)", fontSize: 12 },
            }}
          />
          <ZAxis range={[80, 80]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--separator)",
              borderRadius: 12,
              boxShadow: "var(--shadow-card)",
              color: "var(--text)",
              fontSize: 13,
            }}
            formatter={(value: number, name: string) => {
              if (name === "recall@10") return [value.toFixed(4), name];
              if (name === "QPS") return [`${value.toFixed(1)} q/s`, name];
              return [value, name];
            }}
            labelFormatter={() => ""}
          />
          <Legend wrapperStyle={{ paddingTop: 8 }} />
          {dbs.map(db => (
            <Scatter
              key={db}
              name={DB_LABEL[db] ?? db}
              data={data(db)}
              fill={DB_COLORS[db] ?? "var(--accent)"}
              line={{ stroke: DB_COLORS[db] ?? "var(--accent)", strokeWidth: 1.5 }}
              lineType="joint"
              shape="circle"
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
