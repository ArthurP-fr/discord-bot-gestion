import type { ChatInputCommandInteraction } from "discord.js";

import { parseSlashArgs } from "../commands/argParser.js";
import { buildSlashUsage } from "../commands/usage.js";
import type { CommandRegistry } from "../commands/registry.js";
import { CommandExecutor } from "../execution/CommandExecutor.js";
import type { I18nService } from "../i18n/I18nService.js";
import type { ReplyPayload, SupportedLang } from "../types/command.js";

interface SlashHandlerDeps {
  registry: CommandRegistry;
  i18n: I18nService;
  executor: CommandExecutor;
  prefix: string;
  defaultLang: SupportedLang;
}

const resolveReply = async (interaction: ChatInputCommandInteraction, payload: ReplyPayload): Promise<unknown> => {
  if (typeof payload === "string") {
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ content: payload });
    }

    return interaction.reply({ content: payload });
  }

  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(payload as never);
  }

  return interaction.reply(payload as never);
};

export const createSlashHandler = (deps: SlashHandlerDeps) => {
  return async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const command = deps.registry.findBySlashTrigger(interaction.commandName);
    if (!command) {
      return;
    }

    const lang = deps.i18n.resolveLang(interaction.locale ?? interaction.guildLocale);
    const t = (key: string, vars?: Record<string, string | number | boolean | null | undefined>): string =>
      deps.i18n.t(lang, key, vars);

    const parsed = parseSlashArgs(interaction, command.args);
    if (parsed.errors.length > 0) {
      const firstError = parsed.errors[0];
      if (!firstError) {
        return;
      }

      const usage = buildSlashUsage(command, lang, deps.i18n);
      await resolveReply(interaction, {
        content: t(firstError.key, { ...(firstError.vars ?? {}), usage }),
        ephemeral: true,
      });
      return;
    }

    const ct = (relativeKey: string, vars?: Record<string, string | number | boolean | null | undefined>): string =>
      deps.i18n.commandT(lang, command.meta.name, relativeKey, vars);

    await deps.executor.run(command, {
      client: interaction.client,
      user: interaction.user,
      guild: interaction.guild,
      channel: interaction.channel,
      lang,
      args: parsed.values,
      command,
      source: "slash",
      t,
      ct,
      commandText: deps.i18n.commandObject(lang, command.meta.name),
      format: (template, vars) => deps.i18n.format(template, vars),
      i18n: deps.i18n,
      raw: interaction,
      reply: (payload: ReplyPayload) => resolveReply(interaction, payload),
      registry: deps.registry,
      prefix: deps.prefix,
      defaultLang: deps.defaultLang,
    });
  };
};
