"""Abstract base class for vector DB benchmark clients.

Every client implements the same five operations so the runner can treat them uniformly:

  * setup(dim, metric, m, ef_construction)  -- create a fresh collection/table with HNSW
  * insert(vectors)                         -- bulk-insert (id is row index)
  * post_insert()                           -- finalize after insert (e.g. CREATE INDEX for pgvector)
  * set_ef_search(ef)                       -- runtime tuning before each query batch
  * query(vector, k) -> list[int]           -- single query, returns ranked ids
  * teardown()                              -- drop the collection/table (idempotent)
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np


COLLECTION_NAME = "vectorbench"


class VectorDBClient(ABC):
    name: str

    @abstractmethod
    def setup(self, *, dim: int, metric: str, m: int, ef_construction: int) -> None: ...

    @abstractmethod
    def insert(self, vectors: np.ndarray) -> None:
        """Bulk-insert. Row index becomes the external id."""

    def post_insert(self) -> None:
        """Hook for index builds that are deferred until after inserts (pgvector)."""
        return None

    @abstractmethod
    def set_ef_search(self, ef: int) -> None: ...

    @abstractmethod
    def query(self, vector: np.ndarray, k: int) -> list[int]: ...

    @abstractmethod
    def teardown(self) -> None: ...

    def close(self) -> None:
        return None
