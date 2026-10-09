# t375 w3: repair lane fails on a re-author that was not kept

## Outcome

Done. A re-author that Core held and then did not keep (rejected with a reason, or left held and unsettled) is no longer read as success. The lane writes and publishes `snapshots/repair-lane.json` saying what happened, replays nothing, and fails with `runtime.behavior`.

## What changed and why

Core's closed reason list, confirmed read-only in Core: `AutomationStudioJudgedReauthorReason` = `AutomationStudioJudgedPromotionReason` (`judged-promotion.ts:58`: `not_rerun`, `run_cancelled`, `run_failed`, `refuted`, `not_judged`, `run_parked`, `run_errored`, `apply_failed`, `store_unavailable`) plus `superseded` (`judged-reauthor.ts:60`). That is the ten codes the brief listed. `held-reauthor.ts` defines "held and waiting" as `held === true && applied !== true && notAppliedReason === undefined`.

- `packages/test-contracts/src/harness-recovery.ts`: `RunHarnessResultReauthor` gains `held?: boolean` and `notAppliedReason?: HarnessResultReauthorNotAppliedReason`. Added the exported `harnessResultReauthorNotAppliedReasons`, which holds the ten codes. Here membership is the gate, not shape, so free text, ids and page data cannot travel under this key.
- `packages/test-contracts/src/harness-recovery-validation.ts`: both keys are allowed. `held` must be a boolean on a taken route. `notAppliedReason` must be one of the ten codes, only on a taken route, and never next to `applied: true`.
- `packages/test-runner/src/flow-lane/harness-recovery.ts` (the reader that maps `metadata.resultReauthor`): passes `held` when it is a boolean on a taken route. It passes `notAppliedReason` only when the reason is one of the closed codes and the edit is not applied. Anything else is dropped.
- `packages/test-runner/src/flow-lane/repair/run-repair-lane.ts`: new `unkeptReauthorOf` matches when the marker shows a taken route that names an adaptation and is not `applied`. This check runs first, before the declared-repair judgement, any approval or any replay. The lane then:
  1. writes `{ task, purpose, repair: "result_reauthor", resultReauthor: { adaptationId, kept: false, held, notAppliedReason }, application: null, replaysRequested, replays: [] }`;
  2. publishes `{ repair, kept: false, held, notAppliedReason, application: null, replaysRequested, replays: [] }`;
  3. throws `RunnerFailure("runtime.behavior", ...)`. The messages are:
     - "The run re-wrote the Flow, but the re-write was not kept (refuted), so there is no repair to replay"
     - held and unsettled: "...held the re-write for its judged run, but it was never settled, so it was not kept and there is no repair to replay"
     - an older marker with no `held`: "...was not applied (<failureCode>)..."

  `resultRepairOf` (the applied path) is unchanged.
- `prove-repair.ts`: comment only, at the `no_proposal` return. It records that an unkept re-author never reaches that line.

### Refusal tasks (brief item 3)

The lane cannot tell when a refusal task is running. `describeRepair()` returns only `task` (`repair`/`adapt`) and Core's purpose. `expectation` (`FlowRepairExpectation`) is a positive declared repair, and only a created Flow's lane passes it in. When it is absent, that means "judged elsewhere", not "a refusal expected". A refusal is only ever inferred after the fact, from "no proposal". Decision: an unkept re-author fails on every task. Reasons:

- Passing it would need a signal the lane does not have.
- Guessing would reopen the exact false success this brief closes.
- A refusal task that re-authored has already shown a behaviour worth seeing: Core rewrote the Flow when no repair was right. A failure that names the reason (`refuted`) is honest and easy to triage. A silent pass is not.

If scenarios later declare refusal explicitly, this can become a pass with the record kept.

## Commands run and observed results

Run from `C:/Users/osrs_/FluxStuff/fxwork/t375/!FluxIQWebExtension`. `core-build.mjs` was skipped, as the brief said.

- Fail-first, contracts. I swapped the old `src` back in, rebuilt with `node ../../scripts/build-cache/cli.mjs test-contracts:build -- "tsc -p tsconfig.json"` and ran `node --test tests/harness-recovery-result-route.test.mjs`. Result: `tests 7, pass 5, fail 2`; the two new tests failed. With the new `src` restored: `tests 7, pass 7, fail 0`.
- Fail-first, runner. With the new contract and the old reader and lane, I ran `node scripts/domain-dist.mjs` and the `test-runner:build` step, then `node --test dist/flow-lane/repair/tests/run-repair-lane.test.js dist/flow-lane/tests/harness-recovery.test.js`. Result: `tests 40, pass 37, fail 3`. The failures were the rejected lane test, the held-and-unsettled lane test and the reader test. The applied-unchanged and no-marker-unchanged tests passed.
- After the change, with the same rebuild:
  - `node --test dist/flow-lane/repair/tests/*.test.js`: `tests 45, pass 45, fail 0`
  - `dist/flow-lane/tests/harness-recovery.test.js`: `tests 20, pass 20, fail 0`
  - `dist/flow-lane/tests/persisted-flow-run*.test.js`: `tests 32, pass 32, fail 0`
- `node --test tests/harness-recovery-*.test.mjs tests/evaluation-contracts.test.mjs` (test-contracts): `tests 52, pass 52, fail 0`.
- `npx tsc -p tsconfig.json --noEmit`: test-contracts exit 0, test-runner exit 0.
- `node scripts/structure-audit.mjs`: 1 violation, `[working-docs] docs/working/README.md is out of date`. It comes from the untracked `docs/working/mvp-final-month-plan/reports/t375*` documents, which are not my files and fall outside what I own. There are new advisory warnings on my files:
  - `exported-values`: `test-contracts/src/harness-recovery.ts` has 9 exported values. It was 8 before; the new reason list is the ninth.
  - `file-lines`: `flow-lane/tests/harness-recovery.test.ts` is 631 lines. It was already 605, over the 400-line threshold.

Both are advisory, not failures.

## Not verified

- Ran no live Lab, browser or provider runs, as the brief said.
- Did not rebuild or run against a fresh Core build. The domain build cache noted that Core changed while it ran (not stamped).
- I did not check that Core really writes `held` and `notAppliedReason` on the run detail the Lab reads (`get-flow-run-detail` metadata). I read the Core source but did not observe it in a run.
- Full package suites were not run.

## Open questions or contradictions found

- A taken route that built no adaptation (for example `failureCode: flow_bootstrap.extend_failed`, `adaptationId: null`) still goes down the old path. If there is also no proposal, it passes as `no_proposal` with 0 replays. The brief scoped the change to a marker that names a re-author, so I left this alone. It may deserve the same failure, since Core tried to repair and produced nothing.
- When Core adds a new reason code, the reader drops it. The lane then reports the edit as "held but never settled", which is wrong, but the run still fails. The list in `harnessResultReauthorNotAppliedReasons` has to follow Core.
- The reader `resultRepair()` does not fill the contract's `phase` and `outcome`, so they never travel. This was out of scope and I left it unchanged.
- The `exported-values` advisory: the reason list could move to its own file with a barrel entry if the supervisor wants the warning cleared.
