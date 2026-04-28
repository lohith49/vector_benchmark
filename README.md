# VectorBench

A reproducible, cloud-hosted benchmark of **Qdrant**, **Weaviate**, and **pgvector**
on the [ann-benchmarks](https://github.com/erikbern/ann-benchmarks) datasets, with an
LLM-generated comparison report published as a polished static site.

```
                                              ┌──────────────────────┐
   ann-benchmarks HDF5  ─────► dataset loader ─► (numpy)
                                              │
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │   Qdrant     │  │   Weaviate   │  │   pgvector   │  (Kubernetes pods)
   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
          │                  │                  │
          └────────── benchmark runner ─────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │  results-postgres    │  (run + per-(db, dataset, ef) row)
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │  LangChain + Claude  │ → site/public/results.json
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │  Next.js static site │ → GitHub Pages
              └──────────────────────┘
```

## What it measures

For every `(database, dataset, ef_search)` combination:

| Metric | What it means |
| --- | --- |
| `recall@10` | fraction of true top-10 neighbors returned (vs. ground truth in the HDF5 file) |
| `p50_ms`, `p99_ms` | median and tail single-query latency over 1k queries |
| `qps` | sustained queries per second (serial workload) |
| `insert_seconds` | wall time to bulk-load `n_train` vectors |
| `index_seconds` | extra time to build the HNSW index after insert (pgvector only) |

It's an apples-to-apples sweep: every DB gets the same vectors, the same HNSW build
params (`m`, `ef_construction`), and the same `ef_search` ladder.

## Datasets

All three datasets ship with ground-truth top-100 neighbors, so recall is computed
against the same reference for every DB:

- **sift-128-euclidean** — 1M × 128d, L2 (classic ANN benchmark)
- **glove-100-angular** — 1.18M × 100d, cosine (NLP embeddings)
- **fashion-mnist-784-euclidean** — 60k × 784d, L2 (high-dimensional image features)

Source: <http://ann-benchmarks.com/>

## Prerequisites

| Tool | Why | Install |
| --- | --- | --- |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | container runtime for kind | required |
| [kind](https://kind.sigs.k8s.io/) | local Kubernetes | `choco install kind` / `brew install kind` |
| [kubectl](https://kubernetes.io/docs/tasks/tools/) | K8s CLI | bundled with Docker Desktop |
| Python 3.11+ | benchmark runner + report generator | required |
| Node 20+ | static site builder | required |
| Google AI API key | LLM report generator (Gemini 2.5 Flash) | <https://aistudio.google.com/apikey> |

## Quick start (laptop, ~30 minutes end to end)

```bash
# 1. Configure
cp .env.example .env
# Edit .env: set GOOGLE_API_KEY. Defaults work for everything else.

# 2. Bring up the cluster + databases
make cluster-up
make apply
make wait                # waits for all 4 DB pods to be Ready (~2 min on first run)

# 3. Forward DB ports to localhost
make pf-bg               # background; stop later with `make pf-stop`

# 4. Install Python deps + download datasets
make venv
make datasets            # ~600 MB total

# 5. Run the benchmark (DATASET_LIMIT=100000 by default)
make bench               # ~15-25 min on a laptop

# 6. Generate the LLM-written comparison
make report              # writes site/public/results.json

# 7. Build the static site
make site                # outputs site/out/
# Open site/out/index.html, or `cd site && npm run dev` to serve it.
```

To tear down, `make pf-stop && make cluster-down`.

## Running on a beefier remote (full datasets)

If you have an SSH-accessible machine with more RAM:

```bash
# On the remote:
git clone <your fork>
cd cloud_project
cp .env.example .env
# Edit .env: GOOGLE_API_KEY=..., DATASET_LIMIT=full
make all                 # cluster + bench + report + site, end to end
```

`DATASET_LIMIT=full` uses the entire training set (1M vectors for SIFT/GloVe). With
default ef_search sweep, expect ~2–4 hours on a 32 GB / 8-core box.

## Configuration

All knobs are environment variables (loaded from `.env`):

| Var | Default | Purpose |
| --- | --- | --- |
| `DATASET_LIMIT` | `100000` | rows to load from the train set; `full` = no limit |
| `QUERY_LIMIT` | `1000` | queries to run per (db, dataset, ef) |
| `DATASETS` | all three | comma-separated subset to benchmark |
| `DATABASES` | `qdrant,weaviate,pgvector` | comma-separated subset |
| `EF_SEARCH_VALUES` | `16,32,64,128,256` | ef_search sweep |
| `HNSW_M` | `16` | HNSW connections-per-node |
| `HNSW_EF_CONSTRUCTION` | `128` | HNSW build quality |
| `GEMINI_MODEL` | `gemini-2.5-flash` | model for report narrative |

## Publishing the report (GitHub Pages)

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the workflow manually): `.github/workflows/deploy-pages.yml`
   builds `site/` and deploys it. Subsequent runs just need a new
   `site/public/results.json` committed.

The workflow sets `BASE_PATH=/<repo-name>` so links work under
`https://<user>.github.io/<repo>/`.

## Project layout

```
cloud_project/
├── infra/k8s/             # kind config + StatefulSets + Services
├── benchmark/             # Python: dataset loader, DB clients, runner, results writer
│   └── src/clients/       # Qdrant / Weaviate / pgvector adapters (one file each)
├── report/                # Python: LangChain + Claude → site/public/results.json
├── site/                  # Next.js 15 static export (Apple-HIG styled, Recharts)
├── scripts/               # port-forward helpers (bash + PowerShell)
├── .github/workflows/     # GitHub Pages deploy
├── Makefile               # top-level orchestration
└── .env.example           # all knobs documented
```

## Troubleshooting

**`make wait` hangs forever.** A pod is failing to start. Check with:
```
kubectl -n vectorbench get pods
kubectl -n vectorbench describe pod <name>
kubectl -n vectorbench logs <name>
```

**Connection refused on localhost:6333 / 8080 / 5433 / 5434.** Port-forwards aren't
running. Run `make pf-bg`.

**Weaviate insert is slow.** The dynamic batch is throughput-tuned, but on first run
it warms up. If you see consistent latency, drop `DATASET_LIMIT` for a faster
iteration cycle.

**`make report` says "GOOGLE_API_KEY not set".** Either it's missing from `.env`
or your shell didn't pick it up. Re-source `.env` or `export GOOGLE_API_KEY=...`.

**pgvector index build is the slowest step.** Expected — pgvector builds the HNSW
index after `COPY` finishes. The runner reports this as `index_seconds`.

## License & credits

Datasets © their respective sources via [ann-benchmarks](https://github.com/erikbern/ann-benchmarks).
Engines: [Qdrant](https://qdrant.tech/), [Weaviate](https://weaviate.io/), [pgvector](https://github.com/pgvector/pgvector).
Report generated by [Gemini 2.5 Flash](https://ai.google.dev/) via LangChain.
