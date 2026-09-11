// `web.browser.download`: wait for a browser download to complete.
//
// Downloads are observable only through `chrome.downloads` in the background
// worker, and the `downloads` permission arrives with `w2-upload-dialog`.
// Registered so the action type is reachable and fails honestly; the behaviour
// is `w2-browser-actions`'.

import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";

export function runBrowserDownloadAction(action: BrowserActionCommand): Promise<BrowserActionResult> {
  const now = Date.now();
  return Promise.resolve({
    commandId: action.commandId,
    actionType: action.actionType,
    status: "failed",
    validation: { status: "none", reason: "not-yet-validated" },
    message: "web.browser.download is not implemented yet.",
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
