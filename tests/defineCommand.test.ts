import assert from "node:assert/strict";
import test from "node:test";

import { defineCommand } from "../src/framework/commands/defineCommand.js";

test("defineCommand refuse un argument requis apres un optionnel", () => {
  assert.throws(() => {
    defineCommand({
      meta: { name: "broken", category: "test" },
      args: [
        { name: "optional", type: "string", required: false, descriptionKey: "args.optional" },
        { name: "required", type: "string", required: true, descriptionKey: "args.required" },
      ],
      execute: async () => undefined,
    });
  });
});

test("defineCommand refuse un cooldown invalide", () => {
  assert.throws(() => {
    defineCommand({
      meta: { name: "brokenCooldown", category: "test" },
      cooldown: 0,
      execute: async () => undefined,
    });
  });
});

test("defineCommand applique les valeurs par defaut", () => {
  const command = defineCommand({
    meta: { name: "ok", category: "test" },
    execute: async () => undefined,
  });

  assert.deepEqual(command.args, []);
  assert.deepEqual(command.permissions, []);
  assert.deepEqual(command.examples, []);
  assert.equal(command.cooldown, undefined);
});
