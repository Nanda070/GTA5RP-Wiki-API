import assert from "node:assert/strict";
import test from "node:test";
import { detectChanges, detectSlits } from "./diff.js";
import type { ServerSnapshot } from "./types.js";

function snap(partial: Partial<ServerSnapshot>): ServerSnapshot {
  return {
    fetchedAt: 1,
    apartmentHouses: [],
    apartmentStats: [],
    houses: [],
    business: [],
    ...partial,
  };
}

test("detectSlits catches apartment free increase and free house", () => {
  const prev = snap({
    apartmentHouses: [{ id: 33, name: "1564 San Vitus", position: { x: 0, y: 0, z: 0 } }],
    apartmentStats: [{ houseId: 33, total: 8, free: 1, byClass: [] }],
    houses: [
      {
        id: 10,
        name: "Дом #10",
        className: "Стандарт",
        ownerName: "Ivan_Petrov",
        vehicleCount: 2,
        position: { x: 1, y: 2, z: 3 },
      },
    ],
  });
  const next = snap({
    fetchedAt: 2,
    apartmentHouses: prev.apartmentHouses,
    apartmentStats: [{ houseId: 33, total: 8, free: 2, byClass: [] }],
    houses: [{ ...prev.houses[0]!, ownerName: "" }],
  });

  const events = detectSlits("blackberry", prev, next);
  assert.equal(events.length, 2);
  assert.equal(events[0]?.kind, "apartment_free_up");
  assert.equal(events[0]?.currentFree, 2);
  assert.equal(events[1]?.kind, "house_became_free");
});

test("detectChanges can track ownership transfer", () => {
  const prev = snap({
    business: [
      {
        id: "SHOP_1",
        name: "Магазин #1",
        ownerName: "A",
        position: { x: 0, y: 0, z: 0 },
      },
    ],
  });
  const next = snap({
    fetchedAt: 2,
    business: [{ ...prev.business[0]!, ownerName: "B" }],
  });
  const events = detectChanges("sunrise", prev, next, { kinds: ["business_owner_changed"] });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.previousOwner, "A");
  assert.equal(events[0]?.currentOwner, "B");
});
