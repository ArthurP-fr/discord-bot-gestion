# AGENT.md - Guide du projet template_discordjs

Version: 1.0

But
---
Ce fichier décrit le projet, sa structure, les conventions de code et la procédure recommandée pour ajouter de nouvelles fonctionnalités (commandes, événements, services). Il sert de référence pour les contributeurs et pour les agents automatisés qui travaillent sur le dépôt.

Vue d'ensemble du projet
-----------------------
- Tech stack: TypeScript + Discord.js (bot template). Le code source est dans `src/` et la sortie build dans `build/` (à ignorer).
- Localisation: `src/i18n/` contient `en.json`, `fr.json`, `es.json`.

Organisation des fichiers
------------------------
- Racine:
  - `package.json`, `tsconfig.json`, `Dockerfile`, `docker-compose.yml` — scripts et infra.
- `src/` (code TypeScript):
  - `index.ts` — point d'entrée, boot du bot.
  - `commands/` — définitions de commandes (chaque fichier expose une commande). 
  - `events/` — un fichier par événement Discord (ex: `guildMemberAdd.ts`). `src/events/index.ts` centralise l'enregistrement.
  - `framework/` — bibliothèque interne: helpers commandes, `i18n/`, `memberMessages/`, `presence/`, `execution/`, `handlers/`, `config/`, `types/`.
  - `utils/` — helpers génériques (ex: `templateVariables.ts`).
- `tests/` — tests unitaires ciblant managers, stores et utilitaires.

Principes et conventions de code
-------------------------------
- Commands: chaque commande doit être définie avec `defineCommand({...})` et exposer uniquement la configuration + une fonction `execute()` très mince qui délègue la logique métier à un service/manager.
- Services / Managers: placer la logique métier testable dans `src/framework/*`. Ces modules doivent être découplés de Discord.js — recevoir des adaptateurs ou des interfaces plutôt que des objets Discord directement.
- Events: un seul fichier par événement; exporter une fonction `registerX(client, i18n)` ou une fonction d'enregistrement équivalente. Centraliser les imports dans `src/events/index.ts`.
- Typage: utiliser TypeScript strict, signatures fortement typées pour les handlers (`onPrefixMessage(message: Message)` etc.).
- Tests: privilégier les tests unitaires pour managers/stores/transformations. Mockez les adaptateurs Discord.
- i18n: utiliser `I18nService` pour traductions. Ajouter toutes les clés dans `src/i18n/*.json`.
- Nommage: fichiers en lowerCamelCase (ex: `welcome.ts`, `memberMessagePanel.ts`). Exports nommés préférés pour faciliter le mocking.
- Sécurité: ne pas committer de secrets (`.env*` doit être dans `.gitignore`).

Procédure standard pour ajouter une nouvelle commande
----------------------------------------------------
1. Créer le fichier dans `src/commands/myCommand.ts`.
2. Utiliser `defineCommand({ meta, args, examples, execute })` pour déclarer la commande.
3. Implémenter `execute()` de façon minimale: valider les args et appeler un service dans `src/framework/` si la logique est non triviale.
4. Ajouter les clés de traduction dans `src/i18n/en.json`, `src/i18n/fr.json`, `src/i18n/es.json` (ex: `commands.myCommand.success`).
5. Écrire des tests unitaires dans `tests/` pour le service/manager; si la commande est juste un wrapper, testez le service.
6. Si c'est une slash command, vérifier que le registre inclut la commande; redémarrer le bot avec `AUTO_DEPLOY_SLASH=true` si synchronisation nécessaire.
7. Lancer `npm run build` puis `npm test` (ou la suite de scripts définie dans `package.json`).
8. Ouvrir une PR documentant le changement et incluant les tests et les traductions.

Procédure standard pour ajouter un nouvel événement
--------------------------------------------------
1. Créer `src/events/<eventName>.ts` et y exporter `register<EventName>(client, i18n)`.
2. Respecter la signature projet (voir `src/events/index.ts` pour l'exemple d'enregistrement).
3. Mettre la logique testable dans un manager/service et tester cette logique séparément.
4. Ajouter l'import et l'appel d'enregistrement dans `src/events/index.ts`.

Procédure pour ajouter un service/manager dans `framework`
--------------------------------------------------------
1. Créer un dossier `src/framework/<feature>/` contenant `manager.ts`, `store.ts` (si nécessaire), `types.ts` et tests.
2. Interfacez le manager pour qu'il accepte des adaptateurs (ex: `DiscordAdapter`) au lieu d'utiliser directement `client`.
3. Documenter les comportements et écrire des tests unitaires couvrant les cas critiques.

i18n — bonnes pratiques
-----------------------
- Utiliser des clés structurées: `commands.<name>.<key>` ou `presence.<action>`.
- Garder `en.json` comme référence complète; synchroniser les autres langues.

Tests et CI
-----------
- Prioriser les tests sur managers, stores et utilitaires.
- Mocks: extraire les dépendances externes (Discord API) derrière des adaptateurs pour pouvoir les mocker.
- Scripts: utiliser `npm test` et `npm run build` depuis la racine (vérifier `package.json`).

Déploiement / exécution
-----------------------
- Utiliser `Dockerfile` / `docker-compose.yml` fournis pour le déploiement en conteneur.
- Pour les slash commands, activer `AUTO_DEPLOY_SLASH=true` pour une synchronisation automatique au démarrage.

Revue et PR
-----------
- Inclure toujours:
  - modifications de traduction,
  - tests unitaires pour toute logique métier ajoutée,
  - notes de migration si la structure des commandes/events change.

Remarques finales
-----------------
- Ce fichier est la source de vérité pour les agents et contributeurs. Pour toute modification structurelle majeure (réorganisation de dossiers, changement d'API interne), mettez à jour `AGENT.md` et ouvrez une PR dédiée.
