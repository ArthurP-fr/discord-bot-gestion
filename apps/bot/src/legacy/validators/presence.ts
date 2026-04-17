import type {
  PresenceActivityTypeValue,
  PresenceState,
  PresenceStatusValue,
} from "../types/presence.js";

export const PRESENCE_STATUSES: readonly PresenceStatusValue[] = ["online", "idle", "dnd", "invisible", "streaming"];
export const PRESENCE_ACTIVITY_TYPES: readonly PresenceActivityTypeValue[] = [
  "PLAYING",
  "STREAMING",
  "WATCHING",
  "LISTENING",
  "COMPETING",
  "CUSTOM",
];

export const DEFAULT_ACTIVITY_TEXT = "Ready to help";
export const DEFAULT_ACTIVITY_ROTATION_INTERVAL_SECONDS = 30;
export const MIN_ACTIVITY_ROTATION_INTERVAL_SECONDS = 5;
export const MAX_ACTIVITY_ROTATION_INTERVAL_SECONDS = 3_600;
export const MAX_ACTIVITY_ROTATION_TEXTS = 10;

export const createDefaultPresenceState = (): PresenceState => ({
  status: "online",
  activity: {
    type: "CUSTOM",
    text: DEFAULT_ACTIVITY_TEXT,
    texts: [DEFAULT_ACTIVITY_TEXT],
    rotationIntervalSeconds: DEFAULT_ACTIVITY_ROTATION_INTERVAL_SECONDS,
  },
});

export const isPresenceStatusValue = (value: string): value is PresenceStatusValue =>
  PRESENCE_STATUSES.includes(value as PresenceStatusValue);

export const isPresenceActivityTypeValue = (value: string): value is PresenceActivityTypeValue =>
  PRESENCE_ACTIVITY_TYPES.includes(value as PresenceActivityTypeValue);

export const sanitizeActivityText = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return DEFAULT_ACTIVITY_TEXT;
  }

  return trimmed.slice(0, 128);
};

export const sanitizeActivityTexts = (values: readonly string[]): string[] => {
  const cleaned = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => sanitizeActivityText(value))
    .slice(0, MAX_ACTIVITY_ROTATION_TEXTS);

  if (cleaned.length === 0) {
    return [DEFAULT_ACTIVITY_TEXT];
  }

  return cleaned;
};

export const sanitizePresenceRotationIntervalSeconds = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_ACTIVITY_ROTATION_INTERVAL_SECONDS;
  }

  const normalized = Math.floor(value);
  if (normalized < MIN_ACTIVITY_ROTATION_INTERVAL_SECONDS) {
    return MIN_ACTIVITY_ROTATION_INTERVAL_SECONDS;
  }

  if (normalized > MAX_ACTIVITY_ROTATION_INTERVAL_SECONDS) {
    return MAX_ACTIVITY_ROTATION_INTERVAL_SECONDS;
  }

  return normalized;
};

export const isPresenceRotationIntervalSecondsValue = (value: number): boolean =>
  Number.isInteger(value)
  && value >= MIN_ACTIVITY_ROTATION_INTERVAL_SECONDS
  && value <= MAX_ACTIVITY_ROTATION_INTERVAL_SECONDS;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const parsePresenceState = (value: unknown): PresenceState | null => {
  if (!isRecord(value)) {
    return null;
  }

  const statusValue = value.status;
  const activityValue = value.activity;

  if (typeof statusValue !== "string" || !isPresenceStatusValue(statusValue) || !isRecord(activityValue)) {
    return null;
  }

  const activityType = activityValue.type;
  if (typeof activityType !== "string" || !isPresenceActivityTypeValue(activityType)) {
    return null;
  }

  const activityTextsValue = activityValue.texts;
  const legacyActivityTextValue = activityValue.text;
  const intervalValue = activityValue.rotationIntervalSeconds;

  const activityTexts = Array.isArray(activityTextsValue)
    ? sanitizeActivityTexts(activityTextsValue.filter((entry): entry is string => typeof entry === "string"))
    : typeof legacyActivityTextValue === "string"
      ? sanitizeActivityTexts([legacyActivityTextValue])
      : null;

  if (!activityTexts) {
    return null;
  }

  const rotationIntervalSeconds = typeof intervalValue === "number"
    ? sanitizePresenceRotationIntervalSeconds(intervalValue)
    : DEFAULT_ACTIVITY_ROTATION_INTERVAL_SECONDS;

  return {
    status: statusValue,
    activity: {
      type: activityType,
      text: activityTexts[0] ?? DEFAULT_ACTIVITY_TEXT,
      texts: activityTexts,
      rotationIntervalSeconds,
    },
  };
};
