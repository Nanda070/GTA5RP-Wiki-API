import { extractEscapedJsonObject } from "./rsc.js";
import { findServerById, type ServerSlug } from "./types.js";
import type {
  Business,
  BusinessesCatalog,
  CatalogApartmentBuilding,
  CatalogBusiness,
  CatalogHouse,
  EnrichedServerState,
  House,
  RealEstateCatalog,
  ServerSnapshot,
  ServerSnapshotResult,
} from "./types.js";

export function parseRealEstateCatalogFromHtml(html: string): RealEstateCatalog {
  const parsed = extractEscapedJsonObject(html, String.raw`\"houses\":[`) as Record<string, unknown>;
  if (!Array.isArray(parsed.houses) || !Array.isArray(parsed.apartmentHouses)) {
    throw new Error("Real-estate catalog missing houses/apartmentHouses");
  }
  if (typeof parsed.fetchedAtMs !== "number") {
    throw new Error("Real-estate catalog missing fetchedAtMs");
  }

  return {
    server: String(parsed.server ?? ""),
    fetchedAtMs: parsed.fetchedAtMs,
    houses: parsed.houses as CatalogHouse[],
    apartmentHouses: parsed.apartmentHouses as CatalogApartmentBuilding[],
  };
}

export function parseBusinessesCatalogFromHtml(html: string): BusinessesCatalog {
  const parsed = extractEscapedJsonObject(html, String.raw`\"servers\":[`) as Record<string, unknown>;
  if (!Array.isArray(parsed.servers) || typeof parsed.fetchedAtMs !== "number") {
    throw new Error("Businesses catalog missing servers/fetchedAtMs");
  }
  return {
    fetchedAtMs: parsed.fetchedAtMs,
    servers: parsed.servers as BusinessesCatalog["servers"],
  };
}

export function businessesForServer(
  catalog: BusinessesCatalog,
  server: ServerSlug,
): CatalogBusiness[] {
  const info = findServerById(server);
  if (!info) return [];
  const sid = String(info.number).padStart(2, "0");
  const bySid = catalog.servers.find((s) => s.sid === sid);
  if (bySid) return bySid.items;
  const byName = catalog.servers.find((s) => s.name.toLowerCase().replace(/\s+/g, "") === server);
  return byName?.items ?? [];
}

/** Merge map houses with `/realestate` catalog (price, classId, image). */
export function mergeHouses(mapHouses: House[], catalogHouses: CatalogHouse[]): House[] {
  const cat = new Map(catalogHouses.map((h) => [h.id, h]));
  return mapHouses.map((h) => {
    const c = cat.get(h.id);
    if (!c) return h;
    return {
      ...h,
      // Prefer live map ownerName; fall back to catalog
      ownerName: h.ownerName || c.ownerName,
      className: h.className || c.className,
      vehicleCount: h.vehicleCount ?? c.vehicleCount,
      price: c.price,
      classId: c.classId,
      image: c.image,
    };
  });
}

/** Merge map businesses with catalog defensiveFaction id. */
export function mergeBusinesses(mapBusiness: Business[], catalogItems: CatalogBusiness[]): Business[] {
  const cat = new Map(catalogItems.map((b) => [b.internalId, b]));
  return mapBusiness.map((b) => {
    const c = cat.get(b.id);
    if (!c) return b;
    return {
      ...b,
      ownerName: b.ownerName || c.ownerName,
      name: b.name || c.name,
      defensiveFaction: c.defensiveFaction,
      defensiveFactionLabel: b.defensiveFactionLabel,
    };
  });
}

export function buildEnrichedServerState(
  snapshot: ServerSnapshotResult,
  realEstate?: RealEstateCatalog,
  businesses?: CatalogBusiness[],
): EnrichedServerState {
  const data = snapshot.data;
  const houses = realEstate ? mergeHouses(data.houses, realEstate.houses) : data.houses;
  const biz = businesses ? mergeBusinesses(data.business, businesses) : data.business;

  const stats = new Map(data.apartmentStats.map((s) => [s.houseId, s]));
  const catalogApts = new Map((realEstate?.apartmentHouses ?? []).map((a) => [a.id, a]));

  return {
    server: snapshot.meta.server,
    mapFetchedAt: snapshot.meta.fetchedAt,
    catalogFetchedAt: realEstate ? new Date(realEstate.fetchedAtMs) : undefined,
    houses,
    businesses: biz,
    pfHouses: data.pfHouses ?? [],
    apartmentBuildings: data.apartmentHouses.map((h) => ({
      ...h,
      stats: stats.get(h.id),
      catalog: catalogApts.get(h.id),
    })),
    familyWarPoints: data.familyWarPoints ?? [],
    influencePoints: data.playerFamilyPointsWar ?? [],
    yachts: data.playerFamilyYacht ?? [],
    gangzones: data.gangzone ?? [],
    factions: data.factions ?? [],
    blackMarket: data.blackMarket,
    clubMerryweather: data.clubMerryweather,
  };
}

export function isPropertyFree(ownerName: string | undefined): boolean {
  return !ownerName || ownerName.trim() === "";
}

/** Prestige / elite houses often called «особняки» by players. */
export function isMansionClass(house: Pick<House, "classId" | "className">): boolean {
  if (house.classId === "B" || house.classId === "A") return true;
  const n = house.className.toLowerCase();
  return n.includes("престиж") || n.includes("элит");
}

export type { ServerSnapshot };
