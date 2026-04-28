"""CLI entrypoint: `python -m benchmark.src.main`."""

from __future__ import annotations

import sys

from .runner import run_all


def main() -> int:
    summaries = run_all()
    return 0 if summaries else 1


if __name__ == "__main__":
    sys.exit(main())
