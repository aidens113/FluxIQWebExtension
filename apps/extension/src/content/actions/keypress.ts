// The keypress verb: press a key on the target or the focused element, and
// perform the default action a trusted key would have performed.
//
// A synthetic `KeyboardEvent` triggers no default action, so before Wave 2
// this verb reported success for an Enter that submitted nothing and a Tab
// that moved nothing -- the "unreliable" row the action audit recorded. The
// keyboard capability (decision D5) delivers the key and then emulates the
// default action, and says both what that was meant to achieve and what it
// observed, which becomes this result's validation.
//
// A key whose default action cannot be emulated honestly -- arrow keys in a
// radio group or a select, Space on a control that a trusted event would
// activate -- is `ACTION_REJECTED` naming the verb that does the job, not a
// success over a page that never changed.
//
// A named target that a person could not have reached -- disabled, hidden, or
// covered -- is refused by the same actionability gate `web.dom.click` uses,
// before the key is dispatched. The gate applies only when the command named
// the target: with no selector the key goes wherever focus already is, which
// names nothing to refuse, and the browser's own focus rules already keep a
// disabled element from holding focus.

import type { ActionResultEvidence } from "../action-runtime";
import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function keypressAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const named = Boolean(action.selector);
  // The one verb whose evidence carries a resolution only sometimes: with no
  // selector the key goes wherever focus already is, so nothing was resolved and
  // there is no measurement to report rather than a measurement worth nothing.
  const resolved = named ? deps.resolveTarget(action) : undefined;
  const target = resolved?.element ?? document.activeElement ?? document.body;
  const key = action.key ?? action.text ?? "";
  const evidence = (): ActionResultEvidence => ({
    element: deps.describeElement(target),
    snapshot: deps.captureSnapshot(),
    ...(resolved ? { resolution: resolved.resolution } : {})
  });

  if (named) {
    const report = deps.checkActionability(target);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can receive the key press", report.detail, evidence());
    }
  }

  const outcome = deps.keyboard.pressKey(target, key, action.modifiers);

  if (outcome.defaultAction === "unsupported") {
    return deps.rejected(action, startedAt, "unsupported_key", outcome.expected, outcome.detail, evidence());
  }
  return deps.success(action, startedAt, outcome.held ? "Key pressed." : "The key press had no observable effect.", {
    status: outcome.held ? "passed" : "failed",
    expected: outcome.expected,
    actual: outcome.detail
  }, evidence());
}
