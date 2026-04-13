/**
 * Entrypoint du bot — bootstrap et configuration runtime.
 *
 * Rôles principaux:
 * - initialiser les stores et ressources (presence, member messages)
 * - configurer le client Discord (intents)
 * - construire i18n, registry et executor
 * - attacher les handlers (prefix/slash) et listeners d'événements
 * - restaurer la présence et (optionnel) déployer les commandes slash
 */
import { Client, GatewayIntentBits } from "discord.js";

import { commandList } from "./commands/index.js";
import { shutdownPresenceRuntime } from "./commands/presence.js";
import { registerEvents } from "./events/index.js";
import { CommandRegistry } from "./framework/commands/registry.js";
import { env } from "./framework/config/env.js";
import { CommandExecutor } from "./framework/execution/CommandExecutor.js";
import { createPrefixHandler } from "./framework/handlers/prefixHandler.js";
import { createSlashHandler } from "./framework/handlers/slashHandler.js";
import { I18nService } from "./i18n/index.js";
import {
  initMemberMessageStore,
  shutdownMemberMessageStore,
} from "./framework/memberMessages/memberMessageStore.js";
import { initPresenceStore, shutdownPresenceStore } from "./framework/presence/presenceStore.js";

/**
 * Attache des handlers pour un arrêt gracieux du process.
 *
 * Actions effectuées lors du shutdown:
 * - arrêt des timers/runtime (présence)
 * - fermeture des stores (member messages / presence)
 * - sortie du process
 */
const bindGracefulShutdown = (): void => {
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[shutdown] ${signal}`);

    // Stoppe les timers et runtime liés à la présence
    shutdownPresenceRuntime();

    // Ferme proprement le store des messages de membre
    await shutdownMemberMessageStore().catch((error) => {
      console.error("[shutdown] member message store close failed", error);
    });

    // Ferme proprement le store de présence
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

/**
 * Sequence d'initialisation principale.
 *
 * Etapes:
 * 1. initialiser les stores (presence, member messages)
 * 2. attacher shutdown handler
 * 3. configurer la gestion d'erreurs process
 * 4. créer le client Discord et les services (i18n, registry, executor)
 * 5. construire les handlers prefix/slash et attacher les listeners
 * 6. enregistrer events métier (member messages)
 * 7. sur ready: restaurer la présence et déployer les slash commands si activé
 */
const bootstrap = async (): Promise<void> => {
  // Initialisation des stores persistants utilisés par le bot
  await initPresenceStore();
  await initMemberMessageStore();

  // Prépare la gestion d'un arrêt gracieux (SIGINT / SIGTERM)
  bindGracefulShutdown();

  // Log des erreurs non catchées pour debugging
  process.on("unhandledRejection", (reason) => {
    console.error("[process] unhandled rejection", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("[process] uncaught exception", error);
  });

  // Création du client Discord avec les intents nécessaires
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Services transverses: i18n, registry des commandes et executor
  const i18n = new I18nService(env.DEFAULT_LANG);
  const registry = new CommandRegistry(commandList, i18n);
  const executor = new CommandExecutor();

  // Création des handlers : ces factories retournent une fonction utilitaire
  // qui prend un Message / Interaction et exécute la logique (parse args, permissions, etc.)
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

  // Enregistre les événements principaux (séparés par fichier)
  // `registerEvents` inclut désormais l'enregistrement du listener `ready`.
  registerEvents(client, i18n, { onPrefixMessage, onSlashInteraction }, registry);

  // Connexion du client au gateway
  await client.login(env.DISCORD_TOKEN);
};

// Démarre la séquence d'initialisation et gère les erreurs fatales
bootstrap().catch(async (error) => {
  console.error("[boot] fatal error", error);

  // Nettoyage partiel en cas d'erreur critique pendant le boot
  shutdownPresenceRuntime();
  await shutdownMemberMessageStore().catch((closeError) => {
    console.error("[boot] failed to close member message store", closeError);
  });
  await shutdownPresenceStore().catch((closeError) => {
    console.error("[boot] failed to close presence store", closeError);
  });
  process.exit(1);
});
