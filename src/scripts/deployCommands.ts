import { commandList } from "../commands/index.js";
import { deployApplicationCommands } from "../framework/commands/deploy.js";
import { CommandRegistry } from "../framework/commands/registry.js";
import { env } from "../framework/config/env.js";
import { I18nService } from "../framework/i18n/I18nService.js";

const main = async (): Promise<void> => {
  const i18n = new I18nService(env.DEFAULT_LANG);
  const registry = new CommandRegistry(commandList, i18n);

  const result = await deployApplicationCommands({
    token: env.DISCORD_TOKEN,
    clientId: env.DISCORD_CLIENT_ID,
    registry,
    i18n,
    ...(env.DEV_GUILD_ID ? { guildId: env.DEV_GUILD_ID } : {}),
  });

  console.log(`[deploy] ${result.count} commands deployed (${result.scope})`);
};

main().catch((error) => {
  console.error("[deploy] failed", error);
  process.exitCode = 1;
});
