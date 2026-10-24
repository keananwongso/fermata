import type { NextConfig } from "next";

// FERMATA_BASE_PATH is only set when building a copy served under a path prefix (for example inside Mana).
const basePath = process.env.FERMATA_BASE_PATH;

// On the hosted site the console (real API calls, writes to the books) is not served; it runs locally.
const PUBLIC_SITE = process.env.NEXT_PUBLIC_FERMATA_PUBLIC === "1";
const CONSOLE = ["/run", "/stories", "/rules", "/evaluation", "/record"];

const nextConfig: NextConfig = {
  ...(PUBLIC_SITE ? { async redirects() { return CONSOLE.map((source) => ({ source, destination: "/demo", permanent: false })); } } : {}),
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
