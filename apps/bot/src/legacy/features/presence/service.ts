import { ActivityType, type Client } from "discord.js";

import { ComponentSessionRegistry } from "../../core/discord/componentSessionRegistry.js";
import type {
  PresenceActivityTypeValue,
  PresenceState,
  PresenceStatusValue,
} from "../../types/presence.js";
import {
  createDefaultPresenceState,
  sanitizeActivityText,
  sanitizeActivityTexts,
  sanitizePresenceRotationIntervalSeconds,
} from "../../validators/presence.js";
import {
  PRESENCE_TEMPLATE_REFRESH_INTERVAL_MS,
  containsPresenceTemplateVariables,
  renderPresenceTemplate,
} from "./templateVariables.js";
import type { PresenceRepository } from "./repository.js";
import type { PresencePanelSession, PresenceRuntimeState } from "./types.js";

const DISCORD_ACTIVITY_TYPES: Record<PresenceActivityTypeValue, ActivityType> = {
  PLAYING: ActivityType.Playing,
  STREAMING: ActivityType.Streaming,
  WATCHING: ActivityType.Watching,
  LISTENING: ActivityType.Listening,
  COMPETING: ActivityType.Competing,
  CUSTOM: ActivityType.Custom,
};

const createRuntimeState = (): PresenceRuntimeState => ({
  dynamicPresenceRefreshTimer: null,
  presenceRotationTimer: null,
  activePresenceTextIndex: 0,
});

const clearRuntimeTimers = (runtimeState: PresenceRuntimeState): void => {
  if (runtimeState.dynamicPresenceRefreshTimer) {
    clearInterval(runtimeState.dynamicPresenceRefreshTimer);
    runtimeState.dynamicPresenceRefreshTimer = null;
  }

  if (runtimeState.presenceRotationTimer) {
    clearInterval(runtimeState.presenceRotationTimer);
    runtimeState.presenceRotationTimer = null;
  }
};

const resolveDiscordStatus = (status: PresenceStatusValue): "online" | "idle" | "dnd" | "invisible" => {
  return status === "streaming" ? "online" : status;
};

export class PresenceService {
  private readonly runtimeByBotId = new Map<string, PresenceRuntimeState>();
  private readonly panelSessions = new ComponentSessionRegistry<PresencePanelSession>();

  public constructor(
    private readonly repository: PresenceRepository,
    private readonly streamUrl: string,
  ) {}

  public resolveBotId(client: Client): string | null {
    return client.user?.id ?? null;
  }

  public getRuntimeState(client: Client): PresenceRuntimeState {
    const botId = this.resolveBotId(client) ?? "unbound";
    const existing = this.runtimeByBotId.get(botId);
    if (existing) {
      return existing;
    }

    const next = createRuntimeState();
    this.runtimeByBotId.set(botId, next);
    return next;
  }

  public normalizeState(state: PresenceState, runtimeState: PresenceRuntimeState): void {
    const activityTexts = sanitizeActivityTexts(state.activity.texts);
    state.activity.texts = activityTexts;
    state.activity.text = activityTexts[0] ?? sanitizeActivityText(state.activity.text);
    state.activity.rotationIntervalSeconds = sanitizePresenceRotationIntervalSeconds(state.activity.rotationIntervalSeconds);

    if (runtimeState.activePresenceTextIndex >= activityTexts.length) {
      runtimeState.activePresenceTextIndex = 0;
    }
  }

  public getActiveTemplateText(state: PresenceState, runtimeState: PresenceRuntimeState): string {
    this.normalizeState(state, runtimeState);
    return state.activity.texts[runtimeState.activePresenceTextIndex] ?? state.activity.text;
  }

  public renderPreview(client: Client, templateText: string): string {
    return renderPresenceTemplate(client, templateText);
  }

  public async loadState(client: Client): Promise<PresenceState> {
    const botId = this.resolveBotId(client);
    if (!botId) {
      return createDefaultPresenceState();
    }

    return this.repository.getByBotId(botId);
  }

  public applyState(client: Client, state: PresenceState): void {
    const runtimeState = this.getRuntimeState(client);
    this.applyPresenceState(client, state, runtimeState);
    this.syncDynamicPresenceTimers(client, state, runtimeState);
  }

  public async persistAndApply(client: Client, state: PresenceState): Promise<void> {
    this.applyState(client, state);

    const botId = this.resolveBotId(client);
    if (!botId) {
      return;
    }

    await this.repository.upsertByBotId(botId, state);
  }

  public async restoreFromStorage(client: Client): Promise<void> {
    const state = await this.loadState(client);
    const runtimeState = this.getRuntimeState(client);
    runtimeState.activePresenceTextIndex = 0;
    this.applyPresenceState(client, state, runtimeState);
    this.syncDynamicPresenceTimers(client, state, runtimeState);
  }

  public panelSessionKey(client: Client, userId: string): string {
    return `${this.resolveBotId(client) ?? "unbound"}:${userId}`;
  }

  public async replacePanelSession(key: string, session: PresencePanelSession): Promise<void> {
    await this.panelSessions.replace(key, session);
  }

  public deletePanelSessionIfCollectorMatch(key: string, collector: PresencePanelSession["collector"]): void {
    this.panelSessions.deleteIfCollectorMatch(key, collector);
  }

  public async shutdown(): Promise<void> {
    for (const runtimeState of this.runtimeByBotId.values()) {
      clearRuntimeTimers(runtimeState);
    }

    this.runtimeByBotId.clear();
    await this.panelSessions.stopAll("shutdown");
  }

  private applyPresenceState(client: Client, state: PresenceState, runtimeState: PresenceRuntimeState): void {
    if (!client.user) {
      return;
    }

    this.normalizeState(state, runtimeState);

    const status = resolveDiscordStatus(state.status);
    const templateText = this.getActiveTemplateText(state, runtimeState);
    const text = renderPresenceTemplate(client, templateText);

    if (state.status === "streaming" || state.activity.type === "STREAMING") {
      client.user.setPresence({
        status,
        activities: [
          {
            type: ActivityType.Streaming,
            name: text,
            url: this.streamUrl,
          },
        ],
      });
      return;
    }

    if (state.activity.type === "CUSTOM") {
      client.user.setPresence({
        status,
        activities: [
          {
            type: ActivityType.Custom,
            name: "Custom Status",
            state: text,
          },
        ],
      });
      return;
    }

    client.user.setPresence({
      status,
      activities: [
        {
          type: DISCORD_ACTIVITY_TYPES[state.activity.type],
          name: text,
        },
      ],
    });
  }

  private syncDynamicPresenceTimers(client: Client, state: PresenceState, runtimeState: PresenceRuntimeState): void {
    this.normalizeState(state, runtimeState);
    clearRuntimeTimers(runtimeState);

    if (state.activity.texts.length > 1) {
      runtimeState.presenceRotationTimer = setInterval(() => {
        this.normalizeState(state, runtimeState);
        if (state.activity.texts.length <= 1) {
          runtimeState.activePresenceTextIndex = 0;
          return;
        }

        runtimeState.activePresenceTextIndex = (runtimeState.activePresenceTextIndex + 1) % state.activity.texts.length;
        this.applyPresenceState(client, state, runtimeState);
      }, state.activity.rotationIntervalSeconds * 1_000);

      runtimeState.presenceRotationTimer.unref?.();
    }

    const hasKnownVariable = state.activity.texts.some((templateText) => containsPresenceTemplateVariables(templateText));
    if (!hasKnownVariable) {
      return;
    }

    runtimeState.dynamicPresenceRefreshTimer = setInterval(() => {
      this.applyPresenceState(client, state, runtimeState);
    }, PRESENCE_TEMPLATE_REFRESH_INTERVAL_MS);

    runtimeState.dynamicPresenceRefreshTimer.unref?.();
  }
}
