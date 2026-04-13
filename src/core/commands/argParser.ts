import type { ChatInputCommandInteraction, GuildBasedChannel, Message } from "discord.js";

import type { ArgumentParseError, ParsedArgumentsResult } from "../../types/argParser.js";
import type { CommandArgValue, CommandArgument } from "../../types/command.js";

const USER_MENTION_PATTERN = /^<@!?(\d{16,22})>$/;
const CHANNEL_MENTION_PATTERN = /^<#(\d{16,22})>$/;
const ROLE_MENTION_PATTERN = /^<@&(\d{16,22})>$/;
const SNOWFLAKE_ID_PATTERN = /^(\d{16,22})$/;

const BOOLEAN_TRUE = new Set(["true", "1", "yes", "y", "on"]);
const BOOLEAN_FALSE = new Set(["false", "0", "no", "n", "off"]);

const isGuildBasedChannel = (value: unknown): value is GuildBasedChannel => {
  return Boolean(value) && typeof value === "object" && "guild" in (value as Record<string, unknown>);
};

export const tokenizePrefixInput = (raw: string): string[] => {
  const tokens: string[] = [];
  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    tokens.push((match[1] ?? match[2] ?? match[3] ?? "").replace(/\\(["'])/g, "$1"));
  }

  return tokens;
};

export const parsePrefixArgs = async (
  message: Message,
  definitions: CommandArgument[],
  rawInput: string,
): Promise<ParsedArgumentsResult> => {
  const tokens = tokenizePrefixInput(rawInput);
  const values: Record<string, CommandArgValue> = {};
  const errors: ArgumentParseError[] = [];

  for (const definition of definitions) {
    const token = tokens.shift();

    if (!token) {
      if (definition.required) {
        errors.push({ key: "errors.args.missing", vars: { arg: definition.name } });
      }
      values[definition.name] = undefined;
      continue;
    }

    const parsed = await parseByTypeFromPrefix(message, definition.type, token);
    if (parsed.ok) {
      values[definition.name] = parsed.value;
      continue;
    }

    errors.push(parsed.error);
  }

  if (tokens.length > 0) {
    errors.push({
      key: "errors.args.tooMany",
      vars: {
        count: tokens.length,
        extras: tokens.join(" "),
      },
    });
  }

  return { values, errors };
};

export const parseSlashArgs = (
  interaction: ChatInputCommandInteraction,
  definitions: CommandArgument[],
): ParsedArgumentsResult => {
  const values: Record<string, CommandArgValue> = {};
  const errors: ArgumentParseError[] = [];

  for (const definition of definitions) {
    try {
      values[definition.name] = parseByTypeFromSlash(interaction, definition);
    } catch {
      if (definition.required) {
        errors.push({ key: "errors.args.missing", vars: { arg: definition.name } });
      }
      values[definition.name] = undefined;
    }
  }

  return { values, errors };
};

const parseByTypeFromPrefix = async (
  message: Message,
  type: CommandArgument["type"],
  token: string,
): Promise<{ ok: true; value: CommandArgValue } | { ok: false; error: ArgumentParseError }> => {
  switch (type) {
    case "string":
      return { ok: true, value: token };

    case "int": {
      if (!/^-?\d+$/.test(token)) {
        return { ok: false, error: { key: "errors.args.invalidInt", vars: { value: token } } };
      }

      const value = Number.parseInt(token, 10);
      return { ok: true, value };
    }

    case "number": {
      const value = Number(token);
      if (!Number.isFinite(value)) {
        return { ok: false, error: { key: "errors.args.invalidNumber", vars: { value: token } } };
      }
      return { ok: true, value };
    }

    case "boolean": {
      const normalized = token.toLowerCase();
      if (BOOLEAN_TRUE.has(normalized)) {
        return { ok: true, value: true };
      }
      if (BOOLEAN_FALSE.has(normalized)) {
        return { ok: true, value: false };
      }
      return { ok: false, error: { key: "errors.args.invalidBoolean", vars: { value: token } } };
    }

    case "user": {
      const mentionMatch = token.match(USER_MENTION_PATTERN);
      const idMatch = token.match(SNOWFLAKE_ID_PATTERN);
      const userId = mentionMatch?.[1] ?? idMatch?.[1];

      if (!userId) {
        return { ok: false, error: { key: "errors.args.invalidUser", vars: { value: token } } };
      }

      const fromMention = message.mentions.users.get(userId);
      if (fromMention) {
        return { ok: true, value: fromMention };
      }

      try {
        const fetched = await message.client.users.fetch(userId);
        return { ok: true, value: fetched };
      } catch {
        return { ok: false, error: { key: "errors.args.invalidUser", vars: { value: token } } };
      }
    }

    case "channel": {
      const mentionMatch = token.match(CHANNEL_MENTION_PATTERN);
      const idMatch = token.match(SNOWFLAKE_ID_PATTERN);
      const channelId = mentionMatch?.[1] ?? idMatch?.[1];

      if (!channelId) {
        return { ok: false, error: { key: "errors.args.invalidChannel", vars: { value: token } } };
      }

      const fromMention = message.mentions.channels.get(channelId);
      if (fromMention && isGuildBasedChannel(fromMention)) {
        return { ok: true, value: fromMention };
      }

      const fromGuildCache = message.guild?.channels.cache.get(channelId);
      if (fromGuildCache) {
        return { ok: true, value: fromGuildCache };
      }

      try {
        const fetchedFromGuild = await message.guild?.channels.fetch(channelId);
        if (fetchedFromGuild) {
          return { ok: true, value: fetchedFromGuild };
        }
      } catch {
        // Try the global cache/fetch fallback below.
      }

      try {
        const fetched = await message.client.channels.fetch(channelId);
        if (fetched && isGuildBasedChannel(fetched)) {
          return { ok: true, value: fetched };
        }
      } catch {
        // Falls through to invalid channel error.
      }

      return { ok: false, error: { key: "errors.args.invalidChannel", vars: { value: token } } };
    }

    case "role": {
      const mentionMatch = token.match(ROLE_MENTION_PATTERN);
      const idMatch = token.match(SNOWFLAKE_ID_PATTERN);
      const roleId = mentionMatch?.[1] ?? idMatch?.[1];

      if (!roleId || !message.guild) {
        return { ok: false, error: { key: "errors.args.invalidRole", vars: { value: token } } };
      }

      const fromMention = message.mentions.roles.get(roleId);
      if (fromMention) {
        return { ok: true, value: fromMention };
      }

      const fromCache = message.guild.roles.cache.get(roleId);
      if (fromCache) {
        return { ok: true, value: fromCache };
      }

      try {
        const fetched = await message.guild.roles.fetch(roleId);
        if (fetched) {
          return { ok: true, value: fetched };
        }
      } catch {
        // Falls through to invalid role error.
      }

      return { ok: false, error: { key: "errors.args.invalidRole", vars: { value: token } } };
    }

    default:
      return { ok: true, value: token };
  }
};

const parseByTypeFromSlash = (
  interaction: ChatInputCommandInteraction,
  definition: CommandArgument,
): CommandArgValue => {
  switch (definition.type) {
    case "string":
      return interaction.options.getString(definition.name, definition.required) ?? undefined;

    case "int":
      return interaction.options.getInteger(definition.name, definition.required) ?? undefined;

    case "number":
      return interaction.options.getNumber(definition.name, definition.required) ?? undefined;

    case "boolean":
      return interaction.options.getBoolean(definition.name, definition.required) ?? undefined;

    case "user":
      return interaction.options.getUser(definition.name, definition.required) ?? undefined;

    case "channel":
      return (interaction.options.getChannel(definition.name, definition.required) ?? undefined) as CommandArgValue;

    case "role":
      return (interaction.options.getRole(definition.name, definition.required) ?? undefined) as CommandArgValue;

    default:
      return interaction.options.getString(definition.name, definition.required) ?? undefined;
  }
};
