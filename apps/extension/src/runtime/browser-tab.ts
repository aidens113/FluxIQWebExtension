// `web.browser.tab`: open a tab, switch to one, or close one.
//
// A tab action runs in the background worker, not the page: only the worker has
// `chrome.tabs`. Registered so the action type is reachable and fails honestly;
// the behaviour is `w2-browser-actions`', which also keeps the automation tab
// in step so a later content action addresses the tab the switch selected.

import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";

export function runBrowserTabAction(action: BrowserActionCommand): Promise<BrowserActionResult> {
  const now = Date.now();
  return Promise.resolve({
    commandId: action.commandId,
    actionType: action.actionType,
    status: "failed",
    validation: { status: "none", reason: "not-yet-validated" },
    message: "web.browser.tab is not implemented yet.",
    failure: {
      category: "blocked_by_capability_or_policy",
      code: "web.action.not_implemented",
      retryable: false,
      stage: "dispatch"
    },
    startedAt: now,
    finishedAt: now
  });
}
