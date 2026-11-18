// The numbered steps as data (`steps.ts`), what they say (`step-words.ts`), and the screen that draws them (`view.ts`).
export { startGuide, type StartConnect, type StartGuide, type StartMemory, type StartStep, type StartStepKey, type StartStepState } from "./steps";
export { createStartView, type StartView } from "./view";
export { ACCESS_REMOVED_LINE, NOT_CONNECTED_LINE } from "./step-words";
