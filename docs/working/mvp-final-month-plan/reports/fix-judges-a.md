# fix-judges-a (t286, Core branch task/t286-fix-judges)

## Outcome

Done. Both tasks fixed with fail-first tests (red then green recorded below). No commits.

R = `packages/fluxiq/src/programs/automation-studio/runtime` in `C:/Users/osrs_/FluxStuff/fxwork/t286/!FluxIQ`.

## What changed and why

### Task 1: testedLabel hidden from the judge

- `R/result-verification/read-account/judge-paging.ts`: `forJudge` now first strips `testedLabel` from every condition of the read (new private `withoutTestedLabel`; returns the same object when no condition carries it, so the original summary is never mutated). Header and doc comment say why (run-mux6naez-6c20f26e; Core bookkeeping no judge instruction describes).
- `R/result-verification/verify.ts` `askOnce`: order changed from `withLeftOut(withPaging(withUnread(summary)))` to `withPaging(withLeftOut(withUnread(summary)))`, so `leftOutNamingTheItem` is computed from accounts that still carry `testedLabel`, then the paging copy drops it. Order dependencies checked: `withUnreadColumns` only reads recordSets/instructions and sets `instructionColumnsUnread`; `withLeftOutNamingTheItem` reads only `reads[].conditions` / `buildTest` / `recordSets` (never `paging` or `pageLimit`); paging reads only paging fields and spreads the rest (so `leftOutNamingTheItem` and `instructionColumnsUnread` survive). The verdict afterwards uses `request.summary` plus `judged.leftOutNamingTheItem`, unchanged.
- Tests: `read-account/tests/judge-paging.test.ts` (judge copy carries no `testedLabel` on either read; original untouched, its `testedLabel` still `true`); `request-rows/tests/left-out-naming-the-item.test.ts` (drives `verifyAutomationStudioRunResult` with a capturing provider on the run-mux6naez variant of `runMuw60j7cRunSummary` -- extra Plus-only "Wireless Charging Case" row added, name pairs kept -- and asserts every request the provider receives contains no `testedLabel` while `context.resultSummary.leftOutNamingTheItem` equals exactly what `automationStudioResultLeftOutNamingTheItem` flags on the raw summary: the three name-condition pairs, not the Plus row; original summary unchanged).

### Task 2: W7 R2-C8

- `R/flow-draft/verify-only.ts` `automationStudioFlowDraftStepWithholdsLater`: a moved target now excuses later steps only when the step's own declaration (`ranWith` before `input`) names something lasting (`automationStudioFlowDraftDeclaresLasting`). A step verified only for claiming an instructed lasting act (declaring nothing lasting) excuses nothing by moving, so `replay-draft.ts`'s existing reanchor (which runs only while `withheldBy` is undefined) puts the next step back on its own page. Destructive-class excuse unchanged. Header: R2-C8 marked closed by t286, the "moved the target" exception reworded, new paragraph with run-mux6pndp-16feb842 and the cost (a step after a claim-only verified move whose page cannot be reached again now fails instead of being excused). Function doc updated.
- Tests in `R/flow-draft/tests/verify-only.test.ts`: claim-only moved step does not withhold; declared-lasting moved step does (ranWith before input, input when no ranWith); destructive withholds moved or not; and two tests driving `automationStudioFlowDraftReplaySteps` (imported via the llm barrel, where it is exported by `export *`) with a fake `executeTool` shaped like `replay-draft-acts.test.ts`'s: claim-only link -> calls `t.16`(verify), `t.17`, `t.17.reanchor` (from = product page), `t.17.again`, outcome replayed + reanchored, no `withheldBy`/`excused`; declared-lasting moved link -> only `t.16`, `t.17`, outcome `unreproducible`, `withheldBy: 16`, `excused: "withheld"`.

## Commands run and observed results

From `packages/fluxiq`:

- Task 1 red: `npx vitest run .../read-account/tests/judge-paging.test.ts .../request-rows/tests/left-out-naming-the-item.test.ts` -> 2 failed | 21 passed; both new tests failed with `expected '{...}' not to contain 'testedLabel'` (the judge request JSON showed `"testedLabel":true` on the name condition).
- Task 1 green: same two plus `result-verification/tests/judge-accounts-for-rows.test.ts` -> 3 files passed, 29 tests passed.
- Task 2 red: `npx vitest run .../flow-draft/tests/verify-only.test.ts` -> 3 failed | 24 passed: claim-only `WithholdsLater` `expected true to be false`; the ranWith-before-input case `expected true to be false`; replay test `expected [ 't.16', 't.17' ] to deeply equal [ 't.16', 't.17', ...(2) ]`. The destructive test and the declared-lasting replay test passed before the fix (they are guards that behaviour is kept, not fail-first).
- Task 2 green: `verify-only.test.ts` + `flow-draft/tests/site-memory.test.ts` -> 2 files, 33 tests passed.
- Neighbours (read-only regression): `llm/node-tools/tests/replay-draft-acts|excused|loop|verify|replay-draft.test.ts` + `flow-draft/tests/dry-run.test.ts` -> 6 files, 81 tests passed. `result-verification/tests/judge-sees-the-read|judge-sees-each-step|judge-sees-the-end|run-outcome|run-outcome-repair|zero-provider-run|judge-accounts-for-rows` -> 7 files, 83 tests passed.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check-t286a.tsbuildinfo` -> no output (0 errors anywhere).

## Not verified

- Structure audit, `fluxiq:check`, full suites (lead runs them). `verify-only.test.ts` now imports from `../../llm/index.ts` (as `dry-run.test.ts` and `accrual.test.ts` already do); the audit was not run on it.
- No live run, Lab or provider calls.

## Open questions or contradictions found

- Other model-facing copies carrying conditions as JSON: the refuted-result re-author. `R/recovery/refuted-result/repair.ts:164` passes `resultSummary: input.summary` (the raw run summary, with `testedLabel`) to the annotation call, and `R/recovery/annotation/annotate.ts` (lines 263/390/518/579) forwards it into the harness context packet (`R/llm/harness/context-packet.ts:286`, finished-run task kinds), so the re-author model still sees `reads[].conditions[].testedLabel` as JSON. `R/recovery/refuted-result/history.ts:114` copies `summary.reads` raw into the history entry, but `brief.ts:177` renders them through `automationStudioResultReadSentence` (prose; does not read `testedLabel`), so that path does not show it unless the history entry itself is serialized to a model elsewhere (not found). Not edited (recovery files out of scope); a fix would apply the same strip (or the judge's copy) where `repair.ts` builds `resultSummary`.
- `verify-only.ts` exports many things in one file (pre-existing; not restructured).
