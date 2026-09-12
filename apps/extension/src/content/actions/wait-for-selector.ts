// The wait-for-selector verb: wait until the page satisfies a condition about
// an element, and report what it showed.
//
// `action.wait.condition` chooses what is waited for -- `present` (the default,
// and the only condition before Phase 1.2), `visible`, `enabled`, `absent`, a
// `url`, or the page going `stable`. Running out of time is not the same as
// failing, so a timeout reports `timed_out` with Core's `timeout` category
// rather than a flattened `failed`; a request the page could never satisfy (a
// condition that needs a selector, asked without one) throws instead, and
// `execute.ts` turns that into a plain failure, because a malformed command
// never waited for anything.

import type { BrowserActionCommand, BrowserActionResult, WebAutomationWaitCondition } from "../types";
import type { ContentActionDependencies } from "./types";

/** How this verb talks about a condition: what it expected, what it says when it held, and when it did not. */
type WaitPhrases = { expected: string; satisfied: string; timedOut: string };

export async function waitForSelectorAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const condition = action.wait?.condition ?? "present";
  const url = action.wait?.url ?? action.url;
  const outcome = await deps.waitForCondition({
    condition,
    selector: action.selector,
    url,
    timeoutMs: action.timeoutMs,
    stableForMs: action.wait?.stableForMs
  });
  const phrases = phrasesFor(condition, action.selector, url);
  if (!outcome.ok) {
    return deps.timedOut(action, startedAt, phrases.timedOut, { status: "failed", expected: phrases.expected, actual: outcome.actual }, {
      snapshot: deps.captureSnapshot()
    });
  }
  return deps.success(action, startedAt, phrases.satisfied, { status: "passed", expected: phrases.expected, actual: outcome.actual }, {
    ...(outcome.element ? { element: deps.describeElement(outcome.element) } : {}),
    snapshot: deps.captureSnapshot()
  });
}

function phrasesFor(condition: WebAutomationWaitCondition, selector: string | undefined, url: string | undefined): WaitPhrases {
  const target = selector ?? "(no selector)";
  if (condition === "visible") {
    return { expected: `a visible element matching ${target}`, satisfied: "The element is visible.", timedOut: `Timed out waiting for a visible element: ${target}` };
  }
  if (condition === "enabled") {
    return { expected: `an enabled element matching ${target}`, satisfied: "The element is enabled.", timedOut: `Timed out waiting for an enabled element: ${target}` };
  }
  if (condition === "absent") {
    return { expected: `no element matching ${target}`, satisfied: "The element is gone.", timedOut: `Timed out waiting for the element to go: ${target}` };
  }
  if (condition === "url") {
    const address = url ?? "(no url)";
    return { expected: `the page URL to be ${address}`, satisfied: "The URL matched.", timedOut: `Timed out waiting for the URL: ${address}` };
  }
  if (condition === "stable") {
    return { expected: "the page to stop changing", satisfied: "The page is stable.", timedOut: "Timed out waiting for the page to stop changing." };
  }
  // `present`, in the wording this verb shipped with, so a report reads the same across the change.
  return { expected: `an element matching ${target}`, satisfied: "Selector found.", timedOut: `Timed out waiting for selector: ${target}` };
}
