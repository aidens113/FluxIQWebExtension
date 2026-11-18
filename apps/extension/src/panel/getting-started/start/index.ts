// The numbered steps as data (`steps.ts`), what they say (`step-words.ts`), and the screen that draws them (`view.ts`).
export { startGuide, type StartConnect, type StartGuide, type StartStep, type StartStepKey, type StartStepState } from "./steps";
export { createStartView, type StartView } from "./view";
export { APPROVED_EARLIER_LINE, MAY_HAVE_BEEN_REMOVED_LINE } from "./step-words";
