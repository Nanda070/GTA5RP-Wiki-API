import { mkdirSync, writeFileSync } from "node:fs";
import { WikiMapClient, parseInitialServerDataFromHtml } from "../dist/index.js";

mkdirSync("data", { recursive: true });

function extractJsonAfter(html: string, marker: string): unknown {
  const idx = html.indexOf(marker);
  if (idx < 0) throw new Error(`marker not found: ${marker}`);
  const start = html.indexOf("{", idx);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        const raw = html.slice(start, i + 1).replace(/\\"/g, '"');
        return JSON.parse(raw);
      }
    }
  }
  throw new Error("unbalanced");
}

function collectKeys(value: unknown, prefix = "", out = new Set<string>(), depth = 0): Set<string> {
  if (depth > 5 || value == null) return out;
  if (Array.isArray(value)) {
    if (value[0]) collectKeys(value[0], prefix + "[]", out, depth + 1);
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const p = prefix ? `${prefix}.${k}` : k;
      out.add(p);
      collectKeys(v, p, out, depth + 1);
    }
  }
  return out;
}

const client = new WikiMapClient();
const map = await client.getServerSnapshot("blackberry");
writeFileSync("data/map-blackberry.json", JSON.stringify(map.data, null, 2));

const pages = [
  ["realestate", "https://wiki.gta5rp.com/realestate?server=blackberry"],
  ["businesses", "https://wiki.gta5rp.com/businesses?server=blackberry"],
] as const;

for (const [name, url] of pages) {
  const html = await (await fetch(url, { headers: { cookie: "gta5rp-map-server=blackberry" } })).text();
  writeFileSync(`data/${name}-blackberry.html`, html);

  // Try common markers
  for (const marker of [
    '"initialData":',
    '"initialServerData":',
    '\\"initialData\\":',
    '\\"initialServerData\\":',
    "initialData",
    "fetchedAtMs",
  ]) {
    if (!html.includes(marker.replace(/\\/g, "")) && !html.includes(marker)) continue;
    try {
      // Prefer scanning near fetchedAtMs object that contains houses/apartments
      if (marker.includes("fetchedAtMs") || marker === "fetchedAtMs") {
        // walk backwards to nearest object start for the payload containing houses
        const i = html.indexOf("fetchedAtMs");
        // find start of object by scanning back for '{"' patterns - better: find "houses":
        const h = html.lastIndexOf('"houses":', i);
        const a = html.lastIndexOf('"apartments":', i);
        const b = html.lastIndexOf('"servers":', i);
        const startGuess = Math.max(h, a, b);
        console.log(name, "near fetchedAtMs houses@", h, "apartments@", a);
      }
    } catch (e) {
      console.log(name, marker, "fail", e);
    }
  }
}

console.log("\nMAP keys:", Object.keys(map.data));
console.log("MAP keypaths:", [...collectKeys(map.data)].sort().join("\n"));

// apartment owners?
const aptBlob = JSON.stringify({
  houses: map.data.apartmentHouses,
  stats: map.data.apartmentStats,
});
console.log("\napartment blob has ownerName?", aptBlob.includes("ownerName"));
console.log("pfHouse sample", map.data.pfHouses?.[0]);
console.log("house class values", [...new Set(map.data.houses.map((h) => h.className))]);
console.log("houses with Престиж", map.data.houses.filter((h) => h.className.includes("Престиж") || h.className.includes("Prestige")).length);
console.log("free prestige", map.data.houses.filter((h) => (!h.ownerName || !h.ownerName.trim()) && (h.className.includes("Престиж") || h.className.includes("B"))).slice(0, 3));
