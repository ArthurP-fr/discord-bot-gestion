# Discord Bot SaaS Platform (Multi-Tenant)

Plateforme SaaS multi-tenant pour gérer des bots Discord avec un seul service bot dynamique.

## Vue d'ensemble

Cette version transforme le modèle "1 conteneur = 1 bot" en architecture scalable:

- Un seul `apps/bot` qui gère `N` bots dynamiquement
- `apps/api` pour OAuth2 Discord + API sécurisée + orchestration des bots
- `apps/web` (Next.js) pour le dashboard
- PostgreSQL pour les données tenant-scopées
- Redis + BullMQ pour la file d'actions de contrôle (`start`, `stop`, `restart`)

## Structure Monorepo

```text
/apps
   /web        # Next.js dashboard
   /api        # Backend API (OAuth2, JWT, gestion bots)
   /bot        # Bot manager multi-instance dynamique
/packages
   /shared     # Types, crypto token, helpers Redis namespacés
/database
   /migrations # SQL versionné (inclut multi-tenant SaaS)
docker-compose.yml
.env
```

## Architecture Runtime

### 1) API (`apps/api`)

- OAuth2 Discord (`/auth/discord/login`, `/auth/discord/callback`)
- Session JWT en cookie `httpOnly`
- Endpoints multi-tenant pour bots (`/api/bots`)
- Validation du token bot via l'API Discord avant stockage
- Chiffrement AES-256-GCM des tokens en base
- Publication des actions de contrôle via BullMQ (Redis)
- Rate limit par tenant (clé Redis namespacée `tenant:{tenantId}:...`)

### 2) Bot Manager (`apps/bot`)

- Charge les bots à relancer depuis PostgreSQL au démarrage
- Maintient une map en mémoire:

```ts
Map<botId, DiscordClient>
```

- Worker BullMQ: consomme les jobs `start|stop|restart`
- Met à jour l'état runtime (`starting`, `running`, `stopping`, `error`)
- Journalise les événements runtime en base (`bot_runtime_events`)

### 3) Web (`apps/web`)

- Pages principales:
   - `/login`
   - `/dashboard`
- Dashboard utilisateur:
   - Ajouter un bot (token)
   - Voir la liste des bots du tenant
   - `start / stop / restart`

## Schéma PostgreSQL (core SaaS)

Migration: `database/migrations/0004_saas_multitenant.sql`

- `tenants`
   - `id` (UUID)
   - `owner_user_id`
- `users`
   - `tenant_id` FK
   - `discord_user_id` (unique)
   - `role`
- `bots`
   - `tenant_id` FK
   - `owner_user_id` FK
   - `discord_bot_id` (unique global)
   - `token_ciphertext`, `token_iv`, `token_tag`
   - `status`, `last_error`
- `bot_runtime_events`
   - logs runtime par bot + tenant

Les tables legacy de configuration (`bot_presence_states`, `bot_member_message_configs`, `bot_log_event_configs`) sont enrichies avec `tenant_id` et `owner_user_id` pour respecter l'isolation multi-tenant stricte.

## API Principale

### Auth

- `GET /auth/discord/login`
- `GET /auth/discord/callback`
- `POST /auth/logout`
- `GET /api/me`

### Bots

- `GET /api/bots`
- `POST /api/bots`
   - body: `{ token: string, displayName?: string }`
- `POST /api/bots/:botId/start`
- `POST /api/bots/:botId/stop`
- `POST /api/bots/:botId/restart`

Tous ces endpoints sont tenant-scopés via la session.

## Sécurité

- Tokens bot jamais stockés en clair
   - AES-256-GCM avec `TOKEN_ENCRYPTION_KEY` (32 bytes en base64)
- Validation token côté Discord avant insertion
- Session auth via JWT httpOnly cookie
- Filtrage systématique des requêtes par `tenant_id`
- Clés Redis namespacées par tenant
- Rate limiting par tenant sur les actions de contrôle

## Docker Compose (fixe)

Services:

- `web`
- `api`
- `bot`
- `postgres`
- `redis`

Pas de service par bot. Pas de `.env` par bot.

## Démarrage local

1. Copier l'environnement:

```bash
cp .env.example .env
```

2. Générer une clé de chiffrement valide (32 bytes base64):

```bash
openssl rand -base64 32
```

3. Installer les dépendances monorepo:

```bash
npm install
```

4. Lancer la stack complète:

```bash
docker compose up -d --build
```

5. Dashboard:

- `http://localhost:3000`

API:

- `http://localhost:4000/health`

Bot manager health:

- `http://localhost:4100/health`

## Notes Scalabilité

- Une instance bot unique peut gérer des dizaines/centaines de bots selon ressources.
- Pour monter en charge horizontalement:
   - scaler `apps/api`
   - scaler `apps/bot` avec coordination queue/locks
   - conserver Redis + PostgreSQL managés
