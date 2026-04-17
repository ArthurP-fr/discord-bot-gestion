import type { Pool } from "pg";

import type {
  PresenceActivityTypeValue,
  PresenceRow,
  PresenceState,
  PresenceStatusValue,
} from "../../types/presence.js";
import {
  DEFAULT_ACTIVITY_ROTATION_INTERVAL_SECONDS,
  createDefaultPresenceState,
  isPresenceActivityTypeValue,
  isPresenceStatusValue,
  sanitizeActivityText,
  sanitizeActivityTexts,
  sanitizePresenceRotationIntervalSeconds,
} from "../../validators/presence.js";
import type { PresenceRepository } from "../../modules/presence/index.js";

const presenceSchemaProbeSql = `
SELECT
  bot_id,
  status,
  activity_type,
  activity_text,
  activity_texts,
  rotation_interval_seconds,
  updated_at
FROM bot_presence_states
LIMIT 0;
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

export class PostgresPresenceStore implements PresenceRepository {
  public constructor(private readonly pool: Pool) {}

  public async init(): Promise<void> {
    try {
      await this.pool.query(presenceSchemaProbeSql);
    } catch (error) {
      throw new Error(
        "[db:init] missing or incompatible table \"bot_presence_states\". Run migrations with \"npm run migrate\".",
        { cause: error },
      );
    }
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
}
