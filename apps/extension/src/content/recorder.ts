// The recording pipeline: what a recorded event looks like, when one is sent,
// and what starts and stops recording. Every event the page produces arrives
// here as a `RecordingEventPayload` on `CONTENT_EVENT`; `content.ready` is the
// one kind allowed through while recording is off, because the background
// worker needs it to learn the frame exists.
//
// Typing is debounced into a single `dom.input` per field rather than one
// event per keystroke, and DOM mutations are batched into one `dom.mutation`
// per quiet period, so a busy page cannot flood the gateway.

import { CONTENT_EVENT, CONTENT_READY } from "./messages";
import { isActiveContentInstance } from "./instance";
import { captureSettings } from "./capture-settings";
import { compactObject } from "./compact-object";
import { captureSnapshot } from "./dom-snapshot";
import { describeElement, readElementValue } from "./describe-element";
import { shouldAttachStateSnapshot } from "./snapshots";
import type { RecordingEventKind, RecordingEventPayload } from "./types";

let recording = false;
let sequence = 0;
let mutationTimer: ReturnType<typeof setTimeout> | undefined;
let inputTimer: ReturnType<typeof setTimeout> | undefined;
let pendingInput: { element: Element; inputValue?: string | undefined } | undefined;
let pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };

const observer = new MutationObserver((mutations) => {
  if (!captureSettings.mutations || !recording) return;
  for (const mutation of mutations) {
    pendingMutation.added += mutation.addedNodes.length;
    pendingMutation.removed += mutation.removedNodes.length;
    if (mutation.type === "attributes") pendingMutation.attributes += 1;
    if (mutation.type === "characterData") pendingMutation.text += 1;
  }
  if (mutationTimer) clearTimeout(mutationTimer);
  mutationTimer = setTimeout(() => {
    emit("dom.mutation", { mutation: pendingMutation });
    pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
  }, 500);
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
  if (details.actionResult) payload.actionResult = details.actionResult;
  if (details.metadata) payload.metadata = details.metadata;
  return payload;
}
