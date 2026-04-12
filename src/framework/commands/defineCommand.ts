import type { BotCommand, BotCommandInput } from "../types/command.js";

export const defineCommand = (input: BotCommandInput): BotCommand => {
  // Discord requires all required slash options before any optional ones.
  const normalizedArgs = [...(input.args ?? [])].sort((a, b) => {
    if (a.required === b.required) {
      return 0;
    }

    return a.required ? -1 : 1;
  });

  return {
    meta: input.meta,
    args: normalizedArgs,
    permissions: input.permissions ?? [],
    examples: input.examples ?? [],
    execute: input.execute,
  };
};
