// A press the page ignored: watched for after a press that is not a link, and
// pressed once more only when the page was seen to do nothing at all.
// `press-again.ts` holds the rule; the rest reads the page for it.

export { watchIgnoredPress } from "./ignored-press-watch";
export { MAX_EXTRA_PRESSES, pressAgain } from "./press-again";
export { pressScope } from "./press-scope";

export type { IgnoredPressAnswer, IgnoredPressProbe, IgnoredPressWatch } from "./ignored-press-watch";
export type { PressListener, PressPage } from "./page-press-listener";
export type { PressSignal } from "./press-again";
