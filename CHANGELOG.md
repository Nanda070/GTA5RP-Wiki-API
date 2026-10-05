# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
