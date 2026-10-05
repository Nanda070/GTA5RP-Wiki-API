import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadSnapshotStore, saveSnapshotStore } from "./store.js";
import { makeSnapshot } from "./test-utils.js";
import type { SnapshotStore } from "./types.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gta5rp-wiki-api-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function makeStore(): SnapshotStore {
  const data = makeSnapshot();
  return {
    downtown: {
      meta: { server: "downtown", url: "https://wiki.gta5rp.com/map?server=downtown", fetchedAt: new Date(data.fetchedAt) },
      data,
    },
  };
}

test("saveSnapshotStore creates missing directories and loadSnapshotStore reads the store back", () =>
  withTempDir(async (dir) => {
    const file = path.join(dir, "nested", "state", "store.json");
    const store = makeStore();

    await saveSnapshotStore(file, store);
    const loaded = await loadSnapshotStore(file);

    assert.deepEqual(loaded.downtown?.data, store.downtown?.data);
    assert.equal(loaded.downtown?.meta.url, store.downtown?.meta.url);
  }));

test("loadSnapshotStore restores meta.fetchedAt as a Date", () =>
  withTempDir(async (dir) => {
    const file = path.join(dir, "store.json");
    const store = makeStore();

    await saveSnapshotStore(file, store);
    const loaded = await loadSnapshotStore(file);

    assert.ok(loaded.downtown?.meta.fetchedAt instanceof Date);
    assert.equal(loaded.downtown?.meta.fetchedAt.getTime(), store.downtown?.meta.fetchedAt.getTime());
  }));

test("loadSnapshotStore returns an empty store when the file does not exist", () =>
  withTempDir(async (dir) => {
    assert.deepEqual(await loadSnapshotStore(path.join(dir, "missing.json")), {});
  }));

test("loadSnapshotStore accepts a bare store written without the version envelope", () =>
  withTempDir(async (dir) => {
    const file = path.join(dir, "store.json");
    await writeFile(file, JSON.stringify(makeStore()), "utf8");

    const loaded = await loadSnapshotStore(file);

    assert.equal(loaded.downtown?.data.houses[0]?.id, 926);
    assert.ok(loaded.downtown?.meta.fetchedAt instanceof Date);
  }));

test("loadSnapshotStore rejects a corrupted file instead of silently starting empty", () =>
  withTempDir(async (dir) => {
    const file = path.join(dir, "store.json");
    await writeFile(file, "{not json", "utf8");

    await assert.rejects(loadSnapshotStore(file), SyntaxError);
  }));
