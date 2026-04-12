/**
 * Commande `advanced` (utility)
 *
 * Exemple de commande démontrant la gestion de plusieurs types d'arguments
 * (string, int, user, number, boolean, channel, role) et l'utilisation d'un
 * template de réponse configurable via `commandText.responses.summary`.
 */
import { PermissionFlagsBits } from "discord.js";

import { defineCommand } from "../../framework/commands/defineCommand.js";

const extractId = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || !("id" in value)) {
    return null;
  }

  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
};

const toDisplayValue = (value: unknown, formatter?: (id: string) => string): string => {
  const id = extractId(value);
  if (id && formatter) {
    return formatter(id);
  }

  if (value === undefined || value === null) {
    return "-";
  }

  return String(value);
};

/**
 * Commande `advanced` — affiche un résumé formaté des arguments fournis.
 */
export const advancedCommand = defineCommand({
  meta: {
    name: "advanced",
    category: "utility",
  },
  permissions: [PermissionFlagsBits.ManageMessages],
  args: [
    {
      name: "text",
      type: "string",
      required: true,
      descriptionKey: "args.text",
    },
    {
      name: "count",
      type: "int",
      required: true,
      descriptionKey: "args.count",
    },
    {
      name: "user",
      type: "user",
      required: true,
      descriptionKey: "args.user",
    },
    {
      name: "ratio",
      type: "number",
      required: false,
      descriptionKey: "args.ratio",
    },
    {
      name: "enabled",
      type: "boolean",
      required: false,
      descriptionKey: "args.enabled",
    },
    {
      name: "channel",
      type: "channel",
      required: false,
      descriptionKey: "args.channel",
    },
    {
      name: "role",
      type: "role",
      required: false,
      descriptionKey: "args.role",
    },
  ],
  examples: [
    {
      args: '"hello world" 5 @Arthur 1.5 true #general @Moderators',
      descriptionKey: "examples.full",
    },
    {
      source: "slash",
      descriptionKey: "examples.slash",
    },
  ],
  execute: async (ctx) => {
    const responses = (ctx.commandText.responses as Record<string, unknown> | undefined) ?? {};
    const template = typeof responses.summary === "string"
      ? responses.summary
      : "text={{text}} count={{count}} ratio={{ratio}} enabled={{enabled}} user={{user}} channel={{channel}} role={{role}} source={{source}}";

    await ctx.reply(
      ctx.format(template, {
        text: toDisplayValue(ctx.args.text),
        count: toDisplayValue(ctx.args.count),
        ratio: toDisplayValue(ctx.args.ratio),
        enabled: toDisplayValue(ctx.args.enabled),
        user: toDisplayValue(ctx.args.user, (id) => `<@${id}>`),
        channel: toDisplayValue(ctx.args.channel, (id) => `<#${id}>`),
        role: toDisplayValue(ctx.args.role, (id) => `<@&${id}>`),
        source: ctx.source,
      }),
    );
  },
});
