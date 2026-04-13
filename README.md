# Discord.js v14 Framework Template

Professional command framework template for Discord.js `14.26.2` with:

- Single command object schema
- Minimal command authoring (`name`, `category`, `execute`)
- Optional per-user command cooldown (`cooldown` in seconds)
- Shared execution logic for prefix and slash
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
   - `PRESENCE_STREAM_URL` (used when activity type is `STREAMING`)
   - `AUTO_DEPLOY_SLASH` (`true` to sync slash commands on startup)
   - `DEV_GUILD_ID` (optional guild scope for faster slash sync)
5. Start in development:
   npm run dev
6. Validate code quality:
   - npm run typecheck
   - npm run test
   - npm run check

## Docker Deployment (Bot + PostgreSQL)

1. Configure `.env` with at least:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `POSTGRES_DB`
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
2. Start stack:
   docker compose up -d --build
3. Stop stack:
   docker compose down

By default, `docker-compose.yml` provisions:
- `bot`: the Discord bot container
- `postgres`: PostgreSQL 16 with persistent volume `postgres_data`

The bot container uses:
- `DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>`

Security defaults:
- PostgreSQL is bound to `127.0.0.1` by default in Compose.
- Keep strong values for `POSTGRES_PASSWORD` and rotate credentials if exposed.

## Multi-Bot With One DB

You can run several bot services against the same PostgreSQL instance.

- Keep one shared `postgres` service.
- Add additional bot services with different `DISCORD_TOKEN` / `DISCORD_CLIENT_ID`.
- Keep `DATABASE_URL` pointing to the same PostgreSQL service.

Because rows are keyed by `bot_id`, each bot keeps its own independent presence configuration.

An example with two bot services is available in `docker-compose.multi-bot.example.yml`.

## Architecture

- `src/types/command.ts`: strict command schema
- `src/core/commands/defineCommand.ts`: default command completion
- `src/core/commands/registry.ts`: trigger/name mapping generated from i18n dictionaries
- `src/core/commands/argParser.ts`: prefix/slash args parsing from schema
- `src/core/execution/CommandExecutor.ts`: unified pipeline (permissions/cooldown/execute)
- `src/handlers/prefixHandler.ts`: prefix entrypoint
- `src/handlers/slashHandler.ts`: slash entrypoint
- `src/database/presence/presenceStore.ts`: PostgreSQL presence storage
- `src/types/presenceTypes.ts`: shared presence types/validation
- `src/i18n/*.json`: external i18n dictionaries
- `src/commands/*`: business commands only (`execute`, optional `cooldown`)

## Included Commands

- `kiss` (`fun`) with required `user` arg
- `ping` (`utility`)
- `advanced` (`utility`) with full argument/permission example
- `presence` (`utility`) with interactive status/activity/text panel
- `help` (`core`) with auto category and usage generation

## Adding A Command

1. Create a command object in `src/commands/...`
2. Follow the schema in `src/types/command.ts`
3. Add command to `src/commands/index.ts`
4. If `AUTO_DEPLOY_SLASH=true`, restart the bot to sync slash commands automatically
