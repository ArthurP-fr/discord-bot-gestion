import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

const LOCK_CLASS_ID = 7813;
const LOCK_OBJECT_ID = 4312;

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
};

const sha256 = (content) => createHash("sha256").update(content).digest("hex");

const listMigrationFiles = async (migrationsDir) => {
  const entries = await readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && /^\d+.*\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
};

const loadMigrations = async (migrationsDir) => {
  const files = await listMigrationFiles(migrationsDir);

  if (files.length === 0) {
    throw new Error(`[migrate] no SQL migration files found in ${migrationsDir}`);
  }

  const migrations = [];

  for (const fileName of files) {
    const filePath = path.join(migrationsDir, fileName);
    const sql = await readFile(filePath, "utf8");

    migrations.push({
      fileName,
      sql,
      checksum: sha256(sql),
    });
  }

  return migrations;
};

const ensureMigrationTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

const applyMigrations = async (client, migrations) => {
  const applied = await client.query("SELECT version, checksum FROM schema_migrations ORDER BY version ASC");

  const appliedByVersion = new Map(applied.rows.map((row) => [String(row.version), String(row.checksum)]));

  for (const migration of migrations) {
    const existingChecksum = appliedByVersion.get(migration.fileName);
    if (existingChecksum) {
      if (existingChecksum !== migration.checksum) {
        throw new Error(
          `[migrate] checksum mismatch for ${migration.fileName}. expected ${existingChecksum}, got ${migration.checksum}`,
        );
      }

      continue;
    }

    await client.query("BEGIN");

    try {
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
        [migration.fileName, migration.checksum],
      );
      await client.query("COMMIT");
      console.log(`[migrate] applied ${migration.fileName}`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw new Error(`[migrate] failed while applying ${migration.fileName}`, { cause: error });
    }
  }
};

const main = async () => {
  loadEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error("[migrate] DATABASE_URL is required");
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, "../../..");
  const migrationsDir = path.join(rootDir, "database", "migrations");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: parseBoolean(process.env.DATABASE_SSL, false)
      ? {
        rejectUnauthorized: true,
      }
      : undefined,
  });

  const client = await pool.connect();

  try {
    const migrations = await loadMigrations(migrationsDir);

    await client.query("SELECT pg_advisory_lock($1, $2)", [LOCK_CLASS_ID, LOCK_OBJECT_ID]);
    await ensureMigrationTable(client);
    await applyMigrations(client, migrations);
    console.log("[migrate] completed");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1, $2)", [LOCK_CLASS_ID, LOCK_OBJECT_ID]).catch(() => undefined);
    client.release();
    await pool.end();
  }
};

main().catch((error) => {
  console.error("[migrate] fatal", error);
  process.exit(1);
});
