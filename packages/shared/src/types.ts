import type { BotStatus } from "./constants.js";

export interface TenantRecord {
  id: string;
  ownerUserId: string;
  createdAt: string;
}

export interface UserRecord {
  id: string;
  tenantId: string;
  discordUserId: string;
  username: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  createdAt: string;
  updatedAt: string;
}

export interface BotRecord {
  id: string;
  tenantId: string;
  ownerUserId: string;
  discordBotId: string;
  displayName: string;
  tokenCiphertext: string;
  tokenIv: string;
  tokenTag: string;
  status: BotStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicBot {
  id: string;
  tenantId: string;
  discordBotId: string;
  displayName: string;
  status: BotStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BotControlAction = "start" | "stop" | "restart";

export interface BotControlJob {
  tenantId: string;
  userId: string;
  botId: string;
  action: BotControlAction;
  requestedAt: string;
}
