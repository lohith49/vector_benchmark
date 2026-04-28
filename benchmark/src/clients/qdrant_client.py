"""Qdrant benchmark client (qdrant-client >= 1.12)."""

from __future__ import annotations

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest

from ..config import CONFIG
from .base import COLLECTION_NAME, VectorDBClient


_DISTANCE = {
    "l2": rest.Distance.EUCLID,
    "cosine": rest.Distance.COSINE,
}


class QdrantBenchClient(VectorDBClient):
    name = "qdrant"

    def __init__(self) -> None:
        self.client = QdrantClient(url=CONFIG.qdrant_url, prefer_grpc=False, timeout=120)
        self._ef_search: int = 64

    def setup(self, *, dim: int, metric: str, m: int, ef_construction: int) -> None:
        # recreate is the safest reset between runs.
        if self.client.collection_exists(collection_name=COLLECTION_NAME):
            self.client.delete_collection(collection_name=COLLECTION_NAME)
        self.client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=rest.VectorParams(size=dim, distance=_DISTANCE[metric]),
            hnsw_config=rest.HnswConfigDiff(m=m, ef_construct=ef_construction),
            # Higher write parallelism during the bulk insert.
            optimizers_config=rest.OptimizersConfigDiff(default_segment_number=2),
        )

    def insert(self, vectors: np.ndarray) -> None:
        # upload_collection batches and parallelises under the hood.
        ids = list(range(vectors.shape[0]))
        self.client.upload_collection(
            collection_name=COLLECTION_NAME,
            vectors=vectors,
            ids=ids,
            batch_size=512,
            parallel=2,
            wait=True,
        )

    def post_insert(self) -> None:
        # Qdrant indexes segments asynchronously. Poll until status == GREEN so the
        # HNSW index is built before we start measuring query latency. We also lower
        # the indexing_threshold to ensure even small benchmark runs get indexed
        # (default is 20000 vectors per segment).
        import time as _t
        self.client.update_collection(
            collection_name=COLLECTION_NAME,
            optimizers_config=rest.OptimizersConfigDiff(indexing_threshold=1),
        )
        deadline = _t.time() + 600
        while _t.time() < deadline:
            info = self.client.get_collection(collection_name=COLLECTION_NAME)
            if info.status == rest.CollectionStatus.GREEN:
                return
            _t.sleep(1)
        raise RuntimeError("Qdrant collection did not reach GREEN within 10 minutes")

    def set_ef_search(self, ef: int) -> None:
        self._ef_search = int(ef)

    def query(self, vector: np.ndarray, k: int) -> list[int]:
        # query_points is the modern entrypoint; .points contains ScoredPoint objects.
        result = self.client.query_points(
            collection_name=COLLECTION_NAME,
            query=vector.tolist(),
            limit=k,
            with_payload=False,
            with_vectors=False,
            search_params=rest.SearchParams(hnsw_ef=self._ef_search, exact=False),
        )
        return [int(p.id) for p in result.points]

    def teardown(self) -> None:
        if self.client.collection_exists(collection_name=COLLECTION_NAME):
            self.client.delete_collection(collection_name=COLLECTION_NAME)

    def close(self) -> None:
        self.client.close()
