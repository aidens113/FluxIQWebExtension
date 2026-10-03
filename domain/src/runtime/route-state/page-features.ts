// What a route state says, reduced to the hashes the route signature
// (`./signature.ts`) and a step's effect (`./effect/sign.ts`) are both made of, so
// the two read one page the same way (t243).
//
// Every name is whitespace-collapsed, trimmed and lowercased first, so a
// re-render that only reflows text reads the same.
//
//   - `path`: the 8-hex FNV-1a hash of the path's shape. The shape is
//     lowercased, empty segments dropped, a segment holding a digit read as
//     `#` and one longer than 24 characters as `*`.
//   - `layers`: the 8-hex FNV-1a hash of the sorted distinct dialog and
//     blocker names, or `""` when nothing stands in front of the page.
//   - `controlHashes`: every distinct control name's mixed hash, sorted.
//   - `controlCount`: how many distinct control names there were.

import type { JsonObject } from "fluxiq/core";
import { fnv1a } from "../llm-evidence/state-digest";

const LIST_SEPARATOR = " | ";
const LONG_SEGMENT = 24;

type WebRoutePageFeatures = {
  readonly path: string;
  readonly layers: string;
  readonly controlHashes: readonly string[];
  readonly controlCount: number;
};

export function webRoutePageFeatures(state: JsonObject): WebRoutePageFeatures {
  const page = isRecord(state.page) ? state.page : {};
  const layerNames = distinctNames([...listOf(page.dialog), ...listOf(page.blockedBy)]).sort();
  const controlNames = distinctNames(listOf(page.controls));
  return {
    path: hex8(pathShape(pathOf(page))),
    layers: layerNames.length > 0 ? hex8(layerNames.join("\n")) : "",
    controlHashes: [...new Set(controlNames.map(controlHash))].sort(),
    controlCount: controlNames.length
  };
}

/** `state.page.path`, else the pathname of `state.page.location`, else nothing. */
function pathOf(page: JsonObject): string {
  if (typeof page.path === "string") return page.path;
  if (typeof page.location !== "string") return "";
  try {
    return new URL(page.location).pathname;
  } catch (error) {
    if (error instanceof TypeError) return "";
    throw error;
  }
}

function pathShape(path: string): string {
  const segments = path.toLowerCase().split("/").filter((segment) => segment.length > 0);
  return `/${segments.map((segment) => (/\d/u.test(segment) ? "#" : segment.length > LONG_SEGMENT ? "*" : segment)).join("/")}`;
}

function listOf(value: unknown): string[] {
  return typeof value === "string" ? value.split(LIST_SEPARATOR) : [];
}

function distinctNames(values: readonly string[]): string[] {
  const names = new Set<string>();
  for (const value of values) {
    const name = value.replace(/\s+/gu, " ").trim().toLowerCase();
    if (name) names.add(name);
  }
  return [...names];
}

function hex8(text: string): string {
  return toHex8(fnv1a(text));
}

/**
 * A control name's FNV-1a hash passed through MurmurHash3's 32-bit finaliser.
 *
 * A bottom-k sketch is only a fair sample when the order of the hashes is
 * unrelated to the names, and bare FNV-1a's high bits are decided mostly by a
 * name's prefix: `Shared control 1` to `Shared control 150` cluster together,
 * so a sketch of a page with numbered controls drew from one family and
 * estimated an overlap of 0.6 as 0.31. The finaliser spreads every input bit
 * across the word, which is all the estimate needs.
 */
function controlHash(name: string): string {
  let hash = fnv1a(name);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return toHex8(hash >>> 0);
}

function toHex8(hash: number): string {
  return hash.toString(16).padStart(8, "0");
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
