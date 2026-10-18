// Scrolling toward a target the page has not shown yet, between the attempts of
// a node's own retries: `unshown-target.ts` keeps the refused target beside its
// result, `reveal-aim.ts` decides where a person would scroll to find it and
// whether scrolling can help, and `reveal-by-scroll.ts` makes the scroll.

export { noteUnshownTarget, revealUnshownTarget } from "./unshown-target";
export { revealByScroll } from "./reveal-by-scroll";
export { revealAim } from "./reveal-aim";

export type { RevealAim } from "./reveal-aim";
