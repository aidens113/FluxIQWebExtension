// A robot check that cleared by itself, as an action result reports it.
//
// A click or a navigation can land on a check the page lifts on its own, and
// the extension waits it out in place without touching it
// (`apps/extension/src/runtime/landed-check-wait.ts`). Until this field the
// fact left the browser only as prose appended to the validation's `actual`,
// which no reader can count on and which the build's evidence loop drops when
// it reports a node run. The chat's robot-check card needs it as a fact: done,
// "cleared on its own after N s".
//
// So the result carries `checkWait: { waitedMs }`, and only for the one outcome
// a reader acts on as a success: the check stood, and cleared by itself. A
// check that asked for a person, or did not clear in time, fails the action
// with `USER_INTERVENTION_REQUIRED` and says so in its failure record; a page
// with no check carries nothing.
//
// It is copied, never passed through, at each hop that carries it -- the
// gateway payload (`client/gateway-mapping.ts`) and the evidence loop's tool
// execution (`runtime/llm-evidence/node-run/cleared-wait.ts`, as
// `clearedWait`) -- through `webAutomationClearedCheckWaitValue`, which keeps
// `waitedMs` alone, as a whole number of milliseconds within ten minutes. A
// wait is held within the command's own timeout, so a longer one is a
// malformed result rather than a long wait, and is dropped rather than clamped.

/** How long a self-clearing check stood before it lifted by itself, untouched. */
export type WebAutomationClearedCheckWait = {
  waitedMs: number;
};

/** The longest wait a result may report: ten minutes, well past any command's timeout. */
export const WEB_AUTOMATION_CLEARED_CHECK_WAIT_MAX_MS = 600_000;

/**
 * The cleared wait as it may travel: `waitedMs` alone, rounded to a whole
 * millisecond, or nothing when the value is not a wait within the bound.
 */
export function webAutomationClearedCheckWaitValue(value: unknown): WebAutomationClearedCheckWait | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const waitedMs = (value as { waitedMs?: unknown }).waitedMs;
  if (typeof waitedMs !== "number" || !Number.isFinite(waitedMs)) return undefined;
  const whole = Math.round(waitedMs);
  if (whole < 0 || whole > WEB_AUTOMATION_CLEARED_CHECK_WAIT_MAX_MS) return undefined;
  return { waitedMs: whole };
}
