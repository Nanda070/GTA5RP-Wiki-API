import type { WikiMapClient } from "./client.js";
import type {
  AllServersPollResult,
  DetectOptions,
  ServerSlug,
  SnapshotStore,
} from "./types.js";

export interface WatcherOptions {
  /** Poll interval in ms. Default 30_000. */
  intervalMs?: number;
  servers?: readonly ServerSlug[];
  detect?: DetectOptions;
  /** Use full change detection (default) or slits-only. */
  mode?: "changes" | "slits";
  /** Alert if wiki snapshot age exceeds this (ms). Default 20 minutes. */
  staleAfterMs?: number;
  onPoll?: (result: AllServersPollResult & { staleServers: ServerSlug[] }) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
}

/**
 * Continuous multi-server watcher. Keeps store in memory between ticks.
 */
export function createWatcher(client: WikiMapClient, options: WatcherOptions = {}) {
  const intervalMs = options.intervalMs ?? 30_000;
  const staleAfterMs = options.staleAfterMs ?? 20 * 60_000;
  const mode = options.mode ?? "changes";
  let store: SnapshotStore = {};
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let stopped = false;

  async function tick(): Promise<void> {
    if (running || stopped) return;
    running = true;
    try {
      const result =
        mode === "slits"
          ? await client.pollAllSlits(store, options.servers)
          : await client.pollAllChanges(store, { servers: options.servers, detect: options.detect });

      store = result.store;
      const now = Date.now();
      const staleServers = result.results
        .filter((r) => r.snapshot && now - r.snapshot.data.fetchedAt > staleAfterMs)
        .map((r) => r.server);

      await options.onPoll?.({ ...result, staleServers });
    } catch (e) {
      await options.onError?.(e);
    } finally {
      running = false;
    }
  }

  return {
    getStore: () => store,
    setStore: (next: SnapshotStore) => {
      store = next;
    },
    tick,
    start() {
      stopped = false;
      void tick();
      timer = setInterval(() => void tick(), intervalMs);
      return this;
    },
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
