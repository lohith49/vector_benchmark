"""Recall@k and latency percentile helpers."""

from __future__ import annotations

import numpy as np


def recall_at_k(
    predicted: list[list[int]],
    ground_truth: np.ndarray,
    *,
    k: int,
    train_limit: int | None = None,
) -> float:
    """Computes mean recall@k.

    For each query i, recall@k = |predicted[i][:k] intersect ground_truth[i][:k]| / k.

    When the train set has been truncated to `train_limit`, the ground-truth indices
    pointing to filtered-out rows are dropped from that query's reference set, and
    the denominator becomes min(k, |reference set|). Falls back to 1.0 if a query
    has no usable references (degenerate but non-fatal).
    """
    assert len(predicted) == ground_truth.shape[0], "predicted and ground_truth length mismatch"

    total = 0.0
    n_queries = 0
    for i, pred in enumerate(predicted):
        ref = ground_truth[i, :k]
        if train_limit is not None:
            ref = ref[ref < train_limit]
        if ref.size == 0:
            continue
        ref_set = set(int(x) for x in ref.tolist())
        hits = sum(1 for p in pred[:k] if int(p) in ref_set)
        total += hits / min(k, ref.size)
        n_queries += 1

    if n_queries == 0:
        return 0.0
    return total / n_queries


def percentiles(latencies_ms: list[float]) -> dict[str, float]:
    """Returns p50/p90/p95/p99/mean/min/max from a list of millisecond latencies."""
    if not latencies_ms:
        return {k: 0.0 for k in ("p50", "p90", "p95", "p99", "mean", "min", "max")}
    arr = np.asarray(latencies_ms, dtype=np.float64)
    return {
        "p50": float(np.percentile(arr, 50)),
        "p90": float(np.percentile(arr, 90)),
        "p95": float(np.percentile(arr, 95)),
        "p99": float(np.percentile(arr, 99)),
        "mean": float(arr.mean()),
        "min": float(arr.min()),
        "max": float(arr.max()),
    }
