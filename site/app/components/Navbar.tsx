"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "auto";

const STORAGE_KEY = "vectorbench-theme";

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

export function Navbar({ runId }: { runId: string }) {
  const [theme, setTheme] = useState<Theme>("auto");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "auto";
    setTheme(saved);
    applyTheme(saved);
    setMounted(true);
  }, []);

  const cycle = () => {
    const next: Theme = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto";
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  const themeIcon = !mounted ? "◐" : theme === "auto" ? "◐" : theme === "light" ? "☀" : "☾";
  const themeLabel = !mounted ? "auto" : theme;

  return (
    <header className="navbar" id="top">
      <div className="container navbar-inner">
        <a href="#top" className="brand" aria-label="VectorBench home">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <defs>
              <linearGradient id="vbgrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--indigo)" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#vbgrad)" />
            <path
              d="M6 13l3 3 9-9"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span>VectorBench</span>
        </a>

        <nav className="nav-links" aria-label="Sections">
          <a href="#kpis">Overview</a>
          <a href="#results">Pareto</a>
          <a href="#throughput">Throughput</a>
          <a href="#per-database">Databases</a>
          <a href="#raw">Data</a>
        </nav>

        <div className="nav-actions">
          <span className="nav-run subtle" title={runId}>
            run <span className="kbd">{runId.slice(0, 7)}</span>
          </span>
          <button
            type="button"
            className="theme-toggle"
            onClick={cycle}
            aria-label={`Theme: ${themeLabel}. Click to cycle.`}
            title={`Theme: ${themeLabel}`}
          >
            <span aria-hidden>{themeIcon}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
