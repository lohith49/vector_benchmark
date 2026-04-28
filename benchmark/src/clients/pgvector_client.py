"""pgvector benchmark client (psycopg 3 + pgvector adapter)."""

from __future__ import annotations

import numpy as np
import psycopg
from pgvector.psycopg import register_vector

from ..config import CONFIG
from .base import COLLECTION_NAME, VectorDBClient


_OPS = {
    "l2": "vector_l2_ops",
    "cosine": "vector_cosine_ops",
}
_OPERATOR = {
    "l2": "<->",      # L2 distance
    "cosine": "<=>",  # cosine distance
}

_TABLE = "vectorbench_items"


class PgvectorBenchClient(VectorDBClient):
    name = "pgvector"

    def __init__(self) -> None:
        self.conn = psycopg.connect(CONFIG.pgvector_dsn, autocommit=True)
        with self.conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        register_vector(self.conn)
        self._metric: str = "l2"
        self._m: int = 16
        self._ef_construction: int = 128
        self._dim: int = 0

    def setup(self, *, dim: int, metric: str, m: int, ef_construction: int) -> None:
        self._metric = metric
        self._m = m
        self._ef_construction = ef_construction
        self._dim = dim
        with self.conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {_TABLE};")
            cur.execute(
                f"CREATE TABLE {_TABLE} ("
                f"  id BIGINT PRIMARY KEY,"
                f"  embedding vector({dim})"
                f");"
            )

    def insert(self, vectors: np.ndarray) -> None:
        # COPY is the fastest path for bulk insert with pgvector.
        n = vectors.shape[0]
        with self.conn.cursor() as cur:
            with cur.copy(f"COPY {_TABLE} (id, embedding) FROM STDIN") as copy:
                for i in range(n):
                    # pgvector's psycopg adapter handles ndarray via the registered type,
                    # but COPY needs a textual representation: vector type accepts '[1,2,3]'.
                    vec_text = "[" + ",".join(f"{float(x):.6f}" for x in vectors[i]) + "]"
                    copy.write_row((i, vec_text))

    def post_insert(self) -> None:
        # Build the HNSW index AFTER bulk-load -- much faster than incremental insert into an index.
        ops = _OPS[self._metric]
        with self.conn.cursor() as cur:
            # Bump maintenance work mem for index build performance.
            cur.execute("SET maintenance_work_mem = '512MB';")
            # Disable parallel build: parallel HNSW workers materialise large
            # shared-memory segments (DSM) which overflow the small /dev/shm
            # provisioned by container runtimes (kind defaults to ~64MB).
            # A serial build is ~30% slower but reliable across environments.
            cur.execute("SET max_parallel_maintenance_workers = 0;")
            cur.execute(
                f"CREATE INDEX ON {_TABLE} "
                f"USING hnsw (embedding {ops}) "
                f"WITH (m = {self._m}, ef_construction = {self._ef_construction});"
            )
            cur.execute(f"ANALYZE {_TABLE};")

    def set_ef_search(self, ef: int) -> None:
        with self.conn.cursor() as cur:
            cur.execute(f"SET hnsw.ef_search = {int(ef)};")

    def query(self, vector: np.ndarray, k: int) -> list[int]:
        op = _OPERATOR[self._metric]
        with self.conn.cursor() as cur:
            cur.execute(
                f"SELECT id FROM {_TABLE} ORDER BY embedding {op} %s::vector LIMIT %s",
                (vector.tolist(), int(k)),
            )
            rows = cur.fetchall()
        return [int(r[0]) for r in rows]

    def teardown(self) -> None:
        with self.conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {_TABLE};")

    def close(self) -> None:
        self.conn.close()
