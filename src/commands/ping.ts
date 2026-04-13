/**
 * Commande `ping` (utility)
 *
 * Répond avec un message court contenant la latence websocket du bot.
 */
import { MessageFlags } from "discord.js";
import { defineCommand } from "../core/commands/defineCommand.js";

/** Commande `ping` — affiche la latence du bot. */
export const pingCommand = defineCommand({
  meta: {
    name: "ping",
    category: "utility",
  },
  cooldown: 5,
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
