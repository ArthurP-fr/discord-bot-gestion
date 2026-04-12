import { readFileSync } from "node:fs";
import path from "node:path";

import { SUPPORTED_LANGS, type SupportedLang, type TranslationVars } from "../types/command.js";

type JsonObject = Record<string, unknown>;

const DISCORD_LOCALE_MAP: Record<string, SupportedLang> = {
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  fr: "fr",
  "fr-fr": "fr",
  es: "es",
  "es-es": "es",
  "es-419": "es",
};

export class I18nService {
  private readonly dictionaries: Record<SupportedLang, JsonObject>;

  public constructor(private readonly defaultLang: SupportedLang) {
    this.dictionaries = this.loadDictionaries();
  }

  public resolveLang(input?: string | null): SupportedLang {
    if (!input) {
      return this.defaultLang;
    }

    const normalized = input.toLowerCase();

    const direct = DISCORD_LOCALE_MAP[normalized];
    if (direct) {
      return direct;
    }

    const short = normalized.split("-")[0];
    const fromShort = short ? DISCORD_LOCALE_MAP[short] : undefined;
    if (fromShort) {
      return fromShort;
    }

    return this.defaultLang;
  }

  public t(lang: SupportedLang, key: string, vars: TranslationVars = {}): string {
    const fromLang = this.lookup(this.dictionaries[lang], key);
    const fromDefault = this.lookup(this.dictionaries[this.defaultLang], key);

    const template = typeof fromLang === "string" ? fromLang : typeof fromDefault === "string" ? fromDefault : key;

    return this.format(template, vars);
  }

  public commandT(lang: SupportedLang, commandName: string, relativeKey: string, vars: TranslationVars = {}): string {
    return this.t(lang, `${this.commandBaseKey(commandName)}.${relativeKey}`, vars);
  }

  public commandName(lang: SupportedLang, commandName: string): string {
    const key = `${this.commandBaseKey(commandName)}.name`;
    const fromLang = this.lookup(this.dictionaries[lang], key);
    if (typeof fromLang === "string" && fromLang.length > 0) {
      return fromLang;
    }

    const fromDefault = this.lookup(this.dictionaries[this.defaultLang], key);
    if (typeof fromDefault === "string" && fromDefault.length > 0) {
      return fromDefault;
    }

    return commandName;
  }

  public commandTrigger(lang: SupportedLang, commandName: string): string {
    return this.commandName(lang, commandName).trim().toLowerCase();
  }

  public commandObject(lang: SupportedLang, commandName: string): Record<string, unknown> {
    const key = this.commandBaseKey(commandName);
    const fromLang = this.lookup(this.dictionaries[lang], key);
    if (this.isObject(fromLang)) {
      return fromLang;
    }

    const fromDefault = this.lookup(this.dictionaries[this.defaultLang], key);
    if (this.isObject(fromDefault)) {
      return fromDefault;
    }

    return {};
  }

  public format(template: string, vars: TranslationVars = {}): string {
    return this.interpolate(template, vars);
  }

  private loadDictionaries(): Record<SupportedLang, JsonObject> {
    const localeDir = path.join(process.cwd(), "locales");

    return SUPPORTED_LANGS.reduce<Record<SupportedLang, JsonObject>>((acc, lang) => {
      const filePath = path.join(localeDir, `${lang}.json`);
      const raw = readFileSync(filePath, "utf-8");
      acc[lang] = JSON.parse(raw) as JsonObject;
      return acc;
    }, {} as Record<SupportedLang, JsonObject>);
  }

  private lookup(source: JsonObject, key: string): unknown {
    const parts = key.split(".");
    let current: unknown = source;

    for (const part of parts) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }

      current = (current as JsonObject)[part];
    }

    return current;
  }

  private commandBaseKey(commandName: string): string {
    return `commands.${commandName}`;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  private interpolate(template: string, vars: TranslationVars): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, variable: string) => {
      const value = vars[variable];
      return value === undefined || value === null ? "" : String(value);
    });
  }
}
