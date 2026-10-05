import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  isMansionClass,
  isPropertyFree,
  parseBusinessesCatalogFromHtml,
  parseRealEstateCatalogFromHtml,
} from "./catalogs.js";
import { catalogRow, flightHtml, makeBusinessesCatalog, makeRealEstateCatalog } from "./test-utils.js";

/** Full page captures are optional local files (`data/` is not in git). */
const data = (...parts: string[]) => path.join(process.cwd(), "data", ...parts);
const noCapture = (file: string) => (existsSync(data(file)) ? false : `no local capture data/${file}`);

test("parseRealEstateCatalogFromHtml reads houses and apartment buildings from a flight chunk", () => {
  const html = flightHtml(catalogRow(makeRealEstateCatalog()));

  const catalog = parseRealEstateCatalogFromHtml(html);

  assert.equal(catalog.server, "04");
  assert.equal(catalog.fetchedAtMs, 1791224100000);
  assert.deepEqual(
    catalog.houses.map((h) => [h.id, h.price, h.classId, h.ownerName]),
    [
      [926, 1800000, "B", "Ivan_Ivanov"],
      [533, 260000, "D", ""],
    ],
  );
  assert.equal(catalog.apartmentHouses[0]?.freeCount, 1);
});

test("parseRealEstateCatalogFromHtml keeps quotes and stray braces inside names", () => {
  const name = String.raw`ЖК "San }Vitus" \ корпус 2`;
  const source = makeRealEstateCatalog();
  source.apartmentHouses[0]!.name = name;

  const catalog = parseRealEstateCatalogFromHtml(flightHtml(catalogRow(source)));

  assert.equal(catalog.apartmentHouses[0]?.name, name);
  assert.equal(catalog.houses.length, 2);
});

test("parseBusinessesCatalogFromHtml reads every server bucket from a flight chunk", () => {
  const html = flightHtml(catalogRow(makeBusinessesCatalog()));

  const catalog = parseBusinessesCatalogFromHtml(html);

  assert.deepEqual(
    catalog.servers.map((s) => [s.sid, s.name, s.items.length]),
    [
      ["01", "Downtown", 1],
      ["04", "Blackberry", 1],
    ],
  );
  assert.equal(catalog.servers[1]?.items[0]?.defensiveFaction, "F_RUSSIANMAFIA");
});

test("parseBusinessesCatalogFromHtml keeps quotes and stray braces inside names", () => {
  const name = String.raw`Магазин "24/7 }" \ #5`;
  const source = makeBusinessesCatalog();
  source.servers[0]!.items[0]!.name = name;

  const catalog = parseBusinessesCatalogFromHtml(flightHtml(catalogRow(source)));

  assert.equal(catalog.servers[0]?.items[0]?.name, name);
  assert.equal(catalog.servers.length, 2);
});

test("parseRealEstateCatalogFromHtml reports a page without a catalog", () => {
  assert.throws(() => parseRealEstateCatalogFromHtml(flightHtml("0:[]\n")), /catalog/i);
});

test(
  "parseRealEstateCatalogFromHtml parses a full captured page",
  { skip: noCapture("realestate-blackberry.html") },
  () => {
    const html = readFileSync(data("realestate-blackberry.html"), "utf8");
    const catalog = parseRealEstateCatalogFromHtml(html);
    assert.ok(catalog.houses.length >= 1000);
    assert.ok(catalog.apartmentHouses.length === 35);
    const owned = catalog.houses.find((h) => h.ownerName && h.ownerName.trim());
    assert.ok(owned?.price && owned.classId);
    const apt = catalog.apartmentHouses[0];
    assert.ok(apt && typeof apt.freeCount === "number" && typeof apt.apartmentsCount === "number");
    assert.equal(JSON.stringify(catalog.apartmentHouses).includes("ownerName"), false);
  },
);

test(
  "parseBusinessesCatalogFromHtml parses a full captured page",
  { skip: noCapture("businesses-blackberry.html") },
  () => {
    const html = readFileSync(data("businesses-blackberry.html"), "utf8");
    const catalog = parseBusinessesCatalogFromHtml(html);
    assert.ok(catalog.servers.length >= 10);
    const total = catalog.servers.reduce((n, s) => n + s.items.length, 0);
    assert.ok(total >= 80);
    assert.ok(catalog.servers.some((s) => s.items.some((i) => typeof i.ownerName === "string")));
  },
);

test("isMansionClass / isPropertyFree helpers", () => {
  assert.equal(isMansionClass({ classId: "B", className: "Престиж" }), true);
  assert.equal(isMansionClass({ classId: "D", className: "Стандарт" }), false);
  assert.equal(isPropertyFree(""), true);
  assert.equal(isPropertyFree("Ivan"), false);
});
