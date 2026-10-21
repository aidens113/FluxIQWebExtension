// The offline-trial experiment (trace-offline-trials-plan, P4 gate): the
// social task's traced trials mapped to their candidates, each candidate
// rebuilt through Core's own authoring path with the build's recorded step
// resolutions and checked by Core's digests, each trial's stored rows judged by
// the task's own oracle, and a hand tier-1 correction prepared for the offline
// trial runner. Provider-free throughout; `cli.ts` is its command line and is
// not re-exported.
export type * from "./types.js";
export * from "./json-record.js";
export * from "./lab-subflow-steps.js";
export * from "./store-trace-manifests.js";
export * from "./traced-revisions.js";
export * from "./project-build-state.js";
export * from "./rebuild/index.js";
export * from "./oracle/index.js";
export * from "./run/index.js";
export * from "./experiment-session.js";
export * from "./survey-experiment.js";
export * from "./offline-trial-request.js";
export * from "./cli-arguments.js";
