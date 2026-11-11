// One element read as a one-row table (t903, F1).
//
// A table of one row -- "a one-row table with column `following` holding the
// account's Followed stores line" -- is one element's words under a column the
// task names. No tool read it so. Extract reads one value into the step's
// `value` output, which is no row; Core takes rows only as an array under the
// read's rows key (`read.extracted`). Extract List makes rows, but only of a
// list detection found, and detection could not bind the line's handle. On
// `run-mwbkuxqt-c57f42cb` the model read the right line four times with Extract
// and stored no row, and 73 calls later the loop guard ended the run. A person
// does exactly this read, and so does the fixture's own recording: the element
// itself as the one item, its own text as the column (`fields: {following:
// ":scope"}`).
//
// So Extract List takes an element's own `tN` where it takes a detected
// list's `extraction.N`: `{handle: "tN", fields: {yourKey: "text"}}`. The
// element is bound exactly as a press or a read binds that handle (`../resolve-
// plan-node.ts`, through the same target store), and becomes a list of one
// record whose item is the element and whose columns are the element itself:
//
// - `text`, its words, on every element;
// - `value`, a field's current value, on a field;
// - `link`, the absolute address, on a link or an element with an address.
//
// That list is issued as an extraction handle like any detected one
// (`../../structure/handles.ts`, `elementRecord`), and the read goes on as a
// read of a detected list: columns renamed by the plan's keys and guessed only
// as any column is (`./columns.ts`), conditions, at most one row
// (`oneRecord`), and the step keeps the list's handle and what it stands for
// rather than the `tN` (`./saved-list.ts`), so it runs again with no memory.
// The rows still come only from the page: this changes which element a read may
// name, never what counts as read.
//
// Why Extract List and not a column on Extract: a read that makes rows is
// already this node's, end to end -- the rows key Core reads, the run's
// dataset, the saved list a replay runs, the read's code Core refuses a second
// kept copy of -- and a one-record list is already a list it reads
// (detection's record beside a run). A second way to make rows would have to
// repeat each of those.

import type { JsonObject } from "fluxiq/core";
import type { WebAutomationExtractField } from "../../../../actions/extraction";
import { canonicalWebLlmTargetHandle } from "../../handle-spelling";
import { present } from "../../present";
import type { WebLlmExtractionBinding, WebLlmExtractionHandles, WebLlmExtractionHandleScope } from "../../structure";
import { isJsonRecord } from "../../untrusted-json";
import { webPlanHandleKind, type WebPlanValuePath } from "../handle-tokens";

/** An element a target handle names, as the resolver bound it, and the page it was bound on when that is known. */
export type WebPlanBoundRecordElement = {
  selector: string;
  frameId: number | undefined;
  frameUrlPath: string | undefined;
  element: JsonObject | undefined;
  location: string | undefined;
};

export type WebPlanElementRecord =
  /** The value names no element by its own handle. */
  | { status: "none" }
  /** The value, naming the element's one-record list by its extraction handle in place of the `tN`. */
  | { status: "named"; value: JsonObject }
  /** The `tN` binds to no one element; `path` is inside the value. */
  | { status: "refused"; code: string; path: WebPlanValuePath };

/** The tag names of the fields a value is read off. */
const FIELD_TAGS: ReadonlySet<string> = new Set(["input", "textarea", "select"]);

/**
 * `value`, an `extractList`, read as one element's one-row table when its
 * `handle` is a target handle (header). `bind` binds the handle as the node's
 * own target slot would, answering an issue code where it cannot.
 */
export function webPlanElementRecord(
  value: unknown,
  scope: WebLlmExtractionHandleScope,
  extractions: WebLlmExtractionHandles,
  bind: (reference: Record<string, unknown>) => WebPlanBoundRecordElement | string
): WebPlanElementRecord {
  if (!isJsonRecord(value) || webPlanHandleKind(value.handle) !== "target") return { status: "none" };
  const reference: Record<string, unknown> = { handle: value.handle };
  if (value.location !== undefined) reference.location = value.location;
  const bound = bind(reference);
  if (typeof bound === "string") return { status: "refused", code: bound, path: [] };
  const named = canonicalWebLlmTargetHandle(value.handle) ?? String(value.handle);
  const handle = extractions.elementRecord(scope, named, present<Omit<WebLlmExtractionBinding, "handle">>({
    location: bound.location ?? (typeof value.location === "string" ? value.location : ""),
    frameId: bound.frameId,
    frameUrlPath: bound.frameUrlPath,
    extractList: { item: bound.selector, fields: elementColumns(bound.element) },
    itemCount: 1,
    oneRecord: true
  }));
  const written: JsonObject = {};
  for (const [key, entry] of Object.entries(value)) if (key !== "location") written[key] = key === "handle" ? handle : entry as JsonObject[string];
  return { status: "named", value: written };
}

/** The columns one element offers as its own record (header): its words, and its value or address where it has one. */
function elementColumns(identity: JsonObject | undefined): Record<string, WebAutomationExtractField> {
  const columns: Record<string, WebAutomationExtractField> = { text: { selector: ":scope", kind: "text" } };
  const tag = typeof identity?.tagName === "string" ? identity.tagName.toLowerCase() : undefined;
  if (tag !== undefined && FIELD_TAGS.has(tag)) columns.value = { selector: ":scope", kind: "value" };
  const attributes = identity?.attributes;
  if (tag === "a" || (isJsonRecord(attributes) && typeof attributes.href === "string" && attributes.href !== "")) columns.link = { selector: ":scope", kind: "link" };
  return columns;
}
