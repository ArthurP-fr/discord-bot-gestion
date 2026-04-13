/**
 * Commande `kiss` (fun)
 *
 * Envoie une réponse de type `kissing` ciblant un utilisateur mentionné.
 * Utilise un seul argument `user` de type `user`.
 */
import { defineCommand } from "../core/commands/defineCommand.js";

/** Commande `kiss` — envoie un message de type `kiss` vers la cible. */
export const kissCommand = defineCommand({
  meta: {
    name: "kiss",
    category: "fun",
  },
  args: [
    {
      name: "user",
      type: "user",
      required: true,
      descriptionKey: "args.user",
    },
  ],
  examples: [
    {
      args: "@Arthur",
      descriptionKey: "examples.basic",
    },
  ],
  execute: async (ctx) => {
    const target = ctx.args.user;
    if (!target || typeof target !== "object" || !("id" in target)) {
      await ctx.reply(ctx.t("errors.args.invalidUser", { value: String(target) }));
      return;
    }

    await ctx.reply(
      ctx.ct("responses.success", {
        from: `<@${ctx.user.id}>`,
        to: `<@${target.id}>`,
      }),
    );
  },
});
