// Runs every compiled *.test.js under dist/.
// `node --test <glob>` only expands globs on Node 21+, and npm does not expand
// them on Windows, so the files are collected here to keep Node 18/20 working.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(full);
    return entry.name.endsWith(".test.js") ? [full] : [];
  });
}

const files = existsSync("dist") ? collect("dist").sort() : [];
if (files.length === 0) {
  console.error("No compiled tests found in dist/ — run `npm run build` first.");
  process.exit(1);
}

const { status } = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(status ?? 1);
