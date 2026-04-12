import {
  ApplicationCommandOptionType,
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

import type { BotCommand, CommandArgument, SupportedLang } from "../types/command.js";
import type { I18nService } from "../i18n/I18nService.js";

const LANG_TO_DISCORD_LOCALE: Record<SupportedLang, string> = {
  en: "en-US",
  fr: "fr",
  es: "es-ES",
};

const toLocalizationMap = (source: Partial<Record<SupportedLang, string>>): Record<string, string> => {
  const entries = Object.entries(source)
    .filter(([, value]) => Boolean(value))
    .map(([lang, value]) => [LANG_TO_DISCORD_LOCALE[lang as SupportedLang], value as string]);

  return Object.fromEntries(entries);
};

const argDescriptionKey = (command: BotCommand, arg: CommandArgument): string => {
  return `commands.${command.meta.name}.${arg.descriptionKey}`;
};

const commandDescriptionKey = (command: BotCommand): string => {
  return `commands.${command.meta.name}.description`;
};

const buildHelpCommandChoices = (commands: readonly BotCommand[], i18n: I18nService): Array<{ name: string; value: string }> => {
  return commands
    .slice()
    .sort((a, b) => a.meta.name.localeCompare(b.meta.name))
    .slice(0, 25)
    .map((cmd) => ({
      name: i18n.commandName("en", cmd.meta.name),
      value: cmd.meta.name,
    }));
};

const applyOption = (
  builder: SlashCommandBuilder,
  command: BotCommand,
  arg: CommandArgument,
  i18n: I18nService,
  allCommands: readonly BotCommand[],
): void => {
  const descriptionKey = argDescriptionKey(command, arg);
  const descriptionEn = i18n.t("en", descriptionKey);
  const descriptionLocalizations = toLocalizationMap({
    en: i18n.t("en", descriptionKey),
    fr: i18n.t("fr", descriptionKey),
    es: i18n.t("es", descriptionKey),
  });

  if (arg.type === "user") {
    builder.addUserOption((opt) =>
      opt
        .setName(arg.name)
        .setDescription(descriptionEn)
        .setDescriptionLocalizations(descriptionLocalizations)
        .setRequired(arg.required),
    );
    return;
  }

  if (arg.type === "int") {
    builder.addIntegerOption((opt) =>
      opt
        .setName(arg.name)
        .setDescription(descriptionEn)
        .setDescriptionLocalizations(descriptionLocalizations)
        .setRequired(arg.required),
    );
    return;
  }

  if (arg.type === "number") {
    builder.addNumberOption((opt) =>
      opt
        .setName(arg.name)
        .setDescription(descriptionEn)
        .setDescriptionLocalizations(descriptionLocalizations)
        .setRequired(arg.required),
    );
    return;
  }

  if (arg.type === "boolean") {
    builder.addBooleanOption((opt) =>
      opt
        .setName(arg.name)
        .setDescription(descriptionEn)
        .setDescriptionLocalizations(descriptionLocalizations)
        .setRequired(arg.required),
    );
    return;
  }

  if (arg.type === "channel") {
    builder.addChannelOption((opt) =>
      opt
        .setName(arg.name)
        .setDescription(descriptionEn)
        .setDescriptionLocalizations(descriptionLocalizations)
        .setRequired(arg.required),
    );
    return;
  }

  if (arg.type === "role") {
    builder.addRoleOption((opt) =>
      opt
        .setName(arg.name)
        .setDescription(descriptionEn)
        .setDescriptionLocalizations(descriptionLocalizations)
        .setRequired(arg.required),
    );
    return;
  }

  builder.addStringOption((opt) =>
    {
      const configured = opt
      .setName(arg.name)
      .setDescription(descriptionEn)
      .setDescriptionLocalizations(descriptionLocalizations)
      .setRequired(arg.required);

      if (command.meta.name === "help" && arg.name === "command") {
        const choices = buildHelpCommandChoices(allCommands, i18n);
        if (choices.length > 0) {
          configured.addChoices(...choices);
        }
      }

      return configured;
    },
  );
};

export const buildSlashPayload = (
  commands: readonly BotCommand[],
  i18n: I18nService,
): RESTPostAPIChatInputApplicationCommandsJSONBody[] => {
  return commands.map((command) => {
    const descriptionKey = commandDescriptionKey(command);

    const slashLocalizations = toLocalizationMap({
      fr: i18n.commandName("fr", command.meta.name),
      es: i18n.commandName("es", command.meta.name),
    });

    const slashBuilder = new SlashCommandBuilder()
      .setName(command.meta.name)
      .setDescription(i18n.t("en", descriptionKey))
      .setDescriptionLocalizations(
        toLocalizationMap({
          en: i18n.t("en", descriptionKey),
          fr: i18n.t("fr", descriptionKey),
          es: i18n.t("es", descriptionKey),
        }),
      )
      .setNameLocalizations(slashLocalizations);

    for (const arg of command.args) {
      applyOption(slashBuilder, command, arg, i18n, commands);
    }

    return slashBuilder.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody;
  });
};

export const commandOptionType = (type: CommandArgument["type"]): ApplicationCommandOptionType => {
  switch (type) {
    case "user":
      return ApplicationCommandOptionType.User;
    case "int":
      return ApplicationCommandOptionType.Integer;
    case "number":
      return ApplicationCommandOptionType.Number;
    case "boolean":
      return ApplicationCommandOptionType.Boolean;
    case "channel":
      return ApplicationCommandOptionType.Channel;
    case "role":
      return ApplicationCommandOptionType.Role;
    default:
      return ApplicationCommandOptionType.String;
  }
};
