// A read's account: list page, link origin, first kept rows and kept-row count.
// The complete kept and rejected rows remain in their existing fields. Core
// owns how declared view groups are projected into model decision context.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebNodeReadLinks } from "./links";
import { webNodeReadPage } from "./read-page";

/** How many kept rows a read shows ahead of the rest. */
export const WEB_NODE_READ_FIRST_ROWS = 3;

/**
 * The read as the model is shown it: kept rows' links written from the page's
 * origin, and the short account ahead of `extracted`. A read whose `extracted`
 * is no list keeps its value as it is; a read that is no object is returned
 * unchanged.
 */
export function webNodeReadOutcome(read: JsonValue | undefined, links: WebNodeReadLinks): JsonValue | undefined {
  if (!isJsonObject(read) || !Object.hasOwn(read, "extracted")) return read;
  const extracted = read.extracted;
  const rows = Array.isArray(extracted) ? extracted.map((row) => writtenRow(row, links)) : extracted;
  const account: JsonObject = {};
  // Only a list read reads a page of a list.
  const page = Array.isArray(extracted) ? webNodeReadPage(read.url, isJsonObject(read.extraction) ? read.extraction.pagesRead : undefined) : undefined;
  if (page !== undefined) account.page = page;
  if (links.used() && links.origin !== undefined) account.origin = links.origin;
  // Copies, never the same objects `extracted` holds: Core's evidence check
  // reads a value met twice as a cycle and refuses the whole result as
  // `evidence_not_json` (live run 14, `run-muqiho7e-13be6c03`: every read refused).
  if (Array.isArray(rows) && rows.length > 0) account.firstRows = rows.slice(0, WEB_NODE_READ_FIRST_ROWS).map(copied);
  const rest = restOfRows(rows, read.rejectedRows !== undefined);
  if (rest !== undefined) account.restOfRows = rest;
  const out: JsonObject = {};
  for (const [key, value] of Object.entries(read)) {
    if (key === "extracted") {
      Object.assign(out, account);
      out.extracted = rows ?? null;
      continue;
    }
    if (!Object.hasOwn(account, key)) out[key] = value;
  }
  return out;
}

/** One kept row with each address on the page's origin written from it. */
function writtenRow(row: JsonValue, links: WebNodeReadLinks): JsonValue {
  if (typeof row === "string") return links.write(row);
  if (!isJsonObject(row)) return row;
  const out: JsonObject = {};
  for (const [key, value] of Object.entries(row)) out[key] = typeof value === "string" ? links.write(value) : value;
  return out;
}

/** The sentence accounting for all kept rows and any rejected rows. */
function restOfRows(rows: JsonValue | undefined, rejected: boolean): string | undefined {
  const count = Array.isArray(rows) ? rows.length : undefined;
  if (count === undefined) return undefined;
  const more = count > WEB_NODE_READ_FIRST_ROWS;
  if (!more && !rejected) return undefined;
  const kept = `extracted holds all ${count} kept row${count === 1 ? "" : "s"}`;
  const turned = rejected ? " and rejectedRows those the conditions turned down" : "";
  return `${kept}${turned}.`;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A JSON value whole, sharing no object with the one it was copied from. */
function copied(value: JsonValue): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
