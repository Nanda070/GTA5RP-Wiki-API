/**
 * Extract JSON objects embedded in Next.js RSC HTML where quotes are escaped as \".
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
