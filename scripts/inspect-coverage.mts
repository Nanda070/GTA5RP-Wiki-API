import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("data", { recursive: true });

function unescapeRsc(raw: string): string {
  return raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function extractBalanced(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced");
}

function extractObjectContaining(html: string, needle: string): unknown {
  const idx = html.indexOf(needle);
  if (idx < 0) throw new Error(`needle not found: ${needle}`);
  // walk back to nearest '{' that starts the enclosing object — take last '{' before needle within reason
  let start = idx;
  while (start > 0 && html[start] !== "{") start--;
  // may be nested; expand outward until parse works
  for (let back = 0; back < 50; back++) {
    while (start > 0) {
      start--;
      if (html[start] === "{") break;
    }
    try {
      const raw = extractBalanced(html, start);
      return JSON.parse(unescapeRsc(raw));
    } catch {
      // keep walking back
    }
  }
  throw new Error("could not parse object for " + needle);
}

function keyPaths(value: unknown, prefix = "", out: string[] = [], depth = 0): string[] {
  if (depth > 6 || value == null) return out;
  if (Array.isArray(value)) {
    out.push(`${prefix || "$"}:array(${value.length})`);
    if (value[0] !== undefined) keyPaths(value[0], `${prefix}[]`, out, depth + 1);
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const p = prefix ? `${prefix}.${k}` : k;
      out.push(`${p}:${Array.isArray(v) ? `array(${v.length})` : typeof v}`);
      keyPaths(v, p, out, depth + 1);
    }
  }
  return out;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      cookie: "gta5rp-map-server=blackberry",
      accept: "text/html",
    },
  });
  return res.text();
}

// --- MAP via library ---
const { WikiMapClient } = await import("../dist/index.js");
const map = await new WikiMapClient().getServerSnapshot("blackberry");
writeFileSync("data/map-blackberry.json", JSON.stringify(map.data, null, 2));
console.log("=== MAP ===");
console.log(keyPaths(map.data).join("\n"));

// --- REALESTATE ---
const reHtml = await fetchHtml("https://wiki.gta5rp.com/realestate?server=blackberry");
writeFileSync("data/realestate-blackberry.html", reHtml);

// The payload looks like: { server: { id, houses:[], apartments:[], fetchedAtMs } }
const re = extractObjectContaining(reHtml, '"fetchedAtMs":') as Record<string, unknown>;
writeFileSync("data/realestate-blackberry.json", JSON.stringify(re, null, 2));
console.log("\n=== REALESTATE object keys ===", Object.keys(re));
console.log(keyPaths(re).slice(0, 80).join("\n"));

const houses = (re.houses ?? (re as { server?: { houses?: unknown[] } }).server?.houses) as unknown[] | undefined;
const apartments = (re.apartments ?? (re as { server?: { apartments?: unknown[] } }).server?.apartments) as
  | unknown[]
  | undefined;

// Search recursively for houses/apartments arrays
function findArrays(obj: unknown, name: string, found: unknown[] = []): unknown[] {
  if (!obj || typeof obj !== "object") return found;
  if (Array.isArray(obj)) {
    for (const item of obj) findArrays(item, name, found);
    return found;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === name && Array.isArray(v) && v.length > 10) found.push(v);
    findArrays(v, name, found);
  }
  return found;
}

const houseArrays = findArrays(re, "houses");
const aptArrays = findArrays(re, "apartments");
console.log("\nhouse arrays found", houseArrays.length, "lens", houseArrays.map((a) => (a as unknown[]).length));
console.log("apt arrays found", aptArrays.length, "lens", aptArrays.map((a) => (a as unknown[]).length));
if (houseArrays[0]) {
  console.log("house[0]", JSON.stringify((houseArrays[0] as unknown[])[0]));
  const keys = new Set<string>();
  for (const h of (houseArrays[0] as Record<string, unknown>[]).slice(0, 100)) Object.keys(h).forEach((k) => keys.add(k));
  console.log("house keys", [...keys]);
}
if (aptArrays[0]) {
  console.log("apt[0]", JSON.stringify((aptArrays[0] as unknown[])[0]));
  const keys = new Set<string>();
  for (const h of (aptArrays[0] as Record<string, unknown>[]).slice(0, 100)) Object.keys(h).forEach((k) => keys.add(k));
  console.log("apt keys", [...keys]);
}

// --- BUSINESSES ---
const bizHtml = await fetchHtml("https://wiki.gta5rp.com/businesses?server=blackberry");
writeFileSync("data/businesses-blackberry.html", bizHtml);
const biz = extractObjectContaining(bizHtml, '"fetchedAtMs":') as Record<string, unknown>;
writeFileSync("data/businesses-blackberry.json", JSON.stringify(biz, null, 2));
console.log("\n=== BUSINESSES ===");
console.log(keyPaths(biz).slice(0, 80).join("\n"));

function findItems(obj: unknown, found: unknown[] = []): unknown[] {
  if (!obj || typeof obj !== "object") return found;
  if (Array.isArray(obj)) {
    for (const item of obj) findItems(item, found);
    return found;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "items" && Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] && "ownerName" in (v[0] as object)) {
      found.push(v);
    }
    findItems(v, found);
  }
  return found;
}
const itemArrays = findItems(biz);
console.log("business item arrays", itemArrays.length, itemArrays.map((a) => (a as unknown[]).length));
if (itemArrays[0]) {
  console.log("biz item[0]", JSON.stringify((itemArrays[0] as unknown[])[0]));
  const keys = new Set<string>();
  for (const h of (itemArrays[0] as Record<string, unknown>[]).slice(0, 100)) Object.keys(h).forEach((k) => keys.add(k));
  console.log("biz item keys", [...keys]);
}

// Individual apartment unit owners?
console.log("\n=== OWNER COVERAGE ===");
console.log("map apartmentStats sample", JSON.stringify(map.data.apartmentStats.find((s) => s.houseId === 33)));
console.log("map has per-apartment owner?", JSON.stringify(map.data).includes('"apartmentOwners"'));
console.log("realestate html has unit owner?", /apartment.*ownerName|ownerName.*квартир/i.test(reHtml));
