import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { SlashHandlerDeps } from "../types/handlers.js";

import { parseSlashArgs } from "../core/commands/argParser.js";
import { buildSlashUsage } from "../core/commands/usage.js";
import {
  buildCommandExecutionContext,
  createTranslator,
} from "./commandExecutionContext.js";
import { createSlashReply } from "./replyAdapter.js";

export const createSlashHandler = (deps: SlashHandlerDeps) => {
  return async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const command = deps.registry.findBySlashTrigger(interaction.commandName);
    if (!command) {
      return;
    }

    const lang = deps.i18n.resolveLang(interaction.locale ?? interaction.guildLocale);
    const reply = createSlashReply(interaction);
    const t = createTranslator(deps.i18n, lang);

    const parsed = parseSlashArgs(interaction, command.args);
    if (parsed.errors.length > 0) {
      const firstError = parsed.errors[0];
      if (!firstError) {
        return;
      }

      const usage = buildSlashUsage(command, lang, deps.i18n);
      await reply({
        content: t(firstError.key, { ...(firstError.vars ?? {}), usage }),
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await deps.executor.run(
      command,
      buildCommandExecutionContext(deps, {
        command,
        source: "slash",
        lang,
        args: parsed.values,
        client: interaction.client,
        user: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel,
        raw: interaction,
        reply,
      }),
    );
  };
};
