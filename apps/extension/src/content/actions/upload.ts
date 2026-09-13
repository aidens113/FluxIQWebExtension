// The upload verb: put files into a file input.
//
// The post-condition compares the names the input ended up holding, read back
// off the element, with the names the command asked for. It passes only when
// the input holds exactly those names, in order, so an upload that silently put
// nothing anywhere reports `failed` with `output_not_observed` rather than
// success. A target that cannot hold files at all is refused before anything is
// dispatched: that is a rejection with a code, not a failed post-condition.
//
// The validation compares names but quotes none. A chosen file's name is the
// user's data, as a typed value is, and whatever this verb writes into
// `expected` and `actual` is kept at rest in Core's saved command attempt: the
// Lab found W17's file name there twice while these two strings listed the
// names. So both say only how many files there are and whether their names
// match, and a refusal's `expected` says the same. File contents never appear
// in the result, the message, or the validation.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function uploadAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const files = action.upload?.files ?? [];
  const requested = files.map((file) => file.name);
  const { element, resolution } = deps.resolveTarget(action);
  const evidence = { element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution };
  const expected = describeFiles(requested.length, true);

  const outcome = deps.setInputFiles(element, files);
  if (!outcome.ok) {
    return deps.rejected(action, startedAt, "upload_rejected", expected, outcome.reason, evidence);
  }

  const matched = sameNames(outcome.fileNames, requested);
  return deps.success(action, startedAt, "Files uploaded.", {
    status: matched ? "passed" : "failed",
    expected,
    actual: describeFiles(outcome.fileNames.length, matched)
  }, evidence);
}

/** How many files, and whether their names are the requested ones -- never a name. */
function describeFiles(count: number, named: boolean): string {
  if (count === 0) return "no files";
  const files = count === 1 ? "1 file" : `${count} files`;
  return named ? `${files}, named as requested` : `${files}, not named as requested`;
}

function sameNames(held: readonly string[], requested: readonly string[]): boolean {
  return held.length === requested.length && held.every((name, index) => name === requested[index]);
}
