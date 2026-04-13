import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "build");
const SOURCE_I18N_DIR = path.join(ROOT_DIR, "src", "i18n");
const OUTPUT_I18N_DIR = path.join(OUTPUT_DIR, "i18n");

const main = async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });

  await build({
    absWorkingDir: ROOT_DIR,
    entryPoints: ["src/index.ts"],
    outfile: "build/index.js",
    bundle: true,
    packages: "external",
    minify: true,
    legalComments: "none",
    platform: "node",
    format: "esm",
    target: ["node18"],
    tsconfig: "tsconfig.json",
    logLevel: "info",
  });

  await mkdir(OUTPUT_I18N_DIR, { recursive: true });
  const localeEntries = await readdir(SOURCE_I18N_DIR, { withFileTypes: true });
  for (const entry of localeEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    await cp(path.join(SOURCE_I18N_DIR, entry.name), path.join(OUTPUT_I18N_DIR, entry.name), { force: true });
  }
};

main().catch((error) => {
  console.error("[build] failed", error);
  process.exit(1);
});
