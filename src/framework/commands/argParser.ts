import type { ChatInputCommandInteraction, Message } from "discord.js";

import type { CommandArgValue, CommandArgument, TranslationVars } from "../types/command.js";

export interface ArgumentParseError {
  key: string;
  vars?: TranslationVars;
}

export interface ParsedArgumentsResult {
  values: Record<string, CommandArgValue>;
  errors: ArgumentParseError[];
}

const USER_MENTION_PATTERN = /^<@!?(\d{16,22})>$/;
const USER_ID_PATTERN = /^(\d{16,22})$/;

const BOOLEAN_TRUE = new Set(["true", "1", "yes", "y", "on"]);
const BOOLEAN_FALSE = new Set(["false", "0", "no", "n", "off"]);

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
      const value = Number.parseInt(token, 10);
      if (Number.isNaN(value)) {
        return { ok: false, error: { key: "errors.args.invalidInt", vars: { value: token } } };
      }
      return { ok: true, value };
    }

    case "number": {
      const value = Number(token);
      if (Number.isNaN(value)) {
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
      const idMatch = token.match(USER_ID_PATTERN);
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
