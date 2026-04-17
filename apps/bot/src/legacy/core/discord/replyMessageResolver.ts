import type { Message } from "discord.js";

const isMessageResult = (value: unknown): value is Message => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "createMessageComponentCollector" in value && "edit" in value;
};

export const resolveReplyMessage = (value: unknown): Message | null => {
  if (isMessageResult(value)) {
    return value;
  }

  if (!value || typeof value !== "object" || !("resource" in value)) {
    return null;
  }

  const resource = (value as { resource?: unknown }).resource;
  if (!resource || typeof resource !== "object" || !("message" in resource)) {
    return null;
  }

  const message = (resource as { message?: unknown }).message;
  return isMessageResult(message) ? message : null;
};
