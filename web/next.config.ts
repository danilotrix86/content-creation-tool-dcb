import path from "node:path";

import type { NextConfig } from "next";

const isWindows = process.platform === "win32";

const nextConfig: NextConfig = {
  ...(isWindows
    ? {
        experimental: {
          // Dev workaround for Windows AV/HTTPS inspection during Turbopack dev builds.
          turbopackUseSystemTlsCerts: true,
        },
      }
    : {}),
  serverExternalPackages: [
    "@google/genai",
    "openai",
    "undici",
    "@supabase/supabase-js",
  ],
  // Pin Turbopack root when the monorepo has other package manifests above web/.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
