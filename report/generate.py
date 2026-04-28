"""Read the latest benchmark run from results-postgres, ask Claude (via LangChain) to
write a structured comparison report, and emit `site/public/results.json` for the static
site to render.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from .prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SITE_PUBLIC = PROJECT_ROOT / "site" / "public"

load_dotenv(PROJECT_ROOT / ".env")

RESULTS_DSN = os.getenv("RESULTS_DSN", "postgresql://results:results@localhost:5434/results")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


# --- DB I/O --------------------------------------------------------------

LATEST_RUN_SQL = """
SELECT id, started_at, host, platform, config
FROM bench_runs
ORDER BY started_at DESC
LIMIT 1
"""

RESULTS_SQL = """
SELECT database, dataset, metric, dim, n_train, n_test,
       hnsw_m, hnsw_ef_construction, ef_search, k,
       insert_seconds, index_seconds,
       recall_at_k, qps,
       p50_ms, p90_ms, p95_ms, p99_ms, mean_ms, min_ms, max_ms
FROM bench_results
WHERE run_id = %s
ORDER BY dataset, database, ef_search
"""


def fetch_run() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    with psycopg.connect(RESULTS_DSN) as conn:
        with conn.cursor() as cur:
            cur.execute(LATEST_RUN_SQL)
            row = cur.fetchone()
            if not row:
                raise SystemExit("No bench_runs found. Run `make bench` first.")
            run_id, started_at, host, plat, config = row
            run = {
                "id": str(run_id),
                "started_at": started_at.isoformat(),
                "host": host,
                "platform": plat,
                "config": config,
            }
            cur.execute(RESULTS_SQL, (run_id,))
            cols = [d.name for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    if not rows:
        raise SystemExit(f"No bench_results for run {run['id']}.")
    return run, rows


# --- Pareto frontier (best recall per latency bucket) -------------------

def pareto_frontier(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Filter rows to the recall/latency Pareto frontier per (dataset, database)."""
    out: list[dict[str, Any]] = []
    by_pair: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for r in rows:
        by_pair.setdefault((r["dataset"], r["database"]), []).append(r)
    for group in by_pair.values():
        # Sort by p50 ascending; keep a row only if its recall is the highest so far.
        sorted_group = sorted(group, key=lambda r: r["p50_ms"])
        best_recall = -1.0
        for r in sorted_group:
            if r["recall_at_k"] > best_recall:
                out.append(r)
                best_recall = r["recall_at_k"]
    return out


# --- Prompt building ----------------------------------------------------

def render_table(rows: list[dict[str, Any]]) -> str:
    """Render a small markdown table the LLM will quote from."""
    headers = [
        "database", "dataset", "ef_search", "recall@10",
        "p50_ms", "p99_ms", "qps", "insert_s", "index_s",
    ]
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for r in rows:
        lines.append(
            "| {database} | {dataset} | {ef_search} | {recall:.4f} | "
            "{p50:.2f} | {p99:.2f} | {qps:.1f} | {ins:.1f} | {idx:.1f} |".format(
                database=r["database"],
                dataset=r["dataset"],
                ef_search=r["ef_search"],
                recall=r["recall_at_k"],
                p50=r["p50_ms"],
                p99=r["p99_ms"],
                qps=r["qps"],
                ins=r["insert_seconds"],
                idx=r["index_seconds"],
            )
        )
    return "\n".join(lines)


def render_config(run: dict[str, Any]) -> str:
    cfg = run["config"]
    return json.dumps(cfg, indent=2)


def render_host(run: dict[str, Any]) -> str:
    return f"host={run['host']}\nplatform={run['platform']}\nstarted_at={run['started_at']}"


# --- LLM call -----------------------------------------------------------

def parse_json(content: str) -> dict[str, Any]:
    """Tolerant JSON parser: strips markdown fences if the model added them."""
    s = content.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```\s*$", "", s)
    return json.loads(s)


def generate_narrative(run: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("GOOGLE_API_KEY not set. Add it to .env.")

    user_prompt = USER_PROMPT_TEMPLATE.format(
        config_block=render_config(run),
        host_block=render_host(run),
        results_block=render_table(rows),
    )

    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        temperature=0.2,
        max_output_tokens=8192,
        google_api_key=api_key,
        # Force the model to emit raw JSON (no markdown fences, no prose).
        model_kwargs={"generation_config": {"response_mime_type": "application/json"}},
    )
    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ])
    return parse_json(response.content if isinstance(response.content, str) else str(response.content))


# --- Output bundle ------------------------------------------------------

def build_output(run: dict[str, Any], rows: list[dict[str, Any]], narrative: dict[str, Any]) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": GEMINI_MODEL,
        "run": run,
        "results": [
            {
                "database": r["database"],
                "dataset": r["dataset"],
                "metric": r["metric"],
                "dim": r["dim"],
                "n_train": r["n_train"],
                "n_test": r["n_test"],
                "hnsw_m": r["hnsw_m"],
                "hnsw_ef_construction": r["hnsw_ef_construction"],
                "ef_search": r["ef_search"],
                "k": r["k"],
                "insert_seconds": r["insert_seconds"],
                "index_seconds": r["index_seconds"],
                "recall_at_k": r["recall_at_k"],
                "qps": r["qps"],
                "p50_ms": r["p50_ms"],
                "p90_ms": r["p90_ms"],
                "p95_ms": r["p95_ms"],
                "p99_ms": r["p99_ms"],
                "mean_ms": r["mean_ms"],
                "min_ms": r["min_ms"],
                "max_ms": r["max_ms"],
            }
            for r in rows
        ],
        "narrative": narrative,
    }


def main() -> int:
    SITE_PUBLIC.mkdir(parents=True, exist_ok=True)
    run, rows = fetch_run()
    print(f"Loaded {len(rows)} results from run {run['id']}")
    print(f"Generating narrative with {GEMINI_MODEL}...")
    narrative = generate_narrative(run, rows)
    output = build_output(run, rows, narrative)
    out_path = SITE_PUBLIC / "results.json"
    out_path.write_text(json.dumps(output, indent=2, default=str), encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
