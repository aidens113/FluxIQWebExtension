// The task's own oracle over a run's stored rows: the expected dataset Scenario
// Lab builds, the rows read from a copied store as the Lab reads them, the
// Lab's judgement of them, and whether a tier-1 change alone could make rows
// already read the oracle's answer.
export * from "./oracle-expectation.js";
export * from "./trial-datasets.js";
export * from "./oracle-verdict.js";
export * from "./tier1-derivability.js";
