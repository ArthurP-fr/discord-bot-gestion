import type { EncryptedToken, PublicBot } from "@saas/shared";
import type { Pool } from "pg";

export interface DbUser {
  id: string;
  tenantId: string;
  discordUserId: string;
  username: string;
  avatarUrl: string | null;
  role: "owner" | "member";
}

interface CreateOrUpdateBotInput {
  tenantId: string;
  ownerUserId: string;
  discordBotId: string;
  displayName: string;
  encryptedToken: EncryptedToken;
}

const mapUser = (row: Record<string, unknown>): DbUser => {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    discordUserId: String(row.discord_user_id),
    username: String(row.username),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    role: (row.role as "owner" | "member") ?? "member",
  };
};

const mapPublicBot = (row: Record<string, unknown>): PublicBot => {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    discordBotId: String(row.discord_bot_id),
    displayName: String(row.display_name),
    status: row.status as PublicBot["status"],
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
};

export const upsertUserFromDiscord = async (
  pool: Pool,
  identity: {
    discordUserId: string;
    username: string;
    avatarUrl: string | null;
  },
): Promise<DbUser> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `
        SELECT id, tenant_id, discord_user_id, username, avatar_url, role
        FROM users
        WHERE discord_user_id = $1
        FOR UPDATE
      `,
      [identity.discordUserId],
    );

    if (existing.rowCount && existing.rows[0]) {
      const updated = await client.query(
        `
          UPDATE users
          SET username = $2,
              avatar_url = $3,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, tenant_id, discord_user_id, username, avatar_url, role
        `,
        [existing.rows[0].id, identity.username, identity.avatarUrl],
      );

      await client.query("COMMIT");
      return mapUser(updated.rows[0] as Record<string, unknown>);
    }

    const tenantInsert = await client.query<{ id: string }>(
      `
        INSERT INTO tenants DEFAULT VALUES
        RETURNING id
      `,
    );

    const tenantId = tenantInsert.rows[0]?.id;
    if (!tenantId) {
      throw new Error("Failed to create tenant");
    }

    const userInsert = await client.query(
      `
        INSERT INTO users (
          tenant_id,
          discord_user_id,
          username,
          avatar_url,
          role
        ) VALUES ($1, $2, $3, $4, 'owner')
        RETURNING id, tenant_id, discord_user_id, username, avatar_url, role
      `,
      [tenantId, identity.discordUserId, identity.username, identity.avatarUrl],
    );

    const user = mapUser(userInsert.rows[0] as Record<string, unknown>);

    await client.query(
      `
        UPDATE tenants
        SET owner_user_id = $1
        WHERE id = $2
      `,
      [user.id, tenantId],
    );

    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

export const getUserByIdAndTenant = async (
  pool: Pool,
  userId: string,
  tenantId: string,
): Promise<DbUser | null> => {
  const result = await pool.query(
    `
      SELECT id, tenant_id, discord_user_id, username, avatar_url, role
      FROM users
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
    `,
    [userId, tenantId],
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapUser(result.rows[0] as Record<string, unknown>);
};

export const listBotsForTenant = async (pool: Pool, tenantId: string): Promise<PublicBot[]> => {
  const result = await pool.query(
    `
      SELECT id, tenant_id, discord_bot_id, display_name, status, last_error, created_at, updated_at
      FROM bots
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `,
    [tenantId],
  );

  return result.rows.map((row) => mapPublicBot(row as Record<string, unknown>));
};

export const getBotForTenant = async (
  pool: Pool,
  tenantId: string,
  botId: string,
): Promise<PublicBot | null> => {
  const result = await pool.query(
    `
      SELECT id, tenant_id, discord_bot_id, display_name, status, last_error, created_at, updated_at
      FROM bots
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
    `,
    [tenantId, botId],
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapPublicBot(result.rows[0] as Record<string, unknown>);
};

export const createOrUpdateBotForTenant = async (
  pool: Pool,
  input: CreateOrUpdateBotInput,
): Promise<PublicBot> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingByDiscordBot = await client.query(
      `
        SELECT id, tenant_id
        FROM bots
        WHERE discord_bot_id = $1
        FOR UPDATE
      `,
      [input.discordBotId],
    );

    if (existingByDiscordBot.rows[0] && existingByDiscordBot.rows[0].tenant_id !== input.tenantId) {
      throw new Error("BOT_ALREADY_CLAIMED");
    }

    const existingInTenant = await client.query(
      `
        SELECT id
        FROM bots
        WHERE tenant_id = $1 AND discord_bot_id = $2
        LIMIT 1
      `,
      [input.tenantId, input.discordBotId],
    );

    let upserted;

    if (existingInTenant.rows[0]) {
      upserted = await client.query(
        `
          UPDATE bots
          SET owner_user_id = $2,
              display_name = $3,
              token_ciphertext = $4,
              token_iv = $5,
              token_tag = $6,
              status = 'stopped',
              last_error = NULL,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, tenant_id, discord_bot_id, display_name, status, last_error, created_at, updated_at
        `,
        [
          existingInTenant.rows[0].id,
          input.ownerUserId,
          input.displayName,
          input.encryptedToken.ciphertext,
          input.encryptedToken.iv,
          input.encryptedToken.tag,
        ],
      );
    } else {
      upserted = await client.query(
        `
          INSERT INTO bots (
            tenant_id,
            owner_user_id,
            discord_bot_id,
            display_name,
            token_ciphertext,
            token_iv,
            token_tag,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'stopped')
          RETURNING id, tenant_id, discord_bot_id, display_name, status, last_error, created_at, updated_at
        `,
        [
          input.tenantId,
          input.ownerUserId,
          input.discordBotId,
          input.displayName,
          input.encryptedToken.ciphertext,
          input.encryptedToken.iv,
          input.encryptedToken.tag,
        ],
      );
    }

    await client.query("COMMIT");
    return mapPublicBot(upserted.rows[0] as Record<string, unknown>);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

export const setBotStatusForTenant = async (
  pool: Pool,
  tenantId: string,
  botId: string,
  status: PublicBot["status"],
  lastError: string | null = null,
): Promise<void> => {
  await pool.query(
    `
      UPDATE bots
      SET status = $3,
          last_error = $4,
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
    `,
    [tenantId, botId, status, lastError],
  );
};

export const insertBotRuntimeEvent = async (
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
