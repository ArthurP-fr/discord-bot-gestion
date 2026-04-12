import type { BotCommand, BotCommandInput } from "../types/command.js";

const assertRequiredArgsBeforeOptional = (input: BotCommandInput): void => {
  const args = input.args ?? [];
  let firstOptionalArgName: string | null = null;

  for (const arg of args) {
    if (!arg.required) {
      firstOptionalArgName ??= arg.name;
      continue;
    }

    if (firstOptionalArgName) {
      throw new Error(
        `Invalid argument order for command "${input.meta.name}": required argument "${arg.name}" cannot appear after optional argument "${firstOptionalArgName}". Declare all required arguments before optional ones.`,
      );
    }
  }
};

const normalizeCooldown = (input: BotCommandInput): number | undefined => {
  if (input.cooldown === undefined) {
    return undefined;
  }

  if (!Number.isFinite(input.cooldown) || input.cooldown <= 0) {
    throw new Error(
      `Invalid cooldown for command "${input.meta.name}": expected a positive number of seconds, received "${input.cooldown}".`,
    );
  }

  return input.cooldown;
};

export const defineCommand = (input: BotCommandInput): BotCommand => {
  assertRequiredArgsBeforeOptional(input);
  const cooldown = normalizeCooldown(input);

  return {
    meta: input.meta,
    args: [...(input.args ?? [])],
    permissions: input.permissions ?? [],
    examples: input.examples ?? [],
    ...(cooldown !== undefined ? { cooldown } : {}),
    execute: input.execute,
  };
};
