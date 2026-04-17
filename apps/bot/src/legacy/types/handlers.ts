import type { CommandRegistry } from "../core/commands/registry.js";
import type { CommandDispatchPort } from "../core/execution/dispatch.js";
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
  requestId: string;
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
  dispatcher: CommandDispatchPort;
}

export interface SlashHandlerDeps extends HandlerExecutionDeps {
  dispatcher: CommandDispatchPort;
}