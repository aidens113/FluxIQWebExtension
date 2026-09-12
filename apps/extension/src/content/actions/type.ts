// The type verb: enter text into the resolved field, and prove the field kept
// it.
//
// Typing goes through the keyboard capability, so each character is a real
// key and input sequence (decision D5) rather than one value assignment: a
// combobox or autocomplete that filters per keystroke sees the keystrokes.
// The post-condition is a value read-back -- the field is asked what it holds
// afterwards rather than assumed to hold what was sent -- so a read-only
// field, a page that rewrites the value in its own `input` handler, and a
// target that was never typeable all report `failed` with Core's
// `output_not_observed` instead of a silent success.
//
// A field a person could not have typed into at all -- disabled, hidden, or
// covered -- is refused by the same actionability gate `web.dom.click` uses,
// before a single key is dispatched. That refusal is ACTION_REJECTED carrying
// the capability's own code, which says why the field was unreachable; the
// read-back failure it replaces could only say that the text was not there.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function typeAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action);
  const text = action.text ?? action.value ?? "";
  const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot() });

  const report = deps.checkActionability(element);
  if (!report.actionable) {
    return deps.rejected(action, startedAt, report.code, "a target that can be typed into", report.detail, evidence());
  }

  if (!holdsText(element)) {
    return deps.success(action, startedAt, "The target holds no typed text.", {
      status: "failed",
      expected: `a text field or editable element holding "${text}"`,
      actual: `the target is a <${element.tagName.toLowerCase()}>, which holds no typed text`
    }, evidence());
  }

  deps.keyboard.typeText(element, text);

  const actual = enteredText(element);
  const held = actual === text;
  return deps.success(action, startedAt, held ? "Text entered." : "The field did not keep the text.", {
    status: held ? "passed" : "failed",
    expected: `the field holds "${text}"`,
    actual: `the field holds "${actual}"`
  }, evidence());
}

/** Typing needs somewhere for the characters to go: a text-valued control, or an editable host. */
function holdsText(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) return !["checkbox", "radio", "file"].includes(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}

/** What the target holds now: a control's value, or an editable host's text. */
function enteredText(element: Element): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value;
  return element.textContent ?? "";
}
