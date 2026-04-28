#!/usr/bin/env bash
# Port-forwards every DB service from the kind cluster to localhost on the ports
# listed in .env.example. Usage:
#   bash scripts/port_forward.sh                  # foreground, Ctrl-C to stop
#   bash scripts/port_forward.sh --background     # background, writes pids to /tmp
#   bash scripts/port_forward.sh --stop           # stop all background forwards

set -euo pipefail

PIDFILE=/tmp/vectorbench-pf.pids
NAMESPACE=vectorbench

# (local-port  service:remote-port)
TARGETS=(
  "6333  svc/qdrant:6333"
  "8080  svc/weaviate:8080"
  "50051 svc/weaviate:50051"
  "5433  svc/pgvector:5432"
  "5434  svc/results-postgres:5432"
)

start_one() {
  local lp svc
  lp="$1"; svc="$2"
  kubectl -n "$NAMESPACE" port-forward "$svc" "$lp:${svc##*:}" >/dev/null 2>&1 &
  echo $!
}

case "${1:-}" in
  --stop)
    if [[ -f "$PIDFILE" ]]; then
      while read -r pid; do
        if kill -0 "$pid" 2>/dev/null; then kill "$pid"; fi
      done < "$PIDFILE"
      rm -f "$PIDFILE"
      echo "Stopped background port-forwards."
    else
      echo "No PID file at $PIDFILE; nothing to stop."
    fi
    ;;
  --background)
    : > "$PIDFILE"
    for t in "${TARGETS[@]}"; do
      lp="${t%% *}"; svc="${t##* }"
      pid="$(start_one "$lp" "$svc")"
      echo "$pid" >> "$PIDFILE"
      echo "  forwarding $svc -> localhost:$lp (pid $pid)"
    done
    echo "Background forwards started. Stop with: bash scripts/port_forward.sh --stop"
    ;;
  *)
    pids=()
    cleanup() { for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
    trap cleanup EXIT INT TERM
    for t in "${TARGETS[@]}"; do
      lp="${t%% *}"; svc="${t##* }"
      pid="$(start_one "$lp" "$svc")"
      pids+=("$pid")
      echo "  forwarding $svc -> localhost:$lp (pid $pid)"
    done
    echo "Foreground forwards running. Ctrl-C to stop."
    wait "${pids[@]}"
    ;;
esac
