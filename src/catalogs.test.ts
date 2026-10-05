import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isMansionClass,
  isPropertyFree,
  parseBusinessesCatalogFromHtml,
  parseRealEstateCatalogFromHtml,
} from "./catalogs.js";

const data = (...parts: string[]) => path.join(process.cwd(), "data", ...parts);

test("parseRealEstateCatalogFromHtml extracts house owners and apartment free counts", () => {
  const html = readFileSync(data("realestate-blackberry.html"), "utf8");
  const catalog = parseRealEstateCatalogFromHtml(html);
  assert.ok(catalog.houses.length >= 1000);
  assert.ok(catalog.apartmentHouses.length === 35);
  const owned = catalog.houses.find((h) => h.ownerName && h.ownerName.trim());
  assert.ok(owned?.price && owned.classId);
  const apt = catalog.apartmentHouses[0];
  assert.ok(apt && typeof apt.freeCount === "number" && typeof apt.apartmentsCount === "number");
  assert.equal(JSON.stringify(catalog.apartmentHouses).includes("ownerName"), false);
});

test("parseBusinessesCatalogFromHtml extracts all servers", () => {
  const html = readFileSync(data("businesses-blackberry.html"), "utf8");
  const catalog = parseBusinessesCatalogFromHtml(html);
  assert.ok(catalog.servers.length >= 10);
  const total = catalog.servers.reduce((n, s) => n + s.items.length, 0);
  assert.ok(total >= 80);
  assert.ok(catalog.servers.some((s) => s.items.some((i) => typeof i.ownerName === "string")));
});

test("isMansionClass / isPropertyFree helpers", () => {
  assert.equal(isMansionClass({ classId: "B", className: "Престиж" }), true);
  assert.equal(isMansionClass({ classId: "D", className: "Стандарт" }), false);
  assert.equal(isPropertyFree(""), true);
  assert.equal(isPropertyFree("Ivan"), false);
});
