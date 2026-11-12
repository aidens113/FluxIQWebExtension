// Planned human pauses, fitted within the command's own time.
//
// A command has its own time (`timeoutMs` before any robot-check allowance,
// `webAutomationBaseTimeoutMs`; Core's default for an action node when it names
// none), after which Core stops waiting for its answer. Humanness must never be
// why a command misses that: the pauses may take at most `HUMAN_SHARE` of what
// is left of it when they are planned, and a plan that would take more is
// scaled down as a whole -- typed faster, dwelt on less -- never cut short or
// failed. The rest is the verb's own: the read-back, the press's watches, a
// submit, the reply. The robot-check allowance is never spent here.

import { WEB_AUTOMATION_DEFAULT_ACTION_TIMEOUT_MS, webAutomationBaseTimeoutMs } from "@fluxiq-web-extension/domain/client";

/** The most of the command's remaining time the pauses may take. */
const HUMAN_SHARE = 0.4;

/** The planned pauses, scaled to fit, as whole milliseconds. `now` is when they are about to start. */
export function fitWithinCommand(
  plannedMs: readonly number[],
  action: { timeoutMs?: number | undefined; checkWaitMs?: number | undefined },
  startedAt: number,
  now: number = Date.now()
): number[] {
  const commandMs = webAutomationBaseTimeoutMs(action) ?? WEB_AUTOMATION_DEFAULT_ACTION_TIMEOUT_MS;
  const room = Math.max(0, commandMs - (now - startedAt)) * HUMAN_SHARE;
  const total = plannedMs.reduce((sum, ms) => sum + Math.max(0, ms), 0);
  const scale = total > room ? room / total : 1;
  return plannedMs.map((ms) => Math.floor(Math.max(0, ms) * scale));
}
