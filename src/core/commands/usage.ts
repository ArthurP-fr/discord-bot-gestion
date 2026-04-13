import type { BotCommand, CommandI18nTools, SupportedLang } from "../../types/command.js";

const formatArgToken = (name: string, required: boolean): string => required ? `<${name}>` : `[${name}]`;

export const resolvePrefixTrigger = (
  command: BotCommand,
  lang: SupportedLang,
  defaultLang: SupportedLang,
  i18n: CommandI18nTools,
): string => {
  const fromLang = i18n.commandTrigger(lang, command.meta.name);
  if (fromLang) {
    return fromLang;
  }

  const fromDefault = i18n.commandTrigger(defaultLang, command.meta.name);
  if (fromDefault) {
    return fromDefault;
  }

  return command.meta.name;
};

export const resolveSlashName = (command: BotCommand, lang: SupportedLang, i18n: CommandI18nTools): string => {
  return i18n.commandName(lang, command.meta.name);
};

export const buildPrefixUsage = (
  command: BotCommand,
  prefix: string,
  lang: SupportedLang,
  defaultLang: SupportedLang,
  i18n: CommandI18nTools,
): string => {
  const trigger = resolvePrefixTrigger(command, lang, defaultLang, i18n);
  const args = command.args.map((arg) => formatArgToken(arg.name, arg.required)).join(" ");
  return `${prefix}${trigger}${args.length > 0 ? ` ${args}` : ""}`;
};

export const buildSlashUsage = (command: BotCommand, lang: SupportedLang, i18n: CommandI18nTools): string => {
  const slashName = resolveSlashName(command, lang, i18n);
  const args = command.args.map((arg) => formatArgToken(arg.name, arg.required)).join(" ");
  return `/${slashName}${args.length > 0 ? ` ${args}` : ""}`;
};
