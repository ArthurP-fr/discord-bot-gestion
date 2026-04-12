import { MessageFlags } from "discord.js";
import { defineCommand } from "../../framework/commands/defineCommand.js";

export const pingCommand = defineCommand({
  meta: {
    name: "ping",
    category: "utility",
  },
  examples: [
    {
      descriptionKey: "examples.basic",
    },
  ],
  execute: async (ctx) => {
    const responses = (ctx.commandText.responses as Record<string, unknown> | undefined) ?? {};
    const template = typeof responses.pong === "string" ? responses.pong : "Pong {{latency}}ms";

    await ctx.reply({
      content: ctx.format(template, {
        latency: ctx.client.ws.ping,
      }),
      flags: [MessageFlags.Ephemeral],
    });
  },
});
