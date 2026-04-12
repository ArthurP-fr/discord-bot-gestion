import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  Message,
  MessageReplyOptions,
} from "discord.js";

import type { ReplyPayload } from "../types/command.js";

const PREFIX_EPHEMERAL_DELETE_DELAY_MS = 10_000;

const PREFIX_ALLOWED_MENTIONS_DEFAULT: NonNullable<MessageReplyOptions["allowedMentions"]> = {
  repliedUser: false,
};

const SLASH_ALLOWED_MENTIONS_DEFAULT: NonNullable<InteractionReplyOptions["allowedMentions"]> = {};

type PrefixReplyObject = Exclude<ReplyPayload, string>;

const EPHEMERAL_FLAG = 64n;

const hasBitfieldLike = (value: unknown): value is { bitfield: bigint | number } => {
  return Boolean(value) && typeof value === "object" && "bitfield" in (value as Record<string, unknown>);
};

const hasEphemeralInFlags = (flags: unknown): boolean => {
  if (flags === undefined || flags === null) {
    return false;
  }

  if (typeof flags === "number" || typeof flags === "bigint") {
    return (BigInt(flags) & EPHEMERAL_FLAG) !== 0n;
  }

  if (typeof flags === "string") {
    return flags === "Ephemeral" || flags === "64";
  }

  if (Array.isArray(flags)) {
    return flags.some((entry) => hasEphemeralInFlags(entry));
  }

  if (hasBitfieldLike(flags)) {
    return (BigInt(flags.bitfield) & EPHEMERAL_FLAG) !== 0n;
  }

  return false;
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

  // Drop interaction-only fields so prefix replies stay valid message payloads.
  delete rest.fetchReply;
  delete rest.withResponse;
  delete rest.ephemeral;
  delete rest.flags;

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