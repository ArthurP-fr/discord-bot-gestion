import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Client,
  type Guild,
} from "discord.js";

import { ComponentSessionRegistry } from "../../core/discord/componentSessionRegistry.js";
import { createScopedLogger } from "../../core/logging/logger.js";
import {
  LOG_CHANNEL_NAME_BY_CATEGORY,
  LOG_EVENT_CATEGORY_KEYS,
  LOG_EVENT_DEFINITIONS,
  LOG_EVENT_KEYS,
} from "./catalog.js";
import type { LogEventRepository } from "./repository.js";
import type {
  LogEventCategoryKey,
  LogChannelProvisionResult,
  LogEventRepositoryEntry,
  LogEventStateByKey,
  LogPanelSession,
  LogRuntimeDispatchInput,
} from "../../types/logs.js";
import {
  cloneLogEventState,
  createDefaultLogEventState,
  mergeLogEventRowsIntoState,
} from "../../validators/logs.js";

const logger = createScopedLogger("feature:logs");
const LOG_CHANNEL_CATEGORY_NAME = "📁 ➜ Espace Logs";
const LOG_CHANNEL_NAME_PREFIX = "📁・";

const hasSendMethod = (value: unknown): value is { send: (payload: unknown) => Promise<unknown> } => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "send" in value && typeof (value as { send?: unknown }).send === "function";
};

const hasPermissionsFor = (value: unknown): value is {
  permissionsFor: (member: unknown) => { has: (permission: unknown) => boolean } | null;
} => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "permissionsFor" in value && typeof (value as { permissionsFor?: unknown }).permissionsFor === "function";
};

const clampField = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
};

const buildChannelName = (category: LogEventCategoryKey): string => {
  return `${LOG_CHANNEL_NAME_PREFIX}${LOG_CHANNEL_NAME_BY_CATEGORY[category]}`;
};

export class LogEventService {
  private readonly stateCache = new Map<string, LogEventStateByKey>();
  private readonly panelSessions = new ComponentSessionRegistry<LogPanelSession>();

  public constructor(private readonly repository: LogEventRepository) {}

  public resolveBotId(client: Client): string | null {
    return client.user?.id ?? null;
  }

  public panelSessionKey(client: Client, guildId: string, userId: string): string {
    return `${this.resolveBotId(client) ?? "unbound"}:${guildId}:${userId}`;
  }

  public async replacePanelSession(key: string, session: LogPanelSession): Promise<void> {
    await this.panelSessions.replace(key, session);
  }

  public deletePanelSessionIfCollectorMatch(key: string, collector: LogPanelSession["collector"]): void {
    this.panelSessions.deleteIfCollectorMatch(key, collector);
  }

  public async loadGuildState(client: Client, guildId: string): Promise<LogEventStateByKey> {
    const botId = this.resolveBotId(client);
    if (!botId) {
      return createDefaultLogEventState();
    }

    const cacheKey = this.cacheKey(botId, guildId);
    const cached = this.stateCache.get(cacheKey);
    if (cached) {
      return cloneLogEventState(cached);
    }

    const rows = await this.repository.listByBotGuild(botId, guildId);
    const state = mergeLogEventRowsIntoState(rows);
    this.stateCache.set(cacheKey, state);

    return cloneLogEventState(state);
  }

  public async persistGuildState(client: Client, guildId: string, state: LogEventStateByKey): Promise<void> {
    const botId = this.resolveBotId(client);
    if (!botId) {
      return;
    }

    const entries: LogEventRepositoryEntry[] = LOG_EVENT_KEYS.map((eventKey) => ({
      eventKey,
      config: {
        enabled: state[eventKey].enabled,
        channelId: state[eventKey].channelId,
      },
    }));

    await this.repository.upsertManyByBotGuildEvents(botId, guildId, entries);
    this.stateCache.set(this.cacheKey(botId, guildId), cloneLogEventState(state));
  }

  public async createCategoryChannels(
    client: Client,
    guild: Guild,
    state: LogEventStateByKey,
  ): Promise<LogChannelProvisionResult> {
    const categoryToChannelId = new Map<LogEventCategoryKey, string>();
    let createdCount = 0;
    let reusedCount = 0;
    const failedCategories: LogEventCategoryKey[] = [];

    const existingChannels = await guild.channels.fetch();
    let logCategory = existingChannels.find((channel) => {
      if (!channel) {
        return false;
      }

      return channel.type === ChannelType.GuildCategory && channel.name === LOG_CHANNEL_CATEGORY_NAME;
    });

    if (!logCategory) {
      try {
        logCategory = await guild.channels.create({
          name: LOG_CHANNEL_CATEGORY_NAME,
          type: ChannelType.GuildCategory,
        });
      } catch (error) {
        logger.warn({ guildId: guild.id, err: error }, "failed to create logs category");
        return {
          createdCount,
          reusedCount,
          failedCategories: [...LOG_EVENT_CATEGORY_KEYS],
        };
      }
    }

    for (const category of LOG_EVENT_CATEGORY_KEYS) {
      const expectedName = buildChannelName(category);
      const legacyName = LOG_CHANNEL_NAME_BY_CATEGORY[category];

      const existingByExpectedName = existingChannels.find((channel) => {
        if (!channel) {
          return false;
        }

        return channel.type === ChannelType.GuildText && channel.name === expectedName;
      });

      const existingByLegacyName = existingByExpectedName
        ? null
        : existingChannels.find((channel) => {
          if (!channel) {
            return false;
          }

          return channel.type === ChannelType.GuildText && channel.name === legacyName;
        });

      const existing = existingByExpectedName ?? existingByLegacyName;

      if (existing) {
        if (existing.name !== expectedName) {
          await existing.setName(expectedName).catch((error) => {
            logger.warn({ guildId: guild.id, category, err: error }, "failed to rename logs channel");
          });
        }

        if (existing.parentId !== logCategory.id) {
          await existing.setParent(logCategory.id).catch((error) => {
            logger.warn({ guildId: guild.id, category, err: error }, "failed to move logs channel to category");
          });
        }

        categoryToChannelId.set(category, existing.id);
        reusedCount += 1;
        continue;
      }

      try {
        const permissionOverwrites = [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel],
            deny: [PermissionFlagsBits.SendMessages],
          },
        ];

        if (client.user?.id) {
          permissionOverwrites.push({
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
            ],
            deny: [],
          });
        }

        const created = await guild.channels.create({
          name: expectedName,
          type: ChannelType.GuildText,
          parent: logCategory.id,
          topic: `Logs for ${category} events`,
          permissionOverwrites,
        });

        categoryToChannelId.set(category, created.id);
        createdCount += 1;
      } catch (error) {
        logger.warn({ guildId: guild.id, category, err: error }, "failed to create logs channel");
        failedCategories.push(category);
      }
    }

    for (const definition of LOG_EVENT_DEFINITIONS) {
      const channelId = categoryToChannelId.get(definition.category);
      if (!channelId) {
        continue;
      }

      state[definition.key].channelId = channelId;
    }

    await this.persistGuildState(client, guild.id, state);

    return {
      createdCount,
      reusedCount,
      failedCategories,
    };
  }

  public async dispatchEvent(client: Client, input: LogRuntimeDispatchInput): Promise<void> {
    const botId = this.resolveBotId(client);
    if (!botId) {
      return;
    }

    const cacheKey = this.cacheKey(botId, input.guildId);
    let state = this.stateCache.get(cacheKey);
    if (!state) {
      const rows = await this.repository.listByBotGuild(botId, input.guildId);
      state = mergeLogEventRowsIntoState(rows);
      this.stateCache.set(cacheKey, state);
    }

    const eventConfig = state[input.eventKey];
    if (!eventConfig.enabled || !eventConfig.channelId) {
      return;
    }

    const guild = client.guilds.cache.get(input.guildId) ?? await client.guilds.fetch(input.guildId).catch(() => null);
    if (!guild) {
      return;
    }

    const channel = guild.channels.cache.get(eventConfig.channelId)
      ?? await guild.channels.fetch(eventConfig.channelId).catch(() => null);

    if (!channel || !hasSendMethod(channel)) {
      return;
    }

    const me = guild.members.me;
    if (me && hasPermissionsFor(channel)) {
      const permissions = channel.permissionsFor(me);
      if (!permissions || !permissions.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.SendMessages)) {
        return;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(input.color ?? 0x5865f2)
      .setTitle(`Event: ${input.eventKey}`)
      .setDescription(clampField(input.summary, 4096))
      .setTimestamp(new Date());

    if (input.details && input.details.length > 0) {
      const detailsValue = clampField(input.details.map((line) => `- ${line}`).join("\n"), 1024);
      if (detailsValue.length > 0) {
        embed.addFields({
          name: "Details",
          value: detailsValue,
        });
      }
    }

    await channel.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  }

  public async cleanupGuild(botId: string, guildId: string): Promise<void> {
    await this.repository.deleteByBotGuild(botId, guildId);
    this.stateCache.delete(this.cacheKey(botId, guildId));
  }

  public async shutdown(): Promise<void> {
    this.stateCache.clear();
    await this.panelSessions.stopAll("shutdown");
  }

  private cacheKey(botId: string, guildId: string): string {
    return `${botId}:${guildId}`;
  }
}