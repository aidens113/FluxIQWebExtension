// The keypress verb: dispatch a key down and up on the target or the focused element.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function keypressAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const target = action.selector ? deps.resolveTarget(action) : document.activeElement ?? document.body;
  const key = action.key ?? action.text ?? "";
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
  return deps.success(action, startedAt, "Key event dispatched.", target instanceof Element ? deps.describeElement(target) : undefined, deps.captureSnapshot());
}
