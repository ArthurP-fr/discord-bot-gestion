import { defineCommand } from "../../core/commands/defineCommand.js";
import {
  createCommandDetailsEmbed,
  createGlobalHelpEmbed,
  resolveCommandFromQuery,
} from "./service.js";

export const helpCommand = defineCommand({
  meta: {
    name: "help",
    category: "core",
  },
  args: [
    {
      name: "command",
      type: "string",
      required: false,
      descriptionKey: "args.command",
    },
  ],
  examples: [
    {
      descriptionKey: "examples.basic",
    },
    {
      args: "<command>",
      descriptionKey: "examples.single",
    },
  ],
  execute: async (ctx) => {
    const queryArg = ctx.args.command;

    if (typeof queryArg === "string" && queryArg.trim().length > 0) {
      const command = resolveCommandFromQuery(ctx, queryArg.trim());
      if (!command) {
        await ctx.reply(ctx.ct("errors.notFound", { query: queryArg }));
        return;
      }

      await ctx.reply({ embeds: [createCommandDetailsEmbed(ctx, command)] });
      return;
    }

    await ctx.reply({ embeds: [createGlobalHelpEmbed(ctx, helpCommand)] });
  },
});
