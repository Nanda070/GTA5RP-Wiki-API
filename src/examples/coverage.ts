import {
  WikiMapClient,
  isMansionClass,
  isPropertyFree,
} from "../index.js";

/** Demonstrate full ownership coverage for one server. */
const server = (process.argv[2] ?? "blackberry") as "blackberry";
const client = new WikiMapClient();
const state = await client.getEnrichedServerState(server);

const freeHouses = state.houses.filter((h) => isPropertyFree(h.ownerName));
const mansions = state.houses.filter(isMansionClass);
const freeMansions = mansions.filter((h) => isPropertyFree(h.ownerName));
const freeBiz = state.businesses.filter((b) => isPropertyFree(b.ownerName));
const ownedBiz = state.businesses.filter((b) => !isPropertyFree(b.ownerName));

console.log(
  JSON.stringify(
    {
      server: state.server,
      mapFetchedAt: state.mapFetchedAt,
      catalogFetchedAt: state.catalogFetchedAt,
      houses: {
        total: state.houses.length,
        free: freeHouses.length,
        withPrice: state.houses.filter((h) => h.price != null).length,
        sampleOwned: state.houses.find((h) => !isPropertyFree(h.ownerName)),
      },
      mansions: {
        total: mansions.length,
        free: freeMansions.length,
        classes: [...new Set(mansions.map((h) => `${h.classId}:${h.className}`))],
        sample: mansions.find((h) => !isPropertyFree(h.ownerName)),
      },
      pfHouses: {
        total: state.pfHouses.length,
        sample: state.pfHouses[0],
      },
      apartments: {
        buildings: state.apartmentBuildings.length,
        note: "wiki does not publish per-unit apartment owners — only free/total",
        sample: state.apartmentBuildings.find((a) => a.id === 33) ?? state.apartmentBuildings[0],
      },
      businesses: {
        total: state.businesses.length,
        free: freeBiz.length,
        owned: ownedBiz.length,
        sampleOwned: ownedBiz[0],
        sampleFree: freeBiz[0] ?? null,
      },
      territories: {
        familyWar: state.familyWarPoints.length,
        influence: state.influencePoints.length,
        yachts: state.yachts.length,
        gangzones: state.gangzones.length,
        factions: state.factions.length,
      },
    },
    null,
    2,
  ),
);
