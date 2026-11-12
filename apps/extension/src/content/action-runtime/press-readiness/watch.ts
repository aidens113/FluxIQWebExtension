// A first press remains immediate. When the page has ignored it, its original
// answer watch may stay open while a command with no fresh binding has finite page work
// pending. A hydration timer can bind the control without any DOM mutation;
// spending the existing second press before that work runs loses both presses.
// Ordinary navigation readiness excludes such deferred work deliberately.
//
// This is only a reason to keep observing, never proof a press did nothing.
// Any effect/request seen by the original watch still forbids another press.
// A fresh binding in the control's composed ancestry ends this wait, even while
// other one-shot work remains. Capture's historical press probe cannot say
// this: it remembers removed listeners. Broad document/body listeners are not evidence that
// this control was bound; delegated handlers still get the immediate first
// press, and their effects answer that same watch normally.

import { PAGE_WORK_PENDING_EVENT, PAGE_WORK_WATCHED_EVENT } from "../../../shared/scheduled-work-event";
import { composedParent } from "../../shadow-dom";
import { markPressBinding } from "./binding";

/** A positive, supported reason to keep watching an unanswered press, or nothing where the page world cannot say. */
export function watchPressReadiness(pressed: Element): { pending(): boolean; stop(): void } | undefined {
  const view = pressed.ownerDocument?.defaultView;
  if (!view || typeof view.dispatchEvent !== "function" || typeof CustomEvent !== "function") return undefined;
  const ask = (type: string): boolean => !view.dispatchEvent(new CustomEvent(type, { cancelable: true }));
  if (!ask(PAGE_WORK_WATCHED_EVENT)) return undefined;
  const binding = markPressBinding(pressed);
  if (!binding) return undefined;
  let stopped = false;
  return {
    pending: () => !stopped && pressed.isConnected !== false && !nativeActivation(pressed) && !inlineInScope(pressed) && !binding.added()
      && ask(PAGE_WORK_WATCHED_EVENT) && ask(PAGE_WORK_PENDING_EVENT),
    stop() { stopped = true;
      binding.stop(); }
  };
}

function inlineInScope(pressed: Element): boolean {
  const doc = pressed.ownerDocument;
  for (let target: Element | null = pressed; target && target !== doc.body && target !== doc.documentElement; target = composedParent(target)) {
    if (["onclick", "onmousedown", "onmouseup", "onpointerdown", "onpointerup", "ontouchstart", "ontouchend"].some(name => target!.hasAttribute(name))) return true;
  }
  return false;
}

/** A control the browser can activate without a page handler needs no script binding. */
function nativeActivation(pressed: Element): boolean {
  const control = pressed.closest("a[href],area[href],input,select,textarea,summary,label,button");
  if (!control) return false;
  const name = control.tagName.toLowerCase();
  if (name === "button" || name === "input") {
    const field = control as HTMLButtonElement | HTMLInputElement;
    if (field.type === "button") return false;
    if (["submit", "reset", "image"].includes(field.type)) return field.form !== null;
    return name === "input";
  }
  if (name === "label") return (control as HTMLLabelElement).control !== null;
  if (name === "summary") return control.parentElement?.tagName.toLowerCase() === "details" && control.parentElement.querySelector("summary") === control;
  return true;
}
