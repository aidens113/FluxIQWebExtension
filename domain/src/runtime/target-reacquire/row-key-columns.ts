// The columns that say which item a read's row is, when there are any (t786, D4).
//
// First the read's own declared row identity: the columns its `dedupe.by`
// names, which Core's `automationStudioRecordRowIdentity` already treats as
// "the same row" when it dedupes the read (the extension's list reader,
// `content/extraction/order-rows.ts`, and Core's dataset processing). A dedupe
// written in the read's request, at the request's top level, or moved into the
// record output's `process` (`output-nodes/extract-list/one-page-read.ts`) is
// the same declaration. A column of it whose value is only a count or a time
// cannot identify anything and is left out; a dedupe over every column the row
// holds is "list each once" -- the whole row -- and declares no identity.
//
// Otherwise the columns that hold a link target or an id: a column named as an
// id, URL, link, slug or key, or one whose value is a link. A picture's address
// (an image, thumbnail, avatar or icon column) is not the item's: the page may
// size or sign it per load.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webReacquireVolatileText } from "./volatile-text";

const ID_NAME = /(?:^|[_\-\s.])(?:id|url|uri|href|link|permalink|slug|sku|asin|key)$/iu;
const ID_NAME_CAMEL = /[a-z0-9](?:Id|ID|Url|URL|Uri|Href|Link|Key|Slug)$/u;
const MEDIA_NAME = /image|img|thumb|avatar|photo|picture|icon|logo|media|poster|banner/iu;
const LINK_VALUE = /^(?:https?:\/\/\S+|\/(?!\/)\S*[^\s/])$/iu;

/**
 * The key columns of `stale`, a row read by a node whose parameters are
 * `parameters` (a web output node's own, or a recorded action's
 * `{ outputId, parameters }`), or none.
 */
export function webReacquireRowKeyColumns(parameters: JsonObject | undefined, stale: JsonObject): string[] {
  const columns = Object.keys(stale);
  const declared = declaredIdentity(readParameters(parameters));
  const wholeRow = declared.length > 0 && columns.length > 1 && columns.every((column) => declared.includes(column));
  const identifying = wholeRow ? [] : declared.filter((column) => identifies(stale[column]));
  if (identifying.length > 0) return identifying;
  return columns.filter((column) => linkOrId(column, stale[column]));
}

/** The read's own parameters: a recorded action carries them under `parameters` beside its `outputId`. */
function readParameters(parameters: JsonObject | undefined): JsonObject | undefined {
  if (parameters !== undefined && typeof parameters.outputId === "string" && record(parameters.parameters)) return parameters.parameters;
  return parameters;
}

/** The first `dedupe.by` the read declares, in its request, at its top level, or in its record output's `process`. */
function declaredIdentity(parameters: JsonObject | undefined): string[] {
  if (parameters === undefined) return [];
  const request = record(parameters.extractList) ? parameters.extractList : undefined;
  const output = record(parameters.recordOutput) ? parameters.recordOutput : undefined;
  const process = output && record(output.process) ? output.process : undefined;
  for (const holder of [request, parameters, process]) {
    const dedupe = holder && record(holder.dedupe) ? holder.dedupe : undefined;
    const by = Array.isArray(dedupe?.by) ? dedupe.by.filter((column): column is string => typeof column === "string" && column !== "") : [];
    if (by.length > 0) return [...new Set(by)];
  }
  return [];
}

/** A value an item can be told by: words or a link, never a count or a time, never blank. */
function identifies(value: JsonValue | undefined): boolean {
  return typeof value === "string" && value.trim() !== "" && !webReacquireVolatileText(value);
}

function linkOrId(column: string, value: JsonValue | undefined): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  if (MEDIA_NAME.test(column)) return false;
  return ID_NAME.test(column) || ID_NAME_CAMEL.test(column) || LINK_VALUE.test(value.trim());
}

function record(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
