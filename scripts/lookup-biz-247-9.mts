import { mkdirSync, writeFileSync } from "node:fs";
import { WikiMapClient, isPropertyFree } from "../dist/index.js";

const TARGET_ID = "PRODUCT_SHOP_9";
const TARGET_NAME = "Магазин 24/7 #9";
const OUT = "data/biz-247-9-blackberry.json";

mkdirSync("data", { recursive: true });

const client = new WikiMapClient();
const state = await client.getEnrichedServerState("blackberry");

const biz =
  state.businesses.find((b) => b.id === TARGET_ID) ??
  state.businesses.find((b) => b.name === TARGET_NAME) ??
  state.businesses.find((b) => b.name.includes("24/7 #9"));

if (!biz) {
  console.error("Business not found. Sample ids:", state.businesses.slice(0, 5).map((b) => b.id));
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
