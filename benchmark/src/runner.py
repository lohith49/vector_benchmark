"""Benchmark runner.

For each (database, dataset) pair:
  1. setup() the index with the configured HNSW build params
  2. insert() the train vectors and time it
  3. post_insert() (pgvector builds the HNSW index here)
  4. for each ef_search value:
       - set_ef_search(ef)
       - run all test queries serially, recording per-query latency
       - compute recall@k against the ground-truth neighbors
       - write one row to bench_results
"""

from __future__ import annotations

import time
import traceback
from dataclasses import asdict, dataclass

import numpy as np
from tqdm import tqdm

from . import results_db
from .clients import VectorDBClient, get_client
from .config import CONFIG
from .datasets import Dataset, load
from .metrics import percentiles, recall_at_k


K = 10  # recall@10 is the canonical ann-benchmarks metric


@dataclass
class RunSummary:
    database: str
    dataset: str
    ef_search: int
    recall_at_k: float
    p50_ms: float
    p99_ms: float
    qps: float


def _bench_one(
    client: VectorDBClient,
    ds: Dataset,
    *,
    run_id: str,
) -> list[RunSummary]:
    print(f"  [{client.name}/{ds.name}] setup (dim={ds.dim}, metric={ds.metric})", flush=True)
    client.setup(
        dim=ds.dim,
        metric=ds.metric,
        m=CONFIG.hnsw_m,
        ef_construction=CONFIG.hnsw_ef_construction,
    )

    print(f"  [{client.name}/{ds.name}] inserting {ds.n_train:,} vectors...", flush=True)
    t0 = time.perf_counter()
    client.insert(ds.train)
    insert_seconds = time.perf_counter() - t0

    t0 = time.perf_counter()
    client.post_insert()
    index_seconds = time.perf_counter() - t0

    print(
        f"  [{client.name}/{ds.name}] insert {insert_seconds:.1f}s, "
        f"index {index_seconds:.1f}s",
        flush=True,
    )

    summaries: list[RunSummary] = []

    for ef in CONFIG.ef_search_values:
        client.set_ef_search(ef)

        # Warm up so JIT / page cache effects don't skew the first few queries.
        warmup = min(20, ds.n_test)
        for i in range(warmup):
            client.query(ds.test[i], K)

        latencies_ms: list[float] = []
        predicted: list[list[int]] = []
        for i in tqdm(
            range(ds.n_test),
            desc=f"  [{client.name}/{ds.name}] ef={ef:>3} querying",
            leave=False,
        ):
            t = time.perf_counter()
            ids = client.query(ds.test[i], K)
            latencies_ms.append((time.perf_counter() - t) * 1000.0)
            predicted.append(ids)

        pcs = percentiles(latencies_ms)
        recall = recall_at_k(predicted, ds.neighbors, k=K, train_limit=ds.n_train)
        total_seconds = sum(latencies_ms) / 1000.0
        qps = ds.n_test / total_seconds if total_seconds > 0 else 0.0

        row = {
            "database": client.name,
            "dataset": ds.name,
            "metric": ds.metric,
            "dim": ds.dim,
            "n_train": ds.n_train,
            "n_test": ds.n_test,
            "hnsw_m": CONFIG.hnsw_m,
            "hnsw_ef_construction": CONFIG.hnsw_ef_construction,
            "ef_search": ef,
            "k": K,
            "insert_seconds": insert_seconds,
            "index_seconds": index_seconds,
            "recall_at_k": recall,
            "qps": qps,
            "p50_ms": pcs["p50"],
            "p90_ms": pcs["p90"],
            "p95_ms": pcs["p95"],
            "p99_ms": pcs["p99"],
            "mean_ms": pcs["mean"],
            "min_ms": pcs["min"],
            "max_ms": pcs["max"],
        }
        results_db.write_result(run_id, row)

        summary = RunSummary(
            database=client.name,
            dataset=ds.name,
            ef_search=ef,
            recall_at_k=recall,
            p50_ms=pcs["p50"],
            p99_ms=pcs["p99"],
            qps=qps,
        )
        summaries.append(summary)
        print(
            f"  [{client.name}/{ds.name}] ef={ef:>3}  recall@{K}={recall:.4f}  "
            f"p50={pcs['p50']:.2f}ms  p99={pcs['p99']:.2f}ms  qps={qps:.1f}",
            flush=True,
        )

    client.teardown()
    return summaries


def run_all() -> list[RunSummary]:
    results_db.init_schema()
    config_snapshot = {
        "datasets": CONFIG.datasets,
        "databases": CONFIG.databases,
        "dataset_limit": CONFIG.dataset_limit,
        "query_limit": CONFIG.query_limit,
        "ef_search_values": CONFIG.ef_search_values,
        "hnsw_m": CONFIG.hnsw_m,
        "hnsw_ef_construction": CONFIG.hnsw_ef_construction,
    }
    run_id = results_db.start_run(config_snapshot)
    print(f"Run id: {run_id}", flush=True)

    summaries: list[RunSummary] = []
    for ds_name in CONFIG.datasets:
        ds = load(
            ds_name,
            train_limit=CONFIG.dataset_limit,
            test_limit=CONFIG.query_limit,
        )
        print(
            f"\n=== {ds.name}: {ds.n_train:,} train x {ds.dim}d, "
            f"{ds.n_test:,} queries, metric={ds.metric} ===",
            flush=True,
        )
        for db_name in CONFIG.databases:
            client: VectorDBClient | None = None
            try:
                client = get_client(db_name)
                summaries.extend(_bench_one(client, ds, run_id=run_id))
            except Exception as e:
                print(f"  !! {db_name}/{ds.name} failed: {e}", flush=True)
                traceback.print_exc()
            finally:
                if client is not None:
                    try:
                        client.close()
                    except Exception:
                        pass

    print(f"\nDone. Run id {run_id}. Wrote {len(summaries)} rows to results-postgres.")
    return summaries
