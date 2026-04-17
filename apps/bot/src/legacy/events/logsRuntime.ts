import {
  Events,
  type Client,
} from "discord.js";

import { createScopedLogger } from "../core/logging/logger.js";
import type { LogEventKey } from "../types/logs.js";
import type { LogEventService } from "../modules/logs/index.js";

const logger = createScopedLogger("event:logsRuntime");

const clamp = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
};

const formatContent = (content: string | null | undefined): string => {
  if (typeof content !== "string") {
    return "(no content)";
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return "(no content)";
  }

  return clamp(trimmed, 400);
};

const emitRuntimeLog = (
  client: Client,
  logEventService: LogEventService,
  eventKey: LogEventKey,
  guildId: string | null | undefined,
  summary: string,
  details: string[] = [],
  color?: number,
): void => {
  if (!guildId) {
    return;
  }

  void logEventService.dispatchEvent(client, {
    eventKey,
    guildId,
    summary,
    ...(details.length > 0 ? { details } : {}),
    ...(color !== undefined ? { color } : {}),
  }).catch((error) => {
    logger.error({ eventKey, guildId, err: error }, "failed to dispatch runtime log event");
  });
};

export const registerLogRuntimeEvents = (client: Client, logEventService: LogEventService): void => {
  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author.bot) {
      return;
    }

    emitRuntimeLog(
      client,
      logEventService,
      "messageCreate",
      message.guild.id,
      `Message sent by <@${message.author.id}> in <#${message.channelId}>`,
      [
        `messageId=${message.id}`,
        `author=${message.author.tag} (${message.author.id})`,
        `content=${formatContent(message.content)}`,
      ],
      0x57f287,
    );
  });

  client.on(Events.MessageDelete, (message) => {
    const authorId = message.author?.id ?? "unknown";
    const authorTag = message.author?.tag ?? "unknown";

    emitRuntimeLog(
      client,
      logEventService,
      "messageDelete",
      message.guild?.id,
      `Message deleted in <#${message.channelId}>`,
      [
        `messageId=${message.id}`,
        `author=${authorTag} (${authorId})`,
        `content=${formatContent(message.content)}`,
      ],
      0xed4245,
    );
  });

  client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    emitRuntimeLog(
      client,
      logEventService,
      "messageUpdate",
      newMessage.guild?.id,
      `Message updated in <#${newMessage.channelId}>`,
      [
        `messageId=${newMessage.id}`,
        `before=${formatContent(oldMessage.content)}`,
        `after=${formatContent(newMessage.content)}`,
      ],
      0xfee75c,
    );
  });

  client.on(Events.MessageBulkDelete, (messages) => {
    const first = messages.first();
    emitRuntimeLog(
      client,
      logEventService,
      "messageBulkDelete",
      first?.guild?.id,
      `Bulk delete: ${messages.size} messages removed`,
      [
        `channelId=${first?.channelId ?? "unknown"}`,
        `count=${messages.size}`,
      ],
      0xed4245,
    );
  });

  client.on(Events.GuildMemberAdd, (member) => {
    emitRuntimeLog(
      client,
      logEventService,
      "guildMemberAdd",
      member.guild.id,
      `Member joined: <@${member.user.id}>`,
      [`user=${member.user.tag} (${member.user.id})`],
      0x57f287,
    );
  });

  client.on(Events.GuildMemberRemove, (member) => {
    emitRuntimeLog(
      client,
      logEventService,
      "guildMemberRemove",
      member.guild.id,
      `Member left: <@${member.user.id}>`,
      [`user=${member.user.tag} (${member.user.id})`],
      0xed4245,
    );
  });

  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    emitRuntimeLog(
      client,
      logEventService,
      "guildMemberUpdate",
      newMember.guild.id,
      `Member updated: <@${newMember.user.id}>`,
      [
        `user=${newMember.user.tag} (${newMember.user.id})`,
        `oldNick=${oldMember.nickname ?? "none"}`,
        `newNick=${newMember.nickname ?? "none"}`,
      ],
      0x5865f2,
    );
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.guildId || interaction.user.bot) {
      return;
    }

    let summary = `Interaction by <@${interaction.user.id}>`;
    if (interaction.isChatInputCommand()) {
      summary = `Slash command /${interaction.commandName} by <@${interaction.user.id}>`;
    } else if (interaction.isButton()) {
      summary = `Button interaction by <@${interaction.user.id}>`;
    } else if (interaction.isStringSelectMenu()) {
      summary = `Select menu interaction by <@${interaction.user.id}>`;
    } else if (interaction.isModalSubmit()) {
      summary = `Modal submit by <@${interaction.user.id}>`;
    }

    emitRuntimeLog(
      client,
      logEventService,
      "interactionCreate",
      interaction.guildId,
      summary,
      [
        `interactionId=${interaction.id}`,
        `channelId=${interaction.channelId ?? "unknown"}`,
      ],
      0x5865f2,
    );
  });

  client.on(Events.ChannelCreate, (channel) => {
    if (!("guild" in channel) || !("name" in channel)) {
      return;
    }

    emitRuntimeLog(
      client,
      logEventService,
      "channelCreate",
      channel.guild.id,
      `Channel created: #${channel.name}`,
      [
        `channelId=${channel.id}`,
        `type=${channel.type}`,
      ],
      0x57f287,
    );
  });

  client.on(Events.ChannelDelete, (channel) => {
    if (!("guild" in channel) || !("name" in channel)) {
      return;
    }

    emitRuntimeLog(
      client,
      logEventService,
      "channelDelete",
      channel.guild.id,
      `Channel deleted: #${channel.name}`,
      [
        `channelId=${channel.id}`,
        `type=${channel.type}`,
      ],
      0xed4245,
    );
  });

  client.on(Events.ChannelUpdate, (oldChannel, newChannel) => {
    if (!("guild" in newChannel) || !("name" in newChannel)) {
      return;
    }

    const oldName = "name" in oldChannel ? oldChannel.name : "unknown";

    emitRuntimeLog(
      client,
      logEventService,
      "channelUpdate",
      newChannel.guild.id,
      `Channel updated: #${newChannel.name}`,
      [
        `channelId=${newChannel.id}`,
        `oldName=${oldName}`,
        `newName=${newChannel.name}`,
      ],
      0xfee75c,
    );
  });

  client.on(Events.GuildRoleCreate, (role) => {
    emitRuntimeLog(
      client,
      logEventService,
      "roleCreate",
      role.guild.id,
      `Role created: @${role.name}`,
      [`roleId=${role.id}`],
      0x57f287,
    );
  });

  client.on(Events.GuildRoleDelete, (role) => {
    emitRuntimeLog(
      client,
      logEventService,
      "roleDelete",
      role.guild.id,
      `Role deleted: @${role.name}`,
      [`roleId=${role.id}`],
      0xed4245,
    );
  });

  client.on(Events.GuildRoleUpdate, (oldRole, newRole) => {
    emitRuntimeLog(
      client,
      logEventService,
      "roleUpdate",
      newRole.guild.id,
      `Role updated: @${newRole.name}`,
      [
        `roleId=${newRole.id}`,
        `oldName=${oldRole.name}`,
        `newName=${newRole.name}`,
      ],
      0xfee75c,
    );
  });

  client.on(Events.ThreadCreate, (thread) => {
    emitRuntimeLog(
      client,
      logEventService,
      "threadCreate",
      thread.guild?.id,
      `Thread created: ${thread.name}`,
      [`threadId=${thread.id}`],
      0x57f287,
    );
  });

  client.on(Events.ThreadDelete, (thread) => {
    emitRuntimeLog(
      client,
      logEventService,
      "threadDelete",
      thread.guild?.id,
      `Thread deleted: ${thread.name}`,
      [`threadId=${thread.id}`],
      0xed4245,
    );
  });

  client.on(Events.ThreadUpdate, (oldThread, newThread) => {
    emitRuntimeLog(
      client,
      logEventService,
      "threadUpdate",
      newThread.guild?.id,
      `Thread updated: ${newThread.name}`,
      [
        `threadId=${newThread.id}`,
        `oldName=${oldThread.name}`,
        `newName=${newThread.name}`,
      ],
      0xfee75c,
    );
  });

  client.on(Events.GuildEmojiCreate, (emoji) => {
    emitRuntimeLog(
      client,
      logEventService,
      "emojiCreate",
      emoji.guild?.id,
      `Emoji created: ${emoji.name ?? "unknown"}`,
      [`emojiId=${emoji.id ?? "unknown"}`],
      0x57f287,
    );
  });

  client.on(Events.GuildEmojiDelete, (emoji) => {
    emitRuntimeLog(
      client,
      logEventService,
      "emojiDelete",
      emoji.guild?.id,
      `Emoji deleted: ${emoji.name ?? "unknown"}`,
      [`emojiId=${emoji.id ?? "unknown"}`],
      0xed4245,
    );
  });

  client.on(Events.GuildEmojiUpdate, (oldEmoji, newEmoji) => {
    emitRuntimeLog(
      client,
      logEventService,
      "emojiUpdate",
      newEmoji.guild?.id,
      `Emoji updated: ${newEmoji.name ?? "unknown"}`,
      [
        `emojiId=${newEmoji.id ?? "unknown"}`,
        `oldName=${oldEmoji.name ?? "unknown"}`,
        `newName=${newEmoji.name ?? "unknown"}`,
      ],
      0xfee75c,
    );
  });

  client.on(Events.GuildUpdate, (oldGuild, newGuild) => {
    emitRuntimeLog(
      client,
      logEventService,
      "guildUpdate",
      newGuild.id,
      `Guild updated: ${newGuild.name}`,
      [
        `guildId=${newGuild.id}`,
        `oldName=${oldGuild.name}`,
        `newName=${newGuild.name}`,
      ],
      0xfee75c,
    );
  });

  client.on(Events.GuildUnavailable, (guild) => {
    emitRuntimeLog(
      client,
      logEventService,
      "guildUnavailable",
      guild.id,
      `Guild temporarily unavailable: ${guild.name}`,
      [`guildId=${guild.id}`],
      0xed4245,
    );
  });

  client.on(Events.GuildBanAdd, (ban) => {
    emitRuntimeLog(
      client,
      logEventService,
      "guildBanAdd",
      ban.guild.id,
      `User banned: <@${ban.user.id}>`,
      [
        `user=${ban.user.tag} (${ban.user.id})`,
        `guildId=${ban.guild.id}`,
      ],
      0xed4245,
    );
  });

  client.on(Events.GuildBanRemove, (ban) => {
    emitRuntimeLog(
      client,
      logEventService,
      "guildBanRemove",
      ban.guild.id,
      `User unbanned: <@${ban.user.id}>`,
      [
        `user=${ban.user.tag} (${ban.user.id})`,
        `guildId=${ban.guild.id}`,
      ],
      0x57f287,
    );
  });

  client.on(Events.InviteCreate, (invite) => {
    emitRuntimeLog(
      client,
      logEventService,
      "inviteCreate",
      invite.guild?.id,
      `Invite created: ${invite.code}`,
      [
        `channelId=${invite.channelId ?? "unknown"}`,
        `inviter=${invite.inviter?.tag ?? "unknown"}`,
      ],
      0x57f287,
    );
  });

  client.on(Events.InviteDelete, (invite) => {
    emitRuntimeLog(
      client,
      logEventService,
      "inviteDelete",
      invite.guild?.id,
      `Invite deleted: ${invite.code}`,
      [
        `channelId=${invite.channelId ?? "unknown"}`,
      ],
      0xed4245,
    );
  });
};