// Whether the document an action finished against is the one it started
// against, and the failure code that says so when it is not.
//
// PAGE_CHANGED was in the closed set from the day it was written and nothing
// produced it, which is the worst state a member of a closed vocabulary can be
// in: a consumer that derives its handling from the set is told the browser
// path can report a replaced page, and it never does. The condition is real --
// Core names it "the surface the action targeted was replaced between resolving
// the target and executing the action" -- and it is the one thing the rest of
// this week's target work does not check. The resolver now refuses a candidate
// the recording contradicts, the veto refuses a fast Level 1 answer the page
// disagrees with, and the actionability gate refuses a target that cannot be
// hit; none of them asks whether the page is still the page.
//
// What it protects. Every verb resolves a target and then acts, and several of
// them wait in between: `assert` polls its claim until it holds or its window
// closes, `scroll` polls for growth, `extract_list` follows pagination. A
// same-document route change, or a `document.open()` that replaces the tree,
// during any of those leaves the verb measuring a page nobody asked about, and
// the result it reports is a lie of the most expensive kind -- not "something
// went wrong", but a specific, confident wrong cause. Reported as
// TARGET_NOT_FOUND, a Flow widens its target. Reported as OUTPUT_NOT_OBSERVED,
// it retries the same action against a page that has moved on. Reported as
// TIMEOUT, it waits longer. PAGE_CHANGED is retryable, so the orchestrator
// still retries -- but it retries knowing the ground moved, which is the
// difference between a retry and a diagnosis.
//
// What it can and cannot see. A cross-document navigation destroys this content
// script with the command unanswered, so the case this module catches is the
// one that leaves the script alive: a same-document navigation (`pushState`, a
// hash route, a `replaceState` redirect) or a document whose root element has
// been swapped out from under it. That is a narrower window than the plan's
// "between dispatch and execution", which would need a document identity
// stamped on the command by the background worker and compared here; this is
// the half the content script can answer on its own, at the cost of two
// property reads per action.
//
// Why it substitutes rather than adds. A result carries one failure record, and
// the record is what Core routes on. So the page-change finding has to win or
// be dropped, and it wins over exactly the codes it explains better: a target
// that vanished, a post-condition that did not appear, a claim that did not
// hold, a wait that expired, an action that threw or was refused. It never
// overwrites a code that already says something the page moving does not
// explain -- AUTH_REQUIRED (sign in; do not retry), USER_INTERVENTION_REQUIRED
// (a person must act), BLOCKED_BY_DIALOG (a dialog stopped it), or the two
// dispatch-stage refusals, which were decided
// before the page mattered at all. Nothing is lost either way: the superseded
// code and its description ride in the new record's `actual`.
//
// No URL text is put in the record. `location.href` carries query strings, and
// a query string is where a session token rides; the domain's own evidence
// builder strips them for the same reason. The result's `url` field already
// says where the page ended up, under the rules that field is bound by.

import {
  WEB_AUTOMATION_FAILURE_CODES,
  webAutomationFailureRecord,
  type WebAutomationFailureCode
} from "@fluxiq-web-extension/domain/client";
import type { BrowserActionResult } from "../types";

/**
 * The document this frame was showing at one instant: where it was, and which
 * root element it was made of.
 *
 * `undefined` means the question could not be asked -- there is no `location`
 * or no `document`, which is every Node test of a verb, since the verbs take
 * the page as injected capabilities. An unanswerable question is never a page
 * change.
 */
export type PageIdentity = { readonly href: string; readonly root: unknown } | undefined;

/** The document this frame is showing now, or `undefined` where there is no page to read. */
export function observePageIdentity(): PageIdentity {
  if (typeof location === "undefined" || typeof document === "undefined") return undefined;
  const href = location.href;
  if (typeof href !== "string") return undefined;
  return { href, root: document.documentElement };
}

/**
 * The result as it should be reported, given the page it started on: unchanged,
 * or carrying PAGE_CHANGED in place of a code the page moving explains better.
 *
 * The result object is written in place rather than copied. It was built one
 * call below by `action-runtime/results.ts` and is shared with nothing, and
 * rebuilding it here would mean either a spread -- which drops a renamed wire
 * field silently, the defect `contractSpreadPaths` exists to stop -- or a second
 * copy of the result contract to keep in step with the first.
 */
export function reportPageChange(result: BrowserActionResult, before: PageIdentity): BrowserActionResult {
  if (result.status === "succeeded") return result;
  const failure = result.failure;
  if (!failure || EXPLAINED_WITHOUT_THE_PAGE.has(failure.code)) return result;
  const change = pageChangeSince(before);
  if (!change) return result;
  result.failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED, {
    expected: failure.expected ?? "the action to run against the document it started on",
    actual: `${change}; the action reported ${failure.code}${failure.actual ? `: ${failure.actual}` : ""}`
  });
  return result;
}

/**
 * Codes a moved page does not explain, so PAGE_CHANGED never replaces one.
 *
 * The first three are page-decided already and each says something a retry
 * cannot fix: sign in, fetch a person, or deal with the dialog standing over
 * the page -- which is what stopped the action, wherever the page then went.
 * The two dispatch-stage refusals were decided before anything touched the
 * page. NAVIGATION_UNEXPECTED is a navigation
 * judgement of its own, and PAGE_CHANGED cannot supersede itself.
 */
const EXPLAINED_WITHOUT_THE_PAGE: ReadonlySet<string> = new Set<WebAutomationFailureCode>([
  WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED,
  WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED,
  WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG,
  WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE,
  WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED,
  WEB_AUTOMATION_FAILURE_CODES.NAVIGATION_UNEXPECTED,
  WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED
]);

/**
 * How the page moved since `before`, in words, or `undefined` if it did not.
 *
 * The root element is compared first because it is the stronger statement: a
 * different root is a different document, whatever the URL says, which is what
 * `document.open()` and a written-over frame leave behind. A changed URL with
 * the same root is the ordinary same-document navigation.
 */
function pageChangeSince(before: PageIdentity): string | undefined {
  if (!before) return undefined;
  const now = observePageIdentity();
  if (!now) return undefined;
  if (now.root !== before.root) return "the document was replaced while the action ran";
  if (now.href !== before.href) return "the page navigated to a different URL while the action ran";
  return undefined;
}
