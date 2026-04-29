"use client";

import { useMemo, useState } from "react";
import { DB_COLORS, DB_LABEL } from "../../lib/colors";
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

function toCsv(rows: Result[]): string {
  const head = COLUMNS.map(c => c.key).join(",");
  const body = rows
    .map(r =>
      COLUMNS.map(c => {
        const v = r[c.key];
        return typeof v === "number" ? String(v) : `"${String(v).replace(/"/g, '""')}"`;
      }).join(","),
    )
    .join("\n");
  return `${head}\n${body}`;
}

export function ResultsTable({ results }: { results: Result[] }) {
  const allDbs = useMemo(() => Array.from(new Set(results.map(r => r.database))), [results]);
  const allDatasets = useMemo(() => Array.from(new Set(results.map(r => r.dataset))), [results]);

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "recall_at_k",
    dir: "desc",
  });
  const [filter, setFilter] = useState<string>("");
  const [activeDbs, setActiveDbs] = useState<Set<string>>(new Set(allDbs));
  const [activeDataset, setActiveDataset] = useState<string>("all");

  const sorted = useMemo(() => {
    const filtered = results.filter(r => {
      if (!activeDbs.has(r.database)) return false;
      if (activeDataset !== "all" && r.dataset !== activeDataset) return false;
      if (filter && !`${r.database} ${r.dataset}`.toLowerCase().includes(filter.toLowerCase())) {
        return false;
      }
      return true;
    });
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
  }, [results, sort, filter, activeDbs, activeDataset]);

  const onSort = (key: SortKey) =>
    setSort(prev =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );

  const toggleDb = (db: string) => {
    setActiveDbs(prev => {
      const next = new Set(prev);
      if (next.has(db)) next.delete(db);
      else next.add(db);
      // Don't allow zero-selection — re-select if user empties.
      if (next.size === 0) return new Set(allDbs);
      return next;
    });
  };

  const downloadCsv = () => {
    const blob = new Blob([toCsv(sorted)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vectorbench-results.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="table-toolbar">
        <div className="db-chip-row" role="group" aria-label="Filter by database">
          {allDbs.map(db => {
            const active = activeDbs.has(db);
            return (
              <button
                key={db}
                type="button"
                className={`db-chip${active ? " is-active" : ""}`}
                onClick={() => toggleDb(db)}
                aria-pressed={active}
                style={{ ["--chip-color" as string]: DB_COLORS[db] ?? "var(--accent)" }}
              >
                <span className="chip-dot" aria-hidden />
                {DB_LABEL[db] ?? db}
              </button>
            );
          })}
          {allDatasets.length > 1 && (
            <select
              className="nav-select"
              aria-label="Dataset filter"
              value={activeDataset}
              onChange={e => setActiveDataset(e.target.value)}
            >
              <option value="all">All datasets</option>
              {allDatasets.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {sorted.length} of {results.length} rows
          </span>
          <input
            aria-label="Filter rows"
            placeholder="Filter…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-input"
          />
          <button type="button" onClick={downloadCsv} className="btn-ghost" aria-label="Download CSV">
            ↓ CSV
          </button>
        </div>
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
                  if (c.key === "database") {
                    return (
                      <td key={c.key}>
                        <span
                          className="row-db"
                          style={{ ["--row-db-color" as string]: DB_COLORS[String(v)] ?? "var(--accent)" }}
                        >
                          <span className="row-db-dot" aria-hidden />
                          {DB_LABEL[String(v)] ?? String(v)}
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={c.key} className={c.numeric ? "num" : undefined}>
                      {c.format && typeof v === "number" ? c.format(v) : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ textAlign: "center", padding: 32 }} className="muted">
                  No rows match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
