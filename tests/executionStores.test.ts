import assert from "node:assert/strict";
import test from "node:test";

import { MemoryCooldownStore } from "../src/core/execution/cooldownStore.js";
import { MemoryGlobalRateLimitStore } from "../src/core/execution/globalRateLimitStore.js";

test("MemoryCooldownStore bloque les executions pendant la fenetre", async () => {
  const store = new MemoryCooldownStore();

  const first = await store.consume("bot-1", "ping", "user-1", 10);
  assert.equal(first.allowed, true);
  assert.equal(first.retryAfterSeconds, 0);

  const second = await store.consume("bot-1", "ping", "user-1", 10);
  assert.equal(second.allowed, false);
  assert.ok(second.retryAfterSeconds > 0);
});

test("MemoryCooldownStore isole les cooldowns par bot", async () => {
  const store = new MemoryCooldownStore();

  const firstBot = await store.consume("bot-a", "ping", "user-1", 10);
  const secondBot = await store.consume("bot-b", "ping", "user-1", 10);
  const sameBotAgain = await store.consume("bot-a", "ping", "user-1", 10);

  assert.equal(firstBot.allowed, true);
  assert.equal(secondBot.allowed, true);
  assert.equal(sameBotAgain.allowed, false);
});

test("MemoryGlobalRateLimitStore applique la limite globale utilisateur", async () => {
  const store = new MemoryGlobalRateLimitStore();
  const policy = {
    limit: 2,
    windowSeconds: 30,
  };

  const first = await store.consume("bot-1", "user-rl", policy);
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);

  const second = await store.consume("bot-1", "user-rl", policy);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);

  const third = await store.consume("bot-1", "user-rl", policy);
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfterSeconds > 0);
});

test("MemoryGlobalRateLimitStore isole les compteurs par bot", async () => {
  const store = new MemoryGlobalRateLimitStore();
  const policy = {
    limit: 1,
    windowSeconds: 30,
  };

  const botAFirst = await store.consume("bot-a", "user-rl", policy);
  const botBFirst = await store.consume("bot-b", "user-rl", policy);
  const botASecond = await store.consume("bot-a", "user-rl", policy);

  assert.equal(botAFirst.allowed, true);
  assert.equal(botBFirst.allowed, true);
  assert.equal(botASecond.allowed, false);
});
