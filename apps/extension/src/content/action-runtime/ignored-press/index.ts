// A press the page ignored: watched for after a press that is not a link, and
// pressed once more only when the page was seen to do nothing at all.
// `press-again.ts` holds the rule, and `command-presses.ts` counts the extra
// press across the in-page recovery's attempts; the rest reads the page for it.
// `settled-look.ts` says whether a press certainly did nothing once the page
// settled (t517), which the click reports for Core to press once more, or that
// it brought nothing but a notice in one of the page's own notice regions
// (`live-region.ts`, t743), which the click reports as the page saying the
// press failed.

export { watchIgnoredPress } from "./ignored-press-watch";
export { extraPressesMade, noteExtraPress } from "./command-presses";
export { MAX_EXTRA_PRESSES, pressAgain } from "./press-again";
export { pressScope } from "./press-scope";
export { markRequestStarts } from "./request-start-mark";
export { scopeRoots } from "./scope-roots";
export { lookUntilSettled } from "./settled-look";

export type { IgnoredPressAnswer, IgnoredPressProbe, IgnoredPressWatch } from "./ignored-press-watch";
export type { PressListener, PressPage } from "./page-press-listener";
export type { PressSignal } from "./press-again";
export type { RequestStartMark } from "./request-start-mark";
export type { SettledLook, SettledLookPage } from "./settled-look";
