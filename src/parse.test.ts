import assert from "node:assert/strict";
import test from "node:test";
import { parseInitialServerDataFromHtml } from "./parse.js";

test("parseInitialServerDataFromHtml extracts RSC-escaped JSON", () => {
  const html = String.raw`initialServerData\":{\"fetchedAt\":1791220500000,\"apartmentHouses\":[{\"id\":33,\"name\":\"1564 San Vitus\",\"position\":{\"x\":-201.23,\"y\":186.22,\"z\":79.32}}],\"apartmentStats\":[{\"houseId\":33,\"total\":8,\"free\":1,\"byClass\":[]}],\"houses\":[],\"business\":[]}`;

  const data = parseInitialServerDataFromHtml(html);
  assert.equal(data.fetchedAt, 1791220500000);
  assert.equal(data.apartmentHouses[0]?.name, "1564 San Vitus");
  assert.equal(data.apartmentStats[0]?.free, 1);
});
