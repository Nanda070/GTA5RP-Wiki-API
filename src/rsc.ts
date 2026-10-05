const FLIGHT_CHUNK = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;

/**
 * Concatenate the Next.js flight chunks (`self.__next_f.push([1,"…"])`) of an
 * SSR page into plain RSC text. Returns null when the HTML has no chunks.
 */
export function decodeFlightPayload(html: string): string | null {
  let payload: string | null = null;
  for (const match of html.matchAll(FLIGHT_CHUNK)) {
    payload = (payload ?? "") + (JSON.parse(match[1]!) as string);
  }
  return payload;
}

/**
 * Read the JSON value of a component prop (`"key":…`) from the flight payload.
 * Returns undefined when the page has no flight chunks or no such prop.
 */
export function readFlightProp(html: string, key: string): unknown {
  const payload = decodeFlightPayload(html);
  if (payload === null) return undefined;

  const needle = `${JSON.stringify(key)}:`;
  const idx = payload.indexOf(needle);
  if (idx < 0) return undefined;

  return JSON.parse(sliceJsonValue(payload, idx + needle.length));
}

/**
 * Read the JSON object that directly contains `needle` (e.g. `"houses":[`)
 * from the flight payload. Returns undefined when there is no such object.
 */
export function readFlightObjectContaining(html: string, needle: string): unknown {
  const payload = decodeFlightPayload(html);
  if (payload === null) return undefined;

  const idx = payload.indexOf(needle);
  if (idx < 0) return undefined;

  const start = payload.lastIndexOf("{", idx);
  if (start < 0) return undefined;

  return JSON.parse(sliceJsonValue(payload, start));
}

/** Slice one complete JSON value (object, array, string or scalar) starting at `start`. */
export function sliceJsonValue(text: string, start: number): string {
  const first = text[start];
  if (first !== "{" && first !== "[" && first !== '"') {
    const scalar = /[^,}\]\s]*/y;
    scalar.lastIndex = start;
    return scalar.exec(text)![0];
  }

  let depth = 0;
  let inString = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') {
        inString = false;
        if (depth === 0) return text.slice(start, i + 1);
      }
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  throw new Error("Unbalanced JSON value in RSC payload");
}

/**
 * Fallback for raw fragments without flight chunks: extract a JSON object
 * embedded in HTML where quotes are escaped as \".
 */
export function extractEscapedJsonObject(html: string, nearNeedle: string): unknown {
  const idx = html.indexOf(nearNeedle);
  if (idx < 0) {
    throw new Error(`RSC payload marker not found: ${nearNeedle}`);
  }

  const start = html.lastIndexOf("{", idx);
  if (start < 0) {
    throw new Error("Could not find object start for RSC payload");
  }

  const raw = extractEscapedBalancedObject(html, start);
  return JSON.parse(unescapeRscJson(raw));
}

export function extractEscapedBalancedObject(source: string, start: number): string {
  let depth = 0;
  let inString = false;

  for (let i = start; i < source.length; i++) {
    if (source[i] === "\\" && source[i + 1] === '"') {
      inString = !inString;
      i++;
      continue;
    }
    if (inString) continue;
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  throw new Error("Unbalanced escaped JSON object in RSC HTML");
}

export function unescapeRscJson(raw: string): string {
  return raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
