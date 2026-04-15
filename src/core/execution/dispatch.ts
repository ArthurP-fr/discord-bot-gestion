import type {
  BotCommand,
  CommandArgValue,
  CommandExecutionContext,
  CommandSource,
  SupportedLang,
} from "../../types/command.js";
import type { AppLogger } from "../logging/logger.js";
import type { CommandExecutor } from "./CommandExecutor.js";

export interface CommandDispatchPort {
  dispatch(command: BotCommand, ctx: CommandExecutionContext): Promise<void>;
}

export type CommandDispatchMode = "local" | "worker";

export interface CommandExecutionJob {
  botId: string;
  requestId: string;
  commandName: string;
  source: CommandSource;
  lang: SupportedLang;
  actor: {
    userId: string;
    guildId: string | null;
    channelId: string | null;
  };
  args: Record<string, unknown>;
  queuedAt: number;
}

export interface CommandJobPublisher {
  publish(job: CommandExecutionJob): Promise<void>;
}

export class LocalCommandDispatchPort implements CommandDispatchPort {
  public constructor(private readonly executor: CommandExecutor) {}

  public async dispatch(command: BotCommand, ctx: CommandExecutionContext): Promise<void> {
    await this.executor.run(command, ctx);
  }
}

export class WorkerCommandDispatchPort implements CommandDispatchPort {
  public constructor(
    private readonly publisher: CommandJobPublisher,
    private readonly logger: AppLogger,
  ) {}

  public async dispatch(command: BotCommand, ctx: CommandExecutionContext): Promise<void> {
    const job = toExecutionJob(command, ctx);

    await this.publisher.publish(job);

    this.logger.info(
      {
        requestId: ctx.execution.requestId,
        command: command.meta.name,
        source: ctx.execution.source,
      },
      "command queued for worker execution",
    );

    await ctx.reply(ctx.t("errors.executionQueued"));
  }
}

const toExecutionJob = (command: BotCommand, ctx: CommandExecutionContext): CommandExecutionJob => {
  const botId = ctx.transport.client.user?.id;
  if (!botId) {
    throw new Error("runtime bot id unavailable for worker command dispatch");
  }

  const serializedArgs = Object.fromEntries(
    Object.entries(ctx.execution.args).map(([key, value]) => [key, serializeArgValue(value)]),
  );

  return {
    botId,
    requestId: ctx.execution.requestId,
    commandName: command.meta.name,
    source: ctx.execution.source,
    lang: ctx.i18nContext.lang,
    actor: {
      userId: ctx.execution.actor.userId,
      guildId: ctx.execution.actor.guildId,
      channelId: ctx.execution.actor.channelId,
    },
    args: serializedArgs,
    queuedAt: Date.now(),
  };
};

const serializeArgValue = (value: CommandArgValue): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "object" && "id" in value && typeof value.id === "string") {
    return {
      id: value.id,
    };
  }

  return String(value);
};
