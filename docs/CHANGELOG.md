# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Parsers decode the Next.js flight chunks (`self.__next_f.push`) before reading JSON, so quotes, backslashes and braces inside names no longer break extraction; payloads split across several chunks are joined.
- `createWatcher` default `staleAfterMs` raised from 20 to 90 minutes: the wiki republishes snapshots about once an hour, so the old default flagged every server as stale for most of each cycle.
- `npm test` runs through `scripts/run-tests.mjs`; the previous glob only worked on Node 21+.
- Published package no longer ships compiled tests and examples.

### Fixed

- `getServerSnapshot` / `getRealEstateCatalog` throw `Unknown server "…"` for slugs outside `ALL_SERVERS` instead of a JSON syntax error.
- `getRealEstateCatalog` rejects a catalog the wiki served for a different server (the wiki silently falls back to its default server).
- `loadSnapshotStore` restores `meta.fetchedAt` as a `Date` (it came back as a string after a save/load round trip).

### Added

- Tests for the client (in-memory wiki), watcher and store; parser tests no longer depend on local `data/` captures.
- GitHub Actions CI on Node 18, 20, 22 and 24.

## [0.1.0] — 2026-10-05

### Added

- Initial public release of **gta5rp-wiki-api**.
- `WikiMapClient` for wiki SSR: map snapshots, real-estate catalog, businesses catalog, enriched server state.
- Multi-server polling: `pollAllSlits`, `pollAllChanges`, concurrency-limited fetches.
- Pure diff helpers: `detectChanges`, `detectSlits` with `DetectOptions` filters.
- Inventory helpers: `listFreeApartments`, `listFreeHouses`, `listFreeBusinesses`, `summarizeFree`, `summarizeAllFree`.
- `createWatcher` for interval monitoring; `loadSnapshotStore` / `saveSnapshotStore` for persistence.
- `ALL_SERVERS` list (including `lapuerta` slug for La Puerta).
- Catalog merge helpers: `isPropertyFree`, `isMansionClass`, `mergeHouses`, `mergeBusinesses`, `buildEnrichedServerState`.
- Runnable examples: snapshot, free-now, watch-all, coverage.
- Unit tests for parse, diff, and catalogs.
- Documentation: English/Russian READMEs and usage guides, contributing notes, MIT license.

### Notes

- Unofficial; not affiliated with GTA5RP.
- Apartment unit owners are not available from the wiki — only building-level free/total stats.
- Data freshness matches the wiki UI, not the in-game tick.
