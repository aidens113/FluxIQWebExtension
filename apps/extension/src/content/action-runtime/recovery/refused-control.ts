// What a control the gate refused as disabled looked like, so the loop can tell
// a control that is changing from one that is not.
//
// Both are the same refusal word, and both intents are right (t195, lead's
// decision, 2026-10-01). job-board's applicant tracker holds "I'm a person"
// disabled for three seconds, reading "Please wait 3", "Please wait 2",
// "Please wait 1": a Flow that reaches it early must wait it out. A control that
// is simply disabled -- failure-surfaces' disabled target, or a Submit that
// needs a field nobody filled -- shows no change at all, and waiting the whole
// ladder at it turns a prompt, honest refusal into five seconds of retries that
// end the same way. The control says which it is: one that is changing shows it
// in its text or its name, or says it is working (`aria-busy`).
//
// **What is kept is a fingerprint, never the page's words.** A short hash of the
// text, the name and the busy flag is all the comparison needs, so that is all
// that is held. It is held beside the result rather than on it, in a `WeakMap`
// keyed by the result object: the result crosses to the background worker and
// on to Core, whose record parser drops a whole record for one key it does not
// know, and a field here would be page-derived state on the wire for no reader
// there. The map lives and dies with the results in this frame.

import type { BrowserActionResult } from "../../types";

/** A disabled control's state as the loop compares it: a bounded fingerprint, and whether it says it is working. */
export type RefusedControlState = {
  /** Eight hex characters over the control's text and name; equal fingerprints mean nothing visible changed. */
  fingerprint: string;
  /** The control, or something holding it, says `aria-busy="true"`. */
  busy: boolean;
};

const REFUSED_CONTROLS = new WeakMap<BrowserActionResult, RefusedControlState>();

/** The text read for a fingerprint is bounded: a control's label is short, and a container mistaken for one must not cost a walk of its subtree's text. */
const FINGERPRINT_TEXT_LIMIT = 512;

/** Input types whose value is their visible label rather than something a person typed. */
const LABEL_VALUE_TYPES: ReadonlySet<string> = new Set(["button", "submit", "reset"]);

/**
 * Notes the state of the control a gate refused as disabled, against the result
 * that reports the refusal. Called by `results.ts` for that refusal alone.
 */
export function noteRefusedControl(result: BrowserActionResult, control: Element): void {
  REFUSED_CONTROLS.set(result, readControlState(control));
}

/** The noted state of the control this result refused, or `undefined` when none was noted. */
export function refusedControl(result: BrowserActionResult): RefusedControlState | undefined {
  return REFUSED_CONTROLS.get(result);
}

/**
 * Whether a disabled control shows it is changing, so that waiting for it is
 * worth another attempt: it says it is busy, or it looks different from how it
 * looked at the previous attempt. A control with no noted state shows nothing,
 * which is the safe direction -- it is refused rather than waited at.
 */
export function refusedControlChanging(previous: RefusedControlState | undefined, current: RefusedControlState | undefined): boolean {
  if (current === undefined) return false;
  if (current.busy) return true;
  return previous !== undefined && previous.fingerprint !== current.fingerprint;
}

function readControlState(control: Element): RefusedControlState {
  const parts = [
    bounded(control.textContent),
    bounded(control.getAttribute?.("aria-label")),
    bounded(control.getAttribute?.("aria-valuetext")),
    bounded(labelValue(control))
  ];
  return { fingerprint: fnv1a(parts.join("\u0000")), busy: saysBusy(control) };
}

/** The value of a button-like input, which is its label; any other control's value is not read. */
function labelValue(control: Element): string | undefined {
  if (control.tagName?.toLowerCase() !== "input") return undefined;
  const type = (control.getAttribute?.("type") ?? "").toLowerCase();
  if (!LABEL_VALUE_TYPES.has(type)) return undefined;
  const value = (control as { value?: unknown }).value;
  return typeof value === "string" ? value : undefined;
}

function saysBusy(control: Element): boolean {
  if (typeof control.closest === "function") return control.closest('[aria-busy="true"]') !== null;
  return control.getAttribute?.("aria-busy") === "true";
}

function bounded(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/\s+/gu, " ").trim().slice(0, FINGERPRINT_TEXT_LIMIT);
}

/** FNV-1a, 32 bits, as eight hex characters: a comparison key, not a secret, so nothing stronger is needed. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
