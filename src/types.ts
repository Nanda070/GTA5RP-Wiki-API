export const ALL_SERVERS = [
  { id: "downtown", number: 1, name: "Downtown", emoji: "🌆" },
  { id: "strawberry", number: 2, name: "Strawberry", emoji: "🍓" },
  { id: "blackberry", number: 4, name: "Blackberry", emoji: "🍇" },
  { id: "insquad", number: 5, name: "Insquad", emoji: "🎭" },
  { id: "sunrise", number: 6, name: "Sunrise", emoji: "🌅" },
  { id: "richman", number: 8, name: "Richman", emoji: "🤵" },
  { id: "eclipse", number: 9, name: "Eclipse", emoji: "🌘" },
  { id: "rockford", number: 12, name: "Rockford", emoji: "💎" },
  { id: "redwood", number: 17, name: "Redwood", emoji: "🌲" },
  { id: "murrieta", number: 20, name: "Murrieta", emoji: "🌹" },
  /** Wiki slug is `lapuerta` (spaces removed), not `la-puerta`. */
  { id: "lapuerta", number: 23, name: "La Puerta", emoji: "🪇" },
  { id: "chiliad", number: 25, name: "Chiliad", emoji: "🏔️" },
  { id: "mirror", number: 26, name: "Mirror", emoji: "🪞" },
] as const;

export type ServerSlug = (typeof ALL_SERVERS)[number]["id"];

export type ServerInfo = (typeof ALL_SERVERS)[number];

export function isServerSlug(value: string): value is ServerSlug {
  return ALL_SERVERS.some((s) => s.id === value);
}

export function findServerById(id: string): ServerInfo | null {
  return ALL_SERVERS.find((s) => s.id === id) ?? null;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ApartmentClassStats {
  className: string;
  total: number;
  free: number;
}

export interface ApartmentStats {
  houseId: number;
  total: number;
  free: number;
  byClass: ApartmentClassStats[];
}

export interface ApartmentHouse {
  id: number;
  name: string;
  position: Vec3;
}

/** House class ids used by the wiki real-estate catalog. */
export type HouseClassId = "N" | "D" | "C" | "B" | "A";

export interface House {
  id: number;
  name: string;
  className: string;
  ownerName: string;
  vehicleCount: number;
  position: Vec3;
  /** Present when merged from `/realestate` catalog */
  price?: number;
  classId?: HouseClassId | string;
  image?: string;
}

export interface Business {
  id: string;
  name: string;
  ownerName: string;
  defensiveFactionLabel?: string;
  defensiveFactionColor?: string;
  position: Vec3;
  /** Present on `/businesses` catalog (`defensiveFaction` raw id) */
  defensiveFaction?: string;
}

/** Catalog row for an apartment building (no per-unit owners in wiki). */
export interface CatalogApartmentBuilding {
  id: number;
  name: string;
  image: string;
  apartmentsCount: number;
  freeCount: number;
  minPrice: number;
  maxPrice: number;
  classNames: string[];
}

export interface CatalogHouse {
  id: number;
  name: string;
  price: number;
  classId: HouseClassId | string;
  className: string;
  ownerName: string;
  vehicleCount: number;
  image: string;
}

export interface RealEstateCatalog {
  server: string;
  fetchedAtMs: number;
  houses: CatalogHouse[];
  apartmentHouses: CatalogApartmentBuilding[];
}

export interface CatalogBusiness {
  internalId: string;
  name: string;
  ownerName: string;
  defensiveFaction: string;
}

export interface BusinessesServerBucket {
  sid: string;
  name: string;
  items: CatalogBusiness[];
}

export interface BusinessesCatalog {
  fetchedAtMs: number;
  servers: BusinessesServerBucket[];
}

/**
 * Richest per-server view: map snapshot + catalog enrichments.
 * Apartment *unit* owners are not published by wiki — only building free/total.
 */
export interface EnrichedServerState {
  server: ServerSlug;
  mapFetchedAt: Date;
  catalogFetchedAt?: Date;
  houses: House[];
  businesses: Business[];
  pfHouses: PfHouse[];
  apartmentBuildings: Array<
    ApartmentHouse & {
      stats?: ApartmentStats;
      catalog?: CatalogApartmentBuilding;
    }
  >;
  familyWarPoints: FamilyPoint[];
  influencePoints: FamilyPoint[];
  yachts: FamilyPoint[];
  gangzones: Gangzone[];
  factions: FactionStatus[];
  blackMarket?: ServerSnapshot["blackMarket"];
  clubMerryweather?: Vec3;
}

export interface PfHouse {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
  position: Vec3;
}

export interface FamilyPoint {
  id: string;
  name?: string;
  familyId: number;
  familyName: string;
  position: Vec3;
}

export interface Gangzone {
  id: number;
  faction: string;
  position: Vec3;
  heading: number;
  radius: number;
}

export interface FactionStatus {
  id: string;
  isActive: boolean;
}

/** Live snapshot embedded in wiki map SSR (`initialServerData`). */
export interface ServerSnapshot {
  fetchedAt: number;
  apartmentHouses: ApartmentHouse[];
  apartmentStats: ApartmentStats[];
  houses: House[];
  business: Business[];
  pfHouses?: PfHouse[];
  gangzone?: Gangzone[];
  familyWarPoints?: FamilyPoint[];
  playerFamilyYacht?: FamilyPoint[];
  playerFamilyPointsWar?: FamilyPoint[];
  blackMarket?: { zone: Vec3; radius: number };
  clubMerryweather?: Vec3;
  factions?: FactionStatus[];
}

export interface SnapshotMeta {
  server: ServerSlug;
  url: string;
  fetchedAt: Date;
}

export interface ServerSnapshotResult {
  meta: SnapshotMeta;
  data: ServerSnapshot;
}

export type ChangeKind =
  | "apartment_free_up"
  | "apartment_free_down"
  | "house_became_free"
  | "house_became_owned"
  | "house_owner_changed"
  | "business_became_free"
  | "business_became_owned"
  | "business_owner_changed"
  | "business_defense_changed"
  | "pf_house_owner_changed"
  | "family_war_changed"
  | "influence_changed"
  | "yacht_changed"
  | "gangzone_changed"
  | "faction_active_changed";

export interface ChangeEvent {
  kind: ChangeKind;
  server: ServerSlug;
  id: number | string;
  name: string;
  previousFree?: number;
  currentFree?: number;
  previousOwner?: string;
  currentOwner?: string;
  previousValue?: string;
  currentValue?: string;
  className?: string;
  deltaFree?: number;
}

/** @deprecated Use ChangeEvent with kind apartment_free_up / house_became_free / business_became_free */
export type SlitEvent = ChangeEvent;

export type SnapshotStore = Partial<Record<ServerSlug, ServerSnapshotResult>>;

export interface ServerPollResult {
  server: ServerSlug;
  snapshot?: ServerSnapshotResult;
  events: ChangeEvent[];
  unchanged: boolean;
  error?: string;
}

export interface AllServersPollResult {
  results: ServerPollResult[];
  events: ChangeEvent[];
  store: SnapshotStore;
}

export interface DetectOptions {
  /** Default: all change kinds */
  kinds?: ChangeKind[];
  /** Only these apartment building ids (per-server global id space) */
  apartmentIds?: number[];
  /** Only these house ids */
  houseIds?: number[];
  /** Only these business ids */
  businessIds?: string[];
  /** Substring match on apartment/house/business name (case-insensitive) */
  nameIncludes?: string[];
  /** Only house classes, e.g. ["Престиж","Стандарт"] */
  houseClasses?: string[];
  /** Minimum free apartments after increase */
  minApartmentFree?: number;
}

export interface FreeApartmentBuilding {
  server: ServerSlug;
  id: number;
  name: string;
  free: number;
  total: number;
  byClass: ApartmentClassStats[];
}

export interface FreeHouseListing {
  server: ServerSlug;
  id: number;
  name: string;
  className: string;
  vehicleCount: number;
  position: Vec3;
}

export interface FreeBusinessListing {
  server: ServerSlug;
  id: string;
  name: string;
  defensiveFactionLabel?: string;
  position: Vec3;
}

export interface ServerFreeSummary {
  server: ServerSlug;
  fetchedAt: Date;
  apartmentsFreeSlots: number;
  apartmentsWithFree: number;
  housesFree: number;
  housesTotal: number;
  businessFree: number;
  businessTotal: number;
}
