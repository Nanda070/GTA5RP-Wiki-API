# Участие в разработке

Спасибо за интерес к **gta5rp-wiki-api**. [English version](CONTRIBUTING.md).

## Требования

- Node.js **18+**
- npm

## Установка

```bash
git clone https://github.com/Nanda070/GTA5RP-Wiki-API.git
cd GTA5RP-Wiki-API
npm install
```

## Сборка

```bash
npm run build
```

Компиляция `src/` → `dist/` (ESM, декларации, source maps).

## Тесты

```bash
npm test
```

Сначала `tsc`, затем встроенный test runner Node по `dist/**/*.test.js`.

Тесты парсеров/diff/каталогов используют фикстуры и чистые функции; живая вики не обязательна.

## Примеры

Сначала `npm run build`, затем:

```bash
npm run example:snapshot
npm run example:free-now
npm run example:watch-all
npm run example:watch-all -- --loop 60
npm run example:coverage
```

Живые примеры ходят на `wiki.gta5rp.com` — не завышайте concurrency и не гоняйте tight-loop в CI.

## Структура

| Путь | Назначение |
|------|------------|
| `src/client.ts` | `WikiMapClient` HTTP + poll |
| `src/parse.ts` / `rsc.ts` | Парсинг SSR карты |
| `src/catalogs.ts` | Каталоги недвижимости / бизнесов |
| `src/diff.ts` | Детект изменений |
| `src/inventory.ts` | Списки свободного |
| `src/watcher.ts` / `store.ts` | Поллинг |
| `src/types.ts` | Типы + `ALL_SERVERS` |
| `src/examples/` | Демо |
| `docs/` | Гайды EN/RU |

## Правила

- Небольшие, сфокусированные PR.
- Стиль TypeScript как в репозитории (`strict`, NodeNext ESM).
- Не коммитьте `node_modules/`, `dist/`, дампы `data/`, `.env`.
- При смене HTML вики обновляйте тесты и парсеры вместе.
- Пользовательские изменения API — в `CHANGELOG.md` и README/гайдах.

## Лицензия

Внося вклад, вы соглашаетесь с публикацией под [MIT](LICENSE).
