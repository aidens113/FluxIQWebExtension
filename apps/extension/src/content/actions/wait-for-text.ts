// The wait-for-text verb: wait until the page's rendered text satisfies a
// condition, and report what it showed.
//
// The conditions that read an element -- `enabled`, and `visible` with a
// selector -- are wait-for-selector's; this verb always waits on text, so it
// passes the text and never the command's selector. `present` (the default)
// waits for the text to appear, `absent` for it to go, and `url` and `stable`
// are about the page rather than either. As with wait-for-selector, running out
// of time reports `timed_out`, not `failed`.

import type { BrowserActionCommand, BrowserActionResult, WebAutomationWaitCondition } from "../types";
import type { ContentActionDependencies } from "./types";

/** How this verb talks about a condition: what it expected, what it says when it held, and when it did not. */
type WaitPhrases = { expected: string; satisfied: string; timedOut: string };

export async function waitForTextAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const condition = action.wait?.condition ?? "present";
  const text = action.text ?? action.value ?? "";
  const url = action.wait?.url ?? action.url;
  const outcome = await deps.waitForCondition({
    condition,
    text,
    url,
    timeoutMs: action.timeoutMs,
    stableForMs: action.wait?.stableForMs
  });
  const phrases = phrasesFor(condition, text, url);
  if (!outcome.ok) {
    return deps.timedOut(action, startedAt, phrases.timedOut, { status: "failed", expected: phrases.expected, actual: outcome.actual }, {
      snapshot: deps.captureSnapshot()
    });
  }
  return deps.success(action, startedAt, phrases.satisfied, { status: "passed", expected: phrases.expected, actual: outcome.actual }, {
    snapshot: deps.captureSnapshot()
  });
}

function phrasesFor(condition: WebAutomationWaitCondition, text: string, url: string | undefined): WaitPhrases {
  if (condition === "visible") {
    return { expected: `visible page text containing ${text}`, satisfied: "The text is visible.", timedOut: `Timed out waiting for visible text: ${text}` };
  }
  if (condition === "absent") {
    return { expected: `no page text containing ${text}`, satisfied: "The text is gone.", timedOut: `Timed out waiting for the text to go: ${text}` };
  }
  if (condition === "url") {
    const address = url ?? "(no url)";
    return { expected: `the page URL to be ${address}`, satisfied: "The URL matched.", timedOut: `Timed out waiting for the URL: ${address}` };
  }
  if (condition === "stable") {
    return { expected: "the page to stop changing", satisfied: "The page is stable.", timedOut: "Timed out waiting for the page to stop changing." };
  }
  // `present`, in the wording this verb shipped with. `enabled` needs an
  // element, so the capability refuses it before any phrase is chosen.
  return { expected: `page text containing ${text}`, satisfied: "Text found.", timedOut: `Timed out waiting for text: ${text}` };
}
