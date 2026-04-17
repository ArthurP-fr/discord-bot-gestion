import type {
  Client,
  Guild,
  GuildMember,
  Message,
  MessageCreateOptions,
  User,
} from "discord.js";

import type { I18nService } from "../i18n/index.js";

export type MemberMessageKind = "welcome" | "goodbye";
export type MemberMessageRenderType = "simple" | "embed" | "container" | "image";

export interface MemberMessageConfig {
  enabled: boolean;
  channelId: string | null;
  messageType: MemberMessageRenderType;
  autoRoleIds: string[];
}

export type DispatchMemberMessageFailureReason =
  | "bot_not_ready"
  | "disabled"
  | "missing_channel"
  | "channel_not_found"
  | "channel_not_sendable"
  | "missing_permissions"
  | "send_failed";

export interface DispatchMemberMessageResult {
  sent: boolean;
  reason: DispatchMemberMessageFailureReason | "sent";
  channelId: string | null;
}

export interface DispatchMemberMessageInput {
  client: Client;
  i18n?: I18nService;
  guild: Guild;
  user: User;
  kind: MemberMessageKind;
  ignoreEnabled?: boolean;
}

export type AssignWelcomeAutoRolesFailureReason =
  | "bot_not_ready"
  | "missing_permissions"
  | "member_not_manageable"
  | "no_roles_configured"
  | "no_assignable_roles"
  | "assign_failed";

export interface AssignWelcomeAutoRolesInput {
  client: Client;
  member: GuildMember;
}

export interface AssignWelcomeAutoRolesResult {
  assigned: boolean;
  reason: AssignWelcomeAutoRolesFailureReason | "assigned";
  configuredRoleIds: string[];
  appliedRoleIds: string[];
  skippedRoleIds: string[];
}

export interface SendableChannel {
  send: (payload: string | MessageCreateOptions) => Promise<unknown>;
}

export type TemplateSuffix =
  | "simple"
  | "embedTitle"
  | "embedDescription"
  | "containerTitle"
  | "containerDescription"
  | "imageTitle"
  | "imageDescription";

export interface MemberMessageImageInput {
  kind: MemberMessageKind;
  title: string;
  subtitle: string;
  username: string;
  avatarUrl: string;
}

export interface MemberMessageRow {
  enabled: boolean;
  channel_id: string | null;
  message_type: string;
  auto_role_ids: string | null;
}

export interface MemberMessageCustomIds {
  toggleButton: string;
  channelButton: string;
  channelCancelButton: string;
  roleButton: string;
  roleCancelButton: string;
  roleClearButton: string;
  typeSelect: string;
  channelSelect: string;
  roleSelect: string;
  testButton: string;
}

export interface MemberMessagePanelUiState {
  channelPickerOpen: boolean;
  rolePickerOpen: boolean;
}

export interface MemberMessagePanelSession {
  collector: ReturnType<Message["createMessageComponentCollector"]>;
  disable: () => Promise<void>;
}