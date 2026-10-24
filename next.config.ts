import type { NextConfig } from "next";

// FERMATA_BASE_PATH is only set when building a copy served under a path prefix (for example inside Mana).
const basePath = process.env.FERMATA_BASE_PATH;

const nextConfig: NextConfig = {
  ...(basePath ? { basePath, distDir: ".next-prefixed" } : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
