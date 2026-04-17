import type {
  CommandExecutionContext,
  ExecutionContext,
  I18nContext,
  SupportedLang,
  TransportContext,
  TranslationVars,
} from "../types/command.js";
import type { BuildExecutionContextInput, HandlerExecutionDeps } from "../types/handlers.js";
import type { I18nService } from "../i18n/index.js";
import { createDiscordMemberPermissionsResolver } from "./discordPermissionResolver.js";

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

  const execution: ExecutionContext = {
    requestId: input.requestId,
    receivedAt: Date.now(),
    source: input.source,
    commandName: input.command.meta.name,
    commandCategory: input.command.meta.category,
    args: input.args,
    actor: {
      userId: input.user.id,
      guildId: input.guild?.id ?? null,
      channelId: input.channel?.id ?? null,
    },
  };

  const transport: TransportContext = {
    kind: "discord",
    client: input.client,
    user: input.user,
    guild: input.guild,
    channel: input.channel,
    raw: input.raw,
    reply: input.reply,
    resolveMemberPermissions: createDiscordMemberPermissionsResolver(input),
  };

  const i18nContext: I18nContext = {
    lang: input.lang,
    t,
    ct,
    commandText: deps.i18n.commandObject(input.lang, input.command.meta.name),
    format: (template, vars) => deps.i18n.format(template, vars),
    i18n: deps.i18n,
    registry: deps.registry,
    prefix: deps.prefix,
    defaultLang: deps.defaultLang,
  };

  return {
    execution,
    transport,
    i18nContext,

    client: transport.client,
    user: transport.user,
    guild: transport.guild,
    channel: transport.channel,
    lang: i18nContext.lang,
    args: execution.args,
    command: input.command,
    source: execution.source,
    t: i18nContext.t,
    ct: i18nContext.ct,
    commandText: i18nContext.commandText,
    format: i18nContext.format,
    i18n: i18nContext.i18n,
    raw: transport.raw,
    reply: transport.reply,
    registry: i18nContext.registry,
    prefix: i18nContext.prefix,
    defaultLang: i18nContext.defaultLang,
  };
};