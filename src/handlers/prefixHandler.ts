import { randomUUID } from "node:crypto";

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

const PREFIX_PRE_PARSE_THROTTLE_MS = 300;
const PREFIX_PRE_PARSE_THROTTLE_SWEEP_INTERVAL_MS = 60_000;
const PREFIX_PRE_PARSE_THROTTLE_MAX_AGE_MS = 5 * 60_000;

const prefixPreParseThrottle = new Map<string, number>();
let prefixPreParseThrottleLastSweepAt = 0;

const shouldThrottlePrefixPreParse = (userId: string): boolean => {
  const now = Date.now();
  const lastSeenAt = prefixPreParseThrottle.get(userId);

  if (lastSeenAt !== undefined && now - lastSeenAt < PREFIX_PRE_PARSE_THROTTLE_MS) {
    return true;
  }

  prefixPreParseThrottle.set(userId, now);

  if (now - prefixPreParseThrottleLastSweepAt >= PREFIX_PRE_PARSE_THROTTLE_SWEEP_INTERVAL_MS) {
    for (const [trackedUserId, trackedAt] of prefixPreParseThrottle.entries()) {
      if (now - trackedAt >= PREFIX_PRE_PARSE_THROTTLE_MAX_AGE_MS) {
        prefixPreParseThrottle.delete(trackedUserId);
      }
    }

    prefixPreParseThrottleLastSweepAt = now;
  }

  return false;
};

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

    if (shouldThrottlePrefixPreParse(message.author.id)) {
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

    await deps.dispatcher.dispatch(
      command,
      buildCommandExecutionContext(deps, {
        requestId: randomUUID(),
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
