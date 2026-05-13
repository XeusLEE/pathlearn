import type { NextConfig } from "next";

// Conditional static export for GitHub Pages. Triggered by the deploy workflow
// (NEXT_PUBLIC_STATIC=true). Dev (`npm run dev`) keeps the API route + dynamic
// routing as normal.
const isStaticExport = process.env.NEXT_PUBLIC_STATIC === "true";
const basePath =
  isStaticExport && process.env.NEXT_PUBLIC_BASE_PATH
    ? process.env.NEXT_PUBLIC_BASE_PATH
    : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  ...(isStaticExport && {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
    basePath,
  }),
};

export default nextConfig;
