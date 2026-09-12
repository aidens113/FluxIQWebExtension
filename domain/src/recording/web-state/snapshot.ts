import type { StateSnapshot } from "fluxiq/automation-studio";
import { createWebAutomationInitialState } from "../state";
import { webAutomationActionTargetFromElement } from "./action-target";
import { filterStateElements } from "./element";
import { addPageEvidenceStateValues, pageEvidenceOfSnapshot, pageEvidenceTruncatedElements } from "./evidence";
import { addElementStateValues, putStateValue } from "./state-values";
import type { WebAutomationDomSnapshotInput, WebAutomationScreenImageSize } from "./types";
import { withScreenVisualFrame } from "./visual-frame";

// A DOM snapshot as a Core state snapshot: the page's own facts, the page-level
// evidence behind them, then one value per captured element, then the two
// visual frames.
export function createWebAutomationStateFromSnapshot(
  snapshot: WebAutomationDomSnapshotInput,
  input: { timestamp?: number; sourceId?: string; screenContentRef?: string; projectId?: string; screenImageSize?: WebAutomationScreenImageSize } = {}
): StateSnapshot {
  const timestamp = input.timestamp ?? Date.now();
  let state = createWebAutomationInitialState(timestamp);
  state = putStateValue(state, "page.url", "string", snapshot.url, timestamp, input.sourceId, { elementKind: "url" });
  state = putStateValue(state, "page.title", "string", snapshot.title, timestamp, input.sourceId, { elementKind: "text" });
  state = putStateValue(state, "viewport.bounds", "rectangle", { x: 0, y: 0, width: snapshot.viewport.width, height: snapshot.viewport.height }, timestamp, input.sourceId, { elementKind: "bounds", volatility: "normal" });
  state = putStateValue(state, "scroll.position", "point", { x: snapshot.viewport.scrollX, y: snapshot.viewport.scrollY }, timestamp, input.sourceId, { elementKind: "position", volatility: "rapid" });
  if (snapshot.selectedText) state = putStateValue(state, "page.selectedText", "string", snapshot.selectedText, timestamp, input.sourceId, { elementKind: "text" });
  if (snapshot.focusedElement) {
    const target = webAutomationActionTargetFromElement(snapshot.focusedElement);
    state = putStateValue(state, "focus.target", "json", target, timestamp, input.sourceId, { elementKind: "json", volatility: "rapid" });
  }

  // What the page is, not what its elements are: the dialogs in front of it,
  // what covers its controls, whether it is still working, its landmarks,
  // repeating runs, forms and navigation. `evidence.ts` owns the shape and the
  // paths; the browser's producer and the background worker's cross-frame merge
  // both wrote it before anything read it.
  const evidence = pageEvidenceOfSnapshot(snapshot);
  if (evidence) state = addPageEvidenceStateValues(state, evidence, timestamp, input.sourceId);

  const selection = filterStateElements(snapshot.interactiveElements);
  // `elements.count` is what the page offered, not what survived the filter.
  // A consumer comparing it with `elements.captured` can see that the element
  // list is a selection; reporting only the kept count made a page of 1,600
  // elements indistinguishable from a page of three.
  state = putStateValue(state, "elements.count", "integer", selection.total, timestamp, input.sourceId, { elementKind: "count" });
  state = putStateValue(state, "elements.captured", "integer", selection.captured, timestamp, input.sourceId, { elementKind: "count" });
  // Two caps can leave the element list short of the page, and they are two
  // facts with two remedies, so each gets its own comparable path rather than
  // being ORed into one flag a consumer cannot act on. `elements.truncated`
  // stays as the summary -- "may I trust this list to be the page" is still one
  // question -- and never claims to say which cap bit. The rule and the full
  // set of limits are in `evidence/input.ts`.
  const captureTruncated = pageEvidenceTruncatedElements(evidence);
  state = putStateValue(state, "elements.captureTruncated", "boolean", captureTruncated, timestamp, input.sourceId, { elementKind: "status" });
  state = putStateValue(state, "elements.stateTruncated", "boolean", selection.truncated, timestamp, input.sourceId, { elementKind: "status" });
  state = putStateValue(state, "elements.truncated", "boolean", selection.truncated || captureTruncated, timestamp, input.sourceId, { elementKind: "status" });
  for (const entry of selection.elements) state = addElementStateValues(state, entry, timestamp, input.sourceId);
  return withScreenVisualFrame(state, snapshot, selection.elements, input);
}
