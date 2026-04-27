import path from "node:path";
import { fileURLToPath } from "node:url";

import createNextIntlPlugin from "next-intl/plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // indispensable pour Docker + monorepo
  output: "standalone",

  // IMPORTANT pour éviter les problèmes de paths en monorepo
  outputFileTracingRoot: process.cwd(),

  turbopack: {
    root: path.join(__dirname, "..", ".."),
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
