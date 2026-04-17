import type { ComponentPanelSession } from "../../core/discord/componentSessionRegistry.js";

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

export interface PresenceRuntimeState {
  dynamicPresenceRefreshTimer: NodeJS.Timeout | null;
  presenceRotationTimer: NodeJS.Timeout | null;
  activePresenceTextIndex: number;
}

export interface PresencePanelSession extends ComponentPanelSession {}
