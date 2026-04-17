import { Client, GatewayIntentBits } from "discord.js";
import { decryptToken } from "@saas/shared";
import type { Pool } from "pg";

import {
  getBotCredentialsById,
  insertRuntimeEvent,
  listBotsToRestore,
  setBotStatusById,
} from "../db/repositories.js";
import {
  initializeLegacyBotRuntime,
  type LegacyBotRuntime,
} from "../runtime/initializeLegacyBotRuntime.js";

interface ManagedBotRuntime {
  client: Client;
  legacyRuntime: LegacyBotRuntime;
  tenantId: string;
  discordBotId: string;
  startedAt: Date;
}

interface RunningBotInfo {
  botId: string;
  tenantId: string;
  discordBotId: string;
  startedAt: string;
}

export class BotManager {
  private readonly runningBots = new Map<string, ManagedBotRuntime>();
  private readonly operationLocks = new Map<string, Promise<void>>();

  public constructor(
    private readonly pool: Pool,
    private readonly tokenEncryptionKey: Buffer,
  ) {}

  public getRunningCount(): number {
    return this.runningBots.size;
  }

  public listRunningBots(): RunningBotInfo[] {
    return Array.from(this.runningBots.entries()).map(([botId, runtime]) => ({
      botId,
      tenantId: runtime.tenantId,
      discordBotId: runtime.discordBotId,
      startedAt: runtime.startedAt.toISOString(),
    }));
  }

  public async loadAndStartPersistedBots(): Promise<void> {
    const persistedBots = await listBotsToRestore(this.pool);

    for (const bot of persistedBots) {
      await this.startBot(bot.id, bot.tenantId).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown startup error";

        await setBotStatusById(this.pool, bot.id, "error", message);
        await insertRuntimeEvent(this.pool, {
          tenantId: bot.tenantId,
          botId: bot.id,
          level: "error",
          message: "Bot failed to restore at startup",
          metadata: {
            error: message,
          },
        });
      });
    }
  }

  public async startBot(botId: string, tenantId?: string): Promise<void> {
    await this.withLock(botId, async () => {
      if (this.runningBots.has(botId)) {
        return;
      }

      const bot = await getBotCredentialsById(this.pool, botId);
      if (!bot) {
        throw new Error("BOT_NOT_FOUND");
      }

      if (tenantId && bot.tenantId !== tenantId) {
        throw new Error("TENANT_SCOPE_VIOLATION");
      }

      await setBotStatusById(this.pool, botId, "starting", null);

      const token = decryptToken(
        {
          ciphertext: bot.tokenCiphertext,
          iv: bot.tokenIv,
          tag: bot.tokenTag,
        },
        this.tokenEncryptionKey,
      );

      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
      });

      const legacyRuntime = await initializeLegacyBotRuntime({
        client,
        pool: this.pool,
        tenantId: bot.tenantId,
        ownerUserId: bot.ownerUserId,
        botToken: token,
        botClientId: bot.discordBotId,
      });

      this.runningBots.set(botId, {
        client,
        legacyRuntime,
        tenantId: bot.tenantId,
        discordBotId: bot.discordBotId,
        startedAt: new Date(),
      });

      client.once("ready", async () => {
        await setBotStatusById(this.pool, botId, "running", null);
        await insertRuntimeEvent(this.pool, {
          tenantId: bot.tenantId,
          botId,
          level: "info",
          message: "Bot client connected to Discord Gateway",
          metadata: {
            discordUserTag: client.user?.tag ?? null,
          },
        });
      });

      client.on("error", async (error) => {
        await setBotStatusById(this.pool, botId, "error", error.message);
        await insertRuntimeEvent(this.pool, {
          tenantId: bot.tenantId,
          botId,
          level: "error",
          message: "Discord client runtime error",
          metadata: {
            error: error.message,
          },
        });
      });

      try {
        await client.login(token);
      } catch (error) {
        await legacyRuntime.shutdown().catch(() => undefined);
        client.destroy();
        this.runningBots.delete(botId);

        const message = error instanceof Error ? error.message : "Unknown login error";
        await setBotStatusById(this.pool, botId, "error", message);
        await insertRuntimeEvent(this.pool, {
          tenantId: bot.tenantId,
          botId,
          level: "error",
          message: "Bot failed to authenticate with Discord",
          metadata: {
            error: message,
          },
        });

        throw error;
      }
    });
  }

  public async stopBot(botId: string, tenantId?: string): Promise<void> {
    await this.withLock(botId, async () => {
      const runtime = this.runningBots.get(botId);

      if (runtime && tenantId && runtime.tenantId !== tenantId) {
        throw new Error("TENANT_SCOPE_VIOLATION");
      }

      if (!runtime) {
        await setBotStatusById(this.pool, botId, "stopped", null);
        return;
      }

      await setBotStatusById(this.pool, botId, "stopping", null);

      await runtime.legacyRuntime.shutdown().catch(() => undefined);
      runtime.client.destroy();
      this.runningBots.delete(botId);

      await setBotStatusById(this.pool, botId, "stopped", null);
      await insertRuntimeEvent(this.pool, {
        tenantId: runtime.tenantId,
        botId,
        level: "info",
        message: "Bot stopped by control action",
      });
    });
  }

  public async restartBot(botId: string, tenantId?: string): Promise<void> {
    await this.stopBot(botId, tenantId);
    await this.startBot(botId, tenantId);
  }

  public async shutdown(): Promise<void> {
    const botIds = [...this.runningBots.keys()];

    for (const botId of botIds) {
      await this.stopBot(botId).catch(() => undefined);
    }
  }

  private async withLock(botId: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.operationLocks.get(botId) ?? Promise.resolve();

    const next = previous
      .catch(() => undefined)
      .then(operation)
      .finally(() => {
        if (this.operationLocks.get(botId) === next) {
          this.operationLocks.delete(botId);
        }
      });

    this.operationLocks.set(botId, next);
    return next;
  }
}
