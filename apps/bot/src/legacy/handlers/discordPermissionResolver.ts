import {
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type Guild,
  type Message,
} from "discord.js";

import type { BuildExecutionContextInput } from "../types/handlers.js";

const resolveFromGuild = async (guild: Guild | null, userId: string): Promise<Readonly<PermissionsBitField> | null> => {
  if (!guild) {
    return null;
  }

  const cached = guild.members.cache.get(userId);
  if (cached?.permissions) {
    return cached.permissions;
  }

  const fetched = await guild.members.fetch(userId).catch(() => null);
  return fetched?.permissions ?? null;
};

const resolveFromInteractionMember = (
  interaction: ChatInputCommandInteraction,
): Readonly<PermissionsBitField> | null => {
  if (interaction.memberPermissions) {
    return interaction.memberPermissions;
  }

  const member = interaction.member;
  if (member && typeof member === "object" && "permissions" in member) {
    const rawPermissions = (member as { permissions?: string | number | bigint }).permissions;

    if (rawPermissions !== undefined) {
      try {
        const normalized = typeof rawPermissions === "string" || typeof rawPermissions === "number"
          ? BigInt(rawPermissions)
          : rawPermissions;

        return new PermissionsBitField(normalized);
      } catch {
        return null;
      }
    }
  }

  return null;
};

export const createDiscordMemberPermissionsResolver = (
  input: BuildExecutionContextInput,
): (() => Promise<Readonly<PermissionsBitField> | null>) => {
  if (input.source === "slash") {
    const interaction = input.raw as ChatInputCommandInteraction;

    return async (): Promise<Readonly<PermissionsBitField> | null> => {
      const direct = resolveFromInteractionMember(interaction);
      if (direct) {
        return direct;
      }

      return resolveFromGuild(interaction.guild, interaction.user.id);
    };
  }

  const message = input.raw as Message;

  return async (): Promise<Readonly<PermissionsBitField> | null> => {
    const directFromMessage = message.member?.permissions;
    if (directFromMessage) {
      return directFromMessage;
    }

    const fallbackFromGuildMember = message.guild?.members.resolve(message.author.id)?.permissions;
    if (fallbackFromGuildMember) {
      return fallbackFromGuildMember;
    }

    return resolveFromGuild(message.guild, message.author.id);
  };
};
