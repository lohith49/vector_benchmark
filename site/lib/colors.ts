// Client-safe constants. Pure data, no Node imports — can be used inside
// "use client" components without dragging fs/path into the bundle.

export const DB_COLORS: Record<string, string> = {
  qdrant: "var(--db-qdrant)",
  weaviate: "var(--db-weaviate)",
  pgvector: "var(--db-pgvector)",
};

export const DB_LABEL: Record<string, string> = {
  qdrant: "Qdrant",
  weaviate: "Weaviate",
  pgvector: "pgvector",
};
