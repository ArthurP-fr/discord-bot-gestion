import type { ReplyPayload } from "./command.js";

export type PrefixReplyObject = Exclude<ReplyPayload, string>;