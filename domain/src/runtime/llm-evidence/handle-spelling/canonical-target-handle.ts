// One element, one spelling.
//
// The domain mints a target handle as `t` and a number (`../stable-handles.ts`):
// the compact page view prints `t267`, and every packet, refusal, failure
// packet and repair candidate says it the same way, so the model never sees two
// spellings of one element. Until t223 the handle was `target.N`, and a model
// that learned that spelling -- from an earlier run, a Flow script it was shown
// or Core's own examples -- still writes it. So input takes either, and every
// place that accepts a handle the model wrote puts it through this first:
// `target.N` and `tN` name the same element, and what is looked up, kept or
// handed back is always `tN`.

import { WEB_LLM_TARGET_HANDLE_PATTERN } from "../stable-handles";

const TARGET_HANDLE = new RegExp(WEB_LLM_TARGET_HANDLE_PATTERN, "u");
const LEGACY_PREFIX = "target.";

/**
 * The canonical `t<N>` form of a target handle written either `t<N>` or the old
 * `target.<N>`, or `undefined` when the value is not a target handle at all.
 * Nothing else is guessed at: a number with no prefix, a zero, or seven digits
 * is not a handle in either spelling.
 */
export function canonicalWebLlmTargetHandle(value: unknown): string | undefined {
  if (typeof value !== "string" || !TARGET_HANDLE.test(value)) return undefined;
  return `t${value.startsWith(LEGACY_PREFIX) ? value.slice(LEGACY_PREFIX.length) : value.slice(1)}`;
}
