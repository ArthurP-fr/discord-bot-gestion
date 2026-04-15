import type { Pool } from "pg";

export interface LeaderCoordinator {
  runIfLeader(lockName: string, botId: string, task: () => Promise<void>): Promise<boolean>;
}

export class LocalLeaderCoordinator implements LeaderCoordinator {
  public async runIfLeader(_lockName: string, _botId: string, task: () => Promise<void>): Promise<boolean> {
    await task();
    return true;
  }
}

export class PostgresLeaderCoordinator implements LeaderCoordinator {
  public constructor(
    private readonly pool: Pool,
    private readonly namespace = "discord-bot",
  ) {}

  public async runIfLeader(lockName: string, botId: string, task: () => Promise<void>): Promise<boolean> {
    const advisoryLockKey = hashToInt32(`${this.namespace}:bot:${botId}:leader:${lockName}`);
    const client = await this.pool.connect();

    try {
      const acquiredResult = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [advisoryLockKey],
      );

      const acquired = acquiredResult.rows[0]?.locked ?? false;
      if (!acquired) {
        return false;
      }

      try {
        await task();
        return true;
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [advisoryLockKey]);
      }
    } finally {
      client.release();
    }
  }
}

const hashToInt32 = (value: string): number => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  if (hash === 0) {
    return 1;
  }

  return hash;
};
