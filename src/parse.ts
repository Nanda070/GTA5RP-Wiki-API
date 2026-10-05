import type { ServerSnapshot } from "./types.js";
import { extractEscapedBalancedObject, unescapeRscJson } from "./rsc.js";

/**
 * Extract `initialServerData` JSON from wiki map HTML (Next.js RSC payload).
 * Not a stable public contract — may break if wiki changes SSR shape.
 */
export function parseInitialServerDataFromHtml(html: string): ServerSnapshot {
  const idx = html.indexOf("initialServerData");
  if (idx === -1) {
    throw new Error("initialServerData not found in HTML (wrong page or wiki layout changed)");
  }

  const jsonStart = html.indexOf("{", idx);
  if (jsonStart === -1) {
    throw new Error("Could not locate JSON object start for initialServerData");
  }

  // Map payload uses escaped quotes; string-aware scan is required for correctness
  // when values contain `{` / `}` (rare but possible).
  const raw = extractEscapedBalancedObject(html, jsonStart);
  const normalized = unescapeRscJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch (e) {
    throw new Error(`Failed to parse initialServerData JSON: ${(e as Error).message}`);
  }

  if (!isServerSnapshot(parsed)) {
    throw new Error("Parsed initialServerData does not match expected ServerSnapshot shape");
  }

  return parsed;
}

function isServerSnapshot(value: unknown): value is ServerSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.fetchedAt === "number" &&
    Array.isArray(v.apartmentHouses) &&
    Array.isArray(v.apartmentStats) &&
    Array.isArray(v.houses) &&
    Array.isArray(v.business)
  );
}
