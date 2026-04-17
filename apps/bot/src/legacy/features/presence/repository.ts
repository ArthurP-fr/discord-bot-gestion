import type { PresenceState } from "../../types/presence.js";

export interface PresenceRepository {
  getByBotId(botId: string): Promise<PresenceState>;
  upsertByBotId(botId: string, state: PresenceState): Promise<void>;
}
