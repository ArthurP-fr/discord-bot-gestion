import {
  AttachmentBuilder,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  TextDisplayBuilder,
  type Client,
  type Guild,
  type MessageCreateOptions,
  type User,
} from "discord.js";

import type { I18nService } from "../../i18n/index.js";
import type { SupportedLang } from "../types/command.js";
import { renderMemberMessageImage } from "./memberMessageImage.js";
import { getMemberMessageStore } from "./memberMessageStore.js";
import {
  type MemberMessageKind,
  type MemberMessageRenderType,
} from "./memberMessageTypes.js";

export type DispatchMemberMessageFailureReason =
  | "bot_not_ready"
  | "disabled"
  | "missing_channel"
  | "channel_not_found"
  | "channel_not_sendable"
  | "missing_permissions"
  | "send_failed";

export interface DispatchMemberMessageResult {
  sent: boolean;
  reason: DispatchMemberMessageFailureReason | "sent";
  channelId: string | null;
}

interface DispatchMemberMessageInput {
  client: Client;
  i18n?: I18nService;
  guild: Guild;
  user: User;
  kind: MemberMessageKind;
  ignoreEnabled?: boolean;
}

interface SendableChannel {
  send: (payload: string | MessageCreateOptions) => Promise<unknown>;
}

const hasSendMethod = (value: unknown): value is SendableChannel => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "send" in value && typeof (value as { send?: unknown }).send === "function";
};

const hasCode = (error: unknown): error is { code: number } => {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && typeof (error as { code?: unknown }).code === "number";
};

const messageTemplateVars = (guild: Guild, user: User): Record<string, string> => ({
  user: `<@${user.id}>`,
  username: user.username,
  guild: guild.name,
});

const messageColor = (kind: MemberMessageKind): number => {
  return kind === "welcome" ? 0x57f287 : 0xed4245;
};

type TemplateSuffix =
  | "simple"
  | "embedTitle"
  | "embedDescription"
  | "containerTitle"
  | "containerDescription"
  | "imageTitle"
  | "imageDescription";

const defaultTemplate = (
  kind: MemberMessageKind,
  suffix: TemplateSuffix,
  vars: Record<string, string>,
): string => {
  if (kind === "welcome") {
    switch (suffix) {
      case "simple":
        return `🎉 Welcome ${vars.user} to **${vars.guild}**!`;
      case "embedTitle":
        return "Welcome!";
      case "embedDescription":
        return `${vars.user} just joined **${vars.guild}**.`;
      case "containerTitle":
        return "Welcome";
      case "containerDescription":
        return `${vars.user} just joined **${vars.guild}**.`;
      case "imageTitle":
        return "New member";
      case "imageDescription":
        return `Glad to have you here, ${vars.user}!`;
      default:
        return "";
    }
  }

  switch (suffix) {
    case "simple":
      return `👋 ${vars.user} left **${vars.guild}**.`;
    case "embedTitle":
      return "Goodbye";
    case "embedDescription":
      return `${vars.user} has left **${vars.guild}**.`;
    case "containerTitle":
      return "Goodbye";
    case "containerDescription":
      return `${vars.user} has left **${vars.guild}**.`;
    case "imageTitle":
      return "Member left";
    case "imageDescription":
      return `${vars.user} has left the server.`;
    default:
      return "";
  }
};

const resolveTemplate = (
  i18n: I18nService | undefined,
  lang: SupportedLang,
  kind: MemberMessageKind,
  suffix: TemplateSuffix,
  vars: Record<string, string>,
): string => {
  if (!i18n) {
    return defaultTemplate(kind, suffix, vars);
  }

  const key = `commands.${kind}.templates.${suffix}`;
  const translated = i18n.t(lang, key, vars);
  return translated === key ? defaultTemplate(kind, suffix, vars) : translated;
};

const buildMemberMessagePayload = async (
  i18n: I18nService | undefined,
  lang: SupportedLang,
  kind: MemberMessageKind,
  renderType: MemberMessageRenderType,
  guild: Guild,
  user: User,
): Promise<MessageCreateOptions> => {
  const vars = messageTemplateVars(guild, user);
  const allowedMentions: NonNullable<MessageCreateOptions["allowedMentions"]> = {
    parse: [],
    users: [user.id],
  };

  if (renderType === "simple") {
    return {
      content: resolveTemplate(i18n, lang, kind, "simple", vars),
      allowedMentions,
    };
  }

  if (renderType === "embed") {
    return {
      allowedMentions,
      embeds: [
        new EmbedBuilder()
          .setColor(messageColor(kind))
          .setTitle(resolveTemplate(i18n, lang, kind, "embedTitle", vars))
          .setDescription(resolveTemplate(i18n, lang, kind, "embedDescription", vars)),
      ],
    };
  }

  if (renderType === "container") {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${resolveTemplate(i18n, lang, kind, "containerTitle", vars)}\n${resolveTemplate(i18n, lang, kind, "containerDescription", vars)}`,
      ),
    );

    return {
      flags: MessageFlags.IsComponentsV2,
      components: [container],
      allowedMentions,
    };
  }

  const imageBuffer = await renderMemberMessageImage({
    kind,
    title: resolveTemplate(i18n, lang, kind, "imageTitle", vars),
    subtitle: resolveTemplate(i18n, lang, kind, "imageDescription", vars),
    username: user.globalName ?? user.username,
    avatarUrl: user.displayAvatarURL({ extension: "png", size: 512 }),
  });

  const fileName = `${kind}-${guild.id}-${user.id}.png`;

  return {
    allowedMentions,
    content: resolveTemplate(i18n, lang, kind, "simple", vars),
    files: [new AttachmentBuilder(imageBuffer, { name: fileName })],
  };
};

export const dispatchMemberMessage = async (input: DispatchMemberMessageInput): Promise<DispatchMemberMessageResult> => {
  const botId = input.client.user?.id;
  if (!botId) {
    return {
      sent: false,
      reason: "bot_not_ready",
      channelId: null,
    };
  }

  const config = await getMemberMessageStore().getByBotGuildKind(botId, input.guild.id, input.kind);

  if (!input.ignoreEnabled && !config.enabled) {
    return {
      sent: false,
      reason: "disabled",
      channelId: config.channelId,
    };
  }

  if (!config.channelId) {
    return {
      sent: false,
      reason: "missing_channel",
      channelId: null,
    };
  }

  const channel = await input.guild.channels.fetch(config.channelId).catch(() => null);
  if (!channel) {
    return {
      sent: false,
      reason: "channel_not_found",
      channelId: config.channelId,
    };
  }

  if (!hasSendMethod(channel)) {
    return {
      sent: false,
      reason: "channel_not_sendable",
      channelId: config.channelId,
    };
  }

  const me = input.guild.members.me;
  if (me && "permissionsFor" in channel && typeof channel.permissionsFor === "function") {
    const permissions = channel.permissionsFor(me);
    if (!permissions || !permissions.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.SendMessages)) {
      return {
        sent: false,
        reason: "missing_permissions",
        channelId: config.channelId,
      };
    }
  }

  const lang = input.i18n?.resolveLang(input.guild.preferredLocale ?? null) ?? "en";
  const payload = await buildMemberMessagePayload(input.i18n, lang, input.kind, config.messageType, input.guild, input.user);

  try {
    await channel.send(payload);
    return {
      sent: true,
      reason: "sent",
      channelId: config.channelId,
    };
  } catch (error) {
    if (hasCode(error) && error.code === 50013) {
      return {
        sent: false,
        reason: "missing_permissions",
        channelId: config.channelId,
      };
    }

    return {
      sent: false,
      reason: "send_failed",
      channelId: config.channelId,
    };
  }
};
