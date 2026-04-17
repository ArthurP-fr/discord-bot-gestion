import type { BotCommand, BotCommandInput } from "../../types/command.js";

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

const resolveSensitive = (input: BotCommandInput, permissions: readonly unknown[]): boolean => {
  if (input.sensitive === true && permissions.length === 0) {
    throw new Error(
      `Invalid security config for command "${input.meta.name}": sensitive commands must declare at least one required permission.`,
    );
  }

  if (input.sensitive !== undefined) {
    return input.sensitive;
  }

  return permissions.length > 0;
};

export const defineCommand = (input: BotCommandInput): BotCommand => {
  assertRequiredArgsBeforeOptional(input);
  const cooldown = normalizeCooldown(input);
  const permissions = [...(input.permissions ?? [])];
  const sensitive = resolveSensitive(input, permissions);

  return {
    meta: input.meta,
    args: [...(input.args ?? [])],
    permissions,
    sensitive,
    examples: input.examples ?? [],
    ...(cooldown !== undefined ? { cooldown } : {}),
    execute: input.execute,
  };
};
