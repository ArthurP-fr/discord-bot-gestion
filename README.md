# Discord.js v14 Framework Template

Professional command framework template for Discord.js `14.26.2` with:

- Single command object schema
- Minimal command authoring (`name`, `category`, `execute`)
- Shared execution logic for prefix and slash
- External JSON i18n
- Automatic prefix and slash localizations from locale files
- One localized `name` per language drives both prefix and slash triggers
- Typed argument schema
- User permission checks
- Auto-generated help from command metadata

## Setup

1. Install dependencies:
   npm install
2. Create environment file:
   cp .env.example .env
3. Fill required values in `.env`:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
4. Deploy slash commands:
   npm run deploy:commands
5. Start in development:
   npm run dev

## Architecture

- `src/framework/types/command.ts`: strict command schema
- `src/framework/commands/defineCommand.ts`: default command completion
- `src/framework/commands/registry.ts`: trigger/name mapping generated from locales
- `src/framework/commands/argParser.ts`: prefix/slash args parsing from schema
- `src/framework/execution/CommandExecutor.ts`: unified pipeline (permissions/execute)
- `src/framework/handlers/prefixHandler.ts`: prefix entrypoint
- `src/framework/handlers/slashHandler.ts`: slash entrypoint
- `locales/*.json`: external i18n dictionaries
- `src/commands/*`: business commands only (`execute`)

## Included Commands

- `kiss` (`fun`) with required `user` arg
- `ping` (`utility`)
- `advanced` (`utility`) with full argument/permission example
- `help` (`core`) with auto category and usage generation

## Adding A Command

1. Create a command object in `src/commands/...`
2. Follow the schema in `src/framework/types/command.ts`
3. Add command to `src/commands/index.ts`
4. Deploy slash commands again (`npm run deploy:commands`)
