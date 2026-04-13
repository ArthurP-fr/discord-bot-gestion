import {
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type Message,
  type PermissionResolvable,
} from "discord.js";

import type { BotCommand, CommandExecutionContext } from "../../types/command.js";

const COOLDOWN_SWEEP_INTERVAL_MS = 60_000;
const COOLDOWN_SWEEP_MIN_ENTRIES = 512;

export class CommandExecutor {
  private readonly cooldowns = new Map<string, number>();
  private lastCooldownSweepAt = 0;

  public async run(command: BotCommand, ctx: CommandExecutionContext): Promise<void> {
    const missingUserPermissions = this.getMissingPermissions(command.permissions, this.memberPermissions(ctx));
    if (missingUserPermissions.length > 0) {
      await ctx.reply(ctx.t("errors.permissions.user", { permissions: missingUserPermissions.join(", ") }));
      return;
    }

    const remainingCooldownSeconds = this.consumeCooldown(command, ctx.user.id);
    if (remainingCooldownSeconds > 0) {
      await ctx.reply(ctx.t("errors.cooldown", { seconds: remainingCooldownSeconds }));
      return;
    }

    try {
      await command.execute(ctx);
    } catch (error) {
      console.error(`[command:${command.meta.name}] execution failed`, error);
      await ctx.reply(ctx.t("errors.execution"));
    }
  }

  private memberPermissions(ctx: CommandExecutionContext): Readonly<PermissionsBitField> | null {
    if (ctx.source === "slash") {
      return (ctx.raw as ChatInputCommandInteraction).memberPermissions ?? null;
    }

    const message = ctx.raw as Message;
    return message.member?.permissions ?? null;
  }

  private getMissingPermissions(
    required: PermissionResolvable[],
    available: Readonly<PermissionsBitField> | null,
  ): string[] {
    if (required.length === 0) {
      return [];
    }

    if (!available) {
      return [...new Set(required.flatMap((permission) => this.permissionToLabels(permission)))];
    }

    return [
      ...new Set(
        required
          .filter((permission) => !available.has(permission))
          .flatMap((permission) => this.permissionToLabels(permission)),
      ),
    ];
  }

  private permissionToLabels(permission: PermissionResolvable): string[] {
    try {
      const resolved = PermissionsBitField.resolve(permission);
      const labels = new PermissionsBitField(resolved).toArray().map(this.formatPermissionLabel);
      if (labels.length > 0) {
        return labels;
      }
    } catch {
      // Fallback handled below.
    }

    return [String(permission)];
  }

  private formatPermissionLabel(permission: string): string {
    return permission
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .trim();
  }

  private consumeCooldown(command: BotCommand, userId: string): number {
    if (command.cooldown === undefined || command.cooldown <= 0) {
      return 0;
    }

    const key = this.cooldownKey(command.meta.name, userId);
    const now = Date.now();
    this.sweepExpiredCooldowns(now);

    const expiresAt = this.cooldowns.get(key);

    if (expiresAt !== undefined && expiresAt > now) {
      return Math.ceil((expiresAt - now) / 1000);
    }

    if (expiresAt !== undefined) {
      this.cooldowns.delete(key);
    }

    this.cooldowns.set(key, now + command.cooldown * 1000);
    return 0;
  }

  private sweepExpiredCooldowns(now: number): void {
    if (this.cooldowns.size === 0) {
      return;
    }

    const shouldSweepBySize = this.cooldowns.size >= COOLDOWN_SWEEP_MIN_ENTRIES;
    const shouldSweepByTime = now - this.lastCooldownSweepAt >= COOLDOWN_SWEEP_INTERVAL_MS;
    if (!shouldSweepBySize && !shouldSweepByTime) {
      return;
    }

    for (const [key, expiresAt] of this.cooldowns.entries()) {
      if (expiresAt <= now) {
        this.cooldowns.delete(key);
      }
    }

    this.lastCooldownSweepAt = now;
  }

  private cooldownKey(commandName: string, userId: string): string {
    return `${commandName}:${userId}`;
  }
}
