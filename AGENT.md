# AGENT.md - Guide SaaS Multi-Tenant

Version: 3.0

But
---
Decrire l'architecture cible du monorepo SaaS pour bot Discord multi-tenant.

Vue d'ensemble
--------------
- Stack backend: Node.js + TypeScript + Express + PostgreSQL + Redis + BullMQ.
- Bot runtime: Discord.js avec gestion dynamique multi-instance.
- Frontend: Next.js App Router.
- Structure: monorepo `apps/*` + `packages/*`.

Organisation des dossiers
-------------------------
- `apps/api/`
  - OAuth2 Discord, JWT cookie, routes multi-tenant, validation token bot, publication jobs BullMQ.
- `apps/bot/`
  - BotManager dynamique (`Map<botId, Client>`), worker de controle (`start/stop/restart`).
- `apps/web/`
  - Dashboard utilisateur (login, liste bots, ajout bot, actions runtime).
- `packages/shared/`
  - Types partages, constantes queue, helpers Redis namespacing, chiffrement token AES-GCM.
- `database/migrations/`
  - SQL versionne (`schema_migrations`) avec schema multi-tenant.

Principes d'architecture
------------------------
- Multi-tenant strict:
  - toutes les requetes de lecture/ecriture passent par `tenant_id`.
  - tables critiques liees a `tenant_id` et/ou `owner_user_id`.
- Pas de secret en clair:
  - token bot chiffre en DB (`token_ciphertext`, `token_iv`, `token_tag`).
- Controle runtime decouple:
  - API publie des jobs, bot manager consomme et execute.
- Separation responsabilites:
  - API: auth + orchestration.
  - Bot: runtime Discord.
  - Web: UX dashboard.

Conventions de code
-------------------
- TypeScript strict.
- Exports nommes.
- Erreurs API explicites et codes HTTP coherents.
- Logs sans fuite de secrets.

Workflow recommande
-------------------
1. Ajouter/adapter migration SQL dans `database/migrations`.
2. Adapter repositories API/Bot avec filtre tenant.
3. Ajouter endpoint API + validation zod.
4. Brancher action queue si runtime impacte.
5. Mettre a jour le dashboard web.
6. Valider `npm run typecheck` puis `docker compose up -d --build`.

Securite
--------
- Ne jamais committer `.env`.
- Garder `TOKEN_ENCRYPTION_KEY` hors depot.
- Appliquer `httpOnly` + `sameSite` sur cookie session.
- Eviter les logs de payloads sensibles (token, secrets).
