"""ANN-Benchmarks dataset loader.

The ann-benchmarks project (https://github.com/erikbern/ann-benchmarks) hosts a set of
canonical ANN evaluation datasets as HDF5 files. Each file contains four datasets:

    /train      (N, dim)  float32   -- vectors to insert
    /test       (Q, dim)  float32   -- query vectors
    /neighbors  (Q, 100)  int32     -- ground-truth indices into /train (top 100)
    /distances  (Q, 100)  float32   -- ground-truth distances

We use the same files via the canonical ann-benchmarks.com mirror.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import h5py
import numpy as np
import requests
from tqdm import tqdm

from .config import CONFIG, DATA_DIR


# Each dataset's canonical download URL and the distance metric the benchmark uses.
# These exact URLs are documented in the ann-benchmarks repo and have been stable for years.
DATASETS: dict[str, dict[str, str]] = {
    "sift-128-euclidean": {
        "url": "http://ann-benchmarks.com/sift-128-euclidean.hdf5",
        "metric": "l2",
        "dim": "128",
    },
    "glove-100-angular": {
        "url": "http://ann-benchmarks.com/glove-100-angular.hdf5",
        "metric": "cosine",
        "dim": "100",
    },
    "fashion-mnist-784-euclidean": {
        "url": "http://ann-benchmarks.com/fashion-mnist-784-euclidean.hdf5",
        "metric": "l2",
        "dim": "784",
    },
}


@dataclass(frozen=True)
class Dataset:
    name: str
    metric: str  # "l2" or "cosine"
    dim: int
    train: np.ndarray  # (N, dim) float32
    test: np.ndarray  # (Q, dim) float32
    neighbors: np.ndarray  # (Q, 100) int32 -- indices into train
    distances: np.ndarray  # (Q, 100) float32

    @property
    def n_train(self) -> int:
        return self.train.shape[0]

    @property
    def n_test(self) -> int:
        return self.test.shape[0]


def dataset_path(name: str) -> Path:
    return DATA_DIR / f"{name}.hdf5"


def download(name: str) -> Path:
    """Downloads the HDF5 file for the given dataset. Idempotent."""
    if name not in DATASETS:
        raise KeyError(f"Unknown dataset {name!r}. Known: {list(DATASETS)}")
    out = dataset_path(name)
    if out.exists() and out.stat().st_size > 0:
        return out
    url = DATASETS[name]["url"]
    print(f"[datasets] downloading {name} from {url}", flush=True)
    tmp = out.with_suffix(".hdf5.part")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        with open(tmp, "wb") as f, tqdm(
            total=total, unit="B", unit_scale=True, desc=name
        ) as bar:
            for chunk in r.iter_content(chunk_size=1 << 20):
                if chunk:
                    f.write(chunk)
                    bar.update(len(chunk))
    tmp.replace(out)
    return out


def load(
    name: str,
    *,
    train_limit: int | None = None,
    test_limit: int | None = None,
) -> Dataset:
    """Loads a dataset (downloads if needed). Optionally subsamples train/test.

    When subsampling train, we take the first `train_limit` rows. The ground-truth
    neighbors that point to indices >= train_limit are filtered out per-query before
    recall is computed; see metrics.recall_at_k.
    """
    path = download(name)
    meta = DATASETS[name]
    with h5py.File(path, "r") as f:
        train = f["train"][:]
        test = f["test"][:]
        neighbors = f["neighbors"][:]
        distances = f["distances"][:]

    train = np.asarray(train, dtype=np.float32)
    test = np.asarray(test, dtype=np.float32)
    neighbors = np.asarray(neighbors, dtype=np.int64)
    distances = np.asarray(distances, dtype=np.float32)

    if train_limit is not None and train_limit < train.shape[0]:
        train = train[:train_limit]
    if test_limit is not None and test_limit < test.shape[0]:
        test = test[:test_limit]
        neighbors = neighbors[:test_limit]
        distances = distances[:test_limit]

    return Dataset(
        name=name,
        metric=meta["metric"],
        dim=int(meta["dim"]),
        train=train,
        test=test,
        neighbors=neighbors,
        distances=distances,
    )


def main() -> int:
    """CLI: download all configured datasets to ./data/."""
    for name in CONFIG.datasets:
        path = download(name)
        size_mb = path.stat().st_size / (1024 * 1024)
        with h5py.File(path, "r") as f:
            n, dim = f["train"].shape
            q = f["test"].shape[0]
        print(f"  {name}: {n:,} train x {dim}d, {q:,} queries  ({size_mb:.0f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
