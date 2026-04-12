import type { InteractionReplyOptions, Message, MessageReplyOptions } from "discord.js";

import { parsePrefixArgs } from "../commands/argParser.js";
import { buildPrefixUsage } from "../commands/usage.js";
import type { CommandRegistry } from "../commands/registry.js";
import { CommandExecutor } from "../execution/CommandExecutor.js";
import type { I18nService } from "../i18n/I18nService.js";
import type { ReplyPayload, SupportedLang } from "../types/command.js";

interface PrefixHandlerDeps {
  registry: CommandRegistry;
  i18n: I18nService;
  executor: CommandExecutor;
  prefix: string;
  defaultLang: SupportedLang;
}

const toMessageReplyOptions = (payload: Exclude<ReplyPayload, string>): MessageReplyOptions => {
  const {
    ephemeral: _ephemeral,
    fetchReply: _fetchReply,
    withResponse: _withResponse,
    flags: _flags,
    ...rest
  } = payload as InteractionReplyOptions & MessageReplyOptions;

  return rest as MessageReplyOptions;
};

export const createPrefixHandler = (deps: PrefixHandlerDeps) => {
  return async (message: Message): Promise<void> => {
    if (message.author.bot || !message.content.startsWith(deps.prefix)) {
      return;
    }

    const content = message.content.slice(deps.prefix.length).trim();
    if (!content) {
      return;
    }

    const firstSpaceIndex = content.indexOf(" ");
    const trigger = (firstSpaceIndex === -1 ? content : content.slice(0, firstSpaceIndex)).toLowerCase();
    const rawArgs = firstSpaceIndex === -1 ? "" : content.slice(firstSpaceIndex + 1);

    const match = deps.registry.findByAnyPrefixTrigger(trigger);
    if (!match) {
      return;
    }

    const command = match.command;
    const lang = match.lang;
    const t = (key: string, vars?: Record<string, string | number | boolean | null | undefined>): string =>
      deps.i18n.t(lang, key, vars);

    const parsed = await parsePrefixArgs(message, command.args, rawArgs);
    if (parsed.errors.length > 0) {
      const firstError = parsed.errors[0];
      if (!firstError) {
        return;
      }

      const usage = buildPrefixUsage(command, deps.prefix, lang, deps.defaultLang, deps.i18n);
      await message.reply(t(firstError.key, { ...(firstError.vars ?? {}), usage }));
      return;
    }

    const ct = (relativeKey: string, vars?: Record<string, string | number | boolean | null | undefined>): string =>
      deps.i18n.commandT(lang, command.meta.name, relativeKey, vars);

    await deps.executor.run(command, {
      client: message.client,
      user: message.author,
      guild: message.guild,
      channel: message.channel,
      lang,
      args: parsed.values,
      command,
      source: "prefix",
      t,
      ct,
      commandText: deps.i18n.commandObject(lang, command.meta.name),
      format: (template, vars) => deps.i18n.format(template, vars),
      i18n: deps.i18n,
      raw: message,
      reply: (payload: ReplyPayload) =>
        typeof payload === "string"
          ? message.reply(payload)
          : message.reply(toMessageReplyOptions(payload)),
      registry: deps.registry,
      prefix: deps.prefix,
      defaultLang: deps.defaultLang,
    });
  };
};
