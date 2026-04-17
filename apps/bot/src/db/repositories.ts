import type { BotStatus } from "@saas/shared";
import type { Pool } from "pg";

export interface StoredBotCredentials {
  id: string;
  tenantId: string;
  ownerUserId: string;
  discordBotId: string;
  displayName: string;
  tokenCiphertext: string;
  tokenIv: string;
  tokenTag: string;
  status: BotStatus;
}

const mapBotCredentials = (row: Record<string, unknown>): StoredBotCredentials => {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ownerUserId: String(row.owner_user_id),
    discordBotId: String(row.discord_bot_id),
    displayName: String(row.display_name),
    tokenCiphertext: String(row.token_ciphertext),
    tokenIv: String(row.token_iv),
    tokenTag: String(row.token_tag),
    status: row.status as BotStatus,
  };
};

export const listBotsToRestore = async (pool: Pool): Promise<StoredBotCredentials[]> => {
  const result = await pool.query(
    `
      SELECT id, tenant_id, owner_user_id, discord_bot_id, display_name, token_ciphertext, token_iv, token_tag, status
      FROM bots
      WHERE status IN ('running', 'starting')
      ORDER BY created_at ASC
    `,
  );

  return result.rows.map((row) => mapBotCredentials(row as Record<string, unknown>));
};

export const getBotCredentialsById = async (
  pool: Pool,
  botId: string,
): Promise<StoredBotCredentials | null> => {
  const result = await pool.query(
    `
      SELECT id, tenant_id, owner_user_id, discord_bot_id, display_name, token_ciphertext, token_iv, token_tag, status
      FROM bots
      WHERE id = $1
      LIMIT 1
    `,
    [botId],
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapBotCredentials(result.rows[0] as Record<string, unknown>);
};

export const setBotStatusById = async (
  pool: Pool,
  botId: string,
  status: BotStatus,
  lastError: string | null = null,
): Promise<void> => {
  await pool.query(
    `
      UPDATE bots
      SET status = $2,
          last_error = $3,
          updated_at = NOW()
      WHERE id = $1
    `,
    [botId, status, lastError],
  );
};

export const insertRuntimeEvent = async (
  pool: Pool,
  input: {
    tenantId: string;
    botId: string;
    level: "info" | "warn" | "error";
    message: string;
    metadata?: unknown;
  },
): Promise<void> => {
  await pool.query(
    `
      INSERT INTO bot_runtime_events (tenant_id, bot_id, level, message, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [
      input.tenantId,
      input.botId,
      input.level,
      input.message,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
};
