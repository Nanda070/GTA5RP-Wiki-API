import type { ServerSnapshot } from "./types.js";
import { extractEscapedBalancedObject, readFlightProp, unescapeRscJson } from "./rsc.js";

const KEY = "initialServerData";

/**
 * Extract `initialServerData` JSON from wiki map HTML (Next.js RSC payload).
 * Not a stable public contract — may break if wiki changes SSR shape.
 */
export function parseInitialServerDataFromHtml(html: string): ServerSnapshot {
  let parsed: unknown;
  try {
    parsed = readFlightProp(html, KEY);
    if (parsed === undefined) parsed = readEscapedFragment(html);
  } catch (e) {
    throw new Error(`Failed to parse initialServerData JSON: ${(e as Error).message}`);
  }

  if (parsed === undefined) {
    throw new Error("initialServerData not found in HTML (wrong page or wiki layout changed)");
  }
  if (parsed === null) {
    throw new Error("Wiki returned no map data (initialServerData is null): unknown or unavailable server");
  }
  if (!isServerSnapshot(parsed)) {
    throw new Error("Parsed initialServerData does not match expected ServerSnapshot shape");
  }

  return parsed;
}

/** Fallback for raw fragments without flight chunks, where quotes are escaped as \". */
function readEscapedFragment(html: string): unknown {
  const idx = html.indexOf(KEY);
  if (idx === -1) return undefined;

  const valueStart = html.indexOf(":", idx) + 1;
  if (html.startsWith("null", valueStart)) return null;

  const jsonStart = html.indexOf("{", idx);
  if (jsonStart === -1) {
    throw new Error("could not locate object start");
  }

  return JSON.parse(unescapeRscJson(extractEscapedBalancedObject(html, jsonStart)));
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
