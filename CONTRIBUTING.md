# Contributing

Thanks for helping improve **gta5rp-wiki-api**. [Русская версия](CONTRIBUTING.ru.md).

## Prerequisites

- Node.js **18+**
- npm

## Setup

```bash
git clone https://github.com/Nanda070/GTA5RP-Wiki-API.git
cd GTA5RP-Wiki-API
npm install
```

## Build

```bash
npm run build
```

Compiles `src/` → `dist/` (ESM, declarations, source maps).

## Test

```bash
npm test
```

Runs `tsc`, then Node’s built-in test runner on `dist/**/*.test.js`.

Parser/diff/catalog tests use fixtures and pure functions; they do not require live wiki access.

## Examples

Build first, then:

```bash
npm run example:snapshot
npm run example:free-now
npm run example:watch-all
npm run example:watch-all -- --loop 60
npm run example:coverage
```

Live examples hit `wiki.gta5rp.com` — keep concurrency reasonable and avoid tight loops in CI.

## Project layout

| Path | Role |
|------|------|
| `src/client.ts` | `WikiMapClient` HTTP + poll |
| `src/parse.ts` / `rsc.ts` | Map SSR parsing |
| `src/catalogs.ts` | Real-estate / businesses catalogs |
| `src/diff.ts` | Change detection |
| `src/inventory.ts` | Free listings / summaries |
| `src/watcher.ts` / `store.ts` | Polling helpers |
| `src/types.ts` | Shared types + `ALL_SERVERS` |
| `src/examples/` | Runnable demos |
| `docs/` | EN/RU guides |

## Guidelines

- Prefer small, focused PRs.
- Match existing TypeScript style (`strict`, NodeNext ESM).
- Do not commit `node_modules/`, `dist/`, `data/` HTML dumps, or `.env`.
- When wiki HTML shape changes, add/adjust tests and parsers together.
- Document user-facing API changes in `CHANGELOG.md` and both READMEs/guides when relevant.

## License

By contributing, you agree your work is released under the [MIT License](LICENSE).
