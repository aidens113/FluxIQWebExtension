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

import { compactObject } from "./compact-object";
import { describeElement, readElementValue } from "./describe-element";
import { isTextEntryElement, shouldRecordChangeEvent } from "./element-traits";
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
    emit("dom.keydown", compactObject({
      key: event.key,
      element: event.target instanceof Element ? describeElement(event.target) : undefined,
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
