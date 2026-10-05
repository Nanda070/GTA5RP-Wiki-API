import assert from "node:assert/strict";
import test from "node:test";
import { WikiMapClient } from "./client.js";
import {
  catalogRow,
  fakeWiki,
  flightHtml,
  makeBusinessesCatalog,
  makeRealEstateCatalog,
  makeSnapshot,
  mapPage,
  serverOf,
} from "./test-utils.js";
import type { ServerSlug } from "./types.js";

test("getServerSnapshot selects the server through the query and the map cookie", async () => {
  const wiki = fakeWiki((call) => mapPage(serverOf(call)));
  const client = new WikiMapClient({ fetch: wiki.fetchFn });

  const { meta, data } = await client.getServerSnapshot("sunrise");

  assert.equal(wiki.calls[0]?.url.href, "https://wiki.gta5rp.com/map?server=sunrise");
  assert.equal(wiki.calls[0]?.headers.cookie, "gta5rp-map-server=sunrise");
  assert.equal(meta.server, "sunrise");
  assert.equal(meta.fetchedAt.getTime(), data.fetchedAt);
});

test("getServerSnapshot rejects an unknown server without calling the wiki", async () => {
  const wiki = fakeWiki(() => mapPage("vinewood", null));
  const client = new WikiMapClient({ fetch: wiki.fetchFn });

  await assert.rejects(client.getServerSnapshot("vinewood" as ServerSlug), /Unknown server "vinewood".*downtown/s);
  assert.equal(wiki.calls.length, 0);
});

test("getRealEstateCatalog rejects an unknown server without calling the wiki", async () => {
  const wiki = fakeWiki(() => flightHtml(catalogRow(makeRealEstateCatalog("01"))));
  const client = new WikiMapClient({ fetch: wiki.fetchFn });

  await assert.rejects(client.getRealEstateCatalog("vinewood" as ServerSlug), /Unknown server "vinewood"/);
  assert.equal(wiki.calls.length, 0);
});

test("getRealEstateCatalog rejects a catalog the wiki returned for another server", async () => {
  const wiki = fakeWiki(() => flightHtml(catalogRow(makeRealEstateCatalog("01"))));
  const client = new WikiMapClient({ fetch: wiki.fetchFn });

  await assert.rejects(client.getRealEstateCatalog("blackberry"), /server 01 instead of 04 \(blackberry\)/);
});

test("getRealEstateCatalog returns the catalog of the requested server", async () => {
  const wiki = fakeWiki(() => flightHtml(catalogRow(makeRealEstateCatalog("04"))));
  const client = new WikiMapClient({ fetch: wiki.fetchFn });

  const catalog = await client.getRealEstateCatalog("blackberry");

  assert.equal(wiki.calls[0]?.url.href, "https://wiki.gta5rp.com/realestate?server=blackberry");
  assert.equal(catalog.houses.length, 2);
});

test("getServerSnapshot surfaces HTTP failures with status and URL", async () => {
  const wiki = fakeWiki(() => new Response("down", { status: 503, statusText: "Service Unavailable" }));
  const client = new WikiMapClient({ fetch: wiki.fetchFn });

  await assert.rejects(client.getServerSnapshot("downtown"), /503 Service Unavailable.*\/map\?server=downtown/);
});

test("getEnrichedServerState merges catalog price and defense faction into map objects", async () => {
  const wiki = fakeWiki((call) => {
    if (call.url.pathname === "/map") return mapPage("blackberry");
    if (call.url.pathname === "/realestate") return flightHtml(catalogRow(makeRealEstateCatalog("04")));
    return flightHtml(catalogRow(makeBusinessesCatalog()));
  });
  const client = new WikiMapClient({ fetch: wiki.fetchFn });

  const state = await client.getEnrichedServerState("blackberry");

  assert.equal(state.houses[0]?.price, 1800000);
  assert.equal(state.houses[0]?.classId, "B");
  assert.equal(state.businesses[0]?.defensiveFaction, "F_RUSSIANMAFIA");
  // Blackberry bucket (sid 04), not Downtown's
  assert.equal(state.businesses[0]?.ownerName, "Igor_Legenda");
  assert.equal(state.apartmentBuildings[0]?.catalog?.minPrice, 97500);
});

test("pollAllChanges emits events once the wiki publishes a newer snapshot", async () => {
  let current = makeSnapshot();
  const wiki = fakeWiki((call) => mapPage(serverOf(call), current));
  const client = new WikiMapClient({ fetch: wiki.fetchFn });

  const first = await client.pollAllChanges({}, { servers: ["downtown"] });
  current = makeSnapshot({ fetchedAt: current.fetchedAt + 3_600_000 });
  current.houses[0]!.ownerName = "";
  const second = await client.pollAllChanges(first.store, { servers: ["downtown"] });

  assert.deepEqual(first.events, []);
  assert.deepEqual(
    second.events.map((e) => [e.kind, e.server, e.id, e.previousOwner]),
    [["house_became_free", "downtown", 926, "Ivan_Ivanov"]],
  );
  assert.equal(second.store.downtown?.data.fetchedAt, current.fetchedAt);
});

test("pollAllChanges stays silent while the wiki snapshot timestamp is unchanged", async () => {
  const wiki = fakeWiki((call) => mapPage(serverOf(call)));
  const client = new WikiMapClient({ fetch: wiki.fetchFn });

  const first = await client.pollAllChanges({}, { servers: ["downtown"] });
  const second = await client.pollAllChanges(first.store, { servers: ["downtown"] });

  assert.equal(second.results[0]?.unchanged, true);
  assert.deepEqual(second.events, []);
});

test("pollAllChanges reports a failing server and keeps its previous snapshot", async () => {
  let sunriseDown = false;
  const wiki = fakeWiki((call) =>
    sunriseDown && serverOf(call) === "sunrise" ? new Response("", { status: 502 }) : mapPage(serverOf(call)),
  );
  const client = new WikiMapClient({ fetch: wiki.fetchFn });
  const servers = ["downtown", "sunrise"] as const;

  const first = await client.pollAllChanges({}, { servers });
  sunriseDown = true;
  const second = await client.pollAllChanges(first.store, { servers });

  const sunrise = second.results.find((r) => r.server === "sunrise");
  assert.match(sunrise?.error ?? "", /502/);
  assert.equal(second.results.find((r) => r.server === "downtown")?.error, undefined);
  assert.equal(second.store.sunrise, first.store.sunrise);
});

test("getAllServerSnapshots never runs more requests at once than the concurrency limit", async () => {
  let inFlight = 0;
  let peak = 0;
  const wiki = fakeWiki(async (call) => {
    peak = Math.max(peak, ++inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    return mapPage(serverOf(call));
  });
  const client = new WikiMapClient({ fetch: wiki.fetchFn, concurrency: 2 });

  const snaps = await client.getAllServerSnapshots(["downtown", "strawberry", "blackberry", "insquad", "sunrise"]);

  assert.equal(peak, 2);
  assert.deepEqual(
    snaps.map((s) => s.meta.server),
    ["downtown", "strawberry", "blackberry", "insquad", "sunrise"],
  );
});
