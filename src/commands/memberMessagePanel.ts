/**
 * Panneau de configuration pour les messages de bienvenue / départ
 *
 * Contient la logique UI (Components v2), collectors et sessions pour afficher
 * et gérer un panneau interactif permettant de configurer les messages
 * d'accueil et d'au revoir par guild.
 *
 * Export:
 * - `createMemberMessageExecute(kind)` : factory utilisée par les commandes
 *   `welcome` et `goodbye` pour attacher le panneau.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  type Message,
} from "discord.js";

import { env } from "../framework/config/env.js";
import { I18nService } from "../i18n/index.js";
import { dispatchMemberMessage } from "../framework/memberMessages/memberMessageSender.js";
import { getMemberMessageStore } from "../framework/memberMessages/memberMessageStore.js";
import {
  MEMBER_MESSAGE_RENDER_TYPES,
  isMemberMessageRenderTypeValue,
  type MemberMessageConfig,
  type MemberMessageKind,
  type MemberMessageRenderType,
} from "../framework/memberMessages/memberMessageTypes.js";
import type { CommandExecutionContext } from "../framework/types/command.js";

const memberMessageI18n = new I18nService(env.DEFAULT_LANG);

interface MemberMessageCustomIds {
  toggleButton: string;
  channelButton: string;
  channelCancelButton: string;
  typeSelect: string;
  channelSelect: string;
  testButton: string;
}

interface MemberMessagePanelUiState {
  channelPickerOpen: boolean;
}

interface MemberMessagePanelSession {
  collector: ReturnType<Message["createMessageComponentCollector"]>;
  disable: () => Promise<void>;
}

const activePanelsByUser = new Map<string, MemberMessagePanelSession>();

const panelSessionKey = (kind: MemberMessageKind, guildId: string, userId: string): string => {
  return `${kind}:${guildId}:${userId}`;
};

const createCustomIds = (kind: MemberMessageKind): MemberMessageCustomIds => {
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    toggleButton: `${kind}:toggle:${nonce}`,
    channelButton: `${kind}:channel:${nonce}`,
    channelCancelButton: `${kind}:channel-cancel:${nonce}`,
    typeSelect: `${kind}:type:${nonce}`,
    channelSelect: `${kind}:channel-select:${nonce}`,
    testButton: `${kind}:test:${nonce}`,
  };
};

const isMessageResult = (value: unknown): value is Message => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "createMessageComponentCollector" in value && "edit" in value;
};

const resolveReplyMessage = (value: unknown): Message | null => {
  if (isMessageResult(value)) {
    return value;
  }

  if (!value || typeof value !== "object" || !("resource" in value)) {
    return null;
  }

  const resource = (value as { resource?: unknown }).resource;
  if (!resource || typeof resource !== "object" || !("message" in resource)) {
    return null;
  }

  const message = (resource as { message?: unknown }).message;
  return isMessageResult(message) ? message : null;
};

const statusLabel = (ctx: CommandExecutionContext, enabled: boolean): string => {
  return enabled ? ctx.ct("ui.status.enabled") : ctx.ct("ui.status.disabled");
};

const messageTypeLabel = (ctx: CommandExecutionContext, messageType: MemberMessageRenderType): string => {
  return ctx.ct(`ui.type.options.${messageType}.label`);
};

const panelContent = (
  ctx: CommandExecutionContext,
  config: MemberMessageConfig,
  uiState: MemberMessagePanelUiState,
): string => {
  const channelDisplay = config.channelId ? `<#${config.channelId}>` : ctx.ct("ui.channelNotConfigured");
  const lines = [
    `## ${ctx.ct("ui.embed.title")}`,
    ctx.ct("ui.embed.description"),
    "",
    `${ctx.ct("ui.embed.fields.status")}: ${statusLabel(ctx, config.enabled)}`,
    `${ctx.ct("ui.embed.fields.channel")}: ${channelDisplay}`,
    `${ctx.ct("ui.embed.fields.type")}: ${messageTypeLabel(ctx, config.messageType)}`,
  ];

  if (uiState.channelPickerOpen) {
    lines.push("", `${ctx.ct("ui.embed.fields.channelPicker")}: ${ctx.ct("ui.channelPickerHint")}`);
  }

  return lines.join("\n");
};

const buildContainer = (
  ctx: CommandExecutionContext,
  customIds: MemberMessageCustomIds,
  config: MemberMessageConfig,
  uiState: MemberMessagePanelUiState,
  disabled = false,
): ContainerBuilder => {
  const toggleButton = new ButtonBuilder()
    .setCustomId(customIds.toggleButton)
    .setLabel(ctx.ct("ui.buttons.toggle"))
    .setStyle(config.enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
    .setDisabled(disabled);

  const channelButton = new ButtonBuilder()
    .setCustomId(uiState.channelPickerOpen ? customIds.channelCancelButton : customIds.channelButton)
    .setLabel(uiState.channelPickerOpen ? ctx.ct("ui.buttons.channelCancel") : ctx.ct("ui.buttons.channel"))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);

  const testButton = new ButtonBuilder()
    .setCustomId(customIds.testButton)
    .setLabel(ctx.ct("ui.buttons.test"))
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled);

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId(customIds.typeSelect)
    .setPlaceholder(ctx.ct("ui.type.placeholder"))
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(disabled)
    .setOptions(
      MEMBER_MESSAGE_RENDER_TYPES.map((renderType) => ({
        label: ctx.ct(`ui.type.options.${renderType}.label`),
        description: ctx.ct(`ui.type.options.${renderType}.description`),
        value: renderType,
        default: renderType === config.messageType,
      })),
    );

  const container = new ContainerBuilder();
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(panelContent(ctx, config, uiState)),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(toggleButton, channelButton, testButton),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeSelect),
  );

  if (uiState.channelPickerOpen) {
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(customIds.channelSelect)
      .setPlaceholder(ctx.ct("ui.channelPickerPlaceholder"))
      .setMinValues(1)
      .setMaxValues(1)
      .setDisabled(disabled)
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    container.addActionRowComponents(
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
    );
  }

  return container;
};

const testFeedbackKey = (reason: string): string => {
  switch (reason) {
    case "disabled":
      return "responses.testDisabled";
    case "missing_channel":
      return "responses.testMissingChannel";
    case "channel_not_found":
    case "channel_not_sendable":
      return "responses.testChannelUnavailable";
    case "missing_permissions":
      return "responses.testMissingPermissions";
    default:
      return "responses.testFailed";
  }
};

/**
 * Factory qui crée l'exécuteur de commande pour un `MemberMessageKind` donné.
 *
 * Le handler retourné gère l'affichage du panneau, la collecte d'interactions
 * et la persistance de la configuration via `memberMessageStore`.
 */
export const createMemberMessageExecute = (kind: MemberMessageKind) => {
  return async (ctx: CommandExecutionContext): Promise<void> => {
    if (!ctx.guild) {
      await ctx.reply(ctx.ct("responses.guildOnly"));
      return;
    }

    const guild = ctx.guild;
    const botId = ctx.client.user?.id;
    if (!botId) {
      await ctx.reply(ctx.t("errors.execution"));
      return;
    }

    const config = await getMemberMessageStore().getByBotGuildKind(botId, guild.id, kind);
    const customIds = createCustomIds(kind);
    const uiState: MemberMessagePanelUiState = {
      channelPickerOpen: false,
    };

    const replyResult = await ctx.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [buildContainer(ctx, customIds, config, uiState)],
      withResponse: true,
    });

    const replyMessage = resolveReplyMessage(replyResult);
    if (!replyMessage) {
      return;
    }

    const ownerId = ctx.user.id;
    const sessionKey = panelSessionKey(kind, guild.id, ownerId);
    const existingPanel = activePanelsByUser.get(sessionKey);
    if (existingPanel) {
      existingPanel.collector.stop("replaced");
      await existingPanel.disable().catch(() => undefined);
      activePanelsByUser.delete(sessionKey);
    }

    const saveConfig = async (): Promise<void> => {
      await getMemberMessageStore().upsertByBotGuildKind(botId, guild.id, kind, config);
    };

    const disablePanel = async (): Promise<void> => {
      await replyMessage
        .edit({
          flags: MessageFlags.IsComponentsV2,
          components: [buildContainer(ctx, customIds, config, uiState, true)],
        })
        .catch(() => undefined);
    };

    const collector = replyMessage.createMessageComponentCollector({ time: 15 * 60_000 });
    activePanelsByUser.set(sessionKey, {
      collector,
      disable: disablePanel,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== ownerId) {
        await interaction.reply({
          content: ctx.ct("responses.notOwner"),
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      try {
        if (interaction.isButton()) {
          if (interaction.customId === customIds.toggleButton) {
            config.enabled = !config.enabled;
            await saveConfig();
            await interaction.update({
              flags: MessageFlags.IsComponentsV2,
              components: [buildContainer(ctx, customIds, config, uiState)],
            });
            return;
          }

          if (interaction.customId === customIds.channelButton) {
            uiState.channelPickerOpen = true;
            await interaction.update({
              flags: MessageFlags.IsComponentsV2,
              components: [buildContainer(ctx, customIds, config, uiState)],
            });
            return;
          }

          if (interaction.customId === customIds.channelCancelButton) {
            uiState.channelPickerOpen = false;
            await interaction.update({
              flags: MessageFlags.IsComponentsV2,
              components: [buildContainer(ctx, customIds, config, uiState)],
            });
            return;
          }

          if (interaction.customId === customIds.testButton) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const testResult = await dispatchMemberMessage({
              client: ctx.client,
              i18n: memberMessageI18n,
              guild,
              user: ctx.user,
              kind,
              ignoreEnabled: true,
            });

            if (testResult.sent) {
              await interaction.editReply({
                content: ctx.ct("responses.testSuccess", {
                  channel: testResult.channelId ? `<#${testResult.channelId}>` : ctx.ct("ui.channelNotConfigured"),
                }),
              });
              return;
            }

            await interaction.editReply({
              content: ctx.ct(testFeedbackKey(testResult.reason)),
            });
            return;
          }

          await interaction.reply({
            content: ctx.ct("responses.invalidSelection"),
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        if (interaction.isStringSelectMenu() && interaction.customId === customIds.typeSelect) {
          const nextType = interaction.values[0];
          if (!nextType || !isMemberMessageRenderTypeValue(nextType)) {
            await interaction.reply({
              content: ctx.ct("responses.invalidSelection"),
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          config.messageType = nextType;
          await saveConfig();
          await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer(ctx, customIds, config, uiState)],
          });
          return;
        }

        if (interaction.isChannelSelectMenu() && interaction.customId === customIds.channelSelect) {
          const channelId = interaction.values[0];
          if (!channelId) {
            await interaction.reply({
              content: ctx.ct("responses.invalidSelection"),
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          config.channelId = channelId;
          uiState.channelPickerOpen = false;
          await saveConfig();
          await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer(ctx, customIds, config, uiState)],
          });
          return;
        }

        await interaction.reply({
          content: ctx.ct("responses.invalidSelection"),
          flags: [MessageFlags.Ephemeral],
        });
      } catch (error) {
        console.error(`[command:${kind}] interaction failed`, error);

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
      const currentPanel = activePanelsByUser.get(sessionKey);
      if (currentPanel?.collector === collector) {
        activePanelsByUser.delete(sessionKey);
      }

      await disablePanel();
    });
  };
};
