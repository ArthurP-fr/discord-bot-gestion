/**
 * Module `presence` — gestion des présences du bot
 *
 * Contient la logique de timers, rotation d'activités, rendu de templates
 * et l'UI panel d'administration. Le module expose des helpers pour restaurer
 * l'état (`restorePresenceFromStorage`), arrêter les timers (`shutdownPresenceRuntime`)
 * et la commande `presence` qui affiche le panneau.
 */
import {
  ActivityType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Client,
  type Message,
} from "discord.js";
import { defineCommand } from "../../framework/commands/defineCommand.js";
import { env } from "../../framework/config/env.js";
import { getPresenceStore } from "../../framework/presence/presenceStore.js";
import {
  PRESENCE_TEMPLATE_REFRESH_INTERVAL_MS,
  containsPresenceTemplateVariables,
  getPresenceTemplateHelpText,
  renderPresenceTemplate,
} from "../../framework/presence/presenceTemplateVariables.js";
import {
  PRESENCE_ACTIVITY_TYPES,
  PRESENCE_STATUSES,
  MAX_ACTIVITY_ROTATION_INTERVAL_SECONDS,
  MIN_ACTIVITY_ROTATION_INTERVAL_SECONDS,
  createDefaultPresenceState,
  isPresenceActivityTypeValue,
  isPresenceRotationIntervalSecondsValue,
  isPresenceStatusValue,
  sanitizeActivityText,
  sanitizeActivityTexts,
  sanitizePresenceRotationIntervalSeconds,
  type PresenceActivityTypeValue,
  type PresenceState,
  type PresenceStatusValue,
} from "../../framework/presence/presenceTypes.js";
import type { CommandExecutionContext } from "../../framework/types/command.js";

interface PresenceCustomIds {
  statusSelect: string;
  activitySelect: string;
  textButton: string;
  intervalButton: string;
  textModal: string;
  textInput: string;
  intervalModal: string;
  intervalInput: string;
}

interface PresencePanelSession {
  collector: ReturnType<Message["createMessageComponentCollector"]>;
  disable: () => Promise<void>;
}

interface PresenceRuntimeState {
  dynamicPresenceRefreshTimer: NodeJS.Timeout | null;
  presenceRotationTimer: NodeJS.Timeout | null;
  activePresenceTextIndex: number;
  activePanelsByUserId: Map<string, PresencePanelSession>;
}

const presenceRuntimeByBotId = new Map<string, PresenceRuntimeState>();

const createPresenceRuntimeState = (): PresenceRuntimeState => ({
  dynamicPresenceRefreshTimer: null,
  presenceRotationTimer: null,
  activePresenceTextIndex: 0,
  activePanelsByUserId: new Map<string, PresencePanelSession>(),
});

const clearRuntimeTimers = (runtimeState: PresenceRuntimeState): void => {
  if (runtimeState.dynamicPresenceRefreshTimer) {
    clearInterval(runtimeState.dynamicPresenceRefreshTimer);
    runtimeState.dynamicPresenceRefreshTimer = null;
  }

  if (runtimeState.presenceRotationTimer) {
    clearInterval(runtimeState.presenceRotationTimer);
    runtimeState.presenceRotationTimer = null;
  }
};

const resolveRuntimeState = (client: Client): PresenceRuntimeState => {
  const botId = resolveBotId(client) ?? "unbound";
  const existing = presenceRuntimeByBotId.get(botId);
  if (existing) {
    return existing;
  }

  const next = createPresenceRuntimeState();
  presenceRuntimeByBotId.set(botId, next);
  return next;
};

/**
 * Stoppe toutes les tâches runtime liées aux présences et libère les sessions.
 */
export const shutdownPresenceRuntime = (): void => {
  for (const runtimeState of presenceRuntimeByBotId.values()) {
    clearRuntimeTimers(runtimeState);

    for (const panelSession of runtimeState.activePanelsByUserId.values()) {
      panelSession.collector.stop("shutdown");
    }
    runtimeState.activePanelsByUserId.clear();
  }

  presenceRuntimeByBotId.clear();
};

const DISCORD_ACTIVITY_TYPES: Record<PresenceActivityTypeValue, ActivityType> = {
  PLAYING: ActivityType.Playing,
  STREAMING: ActivityType.Streaming,
  WATCHING: ActivityType.Watching,
  LISTENING: ActivityType.Listening,
  COMPETING: ActivityType.Competing,
  CUSTOM: ActivityType.Custom,
};

type DiscordPresenceStatus = "online" | "idle" | "dnd" | "invisible";

const resolveDiscordStatus = (status: PresenceStatusValue): DiscordPresenceStatus =>
  status === "streaming" ? "online" : status;

const resolveBotId = (client: Client): string | null => client.user?.id ?? null;

const normalizePresenceActivityState = (state: PresenceState, runtimeState: PresenceRuntimeState): void => {
  const activityTexts = sanitizeActivityTexts(state.activity.texts);
  state.activity.texts = activityTexts;
  state.activity.text = activityTexts[0] ?? sanitizeActivityText(state.activity.text);
  state.activity.rotationIntervalSeconds = sanitizePresenceRotationIntervalSeconds(state.activity.rotationIntervalSeconds);

  if (runtimeState.activePresenceTextIndex >= activityTexts.length) {
    runtimeState.activePresenceTextIndex = 0;
  }
};

const getActivePresenceTemplateText = (state: PresenceState, runtimeState: PresenceRuntimeState): string => {
  normalizePresenceActivityState(state, runtimeState);
  return state.activity.texts[runtimeState.activePresenceTextIndex] ?? state.activity.text;
};

const hasTemplateVariablesInPresenceState = (state: PresenceState, runtimeState: PresenceRuntimeState): boolean => {
  normalizePresenceActivityState(state, runtimeState);
  return state.activity.texts.some((templateText) => containsPresenceTemplateVariables(templateText));
};

const syncDynamicPresenceTimers = (client: Client, state: PresenceState, runtimeState: PresenceRuntimeState): void => {
  normalizePresenceActivityState(state, runtimeState);
  clearRuntimeTimers(runtimeState);

  if (state.activity.texts.length > 1) {
    runtimeState.presenceRotationTimer = setInterval(() => {
      normalizePresenceActivityState(state, runtimeState);
      if (state.activity.texts.length <= 1) {
        runtimeState.activePresenceTextIndex = 0;
        return;
      }

      runtimeState.activePresenceTextIndex = (runtimeState.activePresenceTextIndex + 1) % state.activity.texts.length;
      applyPresenceState(client, state, runtimeState);
    }, state.activity.rotationIntervalSeconds * 1_000);

    runtimeState.presenceRotationTimer.unref?.();
  }

  if (!hasTemplateVariablesInPresenceState(state, runtimeState)) {
    return;
  }

  runtimeState.dynamicPresenceRefreshTimer = setInterval(() => {
    applyPresenceState(client, state, runtimeState);
  }, PRESENCE_TEMPLATE_REFRESH_INTERVAL_MS);

  runtimeState.dynamicPresenceRefreshTimer.unref?.();
};

const loadPresenceState = async (client: Client): Promise<PresenceState> => {
  const botId = resolveBotId(client);
  if (!botId) {
    return createDefaultPresenceState();
  }

  return getPresenceStore().getByBotId(botId);
};

const savePresenceState = async (client: Client, state: PresenceState): Promise<void> => {
  const botId = resolveBotId(client);
  if (!botId) {
    return;
  }

  await getPresenceStore().upsertByBotId(botId, state);
};

const applyPresenceState = (client: Client, state: PresenceState, runtimeState: PresenceRuntimeState): void => {
  if (!client.user) {
    return;
  }

  normalizePresenceActivityState(state, runtimeState);

  const status = resolveDiscordStatus(state.status);
  const templateText = getActivePresenceTemplateText(state, runtimeState);
  const text = renderPresenceTemplate(client, templateText);
  if (state.status === "streaming" || state.activity.type === "STREAMING") {
    client.user.setPresence({
      status,
      activities: [
        {
          type: ActivityType.Streaming,
          name: text,
          url: env.PRESENCE_STREAM_URL,
        },
      ],
    });
    return;
  }

  if (state.activity.type === "CUSTOM") {
    client.user.setPresence({
      status,
      activities: [
        {
          type: ActivityType.Custom,
          name: "Custom Status",
          state: text,
        },
      ],
    });
    return;
  }

  client.user.setPresence({
    status,
    activities: [
      {
        type: DISCORD_ACTIVITY_TYPES[state.activity.type],
        name: text,
      },
    ],
  });
};

const createCustomIds = (): PresenceCustomIds => {
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    statusSelect: `presence:status:${nonce}`,
    activitySelect: `presence:activity:${nonce}`,
    textButton: `presence:text:${nonce}`,
    intervalButton: `presence:interval:${nonce}`,
    textModal: `presence:modal:${nonce}`,
    textInput: `presence:text-input:${nonce}`,
    intervalModal: `presence:interval-modal:${nonce}`,
    intervalInput: `presence:interval-input:${nonce}`,
  };
};

const statusLabel = (ctx: CommandExecutionContext, status: PresenceStatusValue): string =>
  ctx.ct(`ui.status.options.${status}.label`);

const activityLabel = (ctx: CommandExecutionContext, activityType: PresenceActivityTypeValue): string =>
  ctx.ct(`ui.activity.options.${activityType}.label`);

const panelContent = (
  ctx: CommandExecutionContext,
  state: PresenceState,
  runtimeState: PresenceRuntimeState,
): string => {
  normalizePresenceActivityState(state, runtimeState);

  const templateText = getActivePresenceTemplateText(state, runtimeState);
  const activityPreview = renderPresenceTemplate(ctx.client, templateText);
  const activityTexts = state.activity.texts.map((text, index) => `${index + 1}. ${text}`).join(" | ");
  const currentIndex = Math.min(runtimeState.activePresenceTextIndex + 1, state.activity.texts.length);

  const summary = ctx.ct("responses.panel", {
    status: statusLabel(ctx, state.status),
    activityType: activityLabel(ctx, state.activity.type),
    activityText: templateText,
    activityPreview,
    activityTexts,
    textCount: state.activity.texts.length,
    currentTextIndex: currentIndex,
    rotationIntervalSeconds: state.activity.rotationIntervalSeconds,
    doubleBracesHint: "{{var}}",
    variables: getPresenceTemplateHelpText(),
  });

  return `## ${ctx.ct("ui.embed.title")}\n${ctx.ct("ui.embed.description")}\n\n${summary}`;
};

const buildContainer = (
  ctx: CommandExecutionContext,
  state: PresenceState,
  customIds: PresenceCustomIds,
  runtimeState: PresenceRuntimeState,
  disabled = false,
): ContainerBuilder => {
  const statusSelect = new StringSelectMenuBuilder()
    .setCustomId(customIds.statusSelect)
    .setPlaceholder(ctx.ct("ui.status.placeholder"))
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(disabled)
    .setOptions(
      PRESENCE_STATUSES.map((status) => ({
        label: statusLabel(ctx, status),
        description: ctx.ct(`ui.status.options.${status}.description`),
        value: status,
        default: status === state.status,
      })),
    );

  const activitySelect = new StringSelectMenuBuilder()
    .setCustomId(customIds.activitySelect)
    .setPlaceholder(ctx.ct("ui.activity.placeholder"))
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(disabled)
    .setOptions(
      PRESENCE_ACTIVITY_TYPES.map((activityType) => ({
        label: activityLabel(ctx, activityType),
        description: ctx.ct(`ui.activity.options.${activityType}.description`),
        value: activityType,
        default: activityType === state.activity.type,
      })),
    );

  const textButton = new ButtonBuilder()
    .setCustomId(customIds.textButton)
    .setLabel(ctx.ct("ui.textButton"))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);

  const intervalButton = new ButtonBuilder()
    .setCustomId(customIds.intervalButton)
    .setLabel(ctx.ct("ui.intervalButton"))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);

  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(panelContent(ctx, state, runtimeState)),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(statusSelect),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(activitySelect),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(textButton, intervalButton),
  );

  return container;
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

const persistAndApplyPresence = async (
  ctx: CommandExecutionContext,
  state: PresenceState,
  runtimeState: PresenceRuntimeState,
): Promise<void> => {
  applyPresenceState(ctx.client, state, runtimeState);
  syncDynamicPresenceTimers(ctx.client, state, runtimeState);
  await savePresenceState(ctx.client, state);
};

/**
 * Charge et applique l'état de présence depuis le stockage pour un client.
 */
export const restorePresenceFromStorage = async (client: Client): Promise<void> => {
  const state = await loadPresenceState(client);
  const runtimeState = resolveRuntimeState(client);
  runtimeState.activePresenceTextIndex = 0;
  applyPresenceState(client, state, runtimeState);
  syncDynamicPresenceTimers(client, state, runtimeState);
};

/**
 * Commande `presence` — ouvre le panneau de gestion de la présence pour le bot.
 */
export const presenceCommand = defineCommand({
  meta: {
    name: "presence",
    category: "utility",
  },
  examples: [
    {
      source: "slash",
      descriptionKey: "examples.slash",
    },
  ],
  execute: async (ctx) => {
    const runtimeState = resolveRuntimeState(ctx.client);
    const state = await loadPresenceState(ctx.client);
    applyPresenceState(ctx.client, state, runtimeState);
    syncDynamicPresenceTimers(ctx.client, state, runtimeState);

    const customIds = createCustomIds();

    const replyResult = await ctx.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [buildContainer(ctx, state, customIds, runtimeState)],
      withResponse: true,
    });

    const replyMessage = resolveReplyMessage(replyResult);
    if (!replyMessage) {
      return;
    }

    const ownerId = ctx.user.id;
    const existingPanel = runtimeState.activePanelsByUserId.get(ownerId);
    if (existingPanel) {
      existingPanel.collector.stop("replaced");
      await existingPanel.disable().catch(() => undefined);
      runtimeState.activePanelsByUserId.delete(ownerId);
    }

    const disablePanel = async (): Promise<void> => {
      await replyMessage
        .edit({
          flags: MessageFlags.IsComponentsV2,
          components: [buildContainer(ctx, state, customIds, runtimeState, true)],
        })
        .catch(() => undefined);
    };

    const collector = replyMessage.createMessageComponentCollector({ time: 15 * 60_000 });
    runtimeState.activePanelsByUserId.set(ownerId, { collector, disable: disablePanel });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== ownerId) {
        await interaction.reply({
          content: ctx.ct("responses.notOwner"),
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      try {
        if (interaction.isStringSelectMenu()) {
          if (interaction.customId === customIds.statusSelect) {
            const nextStatus = interaction.values[0];
            if (!nextStatus || !isPresenceStatusValue(nextStatus)) {
              await interaction.reply({ content: ctx.ct("responses.invalidSelection"), flags: [MessageFlags.Ephemeral] });
              return;
            }

            state.status = nextStatus;
            await persistAndApplyPresence(ctx, state, runtimeState);
            await interaction.update({
              flags: MessageFlags.IsComponentsV2,
              components: [buildContainer(ctx, state, customIds, runtimeState)],
            });
            return;
          }

          if (interaction.customId === customIds.activitySelect) {
            const nextType = interaction.values[0];
            if (!nextType || !isPresenceActivityTypeValue(nextType)) {
              await interaction.reply({ content: ctx.ct("responses.invalidSelection"), flags: [MessageFlags.Ephemeral] });
              return;
            }

            state.activity.type = nextType;
            await persistAndApplyPresence(ctx, state, runtimeState);
            await interaction.update({
              flags: MessageFlags.IsComponentsV2,
              components: [buildContainer(ctx, state, customIds, runtimeState)],
            });
            return;
          }

          await interaction.reply({ content: ctx.ct("responses.invalidSelection"), flags: [MessageFlags.Ephemeral] });
          return;
        }

        if (interaction.isButton()) {
          if (interaction.customId === customIds.textButton) {
            normalizePresenceActivityState(state, runtimeState);

            const modal = new ModalBuilder()
              .setCustomId(customIds.textModal)
              .setTitle(ctx.ct("ui.modal.title"))
              .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                  new TextInputBuilder()
                    .setCustomId(customIds.textInput)
                    .setLabel(ctx.ct("ui.modal.label"))
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder(ctx.ct("ui.modal.placeholder"))
                    .setRequired(true)
                    .setMaxLength(1_800)
                    .setValue(state.activity.texts.join("\n")),
                ),
              );

            await interaction.showModal(modal);

            try {
              const submitted = await interaction.awaitModalSubmit({
                time: 120_000,
                filter: (modalInteraction) =>
                  modalInteraction.customId === customIds.textModal
                  && modalInteraction.user.id === ownerId,
              });

              const nextTexts = sanitizeActivityTexts(
                submitted.fields.getTextInputValue(customIds.textInput).split(/\r?\n/g),
              );

              state.activity.texts = nextTexts;
              state.activity.text = nextTexts[0] ?? state.activity.text;
              runtimeState.activePresenceTextIndex = 0;
              await persistAndApplyPresence(ctx, state, runtimeState);

              await submitted.deferUpdate();

              await replyMessage.edit({
                flags: MessageFlags.IsComponentsV2,
                components: [buildContainer(ctx, state, customIds, runtimeState)],
              });
            } catch {
              await interaction.followUp({
                content: ctx.ct("responses.modalTimeout"),
                flags: [MessageFlags.Ephemeral],
              }).catch(() => undefined);
            }

            return;
          }

          if (interaction.customId === customIds.intervalButton) {
            normalizePresenceActivityState(state, runtimeState);

            const modal = new ModalBuilder()
              .setCustomId(customIds.intervalModal)
              .setTitle(ctx.ct("ui.intervalModal.title"))
              .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                  new TextInputBuilder()
                    .setCustomId(customIds.intervalInput)
                    .setLabel(ctx.ct("ui.intervalModal.label"))
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(ctx.ct("ui.intervalModal.placeholder"))
                    .setRequired(true)
                    .setMaxLength(4)
                    .setValue(String(state.activity.rotationIntervalSeconds)),
                ),
              );

            await interaction.showModal(modal);

            try {
              const submitted = await interaction.awaitModalSubmit({
                time: 120_000,
                filter: (modalInteraction) =>
                  modalInteraction.customId === customIds.intervalModal
                  && modalInteraction.user.id === ownerId,
              });

              const rawSeconds = submitted.fields.getTextInputValue(customIds.intervalInput).trim();
              if (!/^\d+$/.test(rawSeconds)) {
                await submitted.reply({
                  content: ctx.ct("responses.invalidInterval", {
                    minSeconds: MIN_ACTIVITY_ROTATION_INTERVAL_SECONDS,
                    maxSeconds: MAX_ACTIVITY_ROTATION_INTERVAL_SECONDS,
                  }),
                  flags: [MessageFlags.Ephemeral],
                });
                return;
              }

              const nextSeconds = Number(rawSeconds);
              if (!isPresenceRotationIntervalSecondsValue(nextSeconds)) {
                await submitted.reply({
                  content: ctx.ct("responses.invalidInterval", {
                    minSeconds: MIN_ACTIVITY_ROTATION_INTERVAL_SECONDS,
                    maxSeconds: MAX_ACTIVITY_ROTATION_INTERVAL_SECONDS,
                  }),
                  flags: [MessageFlags.Ephemeral],
                });
                return;
              }

              state.activity.rotationIntervalSeconds = nextSeconds;
              await persistAndApplyPresence(ctx, state, runtimeState);

              await submitted.deferUpdate();

              await replyMessage.edit({
                flags: MessageFlags.IsComponentsV2,
                components: [buildContainer(ctx, state, customIds, runtimeState)],
              });
            } catch {
              await interaction.followUp({
                content: ctx.ct("responses.modalTimeout"),
                flags: [MessageFlags.Ephemeral],
              }).catch(() => undefined);
            }

            return;
          }

          await interaction.reply({ content: ctx.ct("responses.invalidSelection"), flags: [MessageFlags.Ephemeral] });
          return;
        }

        await interaction.reply({ content: ctx.ct("responses.invalidSelection"), flags: [MessageFlags.Ephemeral] });
      } catch (error) {
        console.error("[command:presence] interaction failed", error);
        const fallback = ctx.t("errors.execution");

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: fallback, flags: [MessageFlags.Ephemeral] }).catch(() => undefined);
          return;
        }

        await interaction.followUp({ content: fallback, flags: [MessageFlags.Ephemeral] }).catch(() => undefined);
      }
    });

    collector.on("end", async () => {
      const currentPanel = runtimeState.activePanelsByUserId.get(ownerId);
      if (currentPanel?.collector === collector) {
        runtimeState.activePanelsByUserId.delete(ownerId);
      }

      await disablePanel();
    });
  },
});
