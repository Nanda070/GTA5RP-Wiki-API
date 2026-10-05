import type { BusinessesCatalog, RealEstateCatalog, ServerSlug, ServerSnapshot } from "./types.js";

export interface WikiCall {
  url: URL;
  headers: Record<string, string>;
}

/** In-memory wiki: `route` answers each request with HTML or a full Response. */
export function fakeWiki(route: (call: WikiCall) => string | Response | Promise<string | Response>) {
  const calls: WikiCall[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: new URL(String(input)), headers: (init?.headers ?? {}) as Record<string, string> };
    calls.push(call);
    const out = await route(call);
    return typeof out === "string" ? new Response(out) : out;
  }) as typeof fetch;
  return { fetchFn, calls };
}

export const mapPage = (server: string, data: ServerSnapshot | null = makeSnapshot()) =>
  flightHtml(mapRow(server, data));

export const serverOf = (call: WikiCall) => call.url.searchParams.get("server") as ServerSlug;

/**
 * Wrap RSC payload text the way Next.js inlines it into SSR HTML:
 * one `self.__next_f.push([1,"…"])` script per chunk.
 */
export function flightHtml(...chunks: string[]): string {
  const scripts = chunks
    .map((chunk) => `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`)
    .join("");
  return `<!DOCTYPE html><html><body>${scripts}</body></html>`;
}

/** RSC row of the wiki `/map` page. */
export function mapRow(server: string, data: ServerSnapshot | null): string {
  return `1c:${JSON.stringify(["$", "$L24", null, { initialServerSlug: server, initialServerData: data, initialServerZones: [] }])}\n`;
}

/** RSC row of the wiki `/realestate` and `/businesses` pages. */
export function catalogRow(initialData: unknown): string {
  return `3e:${JSON.stringify(["$", "div", null, { className: "page-layout-main", children: ["$", "$L3f", null, { initialData }] }])}\n`;
}

export function makeSnapshot(overrides: Partial<ServerSnapshot> = {}): ServerSnapshot {
  return {
    fetchedAt: 1791224100000,
    apartmentHouses: [{ id: 33, name: "1564 San Vitus", position: { x: -201.23, y: 186.22, z: 79.32 } }],
    apartmentStats: [{ houseId: 33, total: 8, free: 1, byClass: [] }],
    houses: [
      {
        id: 926,
        name: "Дом #926",
        className: "Престиж",
        ownerName: "Ivan_Ivanov",
        vehicleCount: 6,
        position: { x: -371.9, y: 343.55, z: 108.94 },
      },
    ],
    business: [
      {
        id: "PRODUCT_SHOP_5",
        name: "Магазин 24/7 #5",
        ownerName: "",
        position: { x: 378.79, y: 321.01, z: 102.38 },
      },
    ],
    ...overrides,
  };
}

export function makeRealEstateCatalog(server = "04"): RealEstateCatalog {
  return {
    server,
    fetchedAtMs: 1791224100000,
    houses: [
      {
        id: 926,
        name: "Дом #926",
        price: 1800000,
        classId: "B",
        className: "Престиж",
        ownerName: "Ivan_Ivanov",
        vehicleCount: 6,
        image: "https://files.example/house_926.webp",
      },
      {
        id: 533,
        name: "Дом #533",
        price: 260000,
        classId: "D",
        className: "Стандарт",
        ownerName: "",
        vehicleCount: 2,
        image: "https://files.example/house_533.webp",
      },
    ],
    apartmentHouses: [
      {
        id: 33,
        name: "1564 San Vitus",
        image: "https://files.example/1564_SAN_VITUS.webp",
        apartmentsCount: 8,
        freeCount: 1,
        minPrice: 97500,
        maxPrice: 155000,
        classNames: ["Комфорт", "Стандарт"],
      },
    ],
  };
}

export function makeBusinessesCatalog(): BusinessesCatalog {
  const item = (ownerName: string) => ({
    internalId: "PRODUCT_SHOP_5",
    name: "Магазин 24/7 #5",
    ownerName,
    defensiveFaction: "F_RUSSIANMAFIA",
  });
  return {
    fetchedAtMs: 1791224100000,
    servers: [
      { sid: "01", name: "Downtown", items: [item("Petr_Petrov")] },
      { sid: "04", name: "Blackberry", items: [item("Igor_Legenda")] },
    ],
  };
}
