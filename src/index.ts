import { Client, Events, GatewayIntentBits } from "discord.js";

import { commandList } from "./commands/index.js";
import { restorePresenceFromStorage } from "./commands/utility/presence.js";
import { deployApplicationCommands } from "./framework/commands/deploy.js";
import { CommandRegistry } from "./framework/commands/registry.js";
import { env } from "./framework/config/env.js";
import { CommandExecutor } from "./framework/execution/CommandExecutor.js";
import { createPrefixHandler } from "./framework/handlers/prefixHandler.js";
import { createSlashHandler } from "./framework/handlers/slashHandler.js";
import { I18nService } from "./framework/i18n/I18nService.js";
import { initPresenceStore, shutdownPresenceStore } from "./framework/presence/presenceStore.js";

const bindGracefulShutdown = (): void => {
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[shutdown] ${signal}`);
    await shutdownPresenceStore().catch((error) => {
      console.error("[shutdown] presence store close failed", error);
    });
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
};

const bootstrap = async (): Promise<void> => {
  await initPresenceStore();
  bindGracefulShutdown();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  const i18n = new I18nService(env.DEFAULT_LANG);
  const registry = new CommandRegistry(commandList, i18n);
  const executor = new CommandExecutor();

  const onPrefixMessage = createPrefixHandler({
    registry,
    i18n,
    executor,
    prefix: env.PREFIX,
    defaultLang: env.DEFAULT_LANG,
  });

  const onSlashInteraction = createSlashHandler({
    registry,
    i18n,
    executor,
    prefix: env.PREFIX,
    defaultLang: env.DEFAULT_LANG,
  });

  client.on(Events.MessageCreate, onPrefixMessage);

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    await onSlashInteraction(interaction);
  });

  client.once(Events.ClientReady, async () => {
    console.log(`[ready] logged as ${client.user?.tag ?? "unknown"}`);
    try {
      await restorePresenceFromStorage(client);
    } catch (error) {
      console.error("[ready] failed to restore bot presence", error);
    }

    if (env.AUTO_DEPLOY_SLASH) {
      try {
        const result = await deployApplicationCommands({
          token: env.DISCORD_TOKEN,
          clientId: env.DISCORD_CLIENT_ID,
          registry,
          i18n,
          ...(env.DEV_GUILD_ID ? { guildId: env.DEV_GUILD_ID } : {}),
        });
        console.log(`[ready] slash sync done (${result.scope}, ${result.count} commands)`);
      } catch (error) {
        console.error("[ready] slash sync failed", error);
      }
    }
  });

  await client.login(env.DISCORD_TOKEN);
};

bootstrap().catch(async (error) => {
  console.error("[boot] fatal error", error);
  await shutdownPresenceStore().catch((closeError) => {
    console.error("[boot] failed to close presence store", closeError);
  });
  process.exit(1);
});
