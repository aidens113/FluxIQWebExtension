// The wait-for-text verb: succeed once the page's text contains the target.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export async function waitForTextAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  await deps.waitForText(action.text ?? action.value ?? "", action.timeoutMs);
  return deps.success(action, startedAt, "Text found.", undefined, deps.captureSnapshot());
}
