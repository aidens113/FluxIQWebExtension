// The keypress verb: dispatch a key down and up on the target or the focused element.
//
// The dispatched events are untrusted, so they trigger no default action --
// Enter does not submit and Tab does not move focus. `w2-keyboard-input`
// replaces this with the keyboard capability, which performs the default action
// itself and validates that it happened.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function keypressAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const target = action.selector ? deps.resolveTarget(action) : document.activeElement ?? document.body;
  const key = action.key ?? action.text ?? "";
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
  return deps.success(action, startedAt, "Key event dispatched.", { status: "none", reason: "not-yet-validated" }, {
    ...(target instanceof Element ? { element: deps.describeElement(target) } : {}),
    snapshot: deps.captureSnapshot()
  });
}
