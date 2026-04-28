"""Centralized configuration loaded from environment / .env file."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
RESULTS_DIR = PROJECT_ROOT / "results"

load_dotenv(PROJECT_ROOT / ".env")


def _csv(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def _int_csv(name: str, default: str) -> list[int]:
    return [int(x) for x in _csv(name, default)]


def _limit(name: str, default: str) -> int | None:
    """Parses an int limit. The string 'full' (or empty) means no limit."""
    raw = os.getenv(name, default).strip().lower()
    if raw in ("", "full", "all", "none"):
        return None
    return int(raw)


@dataclass(frozen=True)
class Config:
    datasets: list[str] = field(default_factory=lambda: _csv(
        "DATASETS",
        "sift-128-euclidean,glove-100-angular,fashion-mnist-784-euclidean",
    ))
    databases: list[str] = field(default_factory=lambda: _csv(
        "DATABASES", "qdrant,weaviate,pgvector",
    ))
    dataset_limit: int | None = field(default_factory=lambda: _limit("DATASET_LIMIT", "100000"))
    query_limit: int | None = field(default_factory=lambda: _limit("QUERY_LIMIT", "1000"))

    ef_search_values: list[int] = field(default_factory=lambda: _int_csv(
        "EF_SEARCH_VALUES", "16,32,64,128,256",
    ))
    hnsw_m: int = field(default_factory=lambda: int(os.getenv("HNSW_M", "16")))
    hnsw_ef_construction: int = field(default_factory=lambda: int(os.getenv("HNSW_EF_CONSTRUCTION", "128")))

    qdrant_url: str = field(default_factory=lambda: os.getenv("QDRANT_URL", "http://localhost:6333"))
    weaviate_host: str = field(default_factory=lambda: os.getenv("WEAVIATE_HOST", "localhost"))
    weaviate_http_port: int = field(default_factory=lambda: int(os.getenv("WEAVIATE_HTTP_PORT", "8080")))
    weaviate_grpc_port: int = field(default_factory=lambda: int(os.getenv("WEAVIATE_GRPC_PORT", "50051")))
    pgvector_dsn: str = field(default_factory=lambda: os.getenv(
        "PGVECTOR_DSN", "postgresql://bench:bench@localhost:5433/bench",
    ))
    results_dsn: str = field(default_factory=lambda: os.getenv(
        "RESULTS_DSN", "postgresql://results:results@localhost:5434/results",
    ))


CONFIG = Config()
DATA_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
