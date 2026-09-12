// One key press: the events, and the default action the browser would have
// performed for a trusted key.
//
// A synthetic `KeyboardEvent` never triggers a default action, which is the
// whole of the "keypress is unreliable" finding in the action audit -- Enter
// submitted nothing and Tab moved nothing, while the result still said
// succeeded. So the key is delivered first, and then, only if the page did not
// cancel it, the default action is emulated and the outcome says what was
// meant to happen and what was observed.
//
// Where no honest emulation exists the outcome is `unsupported` rather than a
// pretence: moving a radio group's selection or a select's option with arrow
// keys, and toggling or activating a control with Space, all need a trusted
// event. Those have their own verbs, which the detail names. Reporting them as
// unsupported is the point -- a silent no-op reported as success is the defect
// this replaces.

import type { WebAutomationKeyModifiers } from "../../types";
import { dispatchKeyEvent } from "./key-event";
import { insertText } from "./text-edits";
import { isEditableHost, isTextField } from "./editable-target";
import { submitOwningForm } from "./implicit-submission";
import { moveFocusByTab } from "./tab-order";

export type KeyPressOutcome = {
  /** Whether the key events were dispatched at all. */
  dispatched: boolean;
  /** The default action performed after the key, which a synthetic event does not trigger by itself. */
  defaultAction: "none" | "submitted" | "focus-moved" | "unsupported";
  /** A short description for the result's validation. */
  detail: string;
  /** The post-condition the press was meant to establish, which the verb reports as `expected`. */
  expected: string;
  /** Whether `expected` was observed. An `unsupported` default action never holds. */
  held: boolean;
};

const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export function pressKey(target: Element, key: string, modifiers?: WebAutomationKeyModifiers | undefined): KeyPressOutcome {
  if (!key) {
    return { dispatched: false, defaultAction: "none", expected: "a key to press", detail: "the command named no key", held: false };
  }
  if (target instanceof HTMLElement) target.focus();
  const allowed = dispatchKeyEvent(target, "keydown", key, modifiers);
  const outcome = allowed ? defaultActionFor(target, key, modifiers) : pageHandled(key);
  // A real browser sends keyup to whatever holds focus once the default action has run.
  dispatchKeyEvent(document.activeElement ?? target, "keyup", key, modifiers);
  return outcome;
}

/** The page cancelled the key, so the browser would have performed no default action either. */
function pageHandled(key: string): KeyPressOutcome {
  return {
    dispatched: true,
    defaultAction: "none",
    expected: `the page receives the ${key} key`,
    detail: `the page handled ${key} and cancelled its default action`,
    held: true
  };
}

function defaultActionFor(target: Element, key: string, modifiers: WebAutomationKeyModifiers | undefined): KeyPressOutcome {
  if (key === "Enter") return enterPressed(target);
  if (key === "Tab") return tabPressed(target, modifiers?.shift === true);
  const refused = unsupportedDefault(target, key);
  if (refused) return refused;
  if (isPrintable(key, modifiers) && (isTextField(target) || isEditableHost(target))) return characterTyped(target, key);
  return {
    dispatched: true,
    defaultAction: "none",
    expected: `the page receives the ${key} key`,
    detail: `${key} was delivered; it has no default action on this target`,
    held: true
  };
}

/** Enter submits a form from a text field, and inserts a line break in anything multi-line. */
function enterPressed(target: Element): KeyPressOutcome {
  if (target instanceof HTMLTextAreaElement || isEditableHost(target)) {
    const inserted = insertText(target, "\n");
    return {
      dispatched: true,
      defaultAction: "none",
      expected: "Enter inserts a line break",
      detail: inserted ? "a line break was inserted" : "the page cancelled the line break",
      held: inserted
    };
  }
  const submission = submitOwningForm(target);
  if (submission.kind === "submitted") {
    return { dispatched: true, defaultAction: "submitted", expected: `Enter submits ${submission.form ?? "the form"}`, detail: submission.detail, held: true };
  }
  if (submission.kind === "blocked") {
    return { dispatched: true, defaultAction: "none", expected: `Enter submits ${submission.form ?? "the form"}`, detail: submission.detail, held: false };
  }
  // No form, no default button, or not a field: a trusted Enter would do nothing here either.
  return { dispatched: true, defaultAction: "none", expected: "the page receives the Enter key", detail: submission.detail, held: true };
}

function tabPressed(target: Element, backwards: boolean): KeyPressOutcome {
  const direction = backwards ? "the previous" : "the next";
  const landed = moveFocusByTab(target, backwards);
  return {
    dispatched: true,
    defaultAction: landed ? "focus-moved" : "none",
    expected: `focus moves to ${direction} tabbable element`,
    detail: landed ? `focus moved to ${describe(landed)}` : "focus did not move: nothing else on the page is tabbable",
    held: landed !== undefined
  };
}

function characterTyped(target: Element, key: string): KeyPressOutcome {
  const inserted = insertText(target, key);
  return {
    dispatched: true,
    defaultAction: "none",
    expected: `the character "${key}" is inserted`,
    detail: inserted ? `"${key}" was inserted` : "the page cancelled the insertion",
    held: inserted
  };
}

/** Defaults that cannot be emulated honestly, each with the verb that does the job properly. */
function unsupportedDefault(target: Element, key: string): KeyPressOutcome | undefined {
  if (ARROW_KEYS.has(key) && isRadio(target)) {
    return unsupported(key, "moving a radio group's selection needs a trusted key event", "web.dom.check");
  }
  if (ARROW_KEYS.has(key) && target instanceof HTMLSelectElement) {
    return unsupported(key, "changing a select's option needs a trusted key event", "web.dom.select");
  }
  if (key === " " && (isRadio(target) || isCheckbox(target))) {
    return unsupported(key, "toggling a checkbox or radio needs a trusted key event", "web.dom.check");
  }
  if (key === " " && isButton(target)) {
    return unsupported(key, "activating a button needs a trusted key event", "web.dom.click");
  }
  return undefined;
}

function unsupported(key: string, why: string, verb: string): KeyPressOutcome {
  return {
    dispatched: true,
    defaultAction: "unsupported",
    expected: `${key} performs its default action on this target`,
    detail: `${why}; the key was delivered but nothing changed -- use ${verb} instead`,
    held: false
  };
}

/** A character key with no command modifier held types; with Ctrl, Meta or Alt it is a shortcut. */
function isPrintable(key: string, modifiers: WebAutomationKeyModifiers | undefined): boolean {
  if ([...key].length !== 1) return false;
  return !(modifiers?.ctrl ?? false) && !(modifiers?.meta ?? false) && !(modifiers?.alt ?? false);
}

function isRadio(target: Element): boolean {
  return target instanceof HTMLInputElement && target.type === "radio";
}

function isCheckbox(target: Element): boolean {
  return target instanceof HTMLInputElement && target.type === "checkbox";
}

function isButton(target: Element): boolean {
  if (target instanceof HTMLButtonElement) return true;
  return target instanceof HTMLInputElement && ["submit", "reset", "button", "image"].includes(target.type);
}

function describe(element: HTMLElement): string {
  const testId = element.dataset.testid;
  if (testId) return `[data-testid="${testId}"]`;
  if (element.id) return `#${element.id}`;
  return `<${element.tagName.toLowerCase()}>`;
}
