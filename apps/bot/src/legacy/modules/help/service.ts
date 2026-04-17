import { EmbedBuilder } from "discord.js";

import {
  buildPrefixUsage,
  buildSlashUsage,
  resolvePrefixTrigger,
  resolveSlashName,
} from "../../core/commands/usage.js";
import type { BotCommand, CommandExecutionContext } from "../../types/command.js";

const categoryName = (command: BotCommand): string => command.meta.category;

const commandDescription = (ctx: CommandExecutionContext, command: BotCommand): string =>
  ctx.i18n.commandT(ctx.lang, command.meta.name, "description");

export const resolveCommandFromQuery = (
  ctx: CommandExecutionContext,
  query: string,
): BotCommand | undefined => {
  const normalized = query.toLowerCase();
  const byName = ctx.registry.findByName(normalized);
  if (byName) {
    return byName;
  }

  return ctx.registry.findByAnyPrefixTrigger(normalized)?.command;
};

export const createGlobalHelpEmbed = (
  ctx: CommandExecutionContext,
  helpCommand: BotCommand,
): EmbedBuilder => {
  const commands = [...ctx.registry.getAll()];
  const grouped = new Map<string, BotCommand[]>();

  for (const command of commands) {
    const key = categoryName(command);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(command);
  }

  const helpUsage = buildPrefixUsage(helpCommand, ctx.prefix, ctx.lang, ctx.defaultLang, ctx.i18n);

  const embed = new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle(ctx.ct("embed.title"))
    .setDescription(ctx.ct("embed.description", { prefix: ctx.prefix, usage: `${helpUsage} <command>` }));

  for (const [category, categoryCommands] of grouped.entries()) {
    const lines = categoryCommands
      .map((command) => {
        const slashLabel = `/${resolveSlashName(command, ctx.lang, ctx.i18n)}`;
        const prefixLabel = `${ctx.prefix}${resolvePrefixTrigger(command, ctx.lang, ctx.defaultLang, ctx.i18n)}`;
        return `${slashLabel} | ${prefixLabel} - ${commandDescription(ctx, command)}`;
      })
      .join("\n");

    embed.addFields({
      name: ctx.t(`categories.${category}`),
      value: lines.length > 0 ? lines : ctx.ct("embed.categoryEmpty"),
    });
  }

  return embed;
};

export const createCommandDetailsEmbed = (
  ctx: CommandExecutionContext,
  command: BotCommand,
): EmbedBuilder => {
  const usagePrefix = buildPrefixUsage(command, ctx.prefix, ctx.lang, ctx.defaultLang, ctx.i18n);
  const usageSlash = buildSlashUsage(command, ctx.lang, ctx.i18n);
  const prefixTrigger = resolvePrefixTrigger(command, ctx.lang, ctx.defaultLang, ctx.i18n);
  const slashTrigger = resolveSlashName(command, ctx.lang, ctx.i18n);
  const localizedCommandName = ctx.i18n.commandName(ctx.lang, command.meta.name);

  const args = command.args.length === 0
    ? ctx.ct("labels.noArgs")
    : command.args
        .map((arg) => {
          const description = ctx.i18n.commandT(ctx.lang, command.meta.name, arg.descriptionKey);
          const requirement = arg.required ? ctx.ct("labels.required") : ctx.ct("labels.optional");
          return `- ${arg.name} (${arg.type}, ${requirement}): ${description}`;
        })
        .join("\n");

  const examples = command.examples.length === 0
    ? ctx.ct("labels.noExamples")
    : command.examples
        .map((example) => {
          const source = example.source ?? "prefix";
          const baseUsage = source === "slash"
            ? buildSlashUsage(command, ctx.lang, ctx.i18n)
            : buildPrefixUsage(command, ctx.prefix, ctx.lang, ctx.defaultLang, ctx.i18n);

          const baseCommand = source === "slash"
            ? `/${slashTrigger}`
            : `${ctx.prefix}${prefixTrigger}`;

          const input = example.args ? `${baseCommand} ${example.args}` : baseUsage;
          const description = ctx.i18n.commandT(ctx.lang, command.meta.name, example.descriptionKey);
          return `- ${input}: ${description}`;
        })
        .join("\n");

  return new EmbedBuilder()
    .setColor(0x2f855a)
    .setTitle(ctx.ct("embed.detailsTitle", { name: localizedCommandName }))
    .setDescription(ctx.ct("embed.detailsDescription", { description: commandDescription(ctx, command) }))
    .addFields(
      {
        name: ctx.ct("embed.fields.usage"),
        value: `${ctx.ct("labels.prefix")}: ${usagePrefix}\n${ctx.ct("labels.slash")}: ${usageSlash}`,
      },
      {
        name: ctx.ct("embed.fields.arguments"),
        value: args,
      },
      {
        name: ctx.ct("embed.fields.examples"),
        value: examples,
      },
    )
    .setFooter({ text: ctx.ct("embed.footer", { source: command.meta.category }) });
};
