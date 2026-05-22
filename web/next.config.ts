import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Use Windows trust store so HTTPS to fonts.googleapis.com works with AV/MITM setups.
    turbopackUseSystemTlsCerts: true,
  },
  // Repo root also has package-lock.json; pin Turbopack to this app.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
