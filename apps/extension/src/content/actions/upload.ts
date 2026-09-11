// The upload verb: put files into a file input.
//
// Registered so the action type is reachable and fails honestly; the behaviour
// is `w2-upload-dialog`'s, through `deps.setInputFiles`. The validation
// compares the file names the input ended up holding with the request.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function uploadAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  return deps.notImplemented(action, startedAt, "web.dom.upload");
}
