// The recording pipeline: what a recorded event looks like, when one is sent,
// and what starts and stops recording. Every event the page produces arrives
// here as a `RecordingEventPayload` on `CONTENT_EVENT`; `content.ready` is the
// one kind allowed through while recording is off, because the background
// worker needs it to learn the frame exists.
//
// Typing is debounced into a single `dom.input` per field rather than one
// event per keystroke, and DOM mutations are batched into one `dom.mutation`
// per quiet period, so a busy page cannot flood the gateway. A batch still
// pending when an executable kind is sent goes out first, so a DOM change made
// before an action is never recorded after it.

import { CONTENT_EVENT, CONTENT_READY } from "./messages";
import { isActiveContentInstance } from "./instance";
import { captureSettings } from "./capture-settings";
import { compactObject } from "./compact-object";
import { captureSnapshot } from "./dom-snapshot";
import { describeElement, readElementValue } from "./describe-element";
import { isPickerHostNode } from "./picker-host";
import { shouldAttachStateSnapshot } from "./snapshots";
import type { RecordingEventKind, RecordingEventPayload } from "./types";

/**
 * The kinds a recorded event can become an executable action from.
 *
 * `data.extract` is one of them: the extraction the user defined becomes a
 * `web.dom.extract_list` or `web.dom.extract` node, so it flushes the pending
 * mutation batch for the same reason a click does -- a page change made before
 * the extraction was defined must not be recorded after it.
 */
const EXECUTABLE_KINDS: ReadonlySet<RecordingEventKind> = new Set(["dom.click", "dom.input", "dom.change", "dom.submit", "dom.keydown", "data.extract"]);

let recording = false;
let sequence = 0;
let mutationTimer: ReturnType<typeof setTimeout> | undefined;
let inputTimer: ReturnType<typeof setTimeout> | undefined;
let pendingInput: { element: Element; inputValue?: string | undefined } | undefined;
let pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };

const observer = new MutationObserver((mutations) => {
  if (!captureSettings.mutations || !recording) return;
  tallyMutations(mutations);
  if (mutationTimer) clearTimeout(mutationTimer);
  mutationTimer = setTimeout(() => flushPendingMutation(), 500);
});

export function isRecording(): boolean {
  return recording;
}

/** Tells the background worker this frame has a live content script. */
export function sendReady(): void {
  if (!isActiveContentInstance()) return;
  const payload = basePayload("content.ready", {
    metadata: { readyState: document.readyState }
  });
  void chrome.runtime.sendMessage({ type: CONTENT_READY, payload });
}

export function emit(kind: RecordingEventKind, details: Partial<RecordingEventPayload>): void {
  if (!isActiveContentInstance()) return;
  if (!recording && kind !== "content.ready") return;
  if (EXECUTABLE_KINDS.has(kind)) flushPendingMutation();
  const payload = basePayload(kind, details);
  void chrome.runtime.sendMessage({ type: CONTENT_EVENT, payload });
}

/** Starts or stops recording, attaching or detaching the mutation observer with it. */
export function setRecordingState(nextRecording: boolean): void {
  if (!nextRecording) flushPendingInput();
  recording = nextRecording;
  if (recording && captureSettings.mutations) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  } else {
    observer.disconnect();
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = undefined;
    pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
  }
}

/** Holds a typed value back until the field goes quiet, then emits one `dom.input`. */
export function scheduleInputEvent(element: Element): void {
  pendingInput = { element, inputValue: captureSettings.inputValues ? readElementValue(element) : undefined };
  if (inputTimer) clearTimeout(inputTimer);
  inputTimer = setTimeout(() => flushPendingInput(), 350);
}

export function flushPendingInput(): void {
  if (inputTimer) clearTimeout(inputTimer);
  inputTimer = undefined;
  const pending = pendingInput;
  pendingInput = undefined;
  if (!pending) return;
  emit("dom.input", compactObject({
    element: describeElement(pending.element),
    inputValue: pending.inputValue
  }));
}

/** Emits `dom.input` immediately, for controls whose value is not typed. */
export function emitInputEvent(element: Element | null): void {
  emit("dom.input", compactObject({
    element: element ? describeElement(element) : undefined,
    inputValue: captureSettings.inputValues ? readElementValue(element) : undefined
  }));
}

/**
 * Sends the pending mutation batch now and clears its quiet-period timer. The
 * records the observer has queued but not yet delivered are counted too, so a
 * change made in the same task as the event that follows is not left behind.
 */
function flushPendingMutation(): void {
  if (captureSettings.mutations && recording) tallyMutations(observer.takeRecords());
  if (mutationTimer) clearTimeout(mutationTimer);
  mutationTimer = undefined;
  const mutation = pendingMutation;
  pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
  if (mutation.added + mutation.removed + mutation.attributes + mutation.text === 0) return;
  emit("dom.mutation", { mutation });
}

/**
 * Counts what the page changed, and not what the extension did to it.
 *
 * The picker's overlay is a node the extension adds to the page and takes away
 * again while recording is on. Counted, it would put a `dom.mutation` in the
 * recording that no page behaviour produced, and a replay built from that
 * recording would wait for a change that never comes. So a record whose target
 * is inside the overlay is skipped whole, and the overlay host itself is not
 * counted as an added or removed node (`picker-host.ts`).
 */
function tallyMutations(mutations: readonly MutationRecord[]): void {
  for (const mutation of mutations) {
    if (isPickerHostNode(mutation.target)) continue;
    pendingMutation.added += countOutsidePicker(mutation.addedNodes);
    pendingMutation.removed += countOutsidePicker(mutation.removedNodes);
    if (mutation.type === "attributes") pendingMutation.attributes += 1;
    if (mutation.type === "characterData") pendingMutation.text += 1;
  }
}

/** How many of `nodes` are the page's own. */
function countOutsidePicker(nodes: ArrayLike<Node> & Iterable<Node>): number {
  let count = 0;
  for (const node of nodes) {
    if (!isPickerHostNode(node)) count += 1;
  }
  return count;
}

function basePayload(kind: RecordingEventKind, details: Partial<RecordingEventPayload>): RecordingEventPayload {
  const payload: RecordingEventPayload = {
    kind,
    sequence: ++sequence,
    url: location.href,
    title: document.title,
    eventTimestampMs: Date.now()
  };
  if (details.element) payload.element = details.element;
  if (captureSettings.snapshots) {
    const snapshot = details.snapshot ?? (shouldAttachStateSnapshot(kind) ? captureSnapshot() : undefined);
    if (snapshot) payload.snapshot = snapshot;
  }
  if (details.inputValue !== undefined) payload.inputValue = details.inputValue;
  if (details.key !== undefined) payload.key = details.key;
  if (details.scroll) payload.scroll = details.scroll;
  if (details.mutation) payload.mutation = details.mutation;
  if (details.extraction) payload.extraction = details.extraction;
  if (details.actionResult) payload.actionResult = details.actionResult;
  if (details.metadata) payload.metadata = details.metadata;
  return payload;
}
