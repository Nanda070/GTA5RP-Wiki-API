import type {
  FreeApartmentBuilding,
  FreeBusinessListing,
  FreeHouseListing,
  ServerFreeSummary,
  ServerSlug,
  ServerSnapshot,
  ServerSnapshotResult,
  SnapshotStore,
} from "./types.js";

function isFreeOwner(ownerName: string | undefined): boolean {
  return !ownerName || ownerName.trim() === "";
}

export function listFreeApartments(
  server: ServerSlug,
  data: ServerSnapshot,
  minFree = 1,
): FreeApartmentBuilding[] {
  const names = new Map(data.apartmentHouses.map((h) => [h.id, h.name]));
  return data.apartmentStats
    .filter((s) => s.free >= minFree)
    .map((s) => ({
      server,
      id: s.houseId,
      name: names.get(s.houseId) ?? `apartment #${s.houseId}`,
      free: s.free,
      total: s.total,
      byClass: s.byClass,
    }))
    .sort((a, b) => b.free - a.free || a.name.localeCompare(b.name));
}

export function listFreeHouses(server: ServerSlug, data: ServerSnapshot): FreeHouseListing[] {
  return data.houses
    .filter((h) => isFreeOwner(h.ownerName))
    .map((h) => ({
      server,
      id: h.id,
      name: h.name,
      className: h.className,
      vehicleCount: h.vehicleCount,
      position: h.position,
    }))
    .sort((a, b) => a.id - b.id);
}

export function listFreeBusinesses(server: ServerSlug, data: ServerSnapshot): FreeBusinessListing[] {
  return data.business
    .filter((b) => isFreeOwner(b.ownerName))
    .map((b) => ({
      server,
      id: b.id,
      name: b.name,
      defensiveFactionLabel: b.defensiveFactionLabel,
      position: b.position,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function summarizeFree(server: ServerSlug, result: ServerSnapshotResult): ServerFreeSummary {
  const { data, meta } = result;
  const apts = listFreeApartments(server, data, 1);
  return {
    server,
    fetchedAt: meta.fetchedAt,
    apartmentsFreeSlots: apts.reduce((sum, a) => sum + a.free, 0),
    apartmentsWithFree: apts.length,
    housesFree: listFreeHouses(server, data).length,
    housesTotal: data.houses.length,
    businessFree: listFreeBusinesses(server, data).length,
    businessTotal: data.business.length,
  };
}

export function summarizeAllFree(store: SnapshotStore): ServerFreeSummary[] {
  return Object.entries(store)
    .filter((entry): entry is [ServerSlug, ServerSnapshotResult] => !!entry[1])
    .map(([server, result]) => summarizeFree(server, result))
    .sort((a, b) => a.server.localeCompare(b.server));
}
