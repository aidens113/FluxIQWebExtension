// Room for a command to wait out a robot check that clears by itself.
//
// **Why the command carries it.** A navigation or a click can land on a check
// that lifts on its own -- bigbox's "Robot or human?" after 8 s, auction's
// "Checking your browser" after 5 s -- and the extension waits those out in
// place rather than handing them to a person or reloading into them
// (`apps/extension/src/runtime/landed-check-wait.ts`). But Core gives a command
// `timeoutMs` plus a three-second answer margin and then drops a late answer,
// and a recorded click's `timeoutMs` is Core's default 5,000 ms. The wait was
// cut to about four seconds and every 8 s check went to a person, who found it
// already gone (`run-munx9bvj-a7ba7442`, node `entry.13`, 3,913 ms).
//
// So a command that can land on a check is given the allowance on top of its
// own timeout, which is what makes Core's deadline cover the wait, and says so
// in `checkWaitMs`, which is what lets the extension keep every *other* wait on
// the timeout the command had before. An ordinary click that meets no check
// behaves exactly as it did; only a command that is actually waiting out a
// check uses the extra time.
//
// This follows the paginated read (`extraction/request.ts`), which scales its
// `timeoutMs` for the same reason: Core sends the node's timeout as the
// command's, and a default sized for one quick action cuts a longer honest one
// short.

/** How long a command may spend waiting out a check that said it would clear by itself. */
export const WEB_AUTOMATION_CHECK_WAIT_MS = 15_000;

/** Core's timeout for an action node that names none (`nodes/policy/action.ts`). */
export const WEB_AUTOMATION_DEFAULT_ACTION_TIMEOUT_MS = 5_000;

/** The actions whose command can land on a check: the ones that load or change the page. */
export const WEB_AUTOMATION_CHECK_WAIT_ACTIONS: readonly string[] = ["web.dom.click", "web.browser.navigate"];

/** Whether an action's command is given the check allowance. */
export function webAutomationActionWaitsOutChecks(outputId: string): boolean {
  return WEB_AUTOMATION_CHECK_WAIT_ACTIONS.includes(outputId);
}

/**
 * The timeout a command had before the check allowance was added to it: what
 * every wait but the check's own is bounded by. `undefined` when the command
 * names no timeout.
 */
export function webAutomationBaseTimeoutMs(command: { timeoutMs?: number | undefined; checkWaitMs?: number | undefined }): number | undefined {
  const { timeoutMs, checkWaitMs } = command;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined;
  if (typeof checkWaitMs !== "number" || !Number.isFinite(checkWaitMs) || checkWaitMs <= 0) return timeoutMs;
  // Never below a positive remainder: an allowance larger than the timeout it
  // was added to is a malformed command, and the whole of it stays bounded.
  return timeoutMs > checkWaitMs ? timeoutMs - checkWaitMs : timeoutMs;
}
