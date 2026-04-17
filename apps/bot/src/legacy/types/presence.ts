import type { Message } from "discord.js";

export type PresenceStatusValue = "online" | "idle" | "dnd" | "invisible" | "streaming";
export type PresenceActivityTypeValue = "PLAYING" | "STREAMING" | "WATCHING" | "LISTENING" | "COMPETING" | "CUSTOM";

export interface PresenceActivityState {
  type: PresenceActivityTypeValue;
  text: string;
  texts: string[];
  rotationIntervalSeconds: number;
}

export interface PresenceState {
  status: PresenceStatusValue;
  activity: PresenceActivityState;
}

export interface PresenceRow {
  status: string;
  activity_type: string;
  activity_text: string;
  activity_texts: string | null;
  rotation_interval_seconds: number | null;
}

export interface PresenceCustomIds {
  statusSelect: string;
  activitySelect: string;
  textButton: string;
  intervalButton: string;
  textModal: string;
  textInput: string;
  intervalModal: string;
  intervalInput: string;
}

export interface PresencePanelSession {
  collector: ReturnType<Message["createMessageComponentCollector"]>;
  disable: () => Promise<void>;
}

export interface PresenceRuntimeState {
  dynamicPresenceRefreshTimer: NodeJS.Timeout | null;
  presenceRotationTimer: NodeJS.Timeout | null;
  activePresenceTextIndex: number;
  activePanelsByUserId: Map<string, PresencePanelSession>;
}

export type DiscordPresenceStatus = "online" | "idle" | "dnd" | "invisible";