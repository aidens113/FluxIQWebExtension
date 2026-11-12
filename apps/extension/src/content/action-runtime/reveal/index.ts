// Scrolling toward a target the page has not shown yet, between the attempts of
// a node's own retries: `unshown-target.ts` keeps the refused target beside its
// result, `reveal-aim.ts` decides where a person would scroll to find it and
// whether scrolling can help, and `reveal-by-scroll.ts` makes the scroll.

export { noteUnshownTarget, revealUnshownTarget, unshownTargetOf } from "./unshown-target";
// The wait on the page's own work toward a target it has not shown yet (t903).
export { PAGE_WORK_LOOK_MS, watchPageWork, watchUnshownTargetWork } from "./page-work";
export { revealByScroll } from "./reveal-by-scroll";
export { revealAim } from "./reveal-aim";

export type { RevealAim } from "./reveal-aim";
export type { PageWork } from "./page-work";
