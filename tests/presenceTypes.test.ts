import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ACTIVITY_TEXT,
  MAX_ACTIVITY_ROTATION_INTERVAL_SECONDS,
  MIN_ACTIVITY_ROTATION_INTERVAL_SECONDS,
  parsePresenceState,
  sanitizeActivityTexts,
  sanitizePresenceRotationIntervalSeconds,
} from "../src/framework/presence/presenceTypes.js";

test("sanitizeActivityTexts fallback sur le texte par defaut", () => {
  const texts = sanitizeActivityTexts(["   ", ""]);
  assert.deepEqual(texts, [DEFAULT_ACTIVITY_TEXT]);
});

test("sanitizePresenceRotationIntervalSeconds borne les valeurs", () => {
  assert.equal(sanitizePresenceRotationIntervalSeconds(1), MIN_ACTIVITY_ROTATION_INTERVAL_SECONDS);
  assert.equal(
    sanitizePresenceRotationIntervalSeconds(MAX_ACTIVITY_ROTATION_INTERVAL_SECONDS + 100),
    MAX_ACTIVITY_ROTATION_INTERVAL_SECONDS,
  );
});

test("parsePresenceState reconstruit un etat valide", () => {
  const parsed = parsePresenceState({
    status: "online",
    activity: {
      type: "PLAYING",
      texts: ["Hello", "World"],
      rotationIntervalSeconds: 20,
    },
  });

  assert.ok(parsed);
  assert.equal(parsed?.status, "online");
  assert.equal(parsed?.activity.type, "PLAYING");
  assert.deepEqual(parsed?.activity.texts, ["Hello", "World"]);
  assert.equal(parsed?.activity.rotationIntervalSeconds, 20);
});

test("parsePresenceState retourne null sur statut invalide", () => {
  const parsed = parsePresenceState({
    status: "invalid",
    activity: {
      type: "PLAYING",
      texts: ["Hello"],
      rotationIntervalSeconds: 20,
    },
  });

  assert.equal(parsed, null);
});
