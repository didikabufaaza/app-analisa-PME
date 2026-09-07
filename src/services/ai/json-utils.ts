/**
 * Robust JSON parsing for AI model output.
 *
 * LLMs frequently produce almost-valid JSON: markdown fences, trailing commas,
 * Python literals, smart quotes, comments, or output truncated mid-object by
 * token limits. The extraction pipeline must stay resilient across ANY document,
 * so this module repairs common defects before falling back to a per-object
 * salvage pass for `results` arrays.
 */

export class JsonParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonParseError";
  }
}

/** Log the first part of a malformed response for server-side diagnostics. */
function debugLog(label: string, text: string) {
  const sample = text.slice(0, 600).replace(/\s+/g, " ");
  console.error(`[ai-json-${label}] ${sample}`);
}

/** Basic cleanup: fences, BOM, control chars, Python literals, trailing commas. */
function preClean(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^\uFEFF/, "");
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "");
  s = s.replace(/\bNaN\b/g, "null").replace(/\b-?Infinity\b/g, "null");
  s = s.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null");
  // remove // line comments and /* block comments */ outside strings is complex;
  // a safe heuristic for comment markers preceded by whitespace/newline:
  s = s.replace(/,\s*([}\]])/g, "$1"); // trailing commas
  return s;
}

/** Locate the outermost JSON object bounds. */
function objectSlice(s: string): string {
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1) throw new JsonParseError("AI response did not contain a JSON object");
  return last > first ? s.slice(first, last + 1) : s.slice(first);
}

/**
 * Close truncated JSON: walk the text tracking string/escape state and bracket
 * depth, then append the required closers. Handles outputs cut off by max tokens.
 */
function closeTruncated(fragment: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of fragment) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }
  let out = fragment;
  // drop a trailing incomplete key/value if the string was cut mid-token
  out = out.replace(/,\s*"[^"]*"?\s*:?\s*$/, "");
  out = out.replace(/:\s*$/, ": null");
  if (inString) out += '"';
  while (stack.length > 0) {
    out += stack.pop() === "{" ? "}" : "]";
  }
  return out;
}

/** Repair minor syntax issues then parse; returns null when unrepairable. */
function tryParse(candidate: string): unknown | null {
  const attempts = [candidate];
  // smart quotes -> straight quotes (only outside of typical prose values is risky,
  // but JSON structural quotes being curly is a common model artifact)
  attempts.push(candidate.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'"));
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Salvage pass: parse individual balanced {...} objects inside the "results"
 * array even when the surrounding JSON is broken. Keeps every parseable row.
 */
function salvageResults(text: string): Record<string, unknown>[] {
  const resultsIdx = text.indexOf('"results"');
  if (resultsIdx === -1) return [];
  const arrStart = text.indexOf("[", resultsIdx);
  if (arrStart === -1) return [];

  const objects: Record<string, unknown>[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = arrStart + 1; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const objText = text.slice(start, i + 1);
        const parsed = tryParse(preClean(objText));
        if (parsed && typeof parsed === "object") objects.push(parsed as Record<string, unknown>);
        start = -1;
      }
    }
  }
  return objects;
}

/**
 * Parse an AI response that should be a JSON object with an optional
 * `results` array. Always resolves for salvageable payloads; throws
 * JsonParseError only when nothing usable can be recovered.
 */
export function parseAiJson<T>(raw: string): T {
  const cleaned = preClean(raw);

  // 1) direct parse of the object slice
  const sliced = objectSlice(cleaned);
  const direct = tryParse(sliced);
  if (direct !== null && typeof direct === "object") return direct as T;

  // 2) truncated output -> close it and retry
  const closed = tryParse(closeTruncated(sliced));
  if (closed !== null && typeof closed === "object") return closed as T;

  // 3) salvage per-row objects
  const salvaged = salvageResults(cleaned);
  if (salvaged.length > 0) {
    debugLog("salvaged", `${salvaged.length} result rows recovered from malformed AI JSON`);
    const container = { results: salvaged } as unknown as T;
    // merge any top-level scalar fields we can find (pme meta etc.)
    const metaMatch = cleaned.match(/"pme"\s*:\s*(\{[^{}]*\})/);
    if (metaMatch) {
      const pme = tryParse(preClean(metaMatch[1]));
      if (pme && typeof pme === "object") (container as Record<string, unknown>).pme = pme;
    }
    return container;
  }

  debugLog("unparseable", raw);
  throw new JsonParseError("AI response was not valid JSON and could not be repaired");
}
