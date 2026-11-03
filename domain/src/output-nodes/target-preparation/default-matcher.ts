import type { ElementMatcher } from "fluxiq/runtime/target-matching";

/** Pins the inspected default method and its original receiver before exposure. */
export function pinDefaultWebElementMatcher(matcher: ElementMatcher): ElementMatcher {
  const receiver = matcher;
  const bestCandidate = receiver.bestCandidate;
  return Object.freeze({ ...receiver, bestCandidate: (...args: Parameters<ElementMatcher["bestCandidate"]>) => bestCandidate.apply(receiver, args) });
}
