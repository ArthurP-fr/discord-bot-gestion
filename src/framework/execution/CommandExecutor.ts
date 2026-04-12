import {
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type Message,
  type PermissionResolvable,
} from "discord.js";

import type { BotCommand, CommandExecutionContext } from "../types/command.js";

export class CommandExecutor {
  public async run(command: BotCommand, ctx: CommandExecutionContext): Promise<void> {
    const missingUserPermissions = this.getMissingPermissions(command.permissions, this.memberPermissions(ctx));
    if (missingUserPermissions.length > 0) {
      await ctx.reply(ctx.t("errors.permissions.user", { permissions: missingUserPermissions.join(", ") }));
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
}
