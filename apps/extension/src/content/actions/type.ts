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
//
// The read-back is the reason this verb has to redact. Both halves of the
// validation are built from the text, so typing into a password field returned
// the secret to the gateway twice in one result until Wave 3. The text is now
// quoted only when the control is not sensitive, by the one shared rule; when
// it is, the validation still says whether the field kept what was sent, and
// gives the length instead of the content.
//
// Each validation also *declares* that redaction, with `redacted: withheld`.
// The domain cannot tell an already-redacted string from a leaked one, so
// without the declaration it withholds every comparison on a sensitive control
// and replaces both strings with a marker -- losing "the field holds the text
// that was sent, a withheld value of 12 characters", which is the whole reason
// the phrasing above was written. The declaration is what buys it back, and it
// is a statement about these two strings only: it says this verb built them
// through `describeFieldValue`, never that the control is safe.

import { isSensitiveFormControl } from "../element-traits";
import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";
import { describeFieldValue } from "./value-redaction";

export function typeAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action);
  const text = action.text ?? action.value ?? "";
  const withheld = isSensitiveFormControl(element);
  const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot() });

  const report = deps.checkActionability(element);
  if (!report.actionable) {
    return deps.rejected(action, startedAt, report.code, "a target that can be typed into", report.detail, evidence());
  }

  if (!holdsText(element)) {
    return deps.success(action, startedAt, "The target holds no typed text.", {
      status: "failed",
      expected: `a text field or editable element holding ${describeFieldValue(text, withheld)}`,
      actual: `the target is a <${element.tagName.toLowerCase()}>, which holds no typed text`,
      redacted: withheld
    }, evidence());
  }

  deps.keyboard.typeText(element, text);

  const actual = enteredText(element);
  const held = actual === text;
  return deps.success(action, startedAt, held ? "Text entered." : "The field did not keep the text.", {
    status: held ? "passed" : "failed",
    expected: `the field holds ${describeFieldValue(text, withheld)}`,
    actual: heldText(actual, text, withheld),
    redacted: withheld
  }, evidence());
}

/**
 * What the field ended up holding. A withheld value cannot be quoted, so the
 * string says whether it is the text that was sent -- which is the whole point
 * of the read-back -- and carries its length, never its content.
 */
function heldText(actual: string, sent: string, withheld: boolean): string {
  if (!withheld) return `the field holds "${actual}"`;
  if (actual === sent) return `the field holds the text that was sent, ${describeFieldValue(actual, true)}`;
  return `the field holds ${describeFieldValue(actual, true)}, which is not the text that was sent`;
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
