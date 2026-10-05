# Usage guide (English)

This guide covers the public API of **gta5rp-wiki-api**: fetching wiki SSR data, enriching it with catalogs, detecting changes, and watching servers over time.

## Concepts

| Concept | Meaning |
|---------|---------|
| **Server slug** | Wiki id: `blackberry`, `lapuerta`, … (see `ALL_SERVERS`) |
| **Map snapshot** | Live ownership/positions from `/map` SSR (`initialServerData`) |
| **Catalog** | Extra fields from `/realestate` or `/businesses` (prices, free counts) |
| **Enriched state** | Map + catalogs merged for one server |
| **Snapshot store** | `Partial<Record<ServerSlug, ServerSnapshotResult>>` for polling |
| **Change event** | Diff between two snapshots (`ChangeKind`) |

**Apartment limitation:** the wiki never exposes per-unit apartment owners — only building-level `free` / `total` / `byClass`.

**La Puerta:** use slug `lapuerta`, not `la-puerta`.

## Install & client

```bash
npm install gta5rp-wiki-api
```

```ts
import { WikiMapClient } from "gta5rp-wiki-api";

const client = new WikiMapClient({
  concurrency: 4,           // parallel map fetches (default 4)
  // origin: "https://wiki.gta5rp.com",
  // fetch: customFetch,
  // headers: { "user-agent": "my-bot/1.0" },
  // detect: { kinds: ["house_became_free"] },
});
```

| Option | Default | Notes |
|--------|---------|-------|
| `fetch` | global `fetch` | Inject for tests/proxies |
| `origin` | `https://wiki.gta5rp.com` | Trailing slashes stripped |
| `headers` | `{}` | Merged into every request |
| `concurrency` | `4` | Cap parallel `/map` polls |
| `detect` | `{}` | Default filters for `poll*` |

`listServers()` returns the same list as `ALL_SERVERS`.

---

## `getServerSnapshot(server)`

Fetches `/map?server=…` with cookie `gta5rp-map-server`, parses `initialServerData`.

```ts
const { meta, data } = await client.getServerSnapshot("blackberry");

meta.server;      // "blackberry"
meta.url;         // request URL
meta.fetchedAt;   // Date from wiki payload
data.houses;      // House[]
data.business;    // Business[]  (note: singular key from wiki)
data.apartmentHouses;
data.apartmentStats;
data.pfHouses;
// + family war / influence / yachts / gangzones / factions / …
```

Faster than enriched state; no catalog prices/images.

---

## `getRealEstateCatalog(server)`

Parses `/realestate?server=…`:

- `houses[]` — owner, price, `classId`, garage slots, image
- `apartmentHouses[]` — `freeCount`, `apartmentsCount`, min/max price, class names

```ts
const re = await client.getRealEstateCatalog("sunrise");
console.log(re.fetchedAtMs, re.houses.length, re.apartmentHouses[0]?.freeCount);
```

Again: apartment entries are **buildings**, not individual flats.

---

## `getBusinessesCatalog()`

Parses `/businesses` once. The payload already contains **all servers**:

```ts
const catalog = await client.getBusinessesCatalog();
for (const bucket of catalog.servers) {
  console.log(bucket.sid, bucket.items.length); // sid ≈ server slug
}
```

Helper: `businessesForServer(catalog, "eclipse")`.

---

## `getEnrichedServerState(server)`

Runs in parallel:

1. `getServerSnapshot`
2. `getRealEstateCatalog`
3. `getBusinessesCatalog` (then filters to that server)

Returns `EnrichedServerState`:

```ts
const state = await client.getEnrichedServerState("richman");

state.houses;              // map houses + catalog price/class/image
state.businesses;          // map businesses + catalog defense id
state.pfHouses;
state.apartmentBuildings;  // positions + stats + optional catalog row
state.familyWarPoints;
state.influencePoints;
state.yachts;
state.gangzones;
state.factions;
```

Helpers from catalogs:

```ts
import { isPropertyFree, isMansionClass } from "gta5rp-wiki-api";

state.houses.filter((h) => isPropertyFree(h.ownerName));
state.houses.filter(isMansionClass); // classId B/A
```

Also available: `getAllServerSnapshots()` — map-only for many servers with concurrency.

---

## Polling: `pollAllSlits` / `pollAllChanges`

Both take a previous `SnapshotStore` and return `{ results, events, store }`.

| Method | Events |
|--------|--------|
| `pollAllSlits` | “Became free” / apartment free-up style slits |
| `pollAllChanges` | Full set (ownership transfers, defense, territories, …) |

```ts
import { WikiMapClient, type SnapshotStore } from "gta5rp-wiki-api";

const client = new WikiMapClient({ concurrency: 4 });
let store: SnapshotStore = {};

const { events, store: next, results } = await client.pollAllSlits(store);
store = next;

for (const e of events) {
  console.log(e.kind, e.server, e.name);
}

for (const r of results) {
  if (r.error) console.warn(r.server, r.error);
}
```

Single-server variants: `pollSlits`, `pollChanges`.

If wiki `fetchedAt` is unchanged, `unchanged: true` and no events.

---

## `detectChanges` filters

Pure function (call when timestamps differ):

```ts
import { detectChanges, detectSlits } from "gta5rp-wiki-api";

const events = detectChanges(server, prev.data, next.data, {
  kinds: ["house_became_free", "business_became_free", "apartment_free_up"],
  houseIds: [12, 34],
  businessIds: ["biz_1"],
  apartmentIds: [33],
  nameIncludes: ["San Vitus", "АЗС"],
  houseClasses: ["Престиж", "Элитное"],
  minApartmentFree: 2,
});
```

| Filter | Effect |
|--------|--------|
| `kinds` | Allow-list of `ChangeKind` |
| `apartmentIds` / `houseIds` / `businessIds` | Id allow-lists |
| `nameIncludes` | Case-insensitive substring on name |
| `houseClasses` | Match house `className` |
| `minApartmentFree` | For free-up: require current free ≥ N |

`detectSlits` is the slits-focused subset. Pass the same `detect` via client options or `pollAllChanges({ detect })`.

### Change kinds

`apartment_free_up` · `apartment_free_down` · `house_became_free` · `house_became_owned` · `house_owner_changed` · `business_became_free` · `business_became_owned` · `business_owner_changed` · `business_defense_changed` · `pf_house_owner_changed` · `family_war_changed` · `influence_changed` · `yacht_changed` · `gangzone_changed` · `faction_active_changed`

---

## Inventory helpers

```ts
import {
  listFreeApartments,
  listFreeHouses,
  listFreeBusinesses,
  summarizeFree,
  summarizeAllFree,
} from "gta5rp-wiki-api";

const { meta, data } = await client.getServerSnapshot("downtown");

listFreeHouses("downtown", data);
listFreeBusinesses("downtown", data);
listFreeApartments("downtown", data, 1); // min free slots

summarizeFree("downtown", { meta, data });
// apartmentsFreeSlots, housesFree/housesTotal, businessFree/businessTotal, …

summarizeAllFree(store); // after multi-server poll
```

Empty / whitespace `ownerName` = free.

---

## Watcher

```ts
import { WikiMapClient, createWatcher } from "gta5rp-wiki-api";

const client = new WikiMapClient({ concurrency: 4 });

const watcher = createWatcher(client, {
  intervalMs: 60_000,
  mode: "changes", // or "slits"
  // servers: ["blackberry", "lapuerta"],
  detect: { kinds: ["house_became_free", "business_became_free"] },
  staleAfterMs: 20 * 60_000,
  onPoll: async ({ events, staleServers }) => {
    console.log(events, "stale:", staleServers);
  },
  onError: (err) => console.error(err),
});

watcher.start();
// watcher.stop();
// watcher.getStore() / setStore(store)
```

`staleServers`: snapshot age > `staleAfterMs` (default 20 minutes).

---

## Store (persist between runs)

```ts
import {
  loadSnapshotStore,
  saveSnapshotStore,
  snapshotFetchedAtMs,
} from "gta5rp-wiki-api";

let store = await loadSnapshotStore("./.cache/snapshots.json");
const { store: next, events } = await client.pollAllChanges(store);
await saveSnapshotStore("./.cache/snapshots.json", next);

snapshotFetchedAtMs(next.blackberry); // number | null
```

File format: `{ version: 1, updatedAt, servers }`. Missing file → `{}`.

---

## `ALL_SERVERS`

```ts
import { ALL_SERVERS, isServerSlug, findServerById } from "gta5rp-wiki-api";

ALL_SERVERS.map((s) => s.id);
// downtown, strawberry, blackberry, insquad, sunrise, richman,
// eclipse, rockford, redwood, murrieta, lapuerta, chiliad, mirror

isServerSlug("lapuerta");           // true
findServerById("lapuerta")?.name;   // "La Puerta"
```

---

## Latency & etiquette

- Freshness = wiki SSR timestamp, **not** game tick.
- Keep concurrency modest; default `4` is intentional.
- Prefer polling on interval rather than hammering every second.

## Related

- [README](../../README.md)
- [CONTRIBUTING](../../CONTRIBUTING.md)
- Russian guide: [docs/ru/guide.md](../ru/guide.md)
