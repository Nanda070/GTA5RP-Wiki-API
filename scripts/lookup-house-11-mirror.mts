import { mkdirSync, writeFileSync } from "node:fs";
import { WikiMapClient, isPropertyFree, isMansionClass } from "../dist/index.js";

const TARGET_ID = 11;
const TARGET_NAME = "Дом #11";
const OUT = "data/house-11-mirror.json";

mkdirSync("data", { recursive: true });

const client = new WikiMapClient();
const state = await client.getEnrichedServerState("mirror");

const house =
  state.houses.find((h) => h.id === TARGET_ID) ??
  state.houses.find((h) => h.name === TARGET_NAME) ??
  state.houses.find((h) => /дом\s*#?\s*11/i.test(h.name));

if (!house) {
  console.error(
    "House not found. Nearby ids / mansion-like:",
    state.houses
      .filter((h) => h.id <= 30 || isMansionClass(h))
      .slice(0, 40)
      .map((h) => ({ id: h.id, name: h.name, classId: h.classId, className: h.className })),
  );
  process.exit(1);
}

const free = isPropertyFree(house.ownerName);
const mansion = isMansionClass(house);
const payload = {
  server: state.server,
  mapFetchedAt: state.mapFetchedAt,
  catalogFetchedAt: state.catalogFetchedAt,
  id: house.id,
  name: house.name,
  ownerName: house.ownerName,
  className: house.className,
  classId: house.classId,
  price: house.price,
  vehicleCount: house.vehicleCount,
  position: house.position,
  image: house.image,
  free,
  owned: !free,
  isMansionClass: mansion,
  house,
};

writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");

console.log(JSON.stringify(payload, null, 2));
console.log("---");
console.log("ownerName:", house.ownerName || "(empty)");
console.log("status:", free ? "FREE" : "OWNED");
console.log("isMansionClass:", mansion);
console.log("wrote:", OUT);
