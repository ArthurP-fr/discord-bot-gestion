import {
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
} from "discord.js";

import { resolveReplyMessage } from "../../core/discord/replyMessageResolver.js";
import type { CommandExecutionContext } from "../../types/command.js";
import {
  MAX_ACTIVITY_ROTATION_INTERVAL_SECONDS,
  MIN_ACTIVITY_ROTATION_INTERVAL_SECONDS,
  PRESENCE_ACTIVITY_TYPES,
  PRESENCE_STATUSES,
  isPresenceActivityTypeValue,
  isPresenceRotationIntervalSecondsValue,
  isPresenceStatusValue,
  sanitizeActivityTexts,
} from "../../validators/presence.js";
import { getPresenceTemplateHelpText } from "./templateVariables.js";
import type { PresenceService } from "./service.js";
import type { PresenceCustomIds } from "./types.js";
import { createScopedLogger } from "../../core/logging/logger.js";

const log = createScopedLogger("command:presence");

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

const statusLabel = (ctx: CommandExecutionContext, status: string): string =>
  ctx.ct(`ui.status.options.${status}.label`);

const activityLabel = (ctx: CommandExecutionContext, activityType: string): string =>
  ctx.ct(`ui.activity.options.${activityType}.label`);

const panelContent = (
  ctx: CommandExecutionContext,
  service: PresenceService,
  state: Awaited<ReturnType<PresenceService["loadState"]>>,
): string => {
  const runtimeState = service.getRuntimeState(ctx.client);
  service.normalizeState(state, runtimeState);

  const templateText = service.getActiveTemplateText(state, runtimeState);
  const activityPreview = service.renderPreview(ctx.client, templateText);
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
  service: PresenceService,
  state: Awaited<ReturnType<PresenceService["loadState"]>>,
  customIds: PresenceCustomIds,
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
    new TextDisplayBuilder().setContent(panelContent(ctx, service, state)),
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

export const createPresenceCommandExecute = (presenceService: PresenceService) => {
  return async (ctx: CommandExecutionContext): Promise<void> => {
    const state = await presenceService.loadState(ctx.client);
    presenceService.applyState(ctx.client, state);

    const customIds = createCustomIds();

    const replyResult = await ctx.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [buildContainer(ctx, presenceService, state, customIds)],
      withResponse: true,
    });

    const replyMessage = resolveReplyMessage(replyResult);
    if (!replyMessage) {
      return;
    }

    const ownerId = ctx.user.id;
    const sessionKey = presenceService.panelSessionKey(ctx.client, ownerId);

    const disablePanel = async (): Promise<void> => {
      await replyMessage
        .edit({
          flags: MessageFlags.IsComponentsV2,
          components: [buildContainer(ctx, presenceService, state, customIds, true)],
        })
        .catch(() => undefined);
    };

    const collector = replyMessage.createMessageComponentCollector({ time: 15 * 60_000 });
    await presenceService.replacePanelSession(sessionKey, { collector, disable: disablePanel });

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
            await presenceService.persistAndApply(ctx.client, state);
            await interaction.update({
              flags: MessageFlags.IsComponentsV2,
              components: [buildContainer(ctx, presenceService, state, customIds)],
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
            await presenceService.persistAndApply(ctx.client, state);
            await interaction.update({
              flags: MessageFlags.IsComponentsV2,
              components: [buildContainer(ctx, presenceService, state, customIds)],
            });
            return;
          }

          await interaction.reply({ content: ctx.ct("responses.invalidSelection"), flags: [MessageFlags.Ephemeral] });
          return;
        }

        if (interaction.isButton()) {
          if (interaction.customId === customIds.textButton) {
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
              const runtimeState = presenceService.getRuntimeState(ctx.client);
              runtimeState.activePresenceTextIndex = 0;
              await presenceService.persistAndApply(ctx.client, state);

              await submitted.deferUpdate();

              await replyMessage.edit({
                flags: MessageFlags.IsComponentsV2,
                components: [buildContainer(ctx, presenceService, state, customIds)],
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
              await presenceService.persistAndApply(ctx.client, state);

              await submitted.deferUpdate();

              await replyMessage.edit({
                flags: MessageFlags.IsComponentsV2,
                components: [buildContainer(ctx, presenceService, state, customIds)],
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
        log.error({ err: error }, "interaction failed");
        const fallback = ctx.t("errors.execution");

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: fallback, flags: [MessageFlags.Ephemeral] }).catch(() => undefined);
          return;
        }

        await interaction.followUp({ content: fallback, flags: [MessageFlags.Ephemeral] }).catch(() => undefined);
      }
    });

    collector.on("end", async () => {
      presenceService.deletePanelSessionIfCollectorMatch(sessionKey, collector);
      await disablePanel();
    });
  };
};
