import type { CommandArgValue, TranslationVars } from "./command.js";

export interface ArgumentParseError {
  key: string;
  vars?: TranslationVars;
}

export interface ParsedArgumentsResult {
  values: Record<string, CommandArgValue>;
  errors: ArgumentParseError[];
}