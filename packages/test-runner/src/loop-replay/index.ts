// Core's loop detector over saved step logs: a run's log read back as the loops it
// held (`read-steps.ts`), one run replayed (`replay-run.ts`), all of them and the
// table (`corpus.ts`), and what a live run's log says the detector did
// (`loops-caught.ts`, for the Lab's report).
export { renderLoopReplayTable, replayLoopCorpus, type LoopReplayCorpusRun } from "./corpus.js";
export { loopsCaughtInSteps } from "./loops-caught.js";
export { readLoopReplayLoops, type LoopReplayLoop } from "./read-steps.js";
export { replayLoopRun, type LoopReplayFiring, type LoopReplayRun } from "./replay-run.js";
