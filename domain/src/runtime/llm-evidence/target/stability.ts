// Whether handles already shown to the model still name the same controls.
//
// A mutation may add new controls without invalidating any old handle. That is
// safe for a following batched action because the model could only have named
// handles from the earlier packet. Removing, reassigning, or navigating away
// is not safe. Selector strings stay behind this domain boundary; only the
// boolean answer crosses it.

import type { WebLlmSnapshotBinding } from "../sanitize";

export function webLlmTargetsUnchanged(before: WebLlmSnapshotBinding, after: WebLlmSnapshotBinding): boolean {
  if (before.evidence.location !== after.evidence.location) return false;
  for (const [target, selector] of before.selectors) {
    if (after.selectors.get(target) !== selector) return false;
  }
  return true;
}
