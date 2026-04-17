import {
  LOG_EVENT_KEYS,
  LOG_EVENT_KEYS_SET,
} from "../features/logs/catalog.js";
import type {
  LogEventConfig,
  LogEventKey,
  LogEventRow,
  LogEventStateByKey,
} from "../types/logs.js";

export const createDefaultLogEventConfig = (): LogEventConfig => ({
  enabled: false,
  channelId: null,
});

export const createDefaultLogEventState = (): LogEventStateByKey => {
  const state = {} as LogEventStateByKey;

  for (const eventKey of LOG_EVENT_KEYS) {
    state[eventKey] = createDefaultLogEventConfig();
  }

  return state;
};

export const cloneLogEventState = (state: LogEventStateByKey): LogEventStateByKey => {
  const next = {} as LogEventStateByKey;

  for (const eventKey of LOG_EVENT_KEYS) {
    const current = state[eventKey];
    next[eventKey] = {
      enabled: current.enabled,
      channelId: current.channelId,
    };
  }

  return next;
};

export const isLogEventKey = (value: string): value is LogEventKey => {
  return LOG_EVENT_KEYS_SET.has(value as LogEventKey);
};

export const mergeLogEventRowsIntoState = (rows: readonly LogEventRow[]): LogEventStateByKey => {
  const state = createDefaultLogEventState();

  for (const row of rows) {
    if (!isLogEventKey(row.event_key)) {
      continue;
    }

    state[row.event_key] = {
      enabled: row.enabled,
      channelId: row.channel_id,
    };
  }

  return state;
};