import type { CommandRegistry } from "../core/commands/registry.js";
import type { CommandExecutor } from "../core/execution/CommandExecutor.js";
import type { I18nService } from "../i18n/index.js";
import type {
  BotCommand,
  CommandExecutionContext,
  CommandSource,
  SupportedLang,
} from "./command.js";

export interface HandlerExecutionDeps {
  registry: CommandRegistry;
  i18n: I18nService;
  prefix: string;
  defaultLang: SupportedLang;
}

export interface BuildExecutionContextInput {
  command: BotCommand;
  source: CommandSource;
  lang: SupportedLang;
  args: CommandExecutionContext["args"];
  client: CommandExecutionContext["client"];
  user: CommandExecutionContext["user"];
  guild: CommandExecutionContext["guild"];
  channel: CommandExecutionContext["channel"];
  raw: CommandExecutionContext["raw"];
  reply: CommandExecutionContext["reply"];
}

export interface PrefixHandlerDeps extends HandlerExecutionDeps {
  executor: CommandExecutor;
}

export interface SlashHandlerDeps extends HandlerExecutionDeps {
  executor: CommandExecutor;
}