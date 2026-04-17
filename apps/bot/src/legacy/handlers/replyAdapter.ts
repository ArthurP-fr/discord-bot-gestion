import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  Message,
  MessageReplyOptions,
} from "discord.js";

import type { ReplyPayload } from "../types/command.js";
import type { PrefixReplyObject } from "../types/reply.js";

const PREFIX_EPHEMERAL_DELETE_DELAY_MS = 10_000;

const PREFIX_ALLOWED_MENTIONS_DEFAULT: NonNullable<MessageReplyOptions["allowedMentions"]> = {
  parse: [],
  repliedUser: false,
};

const SLASH_ALLOWED_MENTIONS_DEFAULT: NonNullable<InteractionReplyOptions["allowedMentions"]> = {
  parse: [],
};

const EPHEMERAL_FLAG = 64n;
const FLAG_NAME_TO_BITS: Record<string, bigint> = {
  Ephemeral: 64n,
  SuppressEmbeds: 4n,
  SuppressNotifications: 4096n,
  IsComponentsV2: 32768n,
};

const hasBitfieldLike = (value: unknown): value is { bitfield: bigint | number } => {
  return Boolean(value) && typeof value === "object" && "bitfield" in (value as Record<string, unknown>);
};

const toFlagBits = (flags: unknown): bigint | null => {
  if (flags === undefined || flags === null) {
    return null;
  }

  if (typeof flags === "number" || typeof flags === "bigint") {
    return BigInt(flags);
  }

  if (typeof flags === "string") {
    if (/^\d+$/.test(flags)) {
      return BigInt(flags);
    }

    return FLAG_NAME_TO_BITS[flags] ?? null;
  }

  if (Array.isArray(flags)) {
    let merged = 0n;
    for (const entry of flags) {
      const bits = toFlagBits(entry);
      if (bits !== null) {
        merged |= bits;
      }
    }

    return merged;
  }

  if (hasBitfieldLike(flags)) {
    return BigInt(flags.bitfield);
  }

  return null;
};

const hasEphemeralInFlags = (flags: unknown): boolean => {
  const bits = toFlagBits(flags);
  return bits !== null && (bits & EPHEMERAL_FLAG) !== 0n;
};

const sanitizePrefixFlags = (flags: unknown): MessageReplyOptions["flags"] | undefined => {
  const bits = toFlagBits(flags);
  if (bits === null) {
    return undefined;
  }

  const sanitizedBits = bits & ~EPHEMERAL_FLAG;
  if (sanitizedBits === 0n) {
    return undefined;
  }

  return Number(sanitizedBits);
};

const hasEphemeral = (payload: PrefixReplyObject): boolean => {
  const slashPayload = payload as InteractionReplyOptions;
  return hasEphemeralInFlags(slashPayload.flags);
};

const scheduleDelete = (message: Message): void => {
  setTimeout(() => {
    void message.delete().catch(() => undefined);
  }, PREFIX_EPHEMERAL_DELETE_DELAY_MS);
};

const withPrefixAllowedMentions = (options: MessageReplyOptions): MessageReplyOptions => {
  return {
    ...options,
    allowedMentions: {
      ...PREFIX_ALLOWED_MENTIONS_DEFAULT,
      ...(options.allowedMentions ?? {}),
    },
  };
};

const withSlashAllowedMentions = (options: InteractionReplyOptions): InteractionReplyOptions => {
  return {
    ...options,
    allowedMentions: {
      ...SLASH_ALLOWED_MENTIONS_DEFAULT,
      ...(options.allowedMentions ?? {}),
    },
  };
};

const toMessageReplyOptions = (payload: Exclude<ReplyPayload, string>): MessageReplyOptions => {
  const rest = { ...(payload as Record<string, unknown>) };
  const sanitizedFlags = sanitizePrefixFlags((payload as InteractionReplyOptions).flags);

  // Drop interaction-only fields so prefix replies stay valid message payloads.
  delete rest.fetchReply;
  delete rest.withResponse;
  delete rest.ephemeral;
  delete rest.flags;

  if (sanitizedFlags !== undefined) {
    rest.flags = sanitizedFlags;
  }

  return rest as MessageReplyOptions;
};

export const createPrefixReply = (message: Message): ((payload: ReplyPayload) => Promise<unknown>) => {
  return async (payload: ReplyPayload): Promise<unknown> => {
    if (typeof payload === "string") {
      return message.reply(withPrefixAllowedMentions({ content: payload }));
    }

    const shouldDeleteAfterDelay = hasEphemeral(payload);
    const sent = await message.reply(withPrefixAllowedMentions(toMessageReplyOptions(payload)));
    if (shouldDeleteAfterDelay) {
      scheduleDelete(sent);
    }

    return sent;
  };
};

export const createSlashReply = (
  interaction: ChatInputCommandInteraction,
): ((payload: ReplyPayload) => Promise<unknown>) => {
  return async (payload: ReplyPayload): Promise<unknown> => {
    if (typeof payload === "string") {
      const options = withSlashAllowedMentions({ content: payload });
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp(options);
      }

      return interaction.reply(options);
    }

    const options = withSlashAllowedMentions(payload as InteractionReplyOptions);

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(options);
    }

    return interaction.reply(options);
  };
};