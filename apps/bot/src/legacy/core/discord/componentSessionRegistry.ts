export interface ComponentPanelSession {
  collector: {
    stop: (reason?: string) => void;
  };
  disable: () => Promise<void>;
}

export class ComponentSessionRegistry<T extends ComponentPanelSession> {
  private readonly sessions = new Map<string, T>();

  public get(key: string): T | undefined {
    return this.sessions.get(key);
  }

  public async replace(key: string, next: T): Promise<void> {
    const existing = this.sessions.get(key);
    if (existing) {
      existing.collector.stop("replaced");
      await existing.disable().catch(() => undefined);
    }

    this.sessions.set(key, next);
  }

  public deleteIfCollectorMatch(key: string, collector: T["collector"]): void {
    const existing = this.sessions.get(key);
    if (!existing) {
      return;
    }

    if (existing.collector === collector) {
      this.sessions.delete(key);
    }
  }

  public async stopAll(reason = "shutdown"): Promise<void> {
    const entries = [...this.sessions.values()];
    this.sessions.clear();

    for (const session of entries) {
      session.collector.stop(reason);
      await session.disable().catch(() => undefined);
    }
  }
}
