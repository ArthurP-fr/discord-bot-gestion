import type { CommandRegistry } from "../core/commands/registry.js";
import type { I18nService } from "../i18n/index.js";

export interface DeployCommandsOptions {
  token: string;
  clientId: string;
  guildId?: string;
  registry: CommandRegistry;
  i18n: I18nService;
}

export interface DeployCommandsResult {
  scope: "guild" | "global";
  count: number;
}