# Руководство по использованию (RU)

Гайд по публичному API **gta5rp-wiki-api**: загрузка SSR вики, обогащение каталогами, детект изменений и вотчер серверов.

## Понятия

| Понятие | Смысл |
|---------|--------|
| **Slug сервера** | Id вики: `blackberry`, `lapuerta`, … (см. `ALL_SERVERS`) |
| **Снимок карты** | Живые владельцы/позиции из SSR `/map` (`initialServerData`) |
| **Каталог** | Доп. поля из `/realestate` или `/businesses` (цены, free) |
| **Enriched state** | Карта + каталоги для одного сервера |
| **Snapshot store** | `Partial<Record<ServerSlug, ServerSnapshotResult>>` для polling |
| **Change event** | Diff двух снимков (`ChangeKind`) |

**Ограничение по квартирам:** вики не отдаёт владельцев отдельных квартир — только `free` / `total` / `byClass` на здание.

**La Puerta:** slug `lapuerta`, не `la-puerta`.

## Установка и клиент

```bash
npm install gta5rp-wiki-api
```

```ts
import { WikiMapClient } from "gta5rp-wiki-api";

const client = new WikiMapClient({
  concurrency: 4,           // параллельные запросы карты (по умолчанию 4)
  // origin: "https://wiki.gta5rp.com",
  // fetch: customFetch,
  // headers: { "user-agent": "my-bot/1.0" },
  // detect: { kinds: ["house_became_free"] },
});
```

| Опция | По умолчанию | Заметки |
|-------|--------------|---------|
| `fetch` | глобальный `fetch` | Для тестов/прокси |
| `origin` | `https://wiki.gta5rp.com` | Хвостовые `/` убираются |
| `headers` | `{}` | Добавляются к каждому запросу |
| `concurrency` | `4` | Лимит параллельных `/map` |
| `detect` | `{}` | Фильтры по умолчанию для `poll*` |

`listServers()` возвращает тот же список, что `ALL_SERVERS`.

---

## `getServerSnapshot(server)`

Запрос `/map?server=…` с cookie `gta5rp-map-server`, разбор `initialServerData`.

```ts
const { meta, data } = await client.getServerSnapshot("blackberry");

meta.server;      // "blackberry"
meta.url;         // URL запроса
meta.fetchedAt;   // Date из payload вики
data.houses;      // House[]
data.business;    // Business[]  (ключ в единственном числе — как в вики)
data.apartmentHouses;
data.apartmentStats;
data.pfHouses;
// + family war / влияние / яхты / гангзоны / фракции / …
```

Быстрее enriched; без цен/картинок каталога.

---

## `getRealEstateCatalog(server)`

Разбор `/realestate?server=…`:

- `houses[]` — владелец, цена, `classId`, гараж, картинка
- `apartmentHouses[]` — `freeCount`, `apartmentsCount`, min/max цена, классы

```ts
const re = await client.getRealEstateCatalog("sunrise");
console.log(re.fetchedAtMs, re.houses.length, re.apartmentHouses[0]?.freeCount);
```

Записи по квартирам — это **здания**, не отдельные квартиры.

---

## `getBusinessesCatalog()`

Один запрос `/businesses`. В ответе уже **все серверы**:

```ts
const catalog = await client.getBusinessesCatalog();
for (const bucket of catalog.servers) {
  console.log(bucket.sid, bucket.items.length); // sid ≈ slug сервера
}
```

Хелпер: `businessesForServer(catalog, "eclipse")`.

---

## `getEnrichedServerState(server)`

Параллельно:

1. `getServerSnapshot`
2. `getRealEstateCatalog`
3. `getBusinessesCatalog` (затем фильтр по серверу)

Возвращает `EnrichedServerState`:

```ts
const state = await client.getEnrichedServerState("richman");

state.houses;              // дома карты + цена/класс/картинка
state.businesses;          // бизнесы + id защиты из каталога
state.pfHouses;
state.apartmentBuildings;  // позиции + stats + опционально catalog
state.familyWarPoints;
state.influencePoints;
state.yachts;
state.gangzones;
state.factions;
```

Хелперы:

```ts
import { isPropertyFree, isMansionClass } from "gta5rp-wiki-api";

state.houses.filter((h) => isPropertyFree(h.ownerName));
state.houses.filter(isMansionClass); // classId B/A
```

Также: `getAllServerSnapshots()` — только карта по многим серверам с concurrency.

---

## Polling: `pollAllSlits` / `pollAllChanges`

Оба принимают предыдущий `SnapshotStore` и возвращают `{ results, events, store }`.

| Метод | События |
|-------|---------|
| `pollAllSlits` | «Стало свободно» / рост free по квартирам |
| `pollAllChanges` | Полный набор (смена владельцев, защита, территории, …) |

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

Варианты на один сервер: `pollSlits`, `pollChanges`.

Если `fetchedAt` вики не изменился — `unchanged: true`, событий нет.

---

## Фильтры `detectChanges`

Чистая функция (вызывать при разных timestamp):

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

| Фильтр | Эффект |
|--------|--------|
| `kinds` | Разрешённые `ChangeKind` |
| `apartmentIds` / `houseIds` / `businessIds` | Allow-list id |
| `nameIncludes` | Подстрока в имени (без учёта регистра) |
| `houseClasses` | Совпадение `className` дома |
| `minApartmentFree` | Для free-up: текущий free ≥ N |

`detectSlits` — подмножество «слотов». Те же `detect` можно передать в опции клиента или в `pollAllChanges({ detect })`.

### Виды изменений

`apartment_free_up` · `apartment_free_down` · `house_became_free` · `house_became_owned` · `house_owner_changed` · `business_became_free` · `business_became_owned` · `business_owner_changed` · `business_defense_changed` · `pf_house_owner_changed` · `family_war_changed` · `influence_changed` · `yacht_changed` · `gangzone_changed` · `faction_active_changed`

---

## Инвентарь

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
listFreeApartments("downtown", data, 1); // минимум свободных слотов

summarizeFree("downtown", { meta, data });
summarizeAllFree(store);
```

Пустой / пробельный `ownerName` = свободно.

---

## Watcher

```ts
import { WikiMapClient, createWatcher } from "gta5rp-wiki-api";

const client = new WikiMapClient({ concurrency: 4 });

const watcher = createWatcher(client, {
  intervalMs: 60_000,
  mode: "changes", // или "slits"
  // servers: ["blackberry", "lapuerta"],
  detect: { kinds: ["house_became_free", "business_became_free"] },
  staleAfterMs: 90 * 60_000,
  onPoll: async ({ events, staleServers }) => {
    console.log(events, "stale:", staleServers);
  },
  onError: (err) => console.error(err),
});

watcher.start();
// watcher.stop();
// watcher.getStore() / setStore(store)
```

`staleServers`: возраст снимка > `staleAfterMs` (по умолчанию 90 минут, экспортируется как `DEFAULT_STALE_AFTER_MS`). Вики перевыпускает снимки примерно раз в час, поэтому порог ниже будет помечать исправные серверы.

---

## Store (сохранение между запусками)

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

Формат файла: `{ version: 1, updatedAt, servers }`. Нет файла → `{}`.

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

## Задержка и этикет

- Свежесть = timestamp SSR вики, **не** тик игры.
- Не завышайте concurrency; `4` по умолчанию — осознанно.
- Опрашивайте с интервалом, не каждую секунду.

## См. также

- [README.ru.md](../README.ru.md)
- [CONTRIBUTING.ru.md](../CONTRIBUTING.ru.md)
- English guide: [en/guide.md](../en/guide.md)
