import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VectorBench — Qdrant vs Weaviate vs pgvector",
  description:
    "An open, automated benchmark of Qdrant, Weaviate, and pgvector on the ann-benchmarks datasets. Recall, latency, and throughput at multiple HNSW settings.",
  icons: { icon: "/favicon.svg" },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
