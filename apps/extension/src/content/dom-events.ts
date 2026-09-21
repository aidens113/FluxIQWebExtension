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
// Open shadow roots. A composed event reaches these listeners retargeted: its
// `target` is the outermost shadow host, not the control inside the widget, so
// every path reads the element off the composed path instead
// (`eventTargetElement`), as the pointer paths always did. Before that, an
// arrow key pressed in `<kf-location>`'s radius select was recorded against
// the `kf-location` host. And `change` and `submit` are not composed at all,
// so they never arrive here from inside a root: each open root an interaction
// enters gets the same two listeners (`shadow-root-events.ts`).
//
// Typed text is debounced into one pending `dom.input` (`recorder.ts`). A
// pointer press, a text field's `change` and a key that acts on the text rather
// than typing it (`continuesTyping`) send it first, so no action is recorded
// ahead of the text typed just before it.
//
// Sensitive controls (Phase 1.4): the `change` listener's `inputValue` comes
// from `readElementValue`, which withholds a sensitive control's value at the
// source, so nothing here has to remember to redact it. The keydown path is the
// exception that does, because a key press carries the value one character at a
// time and never goes through a value reader -- `recordableKey` handles it.
//
// That exception is why it asks the ancestor-aware rule rather than the
// control's own signature (decision D2). Every other reader moved to
// `isWithinSensitiveControl`, so a field inside an element marked
// `data-sensitive` -- not marked itself -- yielded no value, no text and no
// checked state anywhere, while its keys were still recorded one character at a
// time and could be reassembled in order. A single rule for "is, or sits inside,
// a sensitive control" is what keeps a path that reads no value from drifting
// away from the paths that do.

import { compactObject } from "./compact-object";
import { describeElement, readElementValue } from "./describe-element";
import { isTextEntryElement, shouldRecordChangeEvent } from "./element-traits";
import { isWithinSensitiveControl } from "./sensitive-text";
import {
  actionEventTarget,
  eventTargetElement,
  pointerActivationTarget,
  rememberEventPathElements
} from "./event-elements";
import { captureSettings } from "./capture-settings";
import { listenInOpenShadowRoots } from "./shadow-root-events";
import {
  emit,
  emitInputEvent,
  flushPendingInput,
  isRecording,
  scheduleInputEvent
} from "./recorder";
import type { JsonObject } from "./types";

let scrollTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * A control's value changed. Registered on the document, and on each open
 * shadow root an interaction enters, because `change` does not leave one.
 */
function recordChange(event: Event): void {
  if (!isRecording()) return;
  if (!event.isTrusted) return;
  rememberEventPathElements(event);
  const target = eventTargetElement(event) ?? null;
  if (target && isTextEntryElement(target)) {
    flushPendingInput();
    return;
  }
  if (target && !shouldRecordChangeEvent(target)) return;
  emit("dom.change", compactObject({
    element: target ? describeElement(target) : undefined,
    inputValue: captureSettings.inputValues ? readElementValue(target) : undefined
  }));
}

/** A form was submitted. Registered where `recordChange` is, for the same reason. */
function recordSubmit(event: Event): void {
  if (!isRecording()) return;
  rememberEventPathElements(event);
  const target = eventTargetElement(event) ?? null;
  emit("dom.submit", compactObject({ element: target ? describeElement(target) : undefined }));
}

/** What an open shadow root is given once an interaction enters it: the events it does not let out. */
const SHADOW_ROOT_LISTENERS = { change: recordChange, submit: recordSubmit };

export function installRecordingEventListeners(): void {
  document.addEventListener("pointerdown", (event) => {
    if (!isRecording()) return;
    if (!event.isTrusted) return;
    if (event.button !== 0 || event.isPrimary === false) return;
    rememberEventPathElements(event);
    listenInOpenShadowRoots(event, SHADOW_ROOT_LISTENERS);
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
    const target = eventTargetElement(event) ?? null;
    if (target && isTextEntryElement(target)) {
      scheduleInputEvent(target);
      return;
    }
    flushPendingInput();
    if (target && shouldRecordChangeEvent(target)) return;
    emitInputEvent(target);
  }, true);

  document.addEventListener("change", recordChange, true);

  document.addEventListener("submit", recordSubmit, true);

  // A focus moved into a widget arrives before any key that changes it, and
  // records nothing of its own.
  document.addEventListener("focusin", (event) => {
    if (!isRecording()) return;
    listenInOpenShadowRoots(event, SHADOW_ROOT_LISTENERS);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!isRecording()) return;
    if (!event.isTrusted) return;
    rememberEventPathElements(event);
    listenInOpenShadowRoots(event, SHADOW_ROOT_LISTENERS);
    const keyTarget = eventTargetElement(event) ?? null;
    if (!continuesTyping(event, keyTarget)) flushPendingInput();
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
 * A printable key pressed in a sensitive control, or in anything inside one, is
 * that control's value, arriving one character at a time, so it is withheld and
 * only the press survives -- the recording still shows that the field was typed
 * into, which is what a replay needs, without ever carrying what was typed. A
 * key whose name is longer than one character (`Tab`, `Enter`, `Escape`, an
 * arrow, a modifier) carries no content and always travels, because the
 * navigation and submission it performs are the point of recording keys at all.
 *
 * The question is asked of the element's ancestors as well as of itself
 * (`isWithinSensitiveControl`, `sensitive-text.ts`): an ordinary text field
 * inside a group marked `data-sensitive` holds part of what that group holds,
 * and its keys were the last route by which those characters still left the
 * page.
 */
function recordableKey(key: string, target: Element | null): string | undefined {
  if (!target || [...key].length !== 1) return key;
  return isWithinSensitiveControl(target) ? undefined : key;
}

/**
 * The keys besides a character that are part of typing into a text field: a
 * deletion, a bare modifier (Shift for a capital), and what a dead key or an
 * input method reports while it composes a character.
 */
const TYPING_KEYS: ReadonlySet<string> = new Set([
  "Backspace", "Delete", "Shift", "Control", "Alt", "AltGraph", "Meta", "CapsLock", "Dead", "Process", "Unidentified"
]);

/**
 * Whether a key press continues the typing whose `dom.input` may still be
 * pending, rather than acting on what was typed.
 *
 * A key that acts -- Enter, Tab, Escape, an arrow -- sends the pending text
 * first, as a pointer press and a text field's `change` already do. Before it
 * did, a key pressed inside the debounce window was recorded ahead of the text
 * typed just before it, and the replay pressed Enter or ArrowDown on a field
 * that did not hold the text yet (P1, W02 and W03). A key that is part of typing
 * does not flush: it would split one debounced `dom.input` into one per key.
 */
function continuesTyping(event: KeyboardEvent, target: Element | null): boolean {
  if (!target || !isTextEntryElement(target)) return false;
  return event.isComposing || [...event.key].length === 1 || TYPING_KEYS.has(event.key);
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
