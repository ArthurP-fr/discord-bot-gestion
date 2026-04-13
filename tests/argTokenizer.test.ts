import assert from "node:assert/strict";
import test from "node:test";

import { tokenizePrefixInput } from "../src/framework/commands/argParser.js";

test("tokenizePrefixInput parse les quotes simples et doubles", () => {
  const tokens = tokenizePrefixInput('"hello world" test \'foo bar\'');
  assert.deepEqual(tokens, ["hello world", "test", "foo bar"]);
});

test("tokenizePrefixInput conserve les tokens non quotes", () => {
  const tokens = tokenizePrefixInput("alpha beta gamma");
  assert.deepEqual(tokens, ["alpha", "beta", "gamma"]);
});

test("tokenizePrefixInput gere les quotes echappees", () => {
  const tokens = tokenizePrefixInput('"say \\"hello\\"" done');
  assert.deepEqual(tokens, ['say "hello"', "done"]);
});
