// The wait-for-text verb: succeed once the page's text contains the target.
//
// As with wait-for-selector, a timeout reports `timed_out`, not `failed`.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export async function waitForTextAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const text = action.text ?? action.value ?? "";
  const expected = `page text containing ${text}`;
  try {
    await deps.waitForText(text, action.timeoutMs);
  } catch (error) {
    return deps.timedOut(action, startedAt, error instanceof Error ? error.message : "Timed out waiting for text.", {
      status: "failed",
      expected,
      actual: "the text did not appear before the timeout"
    }, { snapshot: deps.captureSnapshot() });
  }
  return deps.success(action, startedAt, "Text found.", { status: "passed", expected, actual: "the text was found" }, {
    snapshot: deps.captureSnapshot()
  });
}
