import assert from "node:assert/strict";
import test from "node:test";
import { parseInitialServerDataFromHtml } from "./parse.js";
import { flightHtml, makeSnapshot, mapRow } from "./test-utils.js";

test("parseInitialServerDataFromHtml extracts RSC-escaped JSON", () => {
  const html = String.raw`initialServerData\":{\"fetchedAt\":1791220500000,\"apartmentHouses\":[{\"id\":33,\"name\":\"1564 San Vitus\",\"position\":{\"x\":-201.23,\"y\":186.22,\"z\":79.32}}],\"apartmentStats\":[{\"houseId\":33,\"total\":8,\"free\":1,\"byClass\":[]}],\"houses\":[],\"business\":[]}`;

  const data = parseInitialServerDataFromHtml(html);
  assert.equal(data.fetchedAt, 1791220500000);
  assert.equal(data.apartmentHouses[0]?.name, "1564 San Vitus");
  assert.equal(data.apartmentStats[0]?.free, 1);
});

test("parseInitialServerDataFromHtml reads the map row from a Next.js flight chunk", () => {
  const html = flightHtml(mapRow("downtown", makeSnapshot()));

  const data = parseInitialServerDataFromHtml(html);

  assert.equal(data.fetchedAt, 1791224100000);
  assert.equal(data.houses[0]?.ownerName, "Ivan_Ivanov");
});

test("parseInitialServerDataFromHtml keeps quotes, backslashes and stray braces inside names", () => {
  const name = String.raw`Клуб "Yellow }Jack" \ бар`;
  const snapshot = makeSnapshot();
  snapshot.apartmentHouses[0]!.name = name;

  const data = parseInitialServerDataFromHtml(flightHtml(mapRow("downtown", snapshot)));

  assert.equal(data.apartmentHouses[0]?.name, name);
  assert.equal(data.business.length, 1);
});

test("parseInitialServerDataFromHtml joins a payload split across flight chunks", () => {
  const row = mapRow("downtown", makeSnapshot());
  const cut = row.indexOf("San Vitus");

  const data = parseInitialServerDataFromHtml(flightHtml(row.slice(0, cut), row.slice(cut)));

  assert.equal(data.apartmentHouses[0]?.name, "1564 San Vitus");
});

test("parseInitialServerDataFromHtml explains a null payload instead of a JSON syntax error", () => {
  const html = flightHtml(mapRow("vinewood", null));

  assert.throws(() => parseInitialServerDataFromHtml(html), /no map data/i);
});
