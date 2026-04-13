import { REST, Routes } from "discord.js";

import { buildSlashPayload } from "./slashBuilder.js";
import type { DeployCommandsOptions, DeployCommandsResult } from "../../types/deploy.js";

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
