# gta5rp-wiki-api

Unofficial TypeScript client for **[wiki.gta5rp.com](https://wiki.gta5rp.com)** live map and property snapshots.

There is no public REST API for house/business ownership on GTA5RP. This library fetches the same SSR HTML the wiki UI uses (`/map`, `/realestate`, `/businesses`) and parses the embedded payloads into typed objects.

> **Not affiliated with GTA5RP.** This is a community project. Wiki HTML/RSC shape can change without notice and may break parsing until updated.

[English](README.md) · [Русский](README.ru.md) · [Usage guide](en/guide.md) · [Руководство](ru/guide.md)

## Install

```bash
npm install gta5rp-wiki-api
```

Requires **Node.js 18+** (global `fetch`).

## Quick start

```ts
import {
  WikiMapClient,
  isPropertyFree,
  isMansionClass,
} from "gta5rp-wiki-api";

const client = new WikiMapClient({ concurrency: 4 });

// Richest single-server view (map + real-estate + businesses catalogs)
const state = await client.getEnrichedServerState("blackberry");

const freeHouses = state.houses.filter((h) => isPropertyFree(h.ownerName));
const mansions = state.houses.filter(isMansionClass);
const ownedBiz = state.businesses.filter((b) => !isPropertyFree(b.ownerName));

// Map-only snapshot (faster; no catalog prices)
const { meta, data } = await client.getServerSnapshot("sunrise");
console.log(meta.fetchedAt, data.houses.length);

// All servers' business owners in one request
const bizCatalog = await client.getBusinessesCatalog();
```

## What you can parse

| Object | Owner? | Extra fields | Source |
|--------|--------|--------------|--------|
| **House** (Дом #N) | `ownerName` (empty = free) | class, price, garage, coords, image | map + `/realestate` |
| **Mansion / elite** | same | `classId` `B`/`A` (Престиж / Элитное) | same |
| **PF / family house** | `ownerName` + `ownerId` | coords | map |
| **Business** | `ownerName` | defense faction, coords | map + `/businesses` |
| **Apartment building** | **no per-flat owners** | `free`/`total`/`byClass`, prices | map + `/realestate` |
| Family war / influence / yachts | controlling family | coords | map |
| Gangzones / factions | faction id / active | — | map |

**Apartment limitation:** the wiki does **not** publish who owns each individual apartment unit — only how many units are free in a building (e.g. 1564 San Vitus `1/8`).

## API surface

| Method / helper | Purpose |
|-----------------|---------|
| `new WikiMapClient(options?)` | HTTP client (`concurrency`, `fetch`, `origin`, `detect`) |
| `getServerSnapshot(server)` | Live map SSR snapshot |
| `getRealEstateCatalog(server)` | Houses + apartment buildings (prices, free counts) |
| `getBusinessesCatalog()` | Business owners for **all** servers in one response |
| `getEnrichedServerState(server)` | Map + catalogs merged |
| `getAllServerSnapshots()` | Parallel map snapshots |
| `pollAllSlits` / `pollAllChanges` | Diff previous store → change events |
| `detectChanges` / `detectSlits` | Pure diff helpers with filters |
| `listFree*` / `summarizeFree` | Inventory helpers |
| `createWatcher` | Interval poller |
| `loadSnapshotStore` / `saveSnapshotStore` | Persist poll state to disk |
| `ALL_SERVERS` | Official wiki server list |

Full walkthrough: **[en/guide.md](en/guide.md)**.

## Servers

Use slugs from `ALL_SERVERS`. **La Puerta** is `lapuerta` (not `la-puerta`).

```ts
import { ALL_SERVERS } from "gta5rp-wiki-api";
// downtown, strawberry, blackberry, insquad, sunrise, richman,
// eclipse, rockford, redwood, murrieta, lapuerta, chiliad, mirror
```

## Monitoring / diffs

```ts
import { WikiMapClient } from "gta5rp-wiki-api";

const client = new WikiMapClient({ concurrency: 4 });
let store = {};

const { events, store: next } = await client.pollAllSlits(store);
store = next;
// events: apartment_free_up | house_became_free | business_became_free | …
```

For ownership transfers, territories, and defense changes, use `pollAllChanges` or `detectChanges` with filters (`kinds`, `houseIds`, `nameIncludes`, …).

## Latency caveat

Data freshness matches the **wiki UI** (`fetchedAt` / `fetchedAtMs`), not the in-game tick. Snapshots can lag behind the game world by minutes. Prefer `poll*` / `createWatcher` rather than assuming real-time.

## Examples

```bash
npm run build
npm run example:snapshot      # one server map dump
npm run example:free-now      # free houses/biz/apts across all servers
npm run example:watch-all     # one poll round (or --loop 60)
npm run example:coverage      # field coverage probe
```

## Links

- Wiki: [https://wiki.gta5rp.com](https://wiki.gta5rp.com)
- Guide (EN): [en/guide.md](en/guide.md)
- Guide (RU): [ru/guide.md](ru/guide.md)
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Security: [SECURITY.md](SECURITY.md)
- License: [MIT](../LICENSE)

## Disclaimer

This project is **unofficial** and **not affiliated with, endorsed by, or connected to GTA5RP**, its operators, or Rockstar Games. Use responsibly and respect the wiki’s capacity (default concurrency is conservative).

## License

[MIT](../LICENSE) © 2026 Adnan
