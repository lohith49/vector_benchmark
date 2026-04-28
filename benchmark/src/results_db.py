"""Results PostgreSQL: schema + writer.

The schema is deliberately wide and self-describing -- the LLM report generator reads
straight from it, so column names should be human-readable.
"""

from __future__ import annotations

import json
import platform
import socket
import uuid
from datetime import datetime, timezone
from typing import Any

import psycopg

from .config import CONFIG


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS bench_runs (
    id              UUID PRIMARY KEY,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    git_sha         TEXT,
    host            TEXT,
    platform        TEXT,
    config          JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS bench_results (
    id                 BIGSERIAL PRIMARY KEY,
    run_id             UUID NOT NULL REFERENCES bench_runs(id) ON DELETE CASCADE,
    database           TEXT NOT NULL,
    dataset            TEXT NOT NULL,
    metric             TEXT NOT NULL,
    dim                INT  NOT NULL,
    n_train            INT  NOT NULL,
    n_test             INT  NOT NULL,

    hnsw_m             INT  NOT NULL,
    hnsw_ef_construction INT NOT NULL,
    ef_search          INT  NOT NULL,
    k                  INT  NOT NULL,

    insert_seconds     DOUBLE PRECISION NOT NULL,
    index_seconds      DOUBLE PRECISION NOT NULL DEFAULT 0,

    recall_at_k        DOUBLE PRECISION NOT NULL,
    qps                DOUBLE PRECISION NOT NULL,

    p50_ms             DOUBLE PRECISION NOT NULL,
    p90_ms             DOUBLE PRECISION NOT NULL,
    p95_ms             DOUBLE PRECISION NOT NULL,
    p99_ms             DOUBLE PRECISION NOT NULL,
    mean_ms            DOUBLE PRECISION NOT NULL,
    min_ms             DOUBLE PRECISION NOT NULL,
    max_ms             DOUBLE PRECISION NOT NULL,

    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(run_id, database, dataset, hnsw_m, hnsw_ef_construction, ef_search, k)
);

CREATE INDEX IF NOT EXISTS bench_results_run_idx     ON bench_results(run_id);
CREATE INDEX IF NOT EXISTS bench_results_db_idx      ON bench_results(database);
CREATE INDEX IF NOT EXISTS bench_results_dataset_idx ON bench_results(dataset);
"""


def connect() -> psycopg.Connection:
    return psycopg.connect(CONFIG.results_dsn, autocommit=True)


def init_schema() -> None:
    with connect() as conn, conn.cursor() as cur:
        cur.execute(SCHEMA_SQL)


def start_run(config: dict[str, Any]) -> str:
    run_id = str(uuid.uuid4())
    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO bench_runs (id, started_at, host, platform, config) "
            "VALUES (%s, %s, %s, %s, %s::jsonb)",
            (
                run_id,
                datetime.now(timezone.utc),
                socket.gethostname(),
                platform.platform(),
                json.dumps(config),
            ),
        )
    return run_id


def write_result(run_id: str, row: dict[str, Any]) -> None:
    cols = [
        "run_id", "database", "dataset", "metric", "dim",
        "n_train", "n_test",
        "hnsw_m", "hnsw_ef_construction", "ef_search", "k",
        "insert_seconds", "index_seconds",
        "recall_at_k", "qps",
        "p50_ms", "p90_ms", "p95_ms", "p99_ms",
        "mean_ms", "min_ms", "max_ms",
    ]
    placeholders = ", ".join(["%s"] * len(cols))
    values = (run_id,) + tuple(row[c] for c in cols[1:])
    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO bench_results ({', '.join(cols)}) VALUES ({placeholders})",
            values,
        )
