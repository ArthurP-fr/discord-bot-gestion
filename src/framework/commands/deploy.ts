import { REST, Routes } from "discord.js";

import { buildSlashPayload } from "./slashBuilder.js";
import type { CommandRegistry } from "./registry.js";
import type { I18nService } from "../i18n/I18nService.js";

export interface DeployCommandsOptions {
  token: string;
  clientId: string;
  guildId?: string;
  registry: CommandRegistry;
  i18n: I18nService;
}

export interface DeployCommandsResult {
  scope: "guild" | "global";
  count: number;
}

export const deployApplicationCommands = async (options: DeployCommandsOptions): Promise<DeployCommandsResult> => {
  const body = buildSlashPayload(options.registry.getAll(), options.i18n);
  const rest = new REST({ version: "10" }).setToken(options.token);

  if (options.guildId) {
    await rest.put(Routes.applicationGuildCommands(options.clientId, options.guildId), { body });
    return { scope: "guild", count: body.length };
  }

  await rest.put(Routes.applicationCommands(options.clientId), { body });
  return { scope: "global", count: body.length };
};
