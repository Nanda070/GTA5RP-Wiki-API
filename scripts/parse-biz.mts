import { readFileSync, writeFileSync } from "node:fs";

function unescapeRsc(raw: string) {
  return raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function extractEscapedObjectFrom(html: string, fromIdx: number): string {
  let start = html.lastIndexOf("{", fromIdx);
  let depth = 0;
  let i = start;
  let inString = false;
  while (i < html.length) {
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

const html = readFileSync("data/businesses-blackberry.html", "utf8");
const markers = [
  String.raw`\"categories\":[`,
  String.raw`\"servers\":[`,
  String.raw`\"items\":[`,
  "fetchedAtMs",
];

for (const m of markers) {
  const idx = html.indexOf(m);
  console.log(JSON.stringify(m), idx);
  if (idx < 0) continue;
  try {
    const raw = extractEscapedObjectFrom(html, idx);
    const obj = JSON.parse(unescapeRsc(raw));
    console.log("OK", Object.keys(obj), "rawLen", raw.length);
    writeFileSync("data/businesses-parsed.json", JSON.stringify(obj, null, 2));
    // summarize
    const text = JSON.stringify(obj);
    console.log("has items", text.includes('"items"'));
    console.log("ownerName count", (text.match(/"ownerName"/g) || []).length);
  } catch (e) {
    console.log("fail", (e as Error).message);
  }
}
