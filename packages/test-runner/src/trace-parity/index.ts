// Trace parity (trace-offline-trials-plan, lane T P3): every stored client
// gateway trace replayed through Core's own intake by Core's harness, and the
// parity reported as counts, sequences, kinds, message types and field names.
// `check-store-traces` does the same for any storage root on disk (older
// traces included: Core's harness classifies what they never recorded) and
// adds each trace's last delivery points by name.
export type * from "./types.js";
export * from "./parity-reason.js";
export * from "./summarize-parity.js";
export * from "./replay-with-deadline.js";
export * from "./check-project-trace-parity.js";
export * from "./delivery-tail.js";
export * from "./store-projects.js";
export * from "./check-store-traces.js";
