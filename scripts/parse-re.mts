import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("data/realestate-blackberry.html", "utf8");
const i = html.indexOf("fetchedAtMs");
console.log("context:\n", html.slice(i - 200, i + 100));

// Count braces in a window
const window = html.slice(i - 5000, i + 50);
let depth = 0;
let minStart = -1;
for (let p = window.length - 1; p >= 0; p--) {
  const ch = window[p];
  if (ch === "}") depth++;
  else if (ch === "{") {
    depth--;
    if (depth === 0) {
      minStart = p;
      break;
    }
  }
}
console.log("minStart in window", minStart, "depth end", depth);

// Try simpler: regex extract houses array
const m = html.match(/\\"houses\\":(\[.*?\])\\,\"apartments\\"/s);
console.log("regex houses?", !!m, m?.[1]?.slice(0, 200));

// Another approach: unescape whole script payload
const scriptStart = html.indexOf("initialData");
console.log("initialData@", scriptStart);
console.log(html.slice(scriptStart, scriptStart + 300));

// Find self.__next_f push with houses
const push = html.indexOf('\\"houses\\":[');
console.log("escaped houses@", push);
console.log(html.slice(push, push + 250));

// Unescape a large segment starting from houses
const segStart = html.lastIndexOf("{", push);
console.log("brace before houses", segStart);
const snippet = html.slice(push - 100, push + 500);
writeFileSync("data/re-snippet.txt", snippet);

// Manual: replace and find houses JSON array with a dedicated scanner for escaped JSON
function extractEscapedArray(html: string, key: string): unknown {
  const needle = `\\"${key}\\":[`;
  const start = html.indexOf(needle);
  if (start < 0) throw new Error("no " + key);
  const arrStart = start + needle.length - 1; // at [
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = arrStart; i < html.length; i++) {
    const ch = html[i];
    // In RSC HTML, strings use \" ... \" 
    // Actually the whole thing is inside a JS string already, so content looks like: [{\"id\":1},...]
    // Characters are: [ { \ " id \ " : ...
    // So "real" quote in JSON is the sequence \"
    // This is messy. Better approach: take substring and unescape first in a smart way.

    // Simpler approach: find matching ] by counting [ ] while ignoring those inside \"...\"
  }
  return null;
}

// PRACTICAL: convert the RSC escape style on a slice:
// From the first { before houses to matching }, treating \" as string quotes for brace counting
function extractEscapedObjectFrom(html: string, fromIdx: number): string {
  // find nearest { before fromIdx
  let start = html.lastIndexOf("{", fromIdx);
  let depth = 0;
  let i = start;
  let inString = false;
  while (i < html.length) {
    // detect \"
    if (html[i] === "\\" && html[i + 1] === '"') {
      inString = !inString;
      i += 2;
      continue;
    }
    if (!inString) {
      if (html[i] === "{") depth++;
      else if (html[i] === "}") {
        depth--;
        if (depth === 0) return html.slice(start, i + 1);
      }
    }
    i++;
  }
  throw new Error("fail");
}

try {
  // start from houses marker
  const raw = extractEscapedObjectFrom(html, push);
  console.log("raw len", raw.length);
  const json = JSON.parse(unescape(raw));
  writeFileSync("data/realestate-parsed.json", JSON.stringify(json, null, 2));
  console.log("parsed keys", Object.keys(json));
  if (json.houses) console.log("houses", json.houses.length, JSON.stringify(json.houses[0]));
  if (json.apartments) console.log("apartments", json.apartments.length, JSON.stringify(json.apartments[0]));
} catch (e) {
  console.error("parse fail", e);
}

function unescape(raw: string) {
  return raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
