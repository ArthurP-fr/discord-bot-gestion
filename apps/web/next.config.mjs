import path from "node:path";
import { fileURLToPath } from "node:url";

import createNextIntlPlugin from "next-intl/plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "..", "..");

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // indispensable pour Docker + monorepo
  output: "standalone",

  // IMPORTANT pour éviter les problèmes de paths en monorepo
  outputFileTracingRoot: monorepoRoot,

  turbopack: {
    root: monorepoRoot,
  },

  // optimise build (optionnel mais recommandé)
  poweredByHeader: false,
  compress: true,

  // évite erreurs turbopack / build tracing inutile
  experimental: {
    // utile en monorepo pour stabilité
    externalDir: true,
  },
};

export default withNextIntl(nextConfig);
