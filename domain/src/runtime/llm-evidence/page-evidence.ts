// The page-level evidence the packet carries beside its elements: which frame
// the capture came from, whether the page is still settling, whether a dialog
// or an overlay is standing in front of everything, what the user has
// selected, and how much of the page was left out.
//
// These are the items that cannot be derived from an element. The ones that
// can -- forms, landmarks and repeating structure -- ride on the elements
// themselves in `elements.ts`, so trimming an element for budget can never
// leave a page-level list pointing at something the packet no longer holds.
//
// | Packet field   | Snapshot field                                                        | Available today |
// | -------------- | --------------------------------------------------------------------- | --------------- |
// | `frame`        | `frame.isTop`, plus `data-fluxiq-frame-id` on merged elements           | yes             |
// | `selectedText` | `selectedText`                                                          | yes             |
// | `elementTotal` | `elementTotal`, else the length of `interactiveElements`                | partly          |
// | `loading`      | `loading.{readyState,busy,spinner,pendingNavigation}`                   | no              |
// | `navigation`   | `navigation.{pending,from,to}`                                          | no              |
// | `dialogs`      | `dialogs[].{role,name,modal,selector}`, `pendingNativeDialog`           | no              |
// | `blockedBy`    | `blockingOverlay.{selector,tag,role,name}`                              | no              |
//
// The four marked "no" are Phase 1.4 steps 2 and 3, produced by
// `apps/extension/src/content/evidence/` and wired into `dom-snapshot.ts`.
// Every reader below is defensive over untrusted JSON, so an absent field
// costs nothing and a field that arrives under a different name is simply not
// reported -- it is a reconciliation, not a crash.

import { WEB_LLM_EVIDENCE_BOUNDS } from "./limits";
import { evidenceLocation, safeEvidenceUrl } from "./location";
import { boundedCount, boundedText, isJsonRecord, trueFlag } from "./untrusted-json";

const READY_STATES = ["loading", "interactive", "complete"];

export type WebLlmEvidenceFrame = {
  isTop: boolean;
  /** The child frames whose elements reached this packet, for a merged capture. */
  childFrameIds?: number[];
};

export type WebLlmEvidenceDialog = {
  role?: string;
  name?: string;
  modal?: true;
  selector?: string;
};

export type WebLlmPageContext = {
  frame?: WebLlmEvidenceFrame;
  loading?: { readyState?: string; busy?: true; spinner?: true; pendingNavigation?: true };
  navigation?: { pending?: true; from?: string; to?: string };
  dialogs?: WebLlmEvidenceDialog[];
  pendingNativeDialog?: true;
  blockedBy?: { selector: string; tag?: string; role?: string; name?: string };
  selectedText?: string;
  /** How many elements the page held before the capture's own filter, when that is more than the packet carries. */
  elementTotal?: number;
};

/** Every page-level item the snapshot can supply, each omitted when it says nothing. */
export function webLlmPageContext(snapshot: Record<string, unknown>, childFrameIds: number[]): WebLlmPageContext {
  const frame = evidenceFrame(snapshot.frame, childFrameIds);
  const loading = evidenceLoading(snapshot.loading);
  const navigation = evidenceNavigation(snapshot.navigation);
  const dialogs = evidenceDialogs(snapshot.dialogs);
  const blockedBy = evidenceBlocker(snapshot.blockingOverlay);
  const selectedText = boundedText(snapshot.selectedText, WEB_LLM_EVIDENCE_BOUNDS.text);
  return {
    ...(frame ? { frame } : {}),
    ...(loading ? { loading } : {}),
    ...(navigation ? { navigation } : {}),
    ...(dialogs ? { dialogs } : {}),
    ...(trueFlag(snapshot.pendingNativeDialog) ? { pendingNativeDialog: true as const } : {}),
    ...(blockedBy ? { blockedBy } : {}),
    ...(selectedText ? { selectedText } : {})
  };
}

/**
 * The pre-filter element total the packet should report, or `undefined` when
 * it would only restate the number of elements already carried. The capture's
 * own total wins when it supplies one, because by then the page has already
 * been filtered once in the content script.
 */
export function evidenceElementTotal(snapshot: Record<string, unknown>, carried: number): number | undefined {
  const declared = boundedCount(snapshot.elementTotal, 10_000_000);
  const received = Array.isArray(snapshot.interactiveElements) ? snapshot.interactiveElements.length : 0;
  const total = Math.max(declared ?? 0, received);
  return total > carried ? total : undefined;
}

/** Whether the capture itself says it dropped something before the packet ever saw it. */
export function capturedTruncated(snapshot: Record<string, unknown>): boolean {
  return trueFlag(snapshot.truncated) === true;
}

function evidenceFrame(input: unknown, childFrameIds: number[]): WebLlmEvidenceFrame | undefined {
  const declared = isJsonRecord(input) ? input : undefined;
  const isTop = typeof declared?.isTop === "boolean" ? declared.isTop : undefined;
  if (isTop === undefined && !childFrameIds.length) return undefined;
  return {
    isTop: isTop ?? true,
    ...(childFrameIds.length ? { childFrameIds } : {})
  };
}

function evidenceLoading(input: unknown): WebLlmPageContext["loading"] {
  if (!isJsonRecord(input)) return undefined;
  const rawReadyState = boundedText(input.readyState, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const readyState = rawReadyState && READY_STATES.includes(rawReadyState) ? rawReadyState : undefined;
  const loading = {
    ...(readyState && readyState !== "complete" ? { readyState } : {}),
    ...(trueFlag(input.busy) ? { busy: true as const } : {}),
    ...(trueFlag(input.spinner) ? { spinner: true as const } : {}),
    ...(trueFlag(input.pendingNavigation) ? { pendingNavigation: true as const } : {})
  };
  return Object.keys(loading).length ? loading : undefined;
}

function evidenceNavigation(input: unknown): WebLlmPageContext["navigation"] {
  if (!isJsonRecord(input)) return undefined;
  const navigation = {
    ...(trueFlag(input.pending) ? { pending: true as const } : {}),
    ...locationField("from", input.from),
    ...locationField("to", input.to)
  };
  return Object.keys(navigation).length ? navigation : undefined;
}

function locationField(key: "from" | "to", input: unknown): Record<string, string> {
  try {
    return { [key]: evidenceLocation(safeEvidenceUrl(input)) };
  } catch {
    return {};
  }
}

function evidenceDialogs(input: unknown): WebLlmEvidenceDialog[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const dialogs: WebLlmEvidenceDialog[] = [];
  for (const raw of input.slice(0, WEB_LLM_EVIDENCE_BOUNDS.dialogs)) {
    if (!isJsonRecord(raw)) continue;
    const role = boundedText(raw.role, WEB_LLM_EVIDENCE_BOUNDS.role);
    const name = boundedText(raw.name, WEB_LLM_EVIDENCE_BOUNDS.text);
    const selector = boundedText(raw.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
    const modal = trueFlag(raw.modal);
    if (!role && !name && !selector && !modal) continue;
    dialogs.push({
      ...(role ? { role } : {}),
      ...(name ? { name } : {}),
      ...(modal ? { modal } : {}),
      ...(selector ? { selector } : {})
    });
  }
  return dialogs.length ? dialogs : undefined;
}

function evidenceBlocker(input: unknown): WebLlmPageContext["blockedBy"] {
  if (!isJsonRecord(input)) return undefined;
  const selector = boundedText(input.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
  if (!selector) return undefined;
  const tag = boundedText(input.tag ?? input.tagName, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const role = boundedText(input.role, WEB_LLM_EVIDENCE_BOUNDS.role);
  const name = boundedText(input.name, WEB_LLM_EVIDENCE_BOUNDS.text);
  return {
    selector,
    ...(tag ? { tag } : {}),
    ...(role ? { role } : {}),
    ...(name ? { name } : {})
  };
}
