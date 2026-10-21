// Running an offline trial of the gate experiment through Core's exported
// runner (`runAutomationStudioOfflineCandidateTrial`, trace plan P4c): a fresh
// copy of the workspace, a host built as the web process builds one, the
// trial ports a live build's trial gets with a judge that calls no model, and
// the outcome compared with the live trials and judged by the task's oracle.
export * from "./core-trial-seams.js";
export * from "./fresh-store-copy.js";
export * from "./not-judged-judge.js";
export * from "./declared-session-view.js";
export * from "./offline-trial/index.js";
export * from "./run-offline-experiment-trial.js";
export * from "./live-trial-feedback.js";
export * from "./trial-observation.js";
export * from "./stored-rows-comparison.js";
export * from "./experiment-trial.js";
