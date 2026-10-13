// A run's Week 2 adaptation measurements: read from Core while the run's
// workspace still exists, measured from Core's own payloads, recorded in the
// bundle, and read back by both producers of a `RunEvaluation`. Beside them,
// whether a `--replays` run counts toward the adaptation gate.
export * from "./core-reads.js";
export * from "./gate.js";
export * from "./measure.js";
export * from "./snapshot.js";
