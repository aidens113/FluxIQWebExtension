// Barrel for a misclick before a press (W2 H4): `before.ts` decides and makes
// it; `chance.ts` and `random.ts` say how often and from which seeded draws;
// `point.ts` finds where, beside the target, and `inert-point.ts` with
// `interactive-element.ts` says whether a point is safe to click; `open-layer.ts`
// says whether anything is open over the page, when no misclick is made.
export { misclickBefore } from "./before";
export { misclickChance } from "./chance";
export { inertHitAt } from "./inert-point";
export { isInteractiveElement } from "./interactive-element";
export { pageHasOpenLayer } from "./open-layer";
export { misclickPoint } from "./point";
export { misclickRandom } from "./random";
