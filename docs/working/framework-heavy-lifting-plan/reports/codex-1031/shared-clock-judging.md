# Shared execution clock: judging and replay

Outcome: Done. Source is in `C:/Users/osrs_/FluxStuff/fxwork/t823/!FluxIQ`; no git mutations.

## Changes

- Fresh build replays capture one epoch-millisecond `referenceNow` before their work. Every replay dispatch carries it as Core metadata, outside model-authored tool values. Clean replay reuse retains that replay's reference; a changed Flow or a new gate/execution captures a fresh reference.
- Optional metadata propagates through the replay/loop executor types and harness registry, execution option and runtime binding. The model's tool schema remains unchanged.
- Run and build-test summaries carry the fixed reference for later rejudgement, appended after the existing summary fields so the shared start-view cache prefix remains intact. Numeric low-level `now` overrides still win; absent/invalid new metadata uses the lightweight `runtime/reference-now/` validator and legacy fallback (helper relocation and executor compatibility export are lead-owned).
- Candidate summaries use the explicit persisted trial start, then a valid trace reference, then legacy trace start. Normal run summaries use valid trace reference, persisted session start, then legacy trace start. Executor worker owns their upstream timestamp capture/persistence.
- The reference reaches read-condition value readings, left-out row settlement, saved-answer condition readings, build-test saved-answer filtering/sorting, inferred date order and agreement order/refutation readers. Live harness timers and lifecycle timestamps stay live.

Paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/`:

```text
llm/harness-options/binding.ts
llm/harness-options/option.ts
llm/harness-options/registry.ts
llm/harness-options/tests/binding.test.ts
llm/loop-configuration.ts
llm/node-tools/dry-run-gate.ts
llm/node-tools/replay-draft.ts
llm/node-tools/tests/dry-run-gate.test.ts
result-verification/agreement/agree.ts
result-verification/agreement/both-readings.ts
result-verification/agreement/no-record.ts
result-verification/agreement/record-contradictions.ts
result-verification/build-test/summary.ts
result-verification/build-test/tests/stores.test.ts
result-verification/computed-facts/order.ts
result-verification/contracts/run-result-summary.ts
result-verification/result-summary.ts
result-verification/run-outcome.ts
result-verification/tests/result-summary.test.ts
result-verification/value-readings/summary-readings.ts
service/candidate-trial/summary.ts
service/candidate-trial/tests/rejudge.test.ts
service/flow-bootstrap-commands/build-judge.ts
service/flow-bootstrap-commands/tests/build-judge.test.ts
```

## Validation

All commands ran from the Core task root, with provider-free scripted tests and at most two workers. No package/workspace builds, typechecks, full suites, real APIs, browsers or panel commands.

Initial `pnpm` launch was rejected by PowerShell execution policy before running Vitest. Replaced only the executable with `pnpm.cmd`.

```text
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/tests/reference-clock.test.ts src/programs/automation-studio/runtime/result-verification/build-test/tests/reference-clock.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/dry-run-gate.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests/binding.test.ts src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/build-judge.test.ts --maxWorkers=2 --minWorkers=1
```

Observed: `Test Files 2 failed | 3 passed (5)`, `Tests 4 failed | 75 passed (79)`, exit 1. The existing gate, binding and build-judge files passed (39, 21, 14 tests). New data tests failed because their fixtures used planned `onOrAfter` instead of the actual `atLeast: "today"` grammar; treated row `Today` as midnight although row readings use the reference instant; and expected name-only labels from full-row label evidence. These were test fixture errors, not attributed to product behavior.

```text
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/tests/reference-clock.test.ts src/programs/automation-studio/runtime/result-verification/build-test/tests/reference-clock.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/reference-clock.test.ts --maxWorkers=2 --minWorkers=1
```

First rerun observed: root summary and candidate tests passed (5 tests); integrated build-summary test hit `undefined is not a function` in the existing barrel initialization cycle after a direct gate-module import. Switched that test to initialize the `llm` barrel first, matching existing test practice.

Second rerun observed: `Test Files 3 passed (3)`, `Tests 8 passed (8)`, exit 0, 32.36 s. It proves cache reuse preserves actual answer membership after midnight (two matching rows), while a new execution of the unchanged Flow uses a fresh reference (one matching row). The normal-run rejudgement regression was then added, and the same command is running as the final named regression pass; its final result is recorded below.

`git diff --check -- <owned source/test paths>` observed no output, exit 0. This was read-only.

Final named regression result: `Test Files 3 passed (3)`, `Tests 9 passed (9)`, exit 0, 50.71 s. This includes normal-run rejudgement two days later using persisted session start, candidate missing-trace/trace/explicit references, dated read/settlement/saved-answer values, inferred order/refutation, numeric override and malformed-metadata fallback, and actual cached versus new replay membership.

### Structural follow-up

The lead's structure audit found that my three new test files exceeded their owning directories' existing 25-file budgets, two deep agreement imports bypassed its barrel, and two newly added `as never` stubs bypassed typing. After the lead's GO, consolidated all nine clock regressions into the existing cohesive `result-summary.test.ts`, `build-test/tests/stores.test.ts` and candidate `rejudge.test.ts` files; removed only my three standalone clock test files. The public agreement record and value-reading barrels retain the same refutation/order assertions. A typed verdict supplies the agreement stub, and a contextual `Parameters<typeof judge.judge>[0]` literal supplies the build judge input with complete accounting. No structure baseline changed; pre-existing casts remain unchanged.

After a read-only dependency review, the lead moved the shared scalar validator to lightweight `runtime/reference-now/{index,value}.ts`, with executor's public re-export preserved. HEAD documented an earlier LLM initialization cycle, but the new direct executor imports could change traversal order, so the precise earlier observation error was not claimed to predate this change.

The historical standalone-file commands above record the actual earlier runs; those test bodies now live in the final paths listed under Changes. Post-consolidation command:

```text
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/tests/result-summary.test.ts src/programs/automation-studio/runtime/result-verification/build-test/tests/stores.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/rejudge.test.ts src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/build-judge.test.ts --maxWorkers=2 --minWorkers=1
```

Post-consolidation result: `Test Files 4 passed (4)`, `Tests 60 passed (60)`, exit 0, 38.40 s: result-summary 24, stores 17, candidate rejudge 5, build-judge 14. All nine original clock regressions remain. Final file lengths are 447, 351, 121 and 347 respectively, below 800. `git diff --check` over the four destinations observed no output, exit 0.

## Lead acceptance suggestions

Run the affected package typecheck and structure audit after concurrent edits settle. Relevant test groups for lead verification are `result-verification/tests`, `result-verification/value-readings/tests`, `result-verification/agreement/tests`, `result-verification/computed-facts/tests`, `result-verification/build-test/tests`; named gate, binding, candidate `rejudge`, and `build-judge` files above. These are owning directories/files, not the whole package suite.

Not verified: package typing, structure audit, broad owning-directory acceptance, live/native browser execution, downstream metadata propagation, executor/session persistence and normal-run rerun identity. The lead and other workers own that integration. No paid calls.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/shared-clock-judging.md` in the main downstream checkout.
