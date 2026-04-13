import assert from "node:assert/strict";
import test from "node:test";

import {
  extractTemplateVariables,
  hasTemplateVariable,
  renderTemplate,
} from "../src/framework/utils/templateVariables.js";

test("renderTemplate remplace les variables et applique les alias", () => {
  const output = renderTemplate(
    "Hello {{name}} from {{guilds}}",
    {
      name: "Arthur",
      guild_count: "42",
    },
    {
      aliases: {
        guilds: "guild_count",
      },
    },
  );

  assert.equal(output, "Hello Arthur from 42");
});

test("renderTemplate conserve les variables inconnues par defaut", () => {
  const output = renderTemplate("Missing {{unknown}}", {}, { keepUnknown: true });
  assert.equal(output, "Missing {{unknown}}");
});

test("extractTemplateVariables normalise les alias", () => {
  const variables = extractTemplateVariables("{{bot}} {{guilds}}", {
    bot: "bot_name",
    guilds: "guild_count",
  });

  assert.deepEqual(variables.sort(), ["bot_name", "guild_count"]);
});

test("hasTemplateVariable detecte les variables connues", () => {
  const hasKnown = hasTemplateVariable("{{prefix}} {{other}}", ["prefix", "guild_count"]);
  assert.equal(hasKnown, true);

  const hasUnknownOnly = hasTemplateVariable("{{other}}", ["prefix", "guild_count"]);
  assert.equal(hasUnknownOnly, false);
});
