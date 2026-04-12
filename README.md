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
5. Deploy slash commands:
   npm run deploy:commands
6. Start in development:
   npm run dev

## Docker Deployment (Bot + PostgreSQL)

1. Configure `.env` (at minimum `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`).
2. Start stack:
   docker compose up -d --build
3. Stop stack:
   docker compose down

By default, `docker-compose.yml` provisions:
- `bot`: the Discord bot container
- `postgres`: PostgreSQL 16 with persistent volume `postgres_data`

The bot container uses:
- `DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>`

## Multi-Bot With One DB

You can run several bot services against the same PostgreSQL instance.

- Keep one shared `postgres` service.
- Add additional bot services with different `DISCORD_TOKEN` / `DISCORD_CLIENT_ID`.
- Keep `DATABASE_URL` pointing to the same PostgreSQL service.

Because rows are keyed by `bot_id`, each bot keeps its own independent presence configuration.

An example with two bot services is available in `docker-compose.multi-bot.example.yml`.

## Architecture

- `src/framework/types/command.ts`: strict command schema
- `src/framework/commands/defineCommand.ts`: default command completion
- `src/framework/commands/registry.ts`: trigger/name mapping generated from locales
- `src/framework/commands/argParser.ts`: prefix/slash args parsing from schema
- `src/framework/execution/CommandExecutor.ts`: unified pipeline (permissions/cooldown/execute)
- `src/framework/handlers/prefixHandler.ts`: prefix entrypoint
- `src/framework/handlers/slashHandler.ts`: slash entrypoint
- `src/framework/presence/presenceStore.ts`: PostgreSQL presence storage
- `src/framework/presence/presenceTypes.ts`: shared presence types/validation
- `locales/*.json`: external i18n dictionaries
- `src/commands/*`: business commands only (`execute`, optional `cooldown`)

## Included Commands

- `kiss` (`fun`) with required `user` arg
- `ping` (`utility`)
- `advanced` (`utility`) with full argument/permission example
- `presence` (`utility`) with interactive status/activity/text panel
- `help` (`core`) with auto category and usage generation

## Adding A Command

1. Create a command object in `src/commands/...`
2. Follow the schema in `src/framework/types/command.ts`
3. Add command to `src/commands/index.ts`
4. Deploy slash commands again (`npm run deploy:commands`)
