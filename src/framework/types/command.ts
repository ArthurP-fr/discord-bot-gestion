import type {
  ChatInputCommandInteraction,
  Client,
  Guild,
  GuildBasedChannel,
  GuildMember,
  InteractionReplyOptions,
  Message,
  MessageCreateOptions,
  MessageReplyOptions,
  PermissionResolvable,
  Role,
  TextBasedChannel,
  User,
} from "discord.js";

export const SUPPORTED_LANGS = ["en", "fr", "es"] as const;

export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
export type CommandSource = "prefix" | "slash";
export type CommandArgType = "string" | "user" | "int" | "boolean" | "number" | "channel" | "role";

export type TranslationVars = Record<string, string | number | boolean | null | undefined>;
export type ReplyPayload = string | MessageCreateOptions | MessageReplyOptions | InteractionReplyOptions;

export type CommandArgValue =
  | string
  | number
  | boolean
  | User
  | GuildMember
  | Role
  | GuildBasedChannel
  | null
  | undefined;

export interface CommandMeta {
  name: string;
  category: string;
}

export interface CommandArgument {
  name: string;
  type: CommandArgType;
  required: boolean;
  descriptionKey: string;
}

export interface CommandExample {
  source?: CommandSource;
  args?: string;
  descriptionKey: string;
}

export interface PrefixTriggerMatch {
  command: BotCommand;
  lang: SupportedLang;
  trigger: string;
}

export interface CommandRegistryReader {
  getAll(): readonly BotCommand[];
  findByName(name: string): BotCommand | undefined;
  findByAnyPrefixTrigger(trigger: string): PrefixTriggerMatch | undefined;
}

export interface CommandI18nTools {
  commandName: (lang: SupportedLang, commandName: string) => string;
  commandTrigger: (lang: SupportedLang, commandName: string) => string;
  commandT: (lang: SupportedLang, commandName: string, relativeKey: string, vars?: TranslationVars) => string;
  commandObject: (lang: SupportedLang, commandName: string) => Record<string, unknown>;
  format: (template: string, vars?: TranslationVars) => string;
}

export interface CommandExecutionContext {
  client: Client;
  user: User;
  guild: Guild | null;
  channel: TextBasedChannel | null;
  lang: SupportedLang;
  args: Record<string, CommandArgValue>;
  command: BotCommand;
  source: CommandSource;
  t: (key: string, vars?: TranslationVars) => string;
  ct: (relativeKey: string, vars?: TranslationVars) => string;
  commandText: Record<string, unknown>;
  format: (template: string, vars?: TranslationVars) => string;
  i18n: CommandI18nTools;
  raw: Message | ChatInputCommandInteraction;
  reply: (payload: ReplyPayload) => Promise<unknown>;
  registry: CommandRegistryReader;
  prefix: string;
  defaultLang: SupportedLang;
}

export interface BotCommandInput {
  meta: CommandMeta;
  args?: CommandArgument[];
  permissions?: PermissionResolvable[];
  examples?: CommandExample[];
  execute: (ctx: CommandExecutionContext) => Promise<void>;
}

export interface BotCommand {
  meta: CommandMeta;
  args: CommandArgument[];
  permissions: PermissionResolvable[];
  examples: CommandExample[];
  execute: (ctx: CommandExecutionContext) => Promise<void>;
}
