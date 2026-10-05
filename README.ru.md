# gta5rp-wiki-api

Неофициальный TypeScript-клиент для живой карты и снимков недвижимости **[wiki.gta5rp.com](https://wiki.gta5rp.com)**.

У GTA5RP нет публичного REST API по владельцам домов и бизнесов. Библиотека запрашивает тот же SSR HTML, что использует UI вики (`/map`, `/realestate`, `/businesses`), и разбирает встроенные данные в типизированные объекты.

> **Не связано с GTA5RP.** Это community-проект. Формат HTML/RSC вики может измениться без предупреждения и сломать парсинг до обновления библиотеки.

[English](README.md) · [Русский](README.ru.md) · [Usage guide](docs/en/guide.md) · [Руководство](docs/ru/guide.md)

## Установка

```bash
npm install gta5rp-wiki-api
```

Нужен **Node.js 18+** (глобальный `fetch`).

## Быстрый старт

```ts
import {
  WikiMapClient,
  isPropertyFree,
  isMansionClass,
} from "gta5rp-wiki-api";

const client = new WikiMapClient({ concurrency: 4 });

// Самый полный вид по одному серверу (карта + каталоги)
const state = await client.getEnrichedServerState("blackberry");

const freeHouses = state.houses.filter((h) => isPropertyFree(h.ownerName));
const mansions = state.houses.filter(isMansionClass);
const ownedBiz = state.businesses.filter((b) => !isPropertyFree(b.ownerName));

// Только карта (быстрее; без цен из каталога)
const { meta, data } = await client.getServerSnapshot("sunrise");
console.log(meta.fetchedAt, data.houses.length);

// Владельцы бизнесов всех серверов — одним запросом
const bizCatalog = await client.getBusinessesCatalog();
```

## Что можно разобрать

| Объект | Владелец? | Доп. поля | Источник |
|--------|-----------|-----------|----------|
| **Дом** (Дом #N) | `ownerName` (пусто = свободен) | класс, цена, гараж, координаты, картинка | карта + `/realestate` |
| **Особняк / элита** | то же | `classId` `B`/`A` (Престиж / Элитное) | то же |
| **ПФ / семейный дом** | `ownerName` + `ownerId` | координаты | карта |
| **Бизнес** | `ownerName` | фракция защиты, координаты | карта + `/businesses` |
| **Жилой комплекс** | **нет владельцев по квартирам** | `free`/`total`/`byClass`, цены | карта + `/realestate` |
| Family war / влияние / яхты | контролирующая семья | координаты | карта |
| Гангзоны / фракции | id фракции / active | — | карта |

**Ограничение по квартирам:** вики **не публикует**, кто владеет каждой отдельной квартирой — только сколько свободных мест в здании (например, 1564 San Vitus `1/8`).

## Поверхность API

| Метод / хелпер | Назначение |
|----------------|------------|
| `new WikiMapClient(options?)` | HTTP-клиент (`concurrency`, `fetch`, `origin`, `detect`) |
| `getServerSnapshot(server)` | Живой SSR-снимок карты |
| `getRealEstateCatalog(server)` | Дома + ЖК (цены, свободные слоты) |
| `getBusinessesCatalog()` | Владельцы бизнесов **всех** серверов в одном ответе |
| `getEnrichedServerState(server)` | Карта + каталоги в одном объекте |
| `getAllServerSnapshots()` | Параллельные снимки карты |
| `pollAllSlits` / `pollAllChanges` | Diff предыдущего store → события |
| `detectChanges` / `detectSlits` | Чистый diff с фильтрами |
| `listFree*` / `summarizeFree` | Инвентарь свободного |
| `createWatcher` | Поллер по интервалу |
| `loadSnapshotStore` / `saveSnapshotStore` | Сохранение состояния на диск |
| `ALL_SERVERS` | Список серверов вики |

Подробный гайд: **[docs/ru/guide.md](docs/ru/guide.md)**.

## Серверы

Используйте slug из `ALL_SERVERS`. **La Puerta** — это `lapuerta` (не `la-puerta`).

```ts
import { ALL_SERVERS } from "gta5rp-wiki-api";
// downtown, strawberry, blackberry, insquad, sunrise, richman,
// eclipse, rockford, redwood, murrieta, lapuerta, chiliad, mirror
```

## Мониторинг / diff

```ts
import { WikiMapClient } from "gta5rp-wiki-api";

const client = new WikiMapClient({ concurrency: 4 });
let store = {};

const { events, store: next } = await client.pollAllSlits(store);
store = next;
// events: apartment_free_up | house_became_free | business_became_free | …
```

Для смены владельцев, территорий и защиты используйте `pollAllChanges` или `detectChanges` с фильтрами (`kinds`, `houseIds`, `nameIncludes`, …).

## Задержка данных

Свежесть совпадает с **UI вики** (`fetchedAt` / `fetchedAtMs`), а не с тиком игры. Снимки могут отставать от игрового мира на минуты. Предпочитайте `poll*` / `createWatcher`, а не ожидание realtime.

## Примеры

```bash
npm run build
npm run example:snapshot      # дамп карты одного сервера
npm run example:free-now      # свободные дома/биз/кв по всем серверам
npm run example:watch-all     # один раунд опроса (или --loop 60)
npm run example:coverage      # покрытие полей
```

## Ссылки

- Вики: [https://wiki.gta5rp.com](https://wiki.gta5rp.com)
- Гайд (EN): [docs/en/guide.md](docs/en/guide.md)
- Гайд (RU): [docs/ru/guide.md](docs/ru/guide.md)
- Участие: [CONTRIBUTING.md](CONTRIBUTING.md) · [CONTRIBUTING.ru.md](CONTRIBUTING.ru.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Безопасность: [SECURITY.md](SECURITY.md)
- Лицензия: [MIT](LICENSE)

## Отказ от ответственности

Проект **неофициальный** и **не связан с GTA5RP**, его операторами или Rockstar Games. Используйте ответственно и не перегружайте вики (concurrency по умолчанию умеренный).

## Лицензия

[MIT](LICENSE) © 2026 Adnan
