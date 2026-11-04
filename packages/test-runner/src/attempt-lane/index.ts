// A task run more than once on one workspace, and the report that says whether the
// loop paid off. `cli.ts` runs the provider-free proof; `audit-asked-changes.ts`
// plays each task's honest path to check what the double-act oracle is told.
export { auditAskedChanges, type AskedChangeAudit } from "./audit-asked-changes.js";
export { proveContinuation } from "./continuation.js";
export type { AttemptDriver, AttemptOutcome, AttemptRecord, AttemptSavedState, AttemptTask } from "./driver.js";
export { attemptReportRow, attemptSeries, renderAttemptSeries } from "./report.js";
export { runAttemptProof, type AttemptProofChecks, type AttemptProofOptions, type AttemptProofResult } from "./run-attempt-proof.js";
export { runAttemptSeries, type AttemptSeriesResult } from "./run-attempt-series.js";
export * from "./scripted/index.js";
