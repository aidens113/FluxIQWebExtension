# t979 judge recovery progress

2026-11-22: Inspected interrupted changes and F25 report. Removed judge-specific escalation counters and routing. Standalone fallback now carries semantic metadata and stays on the continuing judge's model; native-format end-to-end coverage includes Haiku and nondefault Sonnet starts. Preserved deadlines, cancellation and billed purse handling. Existing framework fake-judge migrations retained. Narrow validation pending.

First validation snapshot: targeted directory run passed the primary verify (24), Flow-less judge (42), build judge (34), run-outcome (45), and framework build-judge (14) tests. Stopped once failures were known to avoid further unnecessary work: 3 stale escalation assertions and one offline-first fake judge timeout. Corrected the assertions and the fake judge's omitted defects field (an empty explicit list preserves its intended unsure/inconclusive outcome). Explicit changed-file rerun uses one Vitest worker. A preliminary rerun was cancelled before any results because its preparatory edit had used the wrong working directory; corrected and relaunched.

One-worker changed-file rerun: `node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false` with 11 explicit changed test files -> 11 files passed, 94 tests passed (180.37 s). Native fallback passed on Haiku and Sonnet starts; offline-first, extension chat, latest-read, candidate trials and timeout mocks all passed.

Additional supervisor-requested budget audit found standalone build-test's per-call half-budget did not bound repeated asks. Added a local existing BuildPurse only when no caller purse exists and a finite explicit judgement budget is supplied. All asks share it; inherited purses/backstops remain intact. Added billed malformed JSON, invalid diagnosis with usage, and Flow-less caller-purse refusal tests. Further validation pending; queued typecheck was cancelled before execution to keep checks on the final source snapshot.

Deadline accounting correction: build-test now uses existing CompletedVerificationChecks to retain settled receipts across a later deadline and ignores late receipts after finish. Test covers a billed malformed first reply followed by a pending second request. Runtime run-outcome already owns the same receipt collector and its retained-paid-first-check deadline test remains in the final run. Flow-less exposes no spend object: production answer-first's wrapped runHarness updates run usage on every settled receipt and the shared creation purse owns debit/holds, so returning not_judged does not reset those totals.

Budget ownership: direct verify accepts an explicit runBudget ledger or ambient build/Flow purse; run-outcome opens its caller's runPurse ledger. Flow-less uses the caller's harness and ambient creation purse. Standalone build-test now creates the existing purse from its explicit maxCostUsd only when no build purse exists. No arbitrary retry or spending cap was introduced; absent an aggregate budget, direct lower-level APIs still rely on their caller's contract and existing deadline.

Budget run observed 93/97 tests passing; new malformed-JSON cost assertions exposed a pre-existing harness receipt omission: the purse/run ledger charged screened failure usage correctly, but failed results and interventions omitted it. Supervisor explicitly extended ownership to runtime/llm/harness/run.ts and focused tests. Corrected both provider-error and provider-result parse-throw returns to propagate the already screened paid usage, without changing failure status/provenance or exposing reply content. Added paid-refusal receipt assertions and included unbilled-refusal regressions. Corrected a test import from the build-purse export and matched existing user-facing refusal wording. Final six-file run, package check and audit queued behind other lanes.

Final billed-receipts validation: `pnpm --filter fluxiq exec vitest run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/result-verification/build-test/tests/judge.test.ts src/runtime/result-verification/flow-less/tests/judge-unreadable.test.ts src/runtime/result-verification/tests/judge-reply/tests/unreadable-reply.test.ts src/runtime/result-verification/tests/run-outcome.test.ts src/runtime/llm/harness/tests/paid-refusal.test.ts src/runtime/llm/build-purse/tests/refused-unbilled.test.ts` -> 6 files passed, 102 tests passed, 68.44 s. All through heavy-slot gate.

`pnpm --filter fluxiq check` -> exit 0; build-cache recorded fluxiq:check build, 84,439 ms, no diagnostics. Structure audit and final inherited touched-file regression run still pending. Source frozen for lead integration.

`node scripts/structure-audit.mjs` -> exit 0, `structure-audit: passed (562 warning(s), 909 baselined).` `git diff --check` -> exit 0 (line-ending advisory only). Source is frozen; lead owns architecture documentation and integration.

## Changed paths

- Core `runtime/result-verification`: inherited F25 recovery implementation, new unreadable-asks module and tests, same-model routing metadata, Flow-less native fallback tests, deadline cancellation wiring, build-test local aggregate purse and settled-receipt retention, existing result-verification mock/expectation migrations.
- Core `runtime/llm/role-routing/provider.ts` and new `tests/judge-same-model.test.ts`: remove judge-specific climb and prove obsolete climb metadata cannot escalate; semantic standalone marker keeps continuing judge model.
- Core `runtime/llm/anthropic/provider.ts` and judge-continuation test: accurate standalone-after-unreadable reason.
- Core `runtime/llm/harness/run.ts` and `tests/paid-refusal.test.ts`: paid failure usage now reaches result and intervention receipts, including parse-throw results.
- Existing owned framework tests: answer-first latest-read; flow-bootstrap build-judge, build-judge-timeout and candidate-trial-facade; project-build-offline-first; Studio extension-chat. Mock judges now explicitly represent intended readable outcomes.
- Downstream: this progress report only. No git mutations.

## Limits

No paid calls, browser runs, panel management or full suites. Broader pre-existing attempt model ladder remains for P4. Lower-level direct verify/Flow-less APIs do not invent an aggregate purse when their caller supplies none; production callers own it as documented above. In-flight usage not yet reported at a deadline remains unknown; settled receipts are preserved. Cancellation still throws to honor Stop, while existing caller purses/ledgers retain settled charges.

Final inherited regression validation: `pnpm --filter fluxiq exec vitest run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/result-verification/tests/verify.test.ts src/runtime/result-verification/flow-less/tests/judge.test.ts src/runtime/result-verification/flow-less/tests/reply-required.test.ts src/runtime/result-verification/request-rows/tests/left-out-naming-the-item.test.ts src/runtime/result-verification/tests/judge-reply/tests/truncated-reply.test.ts src/runtime/result-verification/unreadable-asks/tests/asks.test.ts src/runtime/llm/role-routing/tests/judge-same-model.test.ts src/runtime/llm/anthropic/tests/judge-continuation.test.ts` -> 8 files passed, 102 tests passed (58.15 s). All required worker gates are complete. Lead checkpointed source and architecture note as 021b1f631 and bumped Core to 0.50.3; worker made no git mutations. Parent sync and independent lead acceptance remain lead-owned.

Outcome: Done
Changed: Core result-verification recovery/deadline/build-test code and owning tests; role-routing provider/same-model test; Anthropic continuation reason/test; harness failed-usage receipts/paid-refusal test; six named framework mock files; this downstream report.
Validation: 11-file framework/recovery run -> 94/94; final budget/receipt run -> 102/102; final inherited verifier/model run -> 102/102; pnpm --filter fluxiq check -> exit 0; node scripts/structure-audit.mjs -> passed (562 warnings, 909 baselined); git diff --check -> exit 0.
Not verified: live/paid/browser execution, full suites, parent-sync compatibility; no paid launch or panel management.
Report: C:/Users/osrs_/FluxStuff/fxwork/t979/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/t979-judge.md
Notes: Same-model native fallback covers Haiku and nondefault Sonnet. Aggregate purse and known billed receipts survive unreadable recovery and deadlines. Broader ladder removal belongs to P4.
