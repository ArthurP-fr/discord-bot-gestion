# Discord.js v14 Framework Template

Professional command framework template for Discord.js `14.26.2` with:

- Single command object schema
- Minimal command authoring (`name`, `category`, `execute`)
- Optional per-user command cooldown (`cooldown` in seconds)
- Shared execution logic for prefix and slash
- Dispatch pipeline ready for local execution or worker queue mode
- Global user rate limiting (memory or Redis backend)
- Structured JSON logging with `pino`
- External JSON i18n
- Automatic prefix and slash localizations from locale files
- One localized `name` per language drives both prefix and slash triggers
- Typed argument schema
- User permission checks
- Auto-generated help from command metadata

## Presence Storage

- The `presence` command is persisted in PostgreSQL.
- Storage is keyed by `bot_id` (Discord user id), so one PostgreSQL instance can serve multiple bots.
- Presence survives bot restarts and container restarts.

## Setup

1. Install dependencies:
   npm install
2. Create environment file:
   cp .env.example .env
3. Fill required values in `.env`:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DATABASE_URL`
4. Optional values:
   - `DATABASE_SSL` (`true` for managed cloud DB, `false` for local Docker)
   - `DATABASE_SSL_REJECT_UNAUTHORIZED` (`true` by default for secure TLS verification)
   - `DATABASE_SSL_CA` (optional CA cert chain, supports escaped newlines)
   - `ALLOW_INSECURE_DB_SSL` (`false` by default; set `true` only for local/dev exceptions)
   - `PRESENCE_STREAM_URL` (used when activity type is `STREAMING`)
   - `AUTO_DEPLOY_SLASH` (`true` to sync slash commands on startup)
   - `DEV_GUILD_ID` (optional guild scope for faster slash sync)
   - `LOG_LEVEL` (default `info`, JSON logs)
   - `STATE_BACKEND` (`memory` or `redis`)
   - `REDIS_URL` (required when `STATE_BACKEND=redis`)
   - `GLOBAL_RATE_LIMIT_MAX_REQUESTS` (global per-user request budget)
   - `GLOBAL_RATE_LIMIT_WINDOW_SECONDS` (window size in seconds)
   - `COMMAND_DISPATCH_MODE` (`local` or `worker`; enable `worker` only if a queue consumer is deployed)
   - `COMMAND_QUEUE_NAME` (Redis list used in `worker` mode)
   - `ENABLE_LEADER_ELECTION` (`true` to guard startup jobs in multi-instance)
5. Run migrations:
   npm run migrate
6. Start in development:
   npm run dev
7. Validate code quality:
   - npm run typecheck
   - npm run test
   - npm run check

## Docker Deployment (2 Bots + PostgreSQL)

1. Fill production env files:
   - `.env.bot-alpha.prod`
   - `.env.bot-beta.prod`
2. Set strong shared DB credentials:
   - `POSTGRES_DB`
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
3. Start stack:
   docker compose up -d --build
4. Stop stack:
   docker compose down

By default, `docker-compose.yml` provisions:
- `bot_alpha`: Discord bot instance A
- `bot_beta`: Discord bot instance B
- `postgres`: PostgreSQL 16 with persistent volume `postgres_data`

Both bots use the same PostgreSQL service, and data remains isolated per bot through `bot_id` keys.

Security defaults:
- PostgreSQL is exposed only on the internal Compose network (`expose: 5432`, no host bind).
- Bot containers enforce `no-new-privileges` and graceful stop.
- Log rotation is enabled (`max-size=10m`, `max-file=3`).
- Database TLS verification remains strict by default when SSL is enabled.

## Architecture

- `src/app/bootstrap.ts`: runtime bootstrap, dependency wiring, graceful shutdown
- `src/commands/*`: thin command wrappers (`defineCommand` + delegated execute)
- `src/modules/help/*`: help command module (service + command contract)
- `src/modules/presence/*`: module entrypoint for presence runtime and contracts
- `src/modules/memberMessages/*`: module entrypoint for member-message runtime and contracts
- `src/features/*`: implementation details used behind `src/modules/*`
- `src/core/commands/*`: registry, parsing, slash payload, usage helpers
- `src/core/execution/CommandExecutor.ts`: execution core (permissions, cooldown, global rate limit)
- `src/core/execution/dispatch.ts`: dispatch abstraction (`local` or `worker`)
- `src/core/execution/cooldownStore.ts`: cooldown store contracts and memory/Redis implementations
- `src/core/execution/globalRateLimitStore.ts`: global limiter contracts and memory/Redis implementations
- `src/core/runtime/leaderCoordinator.ts`: leader-only startup coordination for multi-instance deployments
- `src/core/logging/logger.ts`: centralized structured logger (`pino`)
- `src/core/discord/*`: shared Discord helpers (reply message resolver, panel session registry)
- `src/database/stores/*`: PostgreSQL store implementations
- `src/database/dbLifecycle.ts`: centralized DB init/shutdown lifecycle
- `src/validators/*`: business validation/sanitization
- `src/types/*`: pure shared types and contracts
- `src/i18n/*.json`: external i18n dictionaries

## Included Commands

- `kiss` (`fun`) with required `user` arg
- `ping` (`utility`)
- `welcome` (`utility`) interactive welcome-message panel
- `goodbye` (`utility`) interactive goodbye-message panel
- `presence` (`utility`) with interactive status/activity/text panel
- `help` (`core`) with auto category and usage generation

## Adding A Command

1. Create a command object in `src/commands/...`
2. Follow the schema in `src/types/command.ts`
3. Add command to `src/commands/index.ts`
4. Put business logic in `src/modules/<module>/...` and keep `src/commands/*` as wrappers only
5. If `AUTO_DEPLOY_SLASH=true`, restart the bot to sync slash commands automatically
