import type {
  ChangeEvent,
  ChangeKind,
  DetectOptions,
  ServerSlug,
  ServerSnapshot,
} from "./types.js";

function isFreeOwner(ownerName: string | undefined): boolean {
  return !ownerName || ownerName.trim() === "";
}

function allowKind(options: DetectOptions | undefined, kind: ChangeKind): boolean {
  return !options?.kinds || options.kinds.includes(kind);
}

function nameAllowed(name: string, options: DetectOptions | undefined): boolean {
  if (!options?.nameIncludes?.length) return true;
  const lower = name.toLowerCase();
  return options.nameIncludes.some((n) => lower.includes(n.toLowerCase()));
}

/**
 * Full diff between two wiki snapshots.
 * Call only when `next.fetchedAt !== prev.fetchedAt`.
 */
export function detectChanges(
  server: ServerSlug,
  prev: ServerSnapshot,
  next: ServerSnapshot,
  options: DetectOptions = {},
): ChangeEvent[] {
  const events: ChangeEvent[] = [];

  const aptNames = new Map<number, string>();
  for (const h of [...(prev.apartmentHouses ?? []), ...(next.apartmentHouses ?? [])]) {
    aptNames.set(h.id, h.name);
  }

  const prevApartments = new Map(prev.apartmentStats.map((s) => [s.houseId, s]));
  for (const stat of next.apartmentStats) {
    if (options.apartmentIds && !options.apartmentIds.includes(stat.houseId)) continue;
    const name = aptNames.get(stat.houseId) ?? `apartment #${stat.houseId}`;
    if (!nameAllowed(name, options)) continue;

    const before = prevApartments.get(stat.houseId);
    if (!before || before.free === stat.free) continue;

    if (stat.free > before.free) {
      if (!allowKind(options, "apartment_free_up")) continue;
      if (options.minApartmentFree != null && stat.free < options.minApartmentFree) continue;
      events.push({
        kind: "apartment_free_up",
        server,
        id: stat.houseId,
        name,
        previousFree: before.free,
        currentFree: stat.free,
        deltaFree: stat.free - before.free,
      });
    } else {
      if (!allowKind(options, "apartment_free_down")) continue;
      events.push({
        kind: "apartment_free_down",
        server,
        id: stat.houseId,
        name,
        previousFree: before.free,
        currentFree: stat.free,
        deltaFree: stat.free - before.free,
      });
    }
  }

  const prevHouses = new Map(prev.houses.map((h) => [h.id, h]));
  for (const house of next.houses) {
    if (options.houseIds && !options.houseIds.includes(house.id)) continue;
    if (options.houseClasses && !options.houseClasses.includes(house.className)) continue;
    if (!nameAllowed(house.name, options)) continue;

    const before = prevHouses.get(house.id);
    if (!before) continue;

    const wasFree = isFreeOwner(before.ownerName);
    const isFree = isFreeOwner(house.ownerName);

    if (!wasFree && isFree && allowKind(options, "house_became_free")) {
      events.push({
        kind: "house_became_free",
        server,
        id: house.id,
        name: house.name,
        previousOwner: before.ownerName,
        currentOwner: "",
        className: house.className,
      });
    } else if (wasFree && !isFree && allowKind(options, "house_became_owned")) {
      events.push({
        kind: "house_became_owned",
        server,
        id: house.id,
        name: house.name,
        previousOwner: "",
        currentOwner: house.ownerName,
        className: house.className,
      });
    } else if (!wasFree && !isFree && before.ownerName !== house.ownerName && allowKind(options, "house_owner_changed")) {
      events.push({
        kind: "house_owner_changed",
        server,
        id: house.id,
        name: house.name,
        previousOwner: before.ownerName,
        currentOwner: house.ownerName,
        className: house.className,
      });
    }
  }

  const prevBiz = new Map(prev.business.map((b) => [b.id, b]));
  for (const biz of next.business) {
    if (options.businessIds && !options.businessIds.includes(biz.id)) continue;
    if (!nameAllowed(biz.name, options)) continue;

    const before = prevBiz.get(biz.id);
    if (!before) continue;

    const wasFree = isFreeOwner(before.ownerName);
    const isFree = isFreeOwner(biz.ownerName);

    if (!wasFree && isFree && allowKind(options, "business_became_free")) {
      events.push({
        kind: "business_became_free",
        server,
        id: biz.id,
        name: biz.name,
        previousOwner: before.ownerName,
        currentOwner: "",
      });
    } else if (wasFree && !isFree && allowKind(options, "business_became_owned")) {
      events.push({
        kind: "business_became_owned",
        server,
        id: biz.id,
        name: biz.name,
        previousOwner: "",
        currentOwner: biz.ownerName,
      });
    } else if (!wasFree && !isFree && before.ownerName !== biz.ownerName && allowKind(options, "business_owner_changed")) {
      events.push({
        kind: "business_owner_changed",
        server,
        id: biz.id,
        name: biz.name,
        previousOwner: before.ownerName,
        currentOwner: biz.ownerName,
      });
    }

    const prevDef = before.defensiveFactionLabel ?? "";
    const nextDef = biz.defensiveFactionLabel ?? "";
    if (prevDef !== nextDef && allowKind(options, "business_defense_changed")) {
      events.push({
        kind: "business_defense_changed",
        server,
        id: biz.id,
        name: biz.name,
        previousValue: prevDef,
        currentValue: nextDef,
        previousOwner: before.ownerName,
        currentOwner: biz.ownerName,
      });
    }
  }

  pushOwnerMapChanges({
    server,
    events,
    options,
    kind: "pf_house_owner_changed",
    prev: prev.pfHouses ?? [],
    next: next.pfHouses ?? [],
    idOf: (x) => x.id,
    nameOf: (x) => x.name,
    ownerOf: (x) => x.ownerName,
  });

  pushControllerChanges({
    server,
    events,
    options,
    kind: "family_war_changed",
    prev: prev.familyWarPoints ?? [],
    next: next.familyWarPoints ?? [],
  });

  pushControllerChanges({
    server,
    events,
    options,
    kind: "influence_changed",
    prev: prev.playerFamilyPointsWar ?? [],
    next: next.playerFamilyPointsWar ?? [],
  });

  pushControllerChanges({
    server,
    events,
    options,
    kind: "yacht_changed",
    prev: prev.playerFamilyYacht ?? [],
    next: next.playerFamilyYacht ?? [],
  });

  if (allowKind(options, "gangzone_changed")) {
    const prevGz = new Map((prev.gangzone ?? []).map((g) => [g.id, g]));
    for (const g of next.gangzone ?? []) {
      const before = prevGz.get(g.id);
      if (!before || before.faction === g.faction) continue;
      events.push({
        kind: "gangzone_changed",
        server,
        id: g.id,
        name: `Gangzone #${g.id}`,
        previousValue: before.faction,
        currentValue: g.faction,
      });
    }
  }

  if (allowKind(options, "faction_active_changed")) {
    const prevF = new Map((prev.factions ?? []).map((f) => [f.id, f]));
    for (const f of next.factions ?? []) {
      const before = prevF.get(f.id);
      if (!before || before.isActive === f.isActive) continue;
      events.push({
        kind: "faction_active_changed",
        server,
        id: f.id,
        name: f.id,
        previousValue: String(before.isActive),
        currentValue: String(f.isActive),
      });
    }
  }

  return events;
}

/** Back-compat: only property becoming free (classic «слёт»). */
export function detectSlits(
  server: ServerSlug,
  prev: ServerSnapshot,
  next: ServerSnapshot,
  options: DetectOptions = {},
): ChangeEvent[] {
  return detectChanges(server, prev, next, {
    ...options,
    kinds: options.kinds ?? ["apartment_free_up", "house_became_free", "business_became_free"],
  });
}

function pushOwnerMapChanges<T>(args: {
  server: ServerSlug;
  events: ChangeEvent[];
  options: DetectOptions;
  kind: ChangeKind;
  prev: T[];
  next: T[];
  idOf: (x: T) => number | string;
  nameOf: (x: T) => string;
  ownerOf: (x: T) => string;
}): void {
  if (!allowKind(args.options, args.kind)) return;
  const prevMap = new Map(args.prev.map((x) => [args.idOf(x), x]));
  for (const item of args.next) {
    const id = args.idOf(item);
    const name = args.nameOf(item);
    if (!nameAllowed(name, args.options)) continue;
    const before = prevMap.get(id);
    if (!before) continue;
    const prevOwner = args.ownerOf(before);
    const nextOwner = args.ownerOf(item);
    if (prevOwner === nextOwner) continue;
    args.events.push({
      kind: args.kind,
      server: args.server,
      id,
      name,
      previousOwner: prevOwner,
      currentOwner: nextOwner,
    });
  }
}

function pushControllerChanges(args: {
  server: ServerSlug;
  events: ChangeEvent[];
  options: DetectOptions;
  kind: ChangeKind;
  prev: { id: string; name?: string; familyName: string }[];
  next: { id: string; name?: string; familyName: string }[];
}): void {
  if (!allowKind(args.options, args.kind)) return;
  const prevMap = new Map(args.prev.map((x) => [x.id, x]));
  for (const item of args.next) {
    const name = item.name ?? item.id;
    if (!nameAllowed(name, args.options)) continue;
    const before = prevMap.get(item.id);
    if (!before || before.familyName === item.familyName) continue;
    args.events.push({
      kind: args.kind,
      server: args.server,
      id: item.id,
      name,
      previousValue: before.familyName,
      currentValue: item.familyName,
    });
  }
}
