// The upload verb: put files into a file input.
//
// The post-condition compares the names the input ended up holding, read back
// off the element, with the names the command asked for. It passes only when
// the input holds exactly those names, in order, so an upload that silently put
// nothing anywhere reports `failed` with `output_not_observed` rather than
// success. A target that cannot hold files at all is refused before anything is
// dispatched: that is a rejection with a code, not a failed post-condition.
//
// The actionability gate is read here, but only the half of it that bears on
// putting files into an input. The files are assigned through a `DataTransfer`
// and the input is never pressed, and the standard way to ship a file input on
// the web is to keep it out of sight behind a styled label -- job-board's ATS
// and everything-store's photo dialog both do -- so "no visible box" is not
// evidence that the upload would not work, and refusing it would refuse nearly
// every real upload. Two things are evidence, and both mean the page will
// never read what is assigned: a disabled input, which submits nothing, and an
// inert subtree, which the page has taken out of interaction entirely (the
// everything-store's notification prompt does exactly that to the page behind
// it). Either is a refusal rather than a success nothing acts on.
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

  const unusable = unusableReason(element, deps);
  if (unusable) return deps.rejected(action, startedAt, "disabled", expected, unusable, evidence);

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

/**
 * Why the page would never read the files, if it would not: the input is
 * disabled, or it sits in a subtree the page has made inert. Being out of
 * sight is not a reason, and neither is something covering it, since nothing
 * is pressed.
 */
function unusableReason(element: Element, deps: ContentActionDependencies): string | undefined {
  // The gate's own answer first: it is the only reading that accounts for an
  // ancestor claiming `aria-disabled`, which a composite upload widget does.
  const report = deps.checkActionability(element);
  if (!report.actionable && report.code === "disabled") return report.detail;
  // The gate answers `hidden` before it looks at `disabled`, and hidden is how
  // most file inputs ship, so the platform rule is asked for again here -- it
  // is what would refuse the file, and `:disabled` carries a disabled
  // `<fieldset>` above the input with it.
  if (element.matches(":disabled")) return "the file input is disabled";
  // An inert subtree reaches the gate as `hidden` too, and it means the page
  // has taken interaction away rather than merely drawn the input elsewhere.
  return element.closest("[inert]") ? "the file input is inert" : undefined;
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
