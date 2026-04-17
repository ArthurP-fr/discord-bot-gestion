import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
} from "discord.js";

import { resolveReplyMessage } from "../../core/discord/replyMessageResolver.js";
import { createScopedLogger } from "../../core/logging/logger.js";
import type { CommandExecutionContext } from "../../types/command.js";
import type {
  LogEventDefinition,
  LogEventKey,
  LogEventStateByKey,
  LogPanelCustomIds,
} from "../../types/logs.js";
import {
  LOG_EVENT_DEFINITIONS,
  LOG_EVENT_KEYS,
  LOGS_PANEL_EVENTS_PER_PAGE,
} from "./catalog.js";
import type { LogEventService } from "./service.js";

const logger = createScopedLogger("command:logs");

interface LogPanelUiState {
  pageIndex: number;
  feedback: string | null;
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const output: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }

  return output;
};

const createCustomIds = (): LogPanelCustomIds => {
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const toggleButtonsByEvent = {} as Record<LogEventKey, string>;

  for (const eventKey of LOG_EVENT_KEYS) {
    toggleButtonsByEvent[eventKey] = `logs:toggle:${eventKey}:${nonce}`;
  }

  return {
    enableAllButton: `logs:enable-all:${nonce}`,
    disableAllButton: `logs:disable-all:${nonce}`,
    createChannelsButton: `logs:create-channels:${nonce}`,
    previousPageButton: `logs:page-prev:${nonce}`,
    nextPageButton: `logs:page-next:${nonce}`,
    toggleButtonsByEvent,
  };
};

const clampPageIndex = (index: number, pageCount: number): number => {
  if (index < 0) {
    return 0;
  }

  if (index >= pageCount) {
    return pageCount - 1;
  }

  return index;
};

const pageCount = (): number => Math.max(1, Math.ceil(LOG_EVENT_DEFINITIONS.length / LOGS_PANEL_EVENTS_PER_PAGE));

const pageEvents = (uiState: LogPanelUiState): LogEventDefinition[] => {
  const totalPages = pageCount();
  uiState.pageIndex = clampPageIndex(uiState.pageIndex, totalPages);
  const start = uiState.pageIndex * LOGS_PANEL_EVENTS_PER_PAGE;
  return LOG_EVENT_DEFINITIONS.slice(start, start + LOGS_PANEL_EVENTS_PER_PAGE);
};

const eventStatusLabel = (ctx: CommandExecutionContext, enabled: boolean): string => {
  return enabled ? ctx.ct("ui.status.enabled") : ctx.ct("ui.status.disabled");
};

const panelContent = (
  ctx: CommandExecutionContext,
  state: LogEventStateByKey,
  uiState: LogPanelUiState,
): string => {
  const totalPages = pageCount();
  const currentEvents = pageEvents(uiState);
  const enabledCount = LOG_EVENT_KEYS.filter((eventKey) => state[eventKey].enabled).length;

  const lines = [
    `## ${ctx.ct("ui.embed.title")}`,
    ctx.ct("ui.embed.description"),
    "",
    ctx.ct("ui.pageLabel", { page: uiState.pageIndex + 1, pageCount: totalPages }),
    ctx.ct("ui.enabledCountLabel", { enabledCount, totalCount: LOG_EVENT_KEYS.length }),
    "",
    `${ctx.ct("ui.eventsHeader")}:`,
  ];

  for (const definition of currentEvents) {
    const eventConfig = state[definition.key];
    const channelDisplay = eventConfig.channelId ? `<#${eventConfig.channelId}>` : ctx.ct("ui.channelNotConfigured");
    lines.push(`- ${definition.key} | ${eventStatusLabel(ctx, eventConfig.enabled)} | ${ctx.ct("ui.channelLabel")}: ${channelDisplay}`);
  }

  if (uiState.feedback) {
    lines.push("", `${ctx.ct("ui.feedbackLabel")}: ${uiState.feedback}`);
  }

  return lines.join("\n");
};

const buildContainer = (
  ctx: CommandExecutionContext,
  state: LogEventStateByKey,
  customIds: LogPanelCustomIds,
  uiState: LogPanelUiState,
  disabled = false,
): ContainerBuilder => {
  const totalPages = pageCount();
  const currentEvents = pageEvents(uiState);

  const enableAllButton = new ButtonBuilder()
    .setCustomId(customIds.enableAllButton)
    .setLabel(ctx.ct("ui.buttons.enableAll"))
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled);

  const disableAllButton = new ButtonBuilder()
    .setCustomId(customIds.disableAllButton)
    .setLabel(ctx.ct("ui.buttons.disableAll"))
    .setStyle(ButtonStyle.Danger)
    .setDisabled(disabled);

  const createChannelsButton = new ButtonBuilder()
    .setCustomId(customIds.createChannelsButton)
    .setLabel(ctx.ct("ui.buttons.createChannels"))
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled);

  const previousPageButton = new ButtonBuilder()
    .setCustomId(customIds.previousPageButton)
    .setLabel(ctx.ct("ui.buttons.previousPage"))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || uiState.pageIndex <= 0);

  const nextPageButton = new ButtonBuilder()
    .setCustomId(customIds.nextPageButton)
    .setLabel(ctx.ct("ui.buttons.nextPage"))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || uiState.pageIndex >= totalPages - 1);

  const container = new ContainerBuilder();
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(panelContent(ctx, state, uiState)));
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(enableAllButton, disableAllButton, createChannelsButton),
  );

  for (const definitionChunk of chunk(currentEvents, 5)) {
    const rowButtons = definitionChunk.map((definition) => {
      const eventConfig = state[definition.key];
      const label = eventConfig.enabled
        ? ctx.ct("ui.buttons.disableEvent", { event: definition.key })
        : ctx.ct("ui.buttons.enableEvent", { event: definition.key });

      return new ButtonBuilder()
        .setCustomId(customIds.toggleButtonsByEvent[definition.key])
        .setLabel(label)
        .setStyle(eventConfig.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
        .setDisabled(disabled);
    });

    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...rowButtons));
  }

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(previousPageButton, nextPageButton),
  );

  return container;
};

const applyAllEnabled = (state: LogEventStateByKey, enabled: boolean): void => {
  for (const eventKey of LOG_EVENT_KEYS) {
    state[eventKey].enabled = enabled;
  }
};

const toToggleLookup = (customIds: LogPanelCustomIds): Map<string, LogEventKey> => {
  return new Map(
    LOG_EVENT_KEYS.map((eventKey) => [customIds.toggleButtonsByEvent[eventKey], eventKey]),
  );
};

export const createLogsCommandExecute = (logEventService: LogEventService) => {
  return async (ctx: CommandExecutionContext): Promise<void> => {

    if (!ctx.guild) {
      await ctx.reply(ctx.ct("responses.guildOnly"));
      return;
    }

    const guild = ctx.guild;
    const state = await logEventService.loadGuildState(ctx.client, guild.id);
    const customIds = createCustomIds();
    const toggleLookup = toToggleLookup(customIds);

    const uiState: LogPanelUiState = {
      pageIndex: 0,
      feedback: null,
    };

    const replyResult = await ctx.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [buildContainer(ctx, state, customIds, uiState)],
      withResponse: true,
    });

    const replyMessage = resolveReplyMessage(replyResult);
    if (!replyMessage) {
      return;
    }

    const ownerId = ctx.user.id;
    const sessionKey = logEventService.panelSessionKey(ctx.client, guild.id, ownerId);

    const disablePanel = async (): Promise<void> => {
      await replyMessage
        .edit({
          flags: MessageFlags.IsComponentsV2,
          components: [buildContainer(ctx, state, customIds, uiState, true)],
        })
        .catch(() => undefined);
    };

    const collector = replyMessage.createMessageComponentCollector({ time: 15 * 60_000 });
    await logEventService.replacePanelSession(sessionKey, { collector, disable: disablePanel });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== ownerId) {
        await interaction.reply({
          content: ctx.ct("responses.notOwner"),
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      try {
        if (!interaction.isButton()) {
          await interaction.reply({
            content: ctx.ct("responses.invalidSelection"),
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        if (interaction.customId === customIds.enableAllButton) {
          applyAllEnabled(state, true);
          await logEventService.persistGuildState(ctx.client, guild.id, state);
          uiState.feedback = ctx.ct("responses.allEnabled");
          await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer(ctx, state, customIds, uiState)],
          });
          return;
        }

        if (interaction.customId === customIds.disableAllButton) {
          applyAllEnabled(state, false);
          await logEventService.persistGuildState(ctx.client, guild.id, state);
          uiState.feedback = ctx.ct("responses.allDisabled");
          await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer(ctx, state, customIds, uiState)],
          });
          return;
        }

        if (interaction.customId === customIds.createChannelsButton) {
          await interaction.deferUpdate();

          const result = await logEventService.createCategoryChannels(ctx.client, guild, state);
          if (result.failedCategories.length === 0) {
            uiState.feedback = ctx.ct("responses.channelsCreated", {
              created: result.createdCount,
              reused: result.reusedCount,
            });
          } else if (result.createdCount + result.reusedCount > 0) {
            uiState.feedback = ctx.ct("responses.channelsPartial", {
              created: result.createdCount,
              reused: result.reusedCount,
              failed: result.failedCategories.join(", "),
            });
          } else {
            uiState.feedback = ctx.ct("responses.channelsFailed", {
              failed: result.failedCategories.join(", "),
            });
          }

          await replyMessage.edit({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer(ctx, state, customIds, uiState)],
          });
          return;
        }

        if (interaction.customId === customIds.previousPageButton) {
          uiState.pageIndex = Math.max(0, uiState.pageIndex - 1);
          await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer(ctx, state, customIds, uiState)],
          });
          return;
        }

        if (interaction.customId === customIds.nextPageButton) {
          uiState.pageIndex = Math.min(pageCount() - 1, uiState.pageIndex + 1);
          await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer(ctx, state, customIds, uiState)],
          });
          return;
        }

        const eventKey = toggleLookup.get(interaction.customId);
        if (eventKey) {
          state[eventKey].enabled = !state[eventKey].enabled;
          await logEventService.persistGuildState(ctx.client, guild.id, state);
          uiState.feedback = state[eventKey].enabled
            ? ctx.ct("responses.eventEnabled", { event: eventKey })
            : ctx.ct("responses.eventDisabled", { event: eventKey });

          await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer(ctx, state, customIds, uiState)],
          });
          return;
        }

        await interaction.reply({
          content: ctx.ct("responses.invalidSelection"),
          flags: [MessageFlags.Ephemeral],
        });
      } catch (error) {
        logger.error({ err: error }, "interaction failed");

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: ctx.t("errors.execution"),
            flags: [MessageFlags.Ephemeral],
          }).catch(() => undefined);
          return;
        }

        await interaction.followUp({
          content: ctx.t("errors.execution"),
          flags: [MessageFlags.Ephemeral],
        }).catch(() => undefined);
      }
    });

    collector.on("end", async () => {
      logEventService.deletePanelSessionIfCollectorMatch(sessionKey, collector);
      await disablePanel();
    });
  };
};