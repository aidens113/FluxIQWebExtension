// The target a gate refused as `hidden`, kept beside the result that refused it
// so the retry loop can scroll toward it before the next attempt.
//
// Held in a `WeakMap` keyed by the result object, as `../recovery/refused-control.ts`
// holds a disabled control's fingerprint, and for the same reason: the result
// crosses to the background worker and on to Core, whose record parser drops a
// whole record for one key it does not know, and an element is not data. The
// map lives and dies with the results in this frame.
//
// The element only aims a scroll. It is never acted on, and the next attempt
// resolves its target afresh (`../recovery/attempt.ts`), so no handle survives
// from one attempt to the next as the target.

import type { BrowserActionResult } from "../../types";
import { revealByScroll } from "./reveal-by-scroll";

const UNSHOWN_TARGETS = new WeakMap<BrowserActionResult, Element>();

/** Notes the target a gate refused as `hidden` before the verb dispatched anything. Called by `../results.ts` for that refusal alone. */
export function noteUnshownTarget(result: BrowserActionResult, target: Element): void {
  UNSHOWN_TARGETS.set(result, target);
}

/** Scrolls toward the target this result refused as not shown, when one was noted and scrolling may reveal it. Answers whether anything moved. */
export function revealUnshownTarget(result: BrowserActionResult): boolean {
  const target = UNSHOWN_TARGETS.get(result);
  return target === undefined ? false : revealByScroll(target);
}
