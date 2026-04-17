import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BOT_DIR = path.resolve(SCRIPT_DIR, "..");
const SOURCE_DIR = path.join(BOT_DIR, "src", "legacy", "i18n");
const TARGET_DIR = path.join(BOT_DIR, "dist", "legacy", "i18n");

if (!existsSync(SOURCE_DIR)) {
	throw new Error(`[i18n] source locale directory not found: ${SOURCE_DIR}`);
}

mkdirSync(TARGET_DIR, { recursive: true });

for (const fileName of readdirSync(SOURCE_DIR)) {
	if (!fileName.endsWith(".json")) {
		continue;
	}

	copyFileSync(path.join(SOURCE_DIR, fileName), path.join(TARGET_DIR, fileName));
}