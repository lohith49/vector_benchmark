from .base import VectorDBClient
from .qdrant_client import QdrantBenchClient
from .weaviate_client import WeaviateBenchClient
from .pgvector_client import PgvectorBenchClient


def get_client(name: str) -> VectorDBClient:
    if name == "qdrant":
        return QdrantBenchClient()
    if name == "weaviate":
        return WeaviateBenchClient()
    if name == "pgvector":
        return PgvectorBenchClient()
    raise ValueError(f"unknown database {name!r}")


__all__ = [
    "VectorDBClient",
    "QdrantBenchClient",
    "WeaviateBenchClient",
    "PgvectorBenchClient",
    "get_client",
]
