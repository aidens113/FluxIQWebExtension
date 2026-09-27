// Reading the browser's own refusal, so a fault no retry can clear is refused
// once instead of three times.
//
// **The measurement this exists for.** `browserActionFailure`
// (`apps/extension/src/runtime/action-runner.ts`) mapped *every* worker-side
// throw to `web.action.failed`, which the code table declares retryable. On
// 2026-09-25 that turned a manifest-permission refusal into three attempts and
// then a lost run: `test-runs/run-muht9lpw-a39aa056` reported *"Cannot access
// contents of url \"about:blank\". Extension manifest must request permission to
// access this host."*, was retried at 250 ms and 1000 ms, fell to diagnosis and
// ended (`docs/working/language-driven-flow-loop-plan/reports/t163-defensive-runtime-audit.md`,
// section 2). Nothing in the machinery misbehaved. The classifier had nothing
// better to say, because the closed set had no member for it.
//
// **Why reading a message is acceptable here, when this repository generally
// refuses to decide anything from prose.** The rule this file bends is real: a
// decision taken from a sentence changes when someone improves the wording. But
// the sentence is not a producer's -- it is `chrome.runtime.lastError.message`,
// written by the browser, stable across releases because extensions have parsed
// it for a decade, and it is the *only* thing the browser gives. The alternative
// is not a structured answer; it is no answer. So the reading is confined here,
// to one exported function, against a short list of phrases, and every phrase
// that does not match falls back to the code the caller already had -- a miss
// costs the old behaviour, never a wrong refusal.
//
// **The two directions are one rule.** A permission refusal is deterministic and
// must be refused once; a channel that was not there yet is transient and must be
// retried. Absorbing the transient and refusing the deterministic is the same
// policy read from both ends, and a defensive runtime needs both or it either
// stops on nothing or waits on everything.

import { WEB_AUTOMATION_FAILURE_CODES, type WebAutomationFailureCode } from "./codes";

/**
 * Phrases by which the browser says this extension may not touch the page.
 *
 * Chrome's and Firefox's wordings for the same refusal, plus the enterprise
 * policy one. All are matched case-insensitively against the message and none
 * contains a URL, a selector or any page content, so a match says nothing about
 * what the page held.
 */
const PERMISSION_REFUSALS: readonly string[] = [
  "cannot access contents of",
  "extension manifest must request permission",
  "cannot access a chrome",
  "cannot access chrome://",
  "cannot be scripted",
  "missing host permission",
  "no tab permission",
  "permission denied",
  "extensions gallery cannot be scripted",
  "blocked by extensionsettings policy"
];

/**
 * Phrases by which the browser says the channel to the page failed, rather than
 * the page refusing.
 *
 * Every one of these is a frame that was not ready, a port that closed, or a
 * document replaced under the command -- states the next attempt can find
 * changed. "Receiving end does not exist" is the commonest: the content script
 * has not been injected in that frame yet.
 */
const TRANSIENT_TRANSPORT: readonly string[] = [
  "could not establish connection",
  "receiving end does not exist",
  "message port closed",
  "the message port closed before a response was received",
  "frame with id",
  "no frame with id",
  "no window with id",
  "the tab was discarded"
];

/**
 * The code the browser's own message names, or `undefined` when it names none.
 *
 * `undefined` is the ordinary answer and the safe one: the caller keeps the code
 * it already had, so adding this reading can only ever move a fault from
 * `web.action.failed` to something more specific, never the other way.
 *
 * The permission list is tested first. A message can mention both -- a frame
 * that went away *because* the extension was refused the host -- and the
 * refusal is the fact that matters, since it is the one no retry can clear.
 */
export function webBrowserApiFailureCode(message: string | undefined): WebAutomationFailureCode | undefined {
  if (typeof message !== "string" || message.trim().length === 0) return undefined;
  const lowered = message.toLowerCase();
  if (PERMISSION_REFUSALS.some((phrase) => lowered.includes(phrase))) return WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED;
  if (TRANSIENT_TRANSPORT.some((phrase) => lowered.includes(phrase))) return WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT;
  return undefined;
}
