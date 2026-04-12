import { Pool } from "pg";

import { env } from "../config/env.js";
import {
  DEFAULT_ACTIVITY_ROTATION_INTERVAL_SECONDS,
  createDefaultPresenceState,
  isPresenceActivityTypeValue,
  isPresenceStatusValue,
  sanitizeActivityText,
  sanitizeActivityTexts,
  sanitizePresenceRotationIntervalSeconds,
  type PresenceActivityTypeValue,
  type PresenceState,
  type PresenceStatusValue,
} from "./presenceTypes.js";

interface PresenceRow {
  status: string;
  activity_type: string;
  activity_text: string;
  activity_texts: string | null;
  rotation_interval_seconds: number | null;
}

const tableSql = `
CREATE TABLE IF NOT EXISTS bot_presence_states (
  bot_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  activity_text TEXT NOT NULL,
  activity_texts TEXT,
  rotation_interval_seconds INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const migrationSql = `
ALTER TABLE bot_presence_states
  ADD COLUMN IF NOT EXISTS activity_texts TEXT;

ALTER TABLE bot_presence_states
  ADD COLUMN IF NOT EXISTS rotation_interval_seconds INTEGER;
`;

const backfillSql = `
UPDATE bot_presence_states
SET
  activity_texts = COALESCE(activity_texts, '[]'),
  rotation_interval_seconds = COALESCE(rotation_interval_seconds, ${DEFAULT_ACTIVITY_ROTATION_INTERVAL_SECONDS})
WHERE activity_texts IS NULL OR rotation_interval_seconds IS NULL;
`;

const parseStoredTexts = (rawTexts: string | null, fallbackText: string): string[] => {
  if (typeof rawTexts === "string" && rawTexts.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawTexts) as unknown;
      if (Array.isArray(parsed)) {
        const stringValues = parsed
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);

        if (stringValues.length > 0) {
          return sanitizeActivityTexts(stringValues);
        }
      }
    } catch {
      // Fallback to legacy single text when malformed JSON is encountered.
    }
  }

  return sanitizeActivityTexts([fallbackText]);
};

const toPresenceState = (row: PresenceRow): PresenceState | null => {
  if (!isPresenceStatusValue(row.status) || !isPresenceActivityTypeValue(row.activity_type)) {
    return null;
  }

  const texts = parseStoredTexts(row.activity_texts, row.activity_text);
  const rotationIntervalSeconds = sanitizePresenceRotationIntervalSeconds(
    row.rotation_interval_seconds ?? DEFAULT_ACTIVITY_ROTATION_INTERVAL_SECONDS,
  );

  return {
    status: row.status as PresenceStatusValue,
    activity: {
      type: row.activity_type as PresenceActivityTypeValue,
      text: texts[0] ?? sanitizeActivityText(row.activity_text),
      texts,
      rotationIntervalSeconds,
    },
  };
};

class PresenceStore {
  public constructor(private readonly pool: Pool) {}

  public async init(): Promise<void> {
    await this.pool.query(tableSql);
    await this.pool.query(migrationSql);
    await this.pool.query(backfillSql);
  }

  public async getByBotId(botId: string): Promise<PresenceState> {
    const result = await this.pool.query<PresenceRow>(
      "SELECT status, activity_type, activity_text, activity_texts, rotation_interval_seconds FROM bot_presence_states WHERE bot_id = $1 LIMIT 1",
      [botId],
    );

    const row = result.rows[0];
    if (!row) {
      return createDefaultPresenceState();
    }

    return toPresenceState(row) ?? createDefaultPresenceState();
  }

  public async upsertByBotId(botId: string, state: PresenceState): Promise<void> {
    const activityTexts = sanitizeActivityTexts(state.activity.texts);
    const primaryText = activityTexts[0] ?? sanitizeActivityText(state.activity.text);
    const rotationIntervalSeconds = sanitizePresenceRotationIntervalSeconds(state.activity.rotationIntervalSeconds);

    await this.pool.query(
      `
        INSERT INTO bot_presence_states (
          bot_id,
          status,
          activity_type,
          activity_text,
          activity_texts,
          rotation_interval_seconds,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (bot_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          activity_type = EXCLUDED.activity_type,
          activity_text = EXCLUDED.activity_text,
          activity_texts = EXCLUDED.activity_texts,
          rotation_interval_seconds = EXCLUDED.rotation_interval_seconds,
          updated_at = NOW()
      `,
      [
        botId,
        state.status,
        state.activity.type,
        primaryText,
        JSON.stringify(activityTexts),
        rotationIntervalSeconds,
      ],
    );
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

let store: PresenceStore | null = null;

export const initPresenceStore = async (): Promise<PresenceStore> => {
  if (store) {
    return store;
  }

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  });

  const nextStore = new PresenceStore(pool);
  try {
    await nextStore.init();
    store = nextStore;
    return nextStore;
  } catch (error) {
    await pool.end().catch(() => {
      // Ignore close errors; the original init error is the one we want to surface.
    });
    throw error;
  }
};

export const getPresenceStore = (): PresenceStore => {
  if (!store) {
    throw new Error("PresenceStore is not initialized. Call initPresenceStore() during bootstrap.");
  }

  return store;
};

export const shutdownPresenceStore = async (): Promise<void> => {
  if (!store) {
    return;
  }

  await store.close();
  store = null;
};
