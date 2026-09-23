import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The repo root has its own package-lock.json (pipeline tooling); pin the
  // tracing root to this app so Next/Vercel build the web app correctly.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;