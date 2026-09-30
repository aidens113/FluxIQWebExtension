// The getting-started screen: numbered steps that replace the chat until the
// browser is connected and approved. `start-steps.ts` decides; `start-view.ts` draws.
export { startGuide, type StartConnect, type StartGuide, type StartStep, type StartStepState } from "./start-steps";
export { createStartView, type StartView } from "./start-view";
