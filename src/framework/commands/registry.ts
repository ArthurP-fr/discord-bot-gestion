import type { BotCommand, PrefixTriggerMatch } from "../types/command.js";
import { SUPPORTED_LANGS } from "../types/command.js";
import type { I18nService } from "../../i18n/index.js";

const normalize = (value: string): string => value.trim().toLowerCase();

export class CommandRegistry {
  private readonly commandsByName = new Map<string, BotCommand>();
  private readonly prefixTriggers = new Map<string, PrefixTriggerMatch>();
  private readonly slashTriggers = new Map<string, BotCommand>();

  public constructor(
    commands: BotCommand[],
    private readonly i18n: I18nService,
  ) {
    for (const command of commands) {
      this.register(command);
    }
  }

  public getAll(): readonly BotCommand[] {
    return [...this.commandsByName.values()];
  }

  public findByName(name: string): BotCommand | undefined {
    return this.commandsByName.get(normalize(name));
  }

  public findByAnyPrefixTrigger(trigger: string): PrefixTriggerMatch | undefined {
    return this.prefixTriggers.get(normalize(trigger));
  }

  public findBySlashTrigger(trigger: string): BotCommand | undefined {
    return this.slashTriggers.get(normalize(trigger));
  }

  private register(command: BotCommand): void {
    const name = normalize(command.meta.name);
    if (this.commandsByName.has(name)) {
      throw new Error(`Duplicate command meta.name: ${command.meta.name}`);
    }

    this.commandsByName.set(name, command);

    for (const lang of SUPPORTED_LANGS) {
      const trigger = normalize(this.i18n.commandTrigger(lang, command.meta.name));
      const existing = this.prefixTriggers.get(trigger);

      if (existing) {
        if (existing.command.meta.name !== command.meta.name) {
          throw new Error(`Duplicate prefix trigger: ${trigger}`);
        }
        continue;
      }

      this.prefixTriggers.set(trigger, {
        command,
        lang,
        trigger,
      });
    }

    const slashKeys = [command.meta.name, ...SUPPORTED_LANGS.map((lang) => this.i18n.commandName(lang, command.meta.name))];

    for (const keyRaw of slashKeys) {
      const key = normalize(keyRaw);
      const existing = this.slashTriggers.get(key);

      if (existing && existing.meta.name !== command.meta.name) {
        throw new Error(`Duplicate slash trigger: ${key}`);
      }

      this.slashTriggers.set(key, command);
    }
  }
}
