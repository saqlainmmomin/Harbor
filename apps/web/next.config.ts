import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — a stray lockfile in a parent directory otherwise
  // makes Turbopack infer the wrong root for file tracing.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
