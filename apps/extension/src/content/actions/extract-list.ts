// The extract-list verb: read a repeating structure into records.
//
// Registered so the action type is reachable and fails honestly; the behaviour
// is `w2-extract-list`'s, through `deps.extractList`. The records become the
// result's `extracted`, and the validation fails when a record lacks a declared
// field.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function extractListAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  return deps.notImplemented(action, startedAt, "web.dom.extract_list");
}
