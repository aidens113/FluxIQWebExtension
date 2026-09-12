// Where the page's own events become recorded events. Every listener is
// registered in the capture phase so a page that stops propagation cannot hide
// an interaction from the recorder, and each one returns immediately unless
// recording is on. Untrusted events are ignored on the pointer, click, input,
// change, key and wheel paths: a synthetic click the page dispatched is not
// something the user did, and the synthetic `input` and `change` a replayed
// `type`, `clear` or `select` action dispatches would record that action a
// second time -- the background worker already records it as a runtime
// confirmation.
//
// Registration order is a contract in its own right -- pointerdown is recorded
// before click so an action taken during the press is captured with the state
// that preceded it.
//
// Sensitive controls (Phase 1.4): the `change` listener's `inputValue` comes
// from `readElementValue`, which withholds a sensitive control's value at the
// source, so nothing here has to remember to redact it. The keydown path is the
// exception that does, because a key press carries the value one character at a
// time and never goes through a value reader -- `recordableKey` handles it.

import { compactObject } from "./compact-object";
import { describeElement, readElementValue } from "./describe-element";
import { isSensitiveFormControl, isTextEntryElement, shouldRecordChangeEvent } from "./element-traits";
import {
  actionEventTarget,
  eventTargetElement,
  pointerActivationTarget,
  rememberEventPathElements
} from "./event-elements";
import { captureSettings } from "./capture-settings";
import {
  emit,
  emitInputEvent,
  flushPendingInput,
  isRecording,
  scheduleInputEvent
} from "./recorder";
import type { JsonObject } from "./types";

let scrollTimer: ReturnType<typeof setTimeout> | undefined;

export function installRecordingEventListeners(): void {
  document.addEventListener("pointerdown", (event) => {
    if (!isRecording()) return;
    if (!event.isTrusted) return;
    if (event.button !== 0 || event.isPrimary === false) return;
    rememberEventPathElements(event);
    flushPendingInput();
    const eventElement = eventTargetElement(event);
    const target = eventElement ? pointerActivationTarget(eventElement) : null;
    if (!target) return;
    emit("dom.click", compactObject({
      element: describeElement(target),
      metadata: compactObject({
        ...pointerMetadata(event),
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        sourceEvent: "pointerdown",
        captureTiming: "before-action"
      })
    }));
  }, true);

  document.addEventListener("click", (event) => {
    if (!isRecording()) return;
    if (!event.isTrusted) return;
    rememberEventPathElements(event);
    const eventElement = eventTargetElement(event);
    const target = eventElement ? actionEventTarget(eventElement) : null;
    emit("dom.click", compactObject({
      element: target ? describeElement(target) : undefined,
      metadata: compactObject({
        ...pointerMetadata(event),
        sourceEvent: "click"
      })
    }));
  }, true);

  document.addEventListener("input", (event) => {
    if (!isRecording()) return;
    if (!event.isTrusted) return;
    rememberEventPathElements(event);
    const target = event.target instanceof Element ? event.target : null;
    if (target && isTextEntryElement(target)) {
      scheduleInputEvent(target);
      return;
    }
    flushPendingInput();
    if (target && shouldRecordChangeEvent(target)) return;
    emitInputEvent(target);
  }, true);

  document.addEventListener("change", (event) => {
    if (!isRecording()) return;
    if (!event.isTrusted) return;
    rememberEventPathElements(event);
    const target = event.target instanceof Element ? event.target : null;
    if (target && isTextEntryElement(target)) {
      flushPendingInput();
      return;
    }
    if (target && !shouldRecordChangeEvent(target)) return;
    emit("dom.change", compactObject({
      element: target ? describeElement(target) : undefined,
      inputValue: captureSettings.inputValues ? readElementValue(target) : undefined
    }));
  }, true);

  document.addEventListener("submit", (event) => {
    if (!isRecording()) return;
    rememberEventPathElements(event);
    const target = event.target instanceof Element ? event.target : null;
    emit("dom.submit", compactObject({ element: target ? describeElement(target) : undefined }));
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!isRecording()) return;
    if (!event.isTrusted) return;
    rememberEventPathElements(event);
    const keyTarget = event.target instanceof Element ? event.target : null;
    emit("dom.keydown", compactObject({
      key: recordableKey(event.key, keyTarget),
      element: keyTarget ? describeElement(keyTarget) : undefined,
      metadata: {
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey
      }
    }));
  }, true);

  document.addEventListener("wheel", (event) => {
    if (!isRecording()) return;
    if (!event.isTrusted) return;
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      emit("dom.scroll", {
        scroll: { x: window.scrollX, y: window.scrollY },
        metadata: {
          sourceEvent: "wheel",
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaZ: event.deltaZ,
          deltaMode: event.deltaMode,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey
        }
      });
    }, 400);
  }, true);

  window.addEventListener("scroll", () => {
    if (!isRecording()) return;
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      emit("dom.scroll", { scroll: { x: window.scrollX, y: window.scrollY } });
    }, 400);
  }, true);
}

/**
 * The key as it may be recorded, or `undefined` when it may not be.
 *
 * A printable key pressed in a sensitive control is that control's value,
 * arriving one character at a time, so it is withheld and only the press
 * survives -- the recording still shows that the field was typed into, which is
 * what a replay needs, without ever carrying what was typed. A key whose name
 * is longer than one character (`Tab`, `Enter`, `Escape`, an arrow, a modifier)
 * carries no content and always travels, because the navigation and submission
 * it performs are the point of recording keys at all.
 */
function recordableKey(key: string, target: Element | null): string | undefined {
  if (!target || [...key].length !== 1) return key;
  return isSensitiveFormControl(target) ? undefined : key;
}

function pointerMetadata(event: MouseEvent): JsonObject {
  return {
    clientX: event.clientX,
    clientY: event.clientY,
    button: event.button,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey
  };
}
