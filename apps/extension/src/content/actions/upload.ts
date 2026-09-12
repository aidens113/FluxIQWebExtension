// The upload verb: put files into a file input.
//
// The post-condition is the file names the input ended up holding, read back
// off the element, so an upload that silently put nothing anywhere reports
// `failed` with `output_not_observed` rather than success. A target that cannot
// hold files at all is refused before anything is dispatched: that is a
// rejection with a code, not a failed post-condition.
//
// File contents never appear in the result, the message, or the validation --
// only names.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function uploadAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const files = action.upload?.files ?? [];
  const element = deps.resolveTarget(action);
  const evidence = { element: deps.describeElement(element), snapshot: deps.captureSnapshot() };
  const expected = fileNameList(files.map((file) => file.name));

  const outcome = deps.setInputFiles(element, files);
  if (!outcome.ok) {
    return deps.rejected(action, startedAt, "upload_rejected", expected, outcome.reason, evidence);
  }

  const actual = fileNameList(outcome.fileNames);
  return deps.success(action, startedAt, "Files uploaded.", {
    status: actual === expected ? "passed" : "failed",
    expected,
    actual
  }, evidence);
}

function fileNameList(names: readonly string[]): string {
  return names.length === 0 ? "(no files)" : names.join(", ");
}
