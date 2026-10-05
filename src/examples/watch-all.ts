import {
  ALL_SERVERS,
  WikiMapClient,
  type SnapshotStore,
} from "../index.js";

/**
 * Poll every wiki map server once (or in a loop).
 *
 *   node dist/examples/watch-all.js
 *   node dist/examples/watch-all.js --loop 60
 */

const loopArg = process.argv.indexOf("--loop");
const intervalSec = loopArg >= 0 ? Number(process.argv[loopArg + 1] ?? 60) : 0;

const client = new WikiMapClient({ concurrency: 4 });
let store: SnapshotStore = {};

async function tick(round: number) {
  const started = Date.now();
  const { results, events, store: next } = await client.pollAllSlits(store);
  store = next;

  const ok = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error);
  const changed = results.filter((r) => !r.unchanged && !r.error).length;

  console.log(
    JSON.stringify({
      round,
      at: new Date().toISOString(),
      ok,
      total: ALL_SERVERS.length,
      changed,
      events,
      errors: failed.map((f) => ({ server: f.server, error: f.error })),
      ms: Date.now() - started,
    }),
  );
}

if (intervalSec > 0) {
  let round = 1;
  while (true) {
    await tick(round++);
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }
} else {
  await tick(1);
}
