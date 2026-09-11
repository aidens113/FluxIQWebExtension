// The scroll verb: scroll the window to the requested position.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function scrollAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  window.scrollTo({
    left: Number(action.options?.x ?? action.coordinates?.x ?? window.scrollX),
    top: Number(action.options?.y ?? action.coordinates?.y ?? window.scrollY),
    behavior: action.options?.smooth === true ? "smooth" : "instant"
  });
  return deps.success(action, startedAt, "Page scrolled.", undefined, deps.captureSnapshot());
}
