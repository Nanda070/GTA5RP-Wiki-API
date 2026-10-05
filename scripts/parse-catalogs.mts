import { readFileSync, writeFileSync } from "node:fs";

function unescape(raw: string) {
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

function parsePayload(html: string, marker: string) {
  const push = html.indexOf(marker);
  if (push < 0) throw new Error("marker missing " + marker);
  const raw = extractEscapedObjectFrom(html, push);
  return JSON.parse(unescape(raw));
}

const re = parsePayload(readFileSync("data/realestate-blackberry.html", "utf8"), '\\"houses\\":[');
writeFileSync("data/realestate-parsed.json", JSON.stringify(re, null, 2));
console.log("RE keys", Object.keys(re));
console.log("houses", re.houses.length, "keys", Object.keys(re.houses[0]));
console.log("apartmentHouses", re.apartmentHouses?.length, "keys", Object.keys(re.apartmentHouses?.[0] ?? {}));
console.log("apt0", JSON.stringify(re.apartmentHouses?.[0], null, 2));
console.log("classes", [...new Set(re.houses.map((h: { className: string }) => h.className))]);
console.log("classIds", [...new Set(re.houses.map((h: { classId: string }) => h.classId))]);
console.log("prestige free", re.houses.filter((h: { classId: string; ownerName: string }) => h.classId === "B" && !h.ownerName).length);
console.log("has unit owners in apt?", JSON.stringify(re.apartmentHouses).includes("ownerName"));

const bizHtml = await (await fetch("https://wiki.gta5rp.com/businesses?server=blackberry", {
  headers: { cookie: "gta5rp-map-server=blackberry" },
})).text();
writeFileSync("data/businesses-blackberry.html", bizHtml);
const biz = parsePayload(bizHtml, "fetchedAtMs");
writeFileSync("data/businesses-parsed.json", JSON.stringify(biz, null, 2));
console.log("\nBIZ top keys", Object.keys(biz));
console.log(JSON.stringify(biz, null, 2).slice(0, 1500));
