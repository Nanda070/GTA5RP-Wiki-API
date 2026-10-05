import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ServerSnapshotResult, SnapshotStore } from "./types.js";

export interface PersistedStore {
  version: 1;
  updatedAt: string;
  servers: SnapshotStore;
}

/** Compact store for disk (drop huge unused arrays if needed later). */
export async function loadSnapshotStore(filePath: string): Promise<SnapshotStore> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as PersistedStore | SnapshotStore;
    if ("servers" in parsed && parsed.servers) return parsed.servers;
    return parsed as SnapshotStore;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return {};
    throw e;
  }
}

export async function saveSnapshotStore(filePath: string, store: SnapshotStore): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const payload: PersistedStore = {
    version: 1,
    updatedAt: new Date().toISOString(),
    servers: store,
  };
  await writeFile(filePath, JSON.stringify(payload), "utf8");
}

export function snapshotFetchedAtMs(result: ServerSnapshotResult | undefined): number | null {
  return result?.data.fetchedAt ?? null;
}
