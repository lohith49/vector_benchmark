export type Result = {
  database: string;
  dataset: string;
  metric: string;
  dim: number;
  n_train: number;
  n_test: number;
  hnsw_m: number;
  hnsw_ef_construction: number;
  ef_search: number;
  k: number;
  insert_seconds: number;
  index_seconds: number;
  recall_at_k: number;
  qps: number;
  p50_ms: number;
  p90_ms: number;
  p95_ms: number;
  p99_ms: number;
  mean_ms: number;
  min_ms: number;
  max_ms: number;
};

export type RunMeta = {
  id: string;
  started_at: string;
  host: string;
  platform: string;
  config: Record<string, unknown>;
};

export type Narrative = {
  headline: string;
  tl_dr: string[];
  per_database: Record<
    string,
    {
      summary: string;
      strengths: string[];
      weaknesses: string[];
      best_use_case: string;
    }
  >;
  recommendation: {
    if_low_latency_critical: string;
    if_high_recall_critical: string;
    if_postgres_already: string;
    if_managed_simplicity: string;
  };
  caveats: string[];
};

export type ReportBundle = {
  generated_at: string;
  model: string;
  run: RunMeta;
  results: Result[];
  narrative: Narrative;
};
