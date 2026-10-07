// The type verb: enter text into the resolved field, and prove the field kept
// it.
//
// Typing goes through the keyboard capability, so each character is a real
// key and input sequence (decision D5) rather than one value assignment: a
// combobox or autocomplete that filters per keystroke sees the keystrokes.
// Native number/calendar/time controls instead commit one browser-validated
// whole value: their native setter discards incomplete prefixes. Page key and
// beforeinput refusal still prevents that commit; all events remain synthetic.
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
//
// Typing sends the characters and no other key, so a field that belongs to a
// form leaves that form unsent, and the result says so (`unsentForm`). Live
// runs 36 and 37 (t193, bigbox) typed a shorter product name into the results
// page's search field, were told only "Text entered.", and then searched the
// unchanged page for results eleven and twelve times. A command with `submit`
// then presses Enter in the field, which sends its form the way a person's
// Enter does (`../action-runtime/keyboard/implicit-submission.ts`): a search
// typed and sent is one step. Typing that held and a send that did not is a
// failed step, because sending was what was asked.

import { isSensitiveFormControl } from "../element-traits";
import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";
import { describeFieldValue } from "./value-redaction";

export function typeAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const { element, resolution } = deps.resolveTarget(action);
  const text = action.text ?? action.value ?? "";
  const withheld = isSensitiveFormControl(element);
  const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution });

  const report = deps.checkActionability(element);
  if (!report.actionable) {
    return deps.rejected(action, startedAt, report.code, "a target that can be typed into", report.detail, { ...evidence(), blockedAt: report.point, target: element, refusedBeforeDispatch: true });
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
  // Event handlers may replace the field while the detached original still holds text.
  // That object's value cannot prove the current page accepted the requested edit.
  const connected = element.isConnected;
  const held = connected && actual === text;
  const typed = { expected: `the field holds ${describeFieldValue(text, withheld)}`, actual: connected ? heldText(actual, text, withheld) : "the original field was detached during typing", redacted: withheld };
  if (held && action.submit === true) {
    const sent = deps.keyboard.pressKey(element, "Enter");
    return deps.success(action, startedAt, sent.held ? "Text entered, then Enter pressed in the field." : "Text entered, but Enter did not send the field's form.", {
      status: sent.held ? "passed" : "failed",
      expected: `${typed.expected}, then ${sent.expected}`,
      actual: `${typed.actual}; ${sent.detail}`,
      redacted: withheld
    }, evidence());
  }
  const unsent = held ? unsentForm(element) : undefined;
  return deps.success(action, startedAt, held ? `Text entered.${unsent ? ` ${unsent}` : ""}` : "The field did not keep the text.", { status: held ? "passed" : "failed", ...typed }, evidence());
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

/** The longest control name quoted back. */
const MAX_CONTROL_NAME = 40;

/**
 * What a field's unsent form means, when the field has one: no Enter was
 * pressed and no button, so the page has seen the text but not been asked to
 * act on it. Names the form's own submit control when it has one.
 */
function unsentForm(element: Element): string | undefined {
  const form = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.form : null;
  if (!form) return undefined;
  const submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
  const name = submit ? controlName(submit) : "";
  const press = name ? `press its "${name}" button (or Enter in the field)` : "press Enter in the field";
  return `Typing pressed no other key, so the field's form was not sent: if the page has not answered the text, ${press} to send it, or type with submit set to true.`;
}

/** A control's own name: its label, else its words, else an input's value. */
function controlName(control: Element): string {
  const named = control.getAttribute("aria-label") || control.textContent || (control instanceof HTMLInputElement ? control.value : "");
  return named.replace(/\s+/gu, " ").trim().slice(0, MAX_CONTROL_NAME);
}
