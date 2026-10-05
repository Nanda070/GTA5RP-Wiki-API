import { mkdirSync, writeFileSync } from "node:fs";
import { WikiMapClient, isPropertyFree } from "../dist/index.js";

const TARGET_ID = "CLOTHES_SHOP_SPORT_7";
const TARGET_NAME = "Магазин спортивной одежды #7";
const OUT = "data/biz-sport-7-mirror.json";

mkdirSync("data", { recursive: true });

const client = new WikiMapClient();
const state = await client.getEnrichedServerState("mirror");

const biz =
  state.businesses.find((b) => b.id === TARGET_ID) ??
  state.businesses.find((b) => b.name === TARGET_NAME) ??
  state.businesses.find((b) => b.name.includes("спортивной одежды #7"));

if (!biz) {
  console.error(
    "Business not found. Sport shops:",
    state.businesses
      .filter((b) => b.id.includes("SPORT") || b.name.includes("спортив"))
      .map((b) => ({ id: b.id, name: b.name })),
  );
  process.exit(1);
}

const free = isPropertyFree(biz.ownerName);
const payload = {
  server: state.server,
  mapFetchedAt: state.mapFetchedAt,
  catalogFetchedAt: state.catalogFetchedAt,
  free,
  owned: !free,
  business: biz,
};

writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");

console.log(JSON.stringify(biz, null, 2));
console.log("---");
console.log("ownerName:", biz.ownerName || "(empty)");
console.log("status:", free ? "FREE" : "OWNED");
console.log("wrote:", OUT);
