import assert from "node:assert/strict";
import test from "node:test";
import { WikiMapClient } from "./client.js";
import { fakeWiki, makeSnapshot, mapPage, serverOf } from "./test-utils.js";
import type { AllServersPollResult, ServerSlug, ServerSnapshot } from "./types.js";
import { createWatcher } from "./watcher.js";

type Poll = AllServersPollResult & { staleServers: ServerSlug[] };

const MINUTE = 60_000;
const servers = ["downtown"] as const;

/** Wiki that serves whatever `state.current` holds, for every server. */
function liveWiki(initial: ServerSnapshot = makeSnapshot()) {
  const state = { current: initial };
  const wiki = fakeWiki((call) => mapPage(serverOf(call), state.current));
  return { state, calls: wiki.calls, client: new WikiMapClient({ fetch: wiki.fetchFn }) };
}

const aged = (ms: number) => makeSnapshot({ fetchedAt: Date.now() - ms });

test("createWatcher does not call a snapshot from the current hourly wiki cycle stale", async () => {
  const { client } = liveWiki(aged(55 * MINUTE));
  const polls: Poll[] = [];
  const watcher = createWatcher(client, { servers, onPoll: (p) => void polls.push(p) });

  await watcher.tick();

  assert.deepEqual(polls[0]?.staleServers, []);
});

test("createWatcher flags a server whose snapshot missed a whole wiki update cycle", async () => {
  const { client } = liveWiki(aged(125 * MINUTE));
  const polls: Poll[] = [];
  const watcher = createWatcher(client, { servers, onPoll: (p) => void polls.push(p) });

  await watcher.tick();

  assert.deepEqual(polls[0]?.staleServers, ["downtown"]);
});

test("createWatcher honours a custom staleAfterMs", async () => {
  const { client } = liveWiki(aged(10 * MINUTE));
  const polls: Poll[] = [];
  const watcher = createWatcher(client, { servers, staleAfterMs: 5 * MINUTE, onPoll: (p) => void polls.push(p) });

  await watcher.tick();

  assert.deepEqual(polls[0]?.staleServers, ["downtown"]);
});

test("createWatcher remembers the previous poll and reports what changed since", async () => {
  const { client, state } = liveWiki();
  const polls: Poll[] = [];
  const watcher = createWatcher(client, { servers, onPoll: (p) => void polls.push(p) });

  await watcher.tick();
  state.current = makeSnapshot({ fetchedAt: state.current.fetchedAt + 60 * MINUTE });
  state.current.business[0]!.ownerName = "Petr_Petrov";
  await watcher.tick();

  assert.deepEqual(polls[0]?.events, []);
  assert.deepEqual(
    polls[1]?.events.map((e) => [e.kind, e.currentOwner]),
    [["business_became_owned", "Petr_Petrov"]],
  );
  assert.equal(watcher.getStore().downtown?.data.fetchedAt, state.current.fetchedAt);
});

test("createWatcher in slits mode reports only property that became free", async () => {
  const { client, state } = liveWiki();
  const polls: Poll[] = [];
  const watcher = createWatcher(client, { servers, mode: "slits", onPoll: (p) => void polls.push(p) });

  await watcher.tick();
  state.current = makeSnapshot({ fetchedAt: state.current.fetchedAt + 60 * MINUTE });
  state.current.business[0]!.ownerName = "Petr_Petrov";
  state.current.houses[0]!.ownerName = "";
  await watcher.tick();

  assert.deepEqual(
    polls[1]?.events.map((e) => e.kind),
    ["house_became_free"],
  );
});

test("createWatcher passes an onPoll failure to onError and keeps ticking", async () => {
  const { client } = liveWiki();
  const errors: unknown[] = [];
  let polls = 0;
  const watcher = createWatcher(client, {
    servers,
    onPoll: () => {
      polls++;
      throw new Error("handler broke");
    },
    onError: (e) => void errors.push(e),
  });

  await watcher.tick();
  await watcher.tick();

  assert.equal(polls, 2);
  assert.match(String(errors[0]), /handler broke/);
});

test("createWatcher start() polls immediately and stop() ends polling", async () => {
  const { client, calls } = liveWiki();
  let resolveFirst!: () => void;
  const firstPoll = new Promise<void>((resolve) => (resolveFirst = resolve));
  const watcher = createWatcher(client, { servers, intervalMs: 3_600_000, onPoll: () => resolveFirst() });

  watcher.start();
  await firstPoll;
  watcher.stop();
  await watcher.tick();

  assert.equal(calls.length, 1);
});
