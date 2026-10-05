import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("data", { recursive: true });

function unescapeRsc(raw: string): string {
  return raw.replace(/\\"/g, '"');
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
  throw new Error("unbalanced from " + start);
}

async function load(name: string, url: string) {
  const html = await (
    await fetch(url, { headers: { cookie: "gta5rp-map-server=blackberry" } })
  ).text();
  writeFileSync(`data/${name}.html`, html);
  console.log(name, "len", html.length, "fetchedAtMs@", html.indexOf("fetchedAtMs"), "ownerName count", (html.match(/ownerName/g) || []).length);

  // Parse the largest object that contains fetchedAtMs by walking back from each occurrence
  let idx = 0;
  const objects: unknown[] = [];
  while (true) {
    const pos = html.indexOf("fetchedAtMs", idx);
    if (pos < 0) break;
    idx = pos + 1;
    for (let back = 0; back < 30; back++) {
      let start = pos;
      for (let b = 0; b <= back; b++) {
        start = html.lastIndexOf("{", start - 1);
        if (start < 0) break;
      }
      if (start < 0) break;
      try {
        const raw = extractBalanced(html, start);
        if (!raw.includes("fetchedAtMs")) continue;
        const obj = JSON.parse(unescapeRsc(raw));
        objects.push(obj);
        break;
      } catch {
        // try further back
      }
    }
  }
  console.log(name, "parsed objects with fetchedAtMs:", objects.length);
  writeFileSync(`data/${name}.json`, JSON.stringify(objects, null, 2));

  // Print structure of biggest object
  const biggest = objects.sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length)[0] as Record<string, unknown> | undefined;
  if (!biggest) return;
  console.log(name, "biggest keys", Object.keys(biggest));

  function walk(obj: unknown, path: string, depth = 0) {
    if (depth > 4 || obj == null) return;
    if (Array.isArray(obj)) {
      console.log(`${path}: array(${obj.length})`);
      if (obj[0] && typeof obj[0] === "object") {
        console.log(`${path}[0] keys`, Object.keys(obj[0] as object));
        console.log(`${path}[0]`, JSON.stringify(obj[0]).slice(0, 300));
      }
      return;
    }
    if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (Array.isArray(v)) walk(v, `${path}.${k}`, depth + 1);
        else if (v && typeof v === "object") walk(v, `${path}.${k}`, depth + 1);
        else console.log(`${path}.${k}: ${typeof v}`);
      }
    }
  }
  walk(biggest, "root");
}

await load("realestate-blackberry", "https://wiki.gta5rp.com/realestate?server=blackberry");
await load("businesses-blackberry", "https://wiki.gta5rp.com/businesses?server=blackberry");
