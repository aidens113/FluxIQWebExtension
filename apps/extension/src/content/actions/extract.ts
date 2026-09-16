// The extract verb: read a value from the resolved target.
//
// Reading is not acting, so there is no post-condition to check and the
// validation is `evidence-only`. Whether the value is the expected one is an
// authored `web.dom.assert`, not this verb's business.
//
// A sensitive control is never read (decision D2). The capability refuses
// before it reads anything, and the refusal is reported the way every other
// reader's is: ACTION_REJECTED with `sensitive_value`, the element described
// by its descriptor, which carries no value, and no `extracted` at all.
//
// **What to read comes from `action.extract` now** (contract C3): the picker
// records a value extraction as a declared `{ mode, attribute? }`, checked by
// the domain on the way in and on the way out, instead of as a free-form
// `options` bag whose `mode` could be anything. `options` is still read when a
// command carries no `extract`, because every recording made before C3 names
// the mode there and those recordings still replay.

import type { BrowserActionCommand, BrowserActionResult, JsonObject } from "../types";
import type { ContentActionDependencies } from "./types";

export function extractAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const { element, resolution } = deps.resolveTarget(action);
  const read = deps.extractElement(element, readRequest(action));
  if (!read.ok) {
    return deps.rejected(
      action,
      startedAt,
      read.refusal,
      "a readable element that is not a sensitive control",
      "the target is a sensitive control, so its value is never read",
      { element: deps.describeElement(element), resolution }
    );
  }
  return deps.success(action, startedAt, "Value extracted.", { status: "none", reason: "evidence-only" }, {
    element: deps.describeElement(element),
    snapshot: deps.captureSnapshot(),
    extracted: read.value,
    resolution
  });
}

/**
 * The read the reader is given: the command's structured `extract`, or its
 * legacy `options` when it has none.
 *
 * The structured read is copied field by field rather than passed through, so
 * the reader keeps taking one shape and a property the domain does not declare
 * cannot arrive with it.
 */
function readRequest(action: BrowserActionCommand): JsonObject | undefined {
  const extract = action.extract;
  if (extract === undefined) return action.options;
  return extract.attribute === undefined ? { mode: extract.mode } : { mode: extract.mode, attribute: extract.attribute };
}
