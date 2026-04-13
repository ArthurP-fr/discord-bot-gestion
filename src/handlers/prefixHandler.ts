import type { Message } from "discord.js";
import type { BotCommand, SupportedLang } from "../types/command.js";
import type { PrefixHandlerDeps } from "../types/handlers.js";

import { parsePrefixArgs } from "../core/commands/argParser.js";
import { buildPrefixUsage } from "../core/commands/usage.js";
import {
  buildCommandExecutionContext,
  createTranslator,
} from "./commandExecutionContext.js";
import { createPrefixReply } from "./replyAdapter.js";

const resolvePrefixLang = (
  deps: PrefixHandlerDeps,
  command: BotCommand,
  trigger: string,
  fallbackLang: SupportedLang,
  guildPreferredLocale?: string | null,
): SupportedLang => {

  const contextualLang = deps.i18n.resolveLang(guildPreferredLocale);
  const contextualTrigger = deps.i18n.commandTrigger(contextualLang, command.meta.name);

  if (contextualTrigger === trigger) {
    return contextualLang;
  }

  return fallbackLang;
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

    const reply = createPrefixReply(message);

    const command = match.command;
    const lang = resolvePrefixLang(deps, command, trigger, match.lang, message.guild?.preferredLocale ?? null);
    const t = createTranslator(deps.i18n, lang);

    const parsed = await parsePrefixArgs(message, command.args, rawArgs);
    if (parsed.errors.length > 0) {
      const firstError = parsed.errors[0];
      if (!firstError) {
        return;
      }

      const usage = buildPrefixUsage(command, deps.prefix, lang, deps.defaultLang, deps.i18n);
      await reply(t(firstError.key, { ...(firstError.vars ?? {}), usage }));
      return;
    }

    await deps.executor.run(
      command,
      buildCommandExecutionContext(deps, {
        command,
        source: "prefix",
        lang,
        args: parsed.values,
        client: message.client,
        user: message.author,
        guild: message.guild,
        channel: message.channel,
        raw: message,
        reply,
      }),
    );
  };
};
