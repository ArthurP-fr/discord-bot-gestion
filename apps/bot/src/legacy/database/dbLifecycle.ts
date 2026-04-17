export interface DatabaseInitializable {
  name: string;
  init: () => Promise<void>;
}

export class DatabaseLifecycle {
  public constructor(
    private readonly initializables: DatabaseInitializable[],
    private readonly shutdownFn: () => Promise<void>,
  ) {}

  public async init(): Promise<void> {
    for (const resource of this.initializables) {
      try {
        await resource.init();
      } catch (error) {
        await this.shutdownFn().catch(() => undefined);
        throw new Error(`[db:init] ${resource.name} failed`, { cause: error });
      }
    }
  }

  public async shutdown(): Promise<void> {
    await this.shutdownFn();
  }
}
