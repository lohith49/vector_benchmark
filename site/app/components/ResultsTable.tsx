"use client";

import { useMemo, useState } from "react";
import { DB_LABEL } from "../../lib/colors";
import type { Result } from "../../lib/types";

type SortKey = keyof Pick<
  Result,
  | "database"
  | "dataset"
  | "ef_search"
  | "recall_at_k"
  | "p50_ms"
  | "p99_ms"
  | "qps"
  | "insert_seconds"
  | "index_seconds"
>;

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; format?: (n: number) => string }[] = [
  { key: "database", label: "DB" },
  { key: "dataset", label: "Dataset" },
  { key: "ef_search", label: "ef_search", numeric: true, format: n => `${n}` },
  { key: "recall_at_k", label: "recall@10", numeric: true, format: n => n.toFixed(4) },
  { key: "p50_ms", label: "p50 (ms)", numeric: true, format: n => n.toFixed(2) },
  { key: "p99_ms", label: "p99 (ms)", numeric: true, format: n => n.toFixed(2) },
  { key: "qps", label: "QPS", numeric: true, format: n => n.toFixed(1) },
  { key: "insert_seconds", label: "insert (s)", numeric: true, format: n => n.toFixed(1) },
  { key: "index_seconds", label: "index (s)", numeric: true, format: n => n.toFixed(1) },
];

export function ResultsTable({ results }: { results: Result[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "recall_at_k",
    dir: "desc",
  });
  const [filter, setFilter] = useState<string>("");

  const sorted = useMemo(() => {
    const filtered = filter
      ? results.filter(r =>
          (`${r.database} ${r.dataset}`.toLowerCase().includes(filter.toLowerCase()))
        )
      : results;
    const out = [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "number" && typeof bv === "number") {
        return sort.dir === "asc" ? av - bv : bv - av;
      }
      return sort.dir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return out;
  }, [results, sort, filter]);

  const onSort = (key: SortKey) =>
    setSort(prev =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
        <span className="muted" style={{ fontSize: 13 }}>
          {sorted.length} of {results.length} rows
        </span>
        <input
          aria-label="Filter rows"
          placeholder="Filter by db or dataset…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            font: "inherit",
            fontSize: 14,
            padding: "8px 12px",
            border: "1px solid var(--separator)",
            background: "var(--surface-2)",
            color: "var(--text)",
            borderRadius: 10,
            width: 240,
            outline: "none",
          }}
        />
      </div>
      <div className="scroll-x card card-tight" style={{ padding: 0 }}>
        <table className="results">
          <thead>
            <tr>
              {COLUMNS.map(c => (
                <th
                  key={c.key}
                  onClick={() => onSort(c.key)}
                  style={{ cursor: "pointer", textAlign: c.numeric ? "right" : "left", userSelect: "none" }}
                  aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                >
                  {c.label}
                  {sort.key === c.key && <span style={{ marginLeft: 6, color: "var(--accent)" }}>{sort.dir === "asc" ? "↑" : "↓"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i}>
                {COLUMNS.map(c => {
                  const v = r[c.key];
                  return (
                    <td key={c.key} className={c.numeric ? "num" : undefined}>
                      {c.key === "database" ? (DB_LABEL[String(v)] ?? String(v)) : c.format && typeof v === "number" ? c.format(v) : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
