import type { TemplateRenderOptions } from "../types/templateVariables.js";

const createTemplateTokenRegex = (): RegExp => /\{\{([a-zA-Z0-9_]+)\}\}/g;

const normalizeVariableName = (rawName: string): string => rawName.toLowerCase();

const normalizeAliases = (aliases: Record<string, string> = {}): Record<string, string> =>
  Object.entries(aliases).reduce<Record<string, string>>((acc, [from, to]) => {
    acc[normalizeVariableName(from)] = normalizeVariableName(to);
    return acc;
  }, {});

const resolveVariableName = (rawName: string, aliases: Record<string, string>): string => {
  const normalized = normalizeVariableName(rawName);
  return aliases[normalized] ?? normalized;
};

export const extractTemplateVariables = (template: string, aliases: Record<string, string> = {}): string[] => {
  const normalizedAliases = normalizeAliases(aliases);
  const found = new Set<string>();

  for (const match of template.matchAll(createTemplateTokenRegex())) {
    const rawName = match[1];
    if (!rawName) {
      continue;
    }

    found.add(resolveVariableName(rawName, normalizedAliases));
  }

  return [...found];
};

export const hasTemplateVariable = (
  template: string,
  knownVariableNames: Iterable<string>,
  aliases: Record<string, string> = {},
): boolean => {
  const normalizedAliases = normalizeAliases(aliases);
  const normalizedKnownVariables = new Set(
    [...knownVariableNames].map((name) => normalizeVariableName(name)),
  );

  for (const match of template.matchAll(createTemplateTokenRegex())) {
    const rawName = match[1];
    if (!rawName) {
      continue;
    }

    const resolvedName = resolveVariableName(rawName, normalizedAliases);
    if (normalizedKnownVariables.has(resolvedName)) {
      return true;
    }
  }

  return false;
};

export const renderTemplate = (
  template: string,
  values: Record<string, string>,
  options: TemplateRenderOptions = {},
): string => {
  const normalizedAliases = normalizeAliases(options.aliases);
  const keepUnknown = options.keepUnknown ?? true;
  const normalizedValues = Object.entries(values).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeVariableName(key)] = value;
    return acc;
  }, {});

  return template.replace(
    createTemplateTokenRegex(),
    (match: string, doubleBracedName?: string) => {
      const rawName = doubleBracedName;
      if (!rawName) {
        return match;
      }

      const resolvedName = resolveVariableName(rawName, normalizedAliases);
      const resolvedValue = normalizedValues[resolvedName];
      if (resolvedValue === undefined) {
        return keepUnknown ? match : "";
      }

      return resolvedValue;
    },
  );
};
