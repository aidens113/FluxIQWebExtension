// The dialog verb: arm the answer to the next native dialog.
//
// Registered so the action type is reachable and fails honestly; the behaviour
// is `w2-upload-dialog`'s, through `deps.dialogControl`. Arming has to happen
// before the dialog opens, because a native dialog blocks the page's script.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function dialogAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  return deps.notImplemented(action, startedAt, "web.dom.dialog");
}
