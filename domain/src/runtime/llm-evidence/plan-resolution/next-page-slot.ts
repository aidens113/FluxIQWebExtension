// The Next page node's `nextPage`, written as the list a detection found
// (contract C2 of the read-list redesign, `s45-next-page.md`).
//
// The read reads one page (`extraction/slot.ts`), so every page of a list is a
// Flow loop: the read, then Next page on the same list, then a repeat on the
// read through Next page while it succeeds. The model is never shown a
// selector, so it names the list here exactly as it named it to the read:
//
//   {"nextPage": {"list": "extraction.N"}}
//   {"nextPage": {"list": "extraction.N", "control": "tN"}}
//
// `list` resolves through the detection's binding (`structure/handles.ts`) to
// the list's item selector -- which the page watches to tell that the list
// moved -- and the way to its next page the detection found, without its read
// bound: `maxPages` and `maxScrolls` belonged to a read that paged by itself,
// and one Next page step moves one page (`actions/next-page/request.ts`). A
// list detected with no pager resolves to its item alone, and the page finds
// the way live from the list. `control` names the site's own Next control by
// the page-view handle the model was shown, which replaces the detected way
// with `{next: <that control's selector>}`; it must be in the list's frame.
// Either handle may also be written the way the read writes one,
// `{"handle": ..., "location"?: ...}`.
//
// A literal `{item, next?}` is the request written short and becomes
// `{item, pagination: {next}}`; a whole request (`item`, `itemElement`,
// `pagination`) is left exactly as written. Neither is refused as a guess, as a
// literal read is: the contract accepts it.
//
// A handle the stores do not know, let go, or written in the wrong place is
// refused exactly as the read's is (`web.handle.unknown`, `.stale`,
// `.misplaced`), at the position it was written in; the shape this value takes
// is said beside it by `../resolve-plan-node.ts`. Nothing is guessed.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationExtractListPagination } from "../../../actions/extraction";
import { webAutomationNextPageRequestValue } from "../../../actions/next-page";
import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import type { WebLlmExtractionHandles, WebLlmExtractionHandleScope } from "../structure";
import { isJsonRecord } from "../untrusted-json";
import { webPlanHandleKind, webPlanHandlesIn, type WebPlanHandleKind, type WebPlanValuePath } from "./handle-tokens";
import type { WebLlmTargetPackets, WebLlmTargetReach, WebLlmTargetResolution } from "./target-packets";
import type { WebLlmTargetView } from "./view-history";

/** Why a `nextPage` names no one list, or no way to its next page. Each is a plan resolver issue code. */
export type WebNextPageSlotIssue =
  | "web.handle.malformed"
  | "web.handle.misplaced"
  | "web.handle.unknown"
  | "web.handle.stale"
  | "web.handle.ambiguous"
  | "web.handle.not_unique"
  | "web.handle.frame_mismatch";

export type WebNextPageSlotResolution =
  /** Not a handle form and nothing to rewrite: left exactly as written. */
  | { status: "literal" }
  /** The literal `{item, next}` written as the request it means. Its frame is the node's own. */
  | { status: "written"; request: JsonObject }
  /** A detected list's request, in the frame the list was detected in. */
  | {
      status: "resolved"; request: JsonObject; frameId: number | undefined; frameUrlPath: string | undefined;
      /** Under `view_history` only: the named control's handle and the view it resolved from (`target-packets.ts`). */
      controlView?: WebLlmTargetView & { handle: string };
    }
  /** `path` is where inside the value it was refused. */
  | { status: "refused"; issue: WebNextPageSlotIssue; path: WebPlanValuePath };

type Refused = Extract<WebNextPageSlotResolution, { status: "refused" }>;
type WrittenHandle = { handle: string; location: string | undefined };

const HANDLE_FORM_KEYS: readonly string[] = ["list", "control"];
const LITERAL_KEYS: readonly string[] = ["item", "itemElement", "pagination", "next"];
const REFERENCE_KEYS: readonly string[] = ["handle", "location"];

const TARGET_ISSUES = {
  unknown: "web.handle.unknown",
  stale: "web.handle.stale",
  ambiguous: "web.handle.ambiguous",
  not_unique: "web.handle.not_unique",
  // Held but never printed: to the model, a handle no packet it read carried (`target-packets.ts`).
  not_shown: "web.handle.unknown"
} as const satisfies Record<Extract<WebLlmTargetResolution, { ok: false }>["code"], WebNextPageSlotIssue>;

/** What `value`, a Next page node's `nextPage`, runs as, or why it cannot run. */
export function resolveWebNextPageSlot(
  value: unknown,
  scope: WebLlmExtractionHandleScope,
  targets: WebLlmTargetPackets,
  extractions: WebLlmExtractionHandles,
  /** Which views the control's handle may resolve from (`target-packets.ts`); the current pages when absent. */
  reach?: WebLlmTargetReach
): WebNextPageSlotResolution {
  if (!isJsonRecord(value)) return typeof value === "string" && webPlanHandleKind(value) !== undefined ? refused("web.handle.malformed", []) : { status: "literal" };
  if (!Object.hasOwn(value, "list") && !Object.hasOwn(value, "control")) return literalRequest(value);

  const unknownKey = Object.keys(value).find((key) => !HANDLE_FORM_KEYS.includes(key));
  if (unknownKey !== undefined) return refused("web.handle.malformed", [unknownKey]);
  if (!Object.hasOwn(value, "list")) return refused("web.handle.malformed", []);
  const list = writtenHandle(value.list, "extraction", ["list"]);
  if ("issue" in list) return list;
  const control = value.control === undefined ? undefined : writtenHandle(value.control, "target", ["control"]);
  if (control !== undefined && "issue" in control) return control;

  const found = extractions.resolve(scope, list.handle);
  if (!found.ok) return refused(found.code === "stale_handle" ? "web.handle.stale" : "web.handle.unknown", ["list"]);
  const binding = found.binding;
  if (list.location !== undefined && list.location !== binding.location) return refused("web.handle.unknown", ["list", "location"]);

  let way: JsonObject | undefined = detectedWay(binding.extractList.paginate);
  let controlView: (WebLlmTargetView & { handle: string }) | undefined;
  if (control !== undefined) {
    const handle = canonicalWebLlmTargetHandle(control.handle) ?? control.handle;
    const pressed = targets.resolve(scope, handle, control.location, reach);
    if (!pressed.ok) return refused(TARGET_ISSUES[pressed.code], ["control"]);
    // The control moves this list only if it is on the list's document.
    if ((pressed.frameId ?? 0) !== (binding.frameId ?? 0)) return refused("web.handle.frame_mismatch", ["control"]);
    way = { next: pressed.selector };
    if (pressed.shownIn !== undefined) controlView = { handle, view: pressed.shownIn.view, location: pressed.shownIn.location };
  }

  const request: JsonObject = { item: binding.extractList.item };
  if (binding.extractList.itemElement !== undefined) request.itemElement = binding.extractList.itemElement as unknown as JsonObject;
  if (way !== undefined) request.pagination = way;
  // Held to the reader a dispatch is refused by, so a handle never resolves
  // into a request the node would not send.
  const checked = webAutomationNextPageRequestValue(request);
  if (checked === undefined) return refused("web.handle.malformed", ["list"]);
  const resolution: Extract<WebNextPageSlotResolution, { status: "resolved" }> = { status: "resolved", request: checked as unknown as JsonObject, frameId: binding.frameId, frameUrlPath: binding.frameUrlPath };
  if (controlView !== undefined) resolution.controlView = controlView;
  return resolution;
}

/**
 * The detected way to the next page with its read bound dropped, in the shape
 * `WebAutomationNextPageWay` takes; nothing when nothing was detected. An
 * absent `mode` stays absent, as the request reader reads it back.
 */
function detectedWay(paginate: WebAutomationExtractListPagination | undefined): JsonObject | undefined {
  if (paginate === undefined) return undefined;
  if (paginate.mode === "loadMore") return { mode: "loadMore", control: paginate.control };
  if (paginate.mode === "scroll") return { mode: "scroll" };
  if (paginate.mode === "numbered") return { mode: "numbered", pages: paginate.pages };
  return paginate.mode === "next" ? { mode: "next", next: paginate.next } : { next: paginate.next };
}

/** A value written without `list` or `control`: the request itself, or `{item, next}` for it. */
function literalRequest(value: Record<string, unknown>): WebNextPageSlotResolution {
  const stray = webPlanHandlesIn(value)[0];
  if (stray !== undefined) return refused("web.handle.misplaced", stray.path);
  const unknownKey = Object.keys(value).find((key) => !LITERAL_KEYS.includes(key));
  if (unknownKey !== undefined) return refused("web.handle.malformed", [unknownKey]);
  if (!Object.hasOwn(value, "next")) {
    if (webAutomationNextPageRequestValue(value) !== undefined) return { status: "literal" };
    const itemAlone = webAutomationNextPageRequestValue({ item: value.item });
    return refused("web.handle.malformed", value.pagination !== undefined && itemAlone !== undefined ? ["pagination"] : []);
  }
  if (Object.hasOwn(value, "pagination")) return refused("web.handle.malformed", ["next"]);
  const request: JsonObject = { item: value.item as JsonValue };
  if (value.itemElement !== undefined) request.itemElement = value.itemElement as JsonValue;
  request.pagination = { next: value.next as JsonValue };
  const checked = webAutomationNextPageRequestValue(request);
  return checked === undefined ? refused("web.handle.malformed", []) : { status: "written", request: checked as unknown as JsonObject };
}

/** A handle written as a bare token or as `{handle, location?}`, of the kind its key takes; or why it is not one. */
function writtenHandle(written: unknown, kind: WebPlanHandleKind, path: WebPlanValuePath): WrittenHandle | Refused {
  const reference = isJsonRecord(written) ? written : { handle: written };
  if (isJsonRecord(written) && Object.keys(written).some((key) => !REFERENCE_KEYS.includes(key))) return refused("web.handle.malformed", path);
  const found = webPlanHandleKind(reference.handle);
  if (found !== undefined && found !== kind) return refused("web.handle.misplaced", path);
  if (found === undefined || typeof reference.handle !== "string") return refused("web.handle.malformed", path);
  const location = reference.location;
  if (location !== undefined && (typeof location !== "string" || location === "")) return refused("web.handle.malformed", [...path, "location"]);
  return { handle: reference.handle, location: location as string | undefined };
}

function refused(issue: WebNextPageSlotIssue, path: WebPlanValuePath): Refused {
  return { status: "refused", issue, path };
}
