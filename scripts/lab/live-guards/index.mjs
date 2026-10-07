// The live-run guards: what `run-lab.mjs` asks before a `--live-llm` run may
// start, and what it records once the run ends. Design and the rules:
// docs/architecture/testing-facility.md, "Live-run waste guards".

export { admitLiveRun, DEBUG_DIRECTORY } from "./admit-live-run.mjs";
export { detectBalanceFailure } from "./balance-failure.mjs";
export { closeLaunch } from "./close-launch.mjs";
export { readDevAncestry } from "./dev-ancestry.mjs";
export { evaluateLiveGuards } from "./evaluate-live-guards.mjs";
export { formatRefusals } from "./format-refusal.mjs";
export { DEFAULT_LAB_SLOTS_DIRECTORY, guardFiles } from "./guard-files.mjs";
export { appendLedgerEntry, readLedger } from "./ledger.mjs";
export { previousRun, recentStarts, windowSpend } from "./ledger-queries.mjs";
export { describeLiveLaunch } from "./live-launch.mjs";
export { ABANDONED_AFTER_MS, reconcileLedger } from "./reconcile-ledger.mjs";
export { recordLiveRunFinish, recordLiveRunStart } from "./record-live-run.mjs";
export { readRunOutcomes } from "./run-outcomes.mjs";
export { sourceFingerprint } from "./source-fingerprint.mjs";
export * from "./rules/index.mjs";
