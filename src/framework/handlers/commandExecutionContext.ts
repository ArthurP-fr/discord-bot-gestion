import type { CommandRegistry } from "../commands/registry.js";
import type { I18nService } from "../../i18n/index.js";
import type {
  BotCommand,
  CommandExecutionContext,
  CommandSource,
  SupportedLang,
  TranslationVars,
} from "../types/command.js";

export interface HandlerExecutionDeps {
  registry: CommandRegistry;
  i18n: I18nService;
  prefix: string;
  defaultLang: SupportedLang;
}

interface BuildExecutionContextInput {
  command: BotCommand;
  source: CommandSource;
  lang: SupportedLang;
  args: CommandExecutionContext["args"];
  client: CommandExecutionContext["client"];
  user: CommandExecutionContext["user"];
  guild: CommandExecutionContext["guild"];
  channel: CommandExecutionContext["channel"];
  raw: CommandExecutionContext["raw"];
  reply: CommandExecutionContext["reply"];
}

export const createTranslator = (
  i18n: I18nService,
  lang: SupportedLang,
): ((key: string, vars?: TranslationVars) => string) => {
  return (key: string, vars?: TranslationVars): string => i18n.t(lang, key, vars);
};

export const buildCommandExecutionContext = (
  deps: HandlerExecutionDeps,
  input: BuildExecutionContextInput,
): CommandExecutionContext => {
  const t = createTranslator(deps.i18n, input.lang);
  const ct = (relativeKey: string, vars?: TranslationVars): string =>
    deps.i18n.commandT(input.lang, input.command.meta.name, relativeKey, vars);

  return {
    client: input.client,
    user: input.user,
    guild: input.guild,
    channel: input.channel,
    lang: input.lang,
    args: input.args,
    command: input.command,
    source: input.source,
    t,
    ct,
    commandText: deps.i18n.commandObject(input.lang, input.command.meta.name),
    format: (template, vars) => deps.i18n.format(template, vars),
    i18n: deps.i18n,
    raw: input.raw,
    reply: input.reply,
    registry: deps.registry,
    prefix: deps.prefix,
    defaultLang: deps.defaultLang,
  };
};