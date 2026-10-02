// What a read keeps in every later request, once a newer read has replaced its
// rows: the short account of it.
//
// Live run 13 (`run-muqbzu32-8691a65e`) read one list three times while it
// corrected its conditions, and its last request carried all three reads whole
// -- 164,577 of its 290,929 characters -- although only the newest said what
// the Flow would return. So this domain declares a read's rows as a view of
// their own (`../../observed-state/read-rows-keys.ts`): Core shows the newest
// read's rows whole and, in each read a newer read replaced, puts `supersededBy`
// in their place inside the read (`AS/runtime/llm/context-window.ts`). A click
// or a page view that follows a read never replaces its rows.
//
// What stays of a replaced read is everything else in it, which is the short
// account: `extraction` says how many rows it kept, how many each condition
// rejected and removed alone, how many pages it read and why it stopped, and
// `validation` says the same in a sentence. This module adds the rest, ahead of
// the rows, so the account reads in order:
// - `origin`, once, when a link in the rows is written from it (`./links.ts`);
// - `firstRows`, the first few kept rows, so the model can still see what the
//   read was reading;
// - `restOfRows`, where every other row is and how to get it back once
//   replaced: `core.recall_result` with this result's callId, which answers
//   from the result Core already holds and runs nothing.
//
// Nothing here refuses or drops anything: the newest read still shows every
// row whole, and a replaced one can always be had whole again.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebNodeReadLinks } from "./links";

/** How many kept rows a read shows ahead of the rest. */
export const WEB_NODE_READ_FIRST_ROWS = 3;

/**
 * Core's tool that gives back a replaced read's rows (`AS/runtime/llm/evidence-recall/tool-id.ts`).
 * Written here rather than imported because the domain reads Core through its
 * built package, and a sentence naming it should not wait on a rebuild.
 */
const RECALL_TOOL_ID = "core.recall_result";

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
  if (links.used() && links.origin !== undefined) account.origin = links.origin;
  if (Array.isArray(rows) && rows.length > 0) account.firstRows = rows.slice(0, WEB_NODE_READ_FIRST_ROWS);
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

/** The sentence saying where the rows `firstRows` leaves out are, or nothing when it leaves none out. */
function restOfRows(rows: JsonValue | undefined, rejected: boolean): string | undefined {
  const count = Array.isArray(rows) ? rows.length : undefined;
  if (count === undefined) return undefined;
  const more = count > WEB_NODE_READ_FIRST_ROWS;
  if (!more && !rejected) return undefined;
  const kept = `extracted holds all ${count} kept row${count === 1 ? "" : "s"}`;
  const turned = rejected ? " and rejectedRows those the conditions turned down" : "";
  return `${kept}${turned}; in a read a newer read has replaced, supersededBy stands in their place, and ${RECALL_TOOL_ID} with this result's callId gives them back whole.`;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
