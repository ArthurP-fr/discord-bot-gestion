# Structure du projet

Objectif
--------
Décrire l'organisation recommandée du dépôt et les conventions à suivre.

Organisation proposée
---------------------

- `package.json`, `tsconfig.json`, `README.md`, `Dockerfile`, `docker-compose.yml` — fichiers racine et scripts.
- `dist/` — sortie build (doit être ignoré par git).
- `locales/` — fichiers de traduction (`en.json`, `es.json`, `fr.json`).
- `STRUCTURE.md` — ce fichier : documentation structure/conventions.

Arborescence `src/` (principale)
--------------------------------

- `src/index.ts` — point d'entrée, boot du bot (initialisation, appel des enregistreurs d'événements).
- `src/commands/` — définitions de commandes (meta, args, examples, `execute`). Les commandes doivent rester minces et déléguer la logique lourde.
  - `core/` — commandes fondamentales (ex: `help`).
  - `fun/` — petites commandes stateless (ex: `kiss`).
  - `utility/` — commandes qui orchestrent des services (ex: `presence`, `welcome`, `goodbye`).
- `src/events/` — fonctions d'enregistrement d'événements Discord (ex: `registerMemberMessageEvents`). Favoriser des fonctions `registerX(client, i18n)` simples.
- `src/framework/` — bibliothèque interne, responsables techniques réutilisables :
  - `commands/` — helpers pour définir/parse/registry des commandes (`defineCommand`, `usage`, etc.).
  - `i18n/` — `I18nService` et ressources locales.
  - `memberMessages/` — `panel.ts` (UI/panels), `sender.ts`, `store.ts`, `types.ts` (extraction recommandée depuis `commands/utility/memberMessagePanel.ts`).
  - `presence/` — `manager.ts` (timers, rotation, apply/save), `store.ts`, `templateVariables.ts` (extraction recommandée depuis `commands/utility/presence.ts`).
  - `execution/`, `handlers/`, `config/`, `types/` — autres utilitaires et adaptateurs.
- `src/utils/` — helpers orthogonaux (ex: `templateVariables.ts`).
- `src/scripts/` — scripts réutilisables (ex: `deployCommands.ts`).

- `tests/` — tests unitaires; organiser pour refléter la logique testée (stores, managers, utils).

Conventions et règles simples
----------------------------

- Commandes : `defineCommand({...})` doit exposer uniquement la configuration + un `execute` qui fait appel à des services/managers. Eviter grosses fonctions de logique métier dans les fichiers de commandes.
- Services / managers : code testable, découplé de Discord.js; n'exposer que des fonctions pures ou des adaptateurs (injections de `client` uniquement dans l'adaptateur).
- UI / panels : centraliser sous `framework/memberMessages` et exposer des factories (ex: `createMemberMessageExecute(kind)` reste en commande mais la UI est extraite).
- Events : chaque fichier exporte une fonction `registerX(client, i18n)` ; centraliser l'appel dans `src/events/index.ts`.
- Tests : cibler les managers et stores en priorité; mocks/fixtures pour les adaptateurs Discord.

Plan de migration (prioritaire)
------------------------------
1. Extraire `memberMessagePanel.ts` → `src/framework/memberMessages/panel.ts` et mettre à jour `welcome.ts`/`goodbye.ts` pour utiliser l'API extraite. (À FAIRE)
2. Extraire la logique `presence` (timers, rotation, apply) → `src/framework/presence/manager.ts`, laisser `presence` command comme wrapper léger. (À FAIRE)
3. Scinder les événements et centraliser dans `src/events/` — un fichier par événement + `src/events/index.ts`. (FAIT)
4. Documenter les conventions (ce fichier) et ouvrir PRs petites et ciblées. (PARTIELLEMENT FAIT)

Modifications récentes appliquées
--------------------------------

- Scission de `src/events/` en fichiers par événement :
  - `messageCreate.ts`, `interactionCreate.ts`, `guildMemberAdd.ts`, `guildMemberRemove.ts`, `guildCreate.ts`, `guildDelete.ts`, `ready.ts`.
  - `src/events/index.ts` centralise l'enregistrement via `registerEvents(client, i18n, handlers, registry)`.
- `ready` : la logique de restauration de présence et de déploiement des slash commands a été déplacée de `src/index.ts` vers `src/events/ready.ts`.
- Signatures des handlers mises à jour pour être fortement typées : `onPrefixMessage(message: Message)` et `onSlashInteraction(interaction: ChatInputCommandInteraction)`.
- Documentation (JSDoc / commentaires) ajoutée dans plusieurs fichiers de `src/commands/` et `src/events/`.

Conventions actualisées
----------------------

- Un fichier par événement Discord, nommé exactement comme l'événement (ex: `guildMemberAdd.ts`).
- `src/events/index.ts` expose `registerEvents(...)` qui reçoit :
  - `client`, `i18n`, `handlers` ({ `onPrefixMessage`, `onSlashInteraction` }) et `registry`.
- Les commandes restent des wrappers légers : configuration + `execute()` qui délègue aux services/managers dans `src/framework/`.

Prochaines étapes recommandées
------------------------------

- Extraire `memberMessagePanel.ts` vers `src/framework/memberMessages/panel.ts` (priorité haute).
- Extraire la logique `presence` (timers, rotation) vers `src/framework/presence/manager.ts`.
- Ajouter un petit `README.md` de démarrage (build & run) et tenir ce fichier `STRUCTURE.md` à jour après chaque PR.
- Lancer `npm run build` et les tests pour valider les changements et corriger les erreurs de typage éventuelles.

Comment travailler ensemble
-------------------------

- Proposez ici les modifications souhaitées (renommage, dossiers additionnels, conventions strictes). Je peux appliquer chaque changement en petites PRs (déplacement de fichiers + correction d'import).
- Pour chaque modification, indiquer l'objectif et le résultat attendu. Je ferai les edits et lancerai les tests/build.

Historique
---------

- Créé le 12 avril 2026 — version initiale.
