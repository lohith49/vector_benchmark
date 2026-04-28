"""Weaviate benchmark client (weaviate-client v4)."""

from __future__ import annotations

import numpy as np
import weaviate
from weaviate.classes.config import (
    Configure,
    DataType,
    Property,
    Reconfigure,
    VectorDistances,
)
from weaviate.classes.query import MetadataQuery

from ..config import CONFIG
from .base import COLLECTION_NAME, VectorDBClient


_DISTANCE = {
    "l2": VectorDistances.L2_SQUARED,
    "cosine": VectorDistances.COSINE,
}

# Weaviate collection names must start with an uppercase letter.
_WV_COLLECTION = "Vectorbench"


class WeaviateBenchClient(VectorDBClient):
    name = "weaviate"

    def __init__(self) -> None:
        self.client = weaviate.connect_to_local(
            host=CONFIG.weaviate_host,
            port=CONFIG.weaviate_http_port,
            grpc_port=CONFIG.weaviate_grpc_port,
        )
        self._ef_search: int = 64
        self._dim: int = 0
        self._metric: str = "l2"
        self._m: int = 16
        self._ef_construction: int = 128

    def setup(self, *, dim: int, metric: str, m: int, ef_construction: int) -> None:
        self._dim = dim
        self._metric = metric
        self._m = m
        self._ef_construction = ef_construction
        if self.client.collections.exists(_WV_COLLECTION):
            self.client.collections.delete(_WV_COLLECTION)
        self.client.collections.create(
            name=_WV_COLLECTION,
            vectorizer_config=Configure.Vectorizer.none(),
            vector_index_config=Configure.VectorIndex.hnsw(
                distance_metric=_DISTANCE[metric],
                ef_construction=ef_construction,
                max_connections=m,
                ef=self._ef_search,
            ),
            properties=[Property(name="external_id", data_type=DataType.INT)],
        )

    def insert(self, vectors: np.ndarray) -> None:
        col = self.client.collections.get(_WV_COLLECTION)
        # dynamic batching adapts size to throughput; we just supply objects.
        with col.batch.dynamic() as batch:
            for i, vec in enumerate(vectors):
                batch.add_object(
                    properties={"external_id": int(i)},
                    vector=vec.tolist(),
                )
        # Surface any per-object errors that the batch swallowed silently.
        if col.batch.failed_objects:
            n = len(col.batch.failed_objects)
            first = col.batch.failed_objects[0]
            raise RuntimeError(f"Weaviate batch had {n} failures; first: {first}")

    def set_ef_search(self, ef: int) -> None:
        # Weaviate has no per-query ef knob; we update the collection's hnsw `ef`
        # at runtime via Reconfigure (only mutable params -- distance / construction /
        # max_connections are fixed at create time).
        self._ef_search = int(ef)
        col = self.client.collections.get(_WV_COLLECTION)
        col.config.update(
            vector_index_config=Reconfigure.VectorIndex.hnsw(ef=self._ef_search),
        )

    def query(self, vector: np.ndarray, k: int) -> list[int]:
        col = self.client.collections.get(_WV_COLLECTION)
        res = col.query.near_vector(
            near_vector=vector.tolist(),
            limit=k,
            return_metadata=MetadataQuery(distance=False),
            return_properties=["external_id"],
        )
        return [int(o.properties["external_id"]) for o in res.objects]

    def teardown(self) -> None:
        if self.client.collections.exists(_WV_COLLECTION):
            self.client.collections.delete(_WV_COLLECTION)

    def close(self) -> None:
        self.client.close()
