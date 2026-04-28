# Top-level orchestration. Designed to work on macOS, Linux, and Windows (Git Bash / WSL).
# On Windows PowerShell, run the underlying scripts directly (see README.md).

SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PYTHON ?= python
VENV   ?= .venv
PIP    := $(VENV)/bin/pip
PY     := $(VENV)/bin/python

# On Windows the venv puts binaries in Scripts/, not bin/.
ifeq ($(OS),Windows_NT)
PIP := $(VENV)/Scripts/pip
PY  := $(VENV)/Scripts/python
endif

.PHONY: help
help: ## Show this help.
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS=":.*?## "} {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ----------------------------------------------------------------------------
# Python environment
# ----------------------------------------------------------------------------
.PHONY: venv
venv: ## Create the Python virtualenv and install all deps.
	$(PYTHON) -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r benchmark/requirements.txt
	$(PIP) install -r report/requirements.txt

# ----------------------------------------------------------------------------
# Cluster lifecycle
# ----------------------------------------------------------------------------
.PHONY: cluster-up cluster-down apply wait
cluster-up: ## Create the kind cluster.
	kind create cluster --config infra/k8s/kind-config.yaml --name vectorbench || true
	kubectl cluster-info --context kind-vectorbench

cluster-down: ## Delete the kind cluster.
	kind delete cluster --name vectorbench

apply: ## Apply all Kubernetes manifests.
	kubectl apply -f infra/k8s/namespace.yaml
	kubectl apply -f infra/k8s/qdrant.yaml
	kubectl apply -f infra/k8s/weaviate.yaml
	kubectl apply -f infra/k8s/pgvector.yaml
	kubectl apply -f infra/k8s/results-postgres.yaml

wait: ## Wait for all DB pods to be ready.
	kubectl -n vectorbench wait --for=condition=Ready pod -l app=qdrant --timeout=300s
	kubectl -n vectorbench wait --for=condition=Ready pod -l app=weaviate --timeout=300s
	kubectl -n vectorbench wait --for=condition=Ready pod -l app=pgvector --timeout=300s
	kubectl -n vectorbench wait --for=condition=Ready pod -l app=results-postgres --timeout=300s

# ----------------------------------------------------------------------------
# Port forwards (run in a separate terminal, or use `make pf-bg`)
# ----------------------------------------------------------------------------
.PHONY: port-forward pf-bg pf-stop
port-forward: ## Forward all DB ports to localhost (foreground; Ctrl-C to stop).
	bash scripts/port_forward.sh

pf-bg: ## Forward all DB ports to localhost in the background.
	bash scripts/port_forward.sh --background

pf-stop: ## Stop background port-forwards started with pf-bg.
	bash scripts/port_forward.sh --stop

# ----------------------------------------------------------------------------
# Workflow
# ----------------------------------------------------------------------------
.PHONY: datasets bench report site
datasets: ## Download ann-benchmarks datasets to ./data/.
	$(PY) -m benchmark.src.datasets

bench: ## Run the full benchmark suite. Writes results to results-postgres.
	$(PY) -m benchmark.src.main

report: ## Read results, ask Claude to write the comparison, emit site/public/results.json.
	$(PY) -m report.generate

site: ## Build the static report site to site/out/.
	cd site && npm install && npm run build

# ----------------------------------------------------------------------------
# One-shots
# ----------------------------------------------------------------------------
.PHONY: up all clean
up: cluster-up apply wait ## Create cluster + apply + wait for readiness.

all: up datasets pf-bg bench report site ## End-to-end: cluster -> bench -> report -> site.

clean: ## Remove generated artifacts (NOT the cluster).
	rm -rf data/ results/ site/out/ site/.next/ $(VENV)/
