import { detectChanges, detectSlits } from "./diff.js";
import {
  businessesForServer,
  buildEnrichedServerState,
  parseBusinessesCatalogFromHtml,
  parseRealEstateCatalogFromHtml,
} from "./catalogs.js";
import { parseInitialServerDataFromHtml } from "./parse.js";
import {
  ALL_SERVERS,
  type AllServersPollResult,
  type BusinessesCatalog,
  type DetectOptions,
  type EnrichedServerState,
  type RealEstateCatalog,
  type ServerPollResult,
  type ServerSlug,
  type ServerSnapshotResult,
  type SnapshotStore,
  type ChangeEvent,
} from "./types.js";

const WIKI_ORIGIN = "https://wiki.gta5rp.com";
const MAP_COOKIE = "gta5rp-map-server";

export interface WikiClientOptions {
  /** Custom fetch (tests, proxy). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Base URL, default https://wiki.gta5rp.com */
  origin?: string;
  /** Request headers merged into each call */
  headers?: Record<string, string>;
  /**
   * Max parallel map fetches when polling many servers.
   * Default 4 — keeps load on wiki reasonable.
   */
  concurrency?: number;
  /** Default filters for poll* methods */
  detect?: DetectOptions;
}

export class WikiMapClient {
  private readonly fetchFn: typeof fetch;
  private readonly origin: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly concurrency: number;
  private readonly detectDefaults: DetectOptions;

  constructor(options: WikiClientOptions = {}) {
    this.fetchFn = options.fetch ?? fetch;
    this.origin = (options.origin ?? WIKI_ORIGIN).replace(/\/+$/, "");
    this.extraHeaders = options.headers ?? {};
    this.concurrency = Math.max(1, options.concurrency ?? 4);
    this.detectDefaults = options.detect ?? {};
  }

  /** Official map server list (all wiki servers). */
  listServers() {
    return ALL_SERVERS;
  }

  private async fetchHtml(path: string, server?: ServerSlug): Promise<{ url: string; html: string }> {
    const url = `${this.origin}${path}`;
    const res = await this.fetchFn(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        ...(server ? { cookie: `${MAP_COOKIE}=${encodeURIComponent(server)}` } : {}),
        "cache-control": "no-cache",
        ...this.extraHeaders,
      },
    });
    if (!res.ok) {
      throw new Error(`Wiki request failed: ${res.status} ${res.statusText} (${url})`);
    }
    return { url, html: await res.text() };
  }

  /** Full live snapshot from map page SSR. */
  async getServerSnapshot(server: ServerSlug): Promise<ServerSnapshotResult> {
    const { url, html } = await this.fetchHtml(`/map?server=${encodeURIComponent(server)}`, server);
    const data = parseInitialServerDataFromHtml(html);

    return {
      meta: {
        server,
        url,
        fetchedAt: new Date(data.fetchedAt),
      },
      data,
    };
  }

  /**
   * `/realestate` catalog for one server: house owners + price/class/image,
   * apartment buildings with freeCount (not per-unit owners).
   */
  async getRealEstateCatalog(server: ServerSlug): Promise<RealEstateCatalog> {
    const { html } = await this.fetchHtml(`/realestate?server=${encodeURIComponent(server)}`, server);
    return parseRealEstateCatalogFromHtml(html);
  }

  /**
   * `/businesses` catalog — payload includes **all** servers' business owners
   * in one response (`servers[].items`).
   */
  async getBusinessesCatalog(): Promise<BusinessesCatalog> {
    const { html } = await this.fetchHtml("/businesses");
    return parseBusinessesCatalogFromHtml(html);
  }

  /**
   * Richest view for one server: map positions + catalog prices/owners.
   *
   * Coverage:
   * - houses / mansions: owner, class, price, garage slots, coords
   * - businesses: owner, defense faction, coords
   * - pf (family) houses: ownerId + ownerName + coords
   * - apartment buildings: free/total by class — **not** each flat's owner
   * - family war / influence / yachts / gangzones / factions
   */
  async getEnrichedServerState(server: ServerSlug): Promise<EnrichedServerState> {
    const [snapshot, realEstate, businessesCatalog] = await Promise.all([
      this.getServerSnapshot(server),
      this.getRealEstateCatalog(server),
      this.getBusinessesCatalog(),
    ]);
    return buildEnrichedServerState(
      snapshot,
      realEstate,
      businessesForServer(businessesCatalog, server),
    );
  }

  /** Snapshots for many servers (default: all). */
  async getAllServerSnapshots(
    servers: readonly ServerSlug[] = ALL_SERVERS.map((s) => s.id),
  ): Promise<ServerSnapshotResult[]> {
    return mapPool(servers, this.concurrency, (server) => this.getServerSnapshot(server));
  }

  /** Wiki site search (official small JSON API). Not live property data. */
  async search(query: string): Promise<{ results: unknown[] }> {
    const url = `${this.origin}/api/search?q=${encodeURIComponent(query)}`;
    const res = await this.fetchFn(url, { headers: { accept: "application/json", ...this.extraHeaders } });
    if (!res.ok) {
      throw new Error(`Wiki search failed: ${res.status}`);
    }
    return (await res.json()) as { results: unknown[] };
  }

  async pollChanges(
    server: ServerSlug,
    previous: ServerSnapshotResult | null,
    detect: DetectOptions = this.detectDefaults,
  ): Promise<{ snapshot: ServerSnapshotResult; events: ChangeEvent[]; unchanged: boolean }> {
    const snapshot = await this.getServerSnapshot(server);

    if (!previous || previous.data.fetchedAt === snapshot.data.fetchedAt) {
      return { snapshot, events: [], unchanged: true };
    }

    const events = detectChanges(server, previous.data, snapshot.data, detect);
    return { snapshot, events, unchanged: false };
  }

  async pollSlits(
    server: ServerSlug,
    previous: ServerSnapshotResult | null,
    detect: DetectOptions = this.detectDefaults,
  ): Promise<{ snapshot: ServerSnapshotResult; events: ChangeEvent[]; unchanged: boolean }> {
    const snapshot = await this.getServerSnapshot(server);

    if (!previous || previous.data.fetchedAt === snapshot.data.fetchedAt) {
      return { snapshot, events: [], unchanged: true };
    }

    const events = detectSlits(server, previous.data, snapshot.data, detect);
    return { snapshot, events, unchanged: false };
  }

  async pollAllChanges(
    previous: SnapshotStore = {},
    opts: { servers?: readonly ServerSlug[]; detect?: DetectOptions } = {},
  ): Promise<AllServersPollResult> {
    const servers = opts.servers ?? ALL_SERVERS.map((s) => s.id);
    const detect = opts.detect ?? this.detectDefaults;
    return this.pollMany(previous, servers, (server, prev) => this.pollChanges(server, prev, detect));
  }

  async pollAllSlits(
    previous: SnapshotStore = {},
    servers: readonly ServerSlug[] = ALL_SERVERS.map((s) => s.id),
  ): Promise<AllServersPollResult> {
    return this.pollMany(previous, servers, (server, prev) => this.pollSlits(server, prev));
  }

  private async pollMany(
    previous: SnapshotStore,
    servers: readonly ServerSlug[],
    worker: (
      server: ServerSlug,
      prev: ServerSnapshotResult | null,
    ) => Promise<{ snapshot: ServerSnapshotResult; events: ChangeEvent[]; unchanged: boolean }>,
  ): Promise<AllServersPollResult> {
    const settled = await mapPool(servers, this.concurrency, async (server): Promise<ServerPollResult> => {
      try {
        const { snapshot, events, unchanged } = await worker(server, previous[server] ?? null);
        return { server, snapshot, events, unchanged };
      } catch (e) {
        return {
          server,
          events: [],
          unchanged: true,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    });

    const store: SnapshotStore = { ...previous };
    const events: ChangeEvent[] = [];

    for (const result of settled) {
      if (result.snapshot) {
        store[result.server] = result.snapshot;
      }
      events.push(...result.events);
    }

    return { results: settled, events, store };
  }
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}
