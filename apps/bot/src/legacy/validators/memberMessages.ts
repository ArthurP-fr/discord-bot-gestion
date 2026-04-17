import type {
  MemberMessageConfig,
  MemberMessageKind,
  MemberMessageRenderType,
} from "../types/memberMessages.js";

const DISCORD_SNOWFLAKE_REGEX = /^\d{17,20}$/;

export const MEMBER_MESSAGE_KINDS: readonly MemberMessageKind[] = ["welcome", "goodbye"];

export const MEMBER_MESSAGE_RENDER_TYPES: readonly MemberMessageRenderType[] = ["simple", "embed", "container", "image"];

export const DEFAULT_MEMBER_MESSAGE_RENDER_TYPE: MemberMessageRenderType = "simple";

export const sanitizeMemberMessageRoleIds = (roleIds: readonly string[]): string[] => {
  const uniqueRoleIds = new Set<string>();

  for (const rawRoleId of roleIds) {
    const roleId = rawRoleId.trim();
    if (!DISCORD_SNOWFLAKE_REGEX.test(roleId)) {
      continue;
    }

    uniqueRoleIds.add(roleId);
  }

  return [...uniqueRoleIds];
};

export const createDefaultMemberMessageConfig = (): MemberMessageConfig => ({
  enabled: false,
  channelId: null,
  messageType: DEFAULT_MEMBER_MESSAGE_RENDER_TYPE,
  autoRoleIds: [],
});

export const isMemberMessageKindValue = (value: string): value is MemberMessageKind => {
  return MEMBER_MESSAGE_KINDS.includes(value as MemberMessageKind);
};

export const isMemberMessageRenderTypeValue = (value: string): value is MemberMessageRenderType => {
  return MEMBER_MESSAGE_RENDER_TYPES.includes(value as MemberMessageRenderType);
};
