import { Pool } from "pg";

import { env } from "../../config/env.js";
import type {
  MemberMessageConfig,
  MemberMessageKind,
  MemberMessageRow,
} from "../../types/memberMessages.js";
import {
  createDefaultMemberMessageConfig,
  isMemberMessageRenderTypeValue,
} from "../../types/memberMessageTypes.js";

const tableSql = `
CREATE TABLE IF NOT EXISTS bot_member_message_configs (
  bot_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  channel_id TEXT,
  message_type TEXT NOT NULL DEFAULT 'simple',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bot_id, guild_id, kind)
);
`;

const migrationSql = `
ALTER TABLE bot_member_message_configs
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE bot_member_message_configs
  ADD COLUMN IF NOT EXISTS channel_id TEXT;

ALTER TABLE bot_member_message_configs
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'simple';
`;

const toConfig = (row: MemberMessageRow): MemberMessageConfig => {
  const fallback = createDefaultMemberMessageConfig();

  return {
    enabled: row.enabled,
    channelId: row.channel_id,
    messageType: isMemberMessageRenderTypeValue(row.message_type) ? row.message_type : fallback.messageType,
  };
};

class MemberMessageStore {
  public constructor(private readonly pool: Pool) {}

  public async init(): Promise<void> {
    await this.pool.query(tableSql);
    await this.pool.query(migrationSql);
  }

  public async getByBotGuildKind(botId: string, guildId: string, kind: MemberMessageKind): Promise<MemberMessageConfig> {
    const result = await this.pool.query<MemberMessageRow>(
      `
      SELECT enabled, channel_id, message_type
      FROM bot_member_message_configs
      WHERE bot_id = $1 AND guild_id = $2 AND kind = $3
      LIMIT 1
      `,
      [botId, guildId, kind],
    );

    const row = result.rows[0];
    if (!row) {
      return createDefaultMemberMessageConfig();
    }

    return toConfig(row);
  }

  public async upsertByBotGuildKind(
    botId: string,
    guildId: string,
    kind: MemberMessageKind,
    config: MemberMessageConfig,
  ): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO bot_member_message_configs (
        bot_id,
        guild_id,
        kind,
        enabled,
        channel_id,
        message_type,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (bot_id, guild_id, kind)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        channel_id = EXCLUDED.channel_id,
        message_type = EXCLUDED.message_type,
        updated_at = NOW()
      `,
      [botId, guildId, kind, config.enabled, config.channelId, config.messageType],
    );
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

let store: MemberMessageStore | null = null;

export const initMemberMessageStore = async (): Promise<MemberMessageStore> => {
  if (store) {
    return store;
  }

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  });

  const nextStore = new MemberMessageStore(pool);

  try {
    await nextStore.init();
    store = nextStore;
    return nextStore;
  } catch (error) {
    await pool.end().catch(() => {
      // Ignore close errors; the original init error should be preserved.
    });
    throw error;
  }
};

export const getMemberMessageStore = (): MemberMessageStore => {
  if (!store) {
    throw new Error("MemberMessageStore is not initialized. Call initMemberMessageStore() during bootstrap.");
  }

  return store;
};

export const shutdownMemberMessageStore = async (): Promise<void> => {
  if (!store) {
    return;
  }

  await store.close();
  store = null;
};
