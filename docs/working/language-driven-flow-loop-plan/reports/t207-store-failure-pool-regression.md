# t207: store-failure "pool is closing" regression (report)

## Outcome

Done. The datasets store-failure test passes again. Lane B's failed-step re-author still works. The reader test's slowness has a different cause, and I ruled out lane B for it with measurements.

Ready to commit (Core tree `fxwork/t207/!FluxIQ`, branch `task/t207-store-failure-pool-regression`):
- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/step-failure-target.ts` (new)
- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/step-failure-decision.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/index.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/failed-step-store-read.test.ts` (new)

Validation: `npx vitest run runtime/recovery/ runtime/tests/refuted-result/ --maxWorkers=2 --minWorkers=1` -> `Test Files 45 passed (45)`, `Tests 530 passed (530)`.

## Mechanism

Before d6b50b5a, `verifyAutomationStudioRuntimeSessionResult` returned any non-succeeded session at its first line. d6b50b5a (t193, lane B) sent failed sessions to a new `repairFailedStep` instead. Its first action was `input.ports.getFlowRunDetail(projectId, runId)`, a read from the project store. That read happened for every failed run, before any routing condition was checked. It also ran in `no_llm_intervention` mode, because the adaptation context exists there with `invokeLlm: false`, so the `flowId()` check alone would not have stopped it.

In the datasets test, the run fails because the project storage was closed (`record_output.persist_failed`). The new read then hit `AutomationStudioProjectDatabasePool.acquire`, whose `closing` guard threw `Automation Studio project database pool is closing.` The error propagated out of `runRuntimeSession`, so the caller got a thrown error in place of the failed run and its failure record. Stack: `pool.acquire` <- `runtime-stream-store.open` <- `withConfiguredRuntimeStreamStore` <- `readAutomationStudioFlowRunDetail` <- `service.getFlowRunDetail` <- `repairFailedStep` (run-outcome.ts:385) <- `verifyAutomationStudioRuntimeSessionResult` <- service.ts:2738.

The read was also wasted work. The decision re-authors only `target_not_found` or `target_ambiguous` step failures, and the run's own trace already says whether the run failed that way. The record's `actionAttempts` are built from the trace attempts in `runtimeActionAttemptsFromSession`, with the failure parsed by the same contract.

## What changed and why

- New `step-failure-target.ts` holds one rule: the last failed or unknown attempt, its parsed failure, and whether that failure is target-level. The target-level category set and its rationale comment moved here from `step-failure-decision.ts` without changes. The decision and the verification both use it, so the two cannot drift apart.
- `step-failure-decision.ts` now uses the helper. Its refusals and their order are unchanged (`no_failed_step`, then `not_target_level`).
- `run-outcome.ts` `repairFailedStep`: if the session has a trace and that trace does not show a target-level step failure, the session is returned before the store is read. This is how every failed run was handled before t193. A session with no trace still reads its record and lets the decision decide. That keeps lane B's fixtures, which pass trace-less failed sessions, and any caller without a trace, on the old route.
- A store read failure on a run the route could take still throws. That matches the store's fail-closed policy (the run-detail reader tests). I changed no store code, timeouts or existing tests.

## Regression test

`runtime/tests/refuted-result/tests/failed-step-store-read.test.ts` has 3 tests:
- an `action_failed`/`record_output.persist_failed` trace with a store that throws "pool is closing" is handed back as the same failed session; the store is never read, the port is never called, and nothing is saved;
- a trace with no failed step is handed back without a read;
- a `target_not_found` trace still reads the record and calls the port with the detail and the failed trace attempt, which keeps lane B's route.

I disabled the gate temporarily and ran the file: the first two tests failed (×) as expected. The gate was then restored, and `grep -c "if (false"` printed 0.

## Reader test: a different cause, not lane B

`flow-run-detail-reader.test.ts` runs only succeeding runs. `repairFailedStep` is not reached on success, and the only part of d6b50b5a on the success path is a renamed string constant in `conversions.ts`. All four cases, including "reads nothing for a run that has no detail and no session", which has no store failure, spend their time in `completedRun`, one real Flow run each.

Measured with a temporary detached worktree of `e7d8e84f`, the commit before lane B. It shared the t207 dependencies through junctions and was removed afterwards with `git worktree remove`. Runs alternated with the current tree, all run alone with `--maxWorkers=2 --minWorkers=1`:
- baseline e7d8e84f, 5 runs: 4 passed (each case 3–14 s). One run failed all 4 cases with `Test timed out in 15000ms`, each at about 15.1 s.
- current tree, 5 runs plus 2 earlier: all passed. Cases took 3–13 s, and in one run all four cases took about 15.1 s.

The failure reproduces at the pre-lane-B baseline, so it is an existing intermittent stall in a real run, not this regression. All four cases stall together at about 15 s in a bad run and take 3–6 s in a good one. That looks like something per-process, not per-case. I did not root-cause it. t206 (load-sensitive tests) looks like its owner.

## t191 lease-race question (from the supervisor)

It is a different mechanism. t191's `database.ts` change fixes a lease counted on an entry whose last lease was released, and the entry closed, while `acquire` awaited it. Here, "pool is closing" is the intended fail-closed guard at the top of `acquire`, reached after the test deliberately called `closeAll` (`closeProjectStorage`). There is no race: t191 keeps the same guard, so with t191 merged the test would still throw without this fix. My fix touches no storage code, so it is compatible with t191.

One thing to watch when merging: `git diff dev` in t191's tree also removes `exec`/the one-script pragma batch in `database.ts`. That is probably because t191's base predates the change that added `exec` (t192?), not an intended revert. Check it when t191 merges.

## Commands run and observed results

- Reproduction, before the fix: `npx vitest run service/datasets/tests/service-wiring run-detail-read/tests/flow-run-detail-reader` -> 1 failed (`Error: Automation Studio project database pool is closing.`), 6 passed.
- After the fix: `npx vitest run failed-step-store-read failed-step-reauthor service/datasets/tests/service-wiring` -> all passed; the datasets case took 2079 ms.
- Named files alone, after the fix:
  - `service/datasets/tests/service-wiring` -> `Tests 3 passed (3)`
  - `run-detail-read/tests/flow-run-detail-reader` -> `Tests 4 passed (4)`
- `npx vitest run runtime/recovery/ runtime/tests/refuted-result/ --maxWorkers=2 --minWorkers=1` -> `Test Files 45 passed (45)`, `Tests 530 passed (530)`.
- `npx vitest run runtime/service/ --maxWorkers=2 --minWorkers=1` -> `Test Files 1 failed | 38 passed (39)`, `Tests 1 failed | 306 passed | 1 skipped (308)`. The one failure was `summaries/tests/run-detail-preservation.test.ts > keeps a repaired run's recovery annotation ...`, `Test timed out in 15000ms` (15098 ms). Run alone twice afterwards, it passed both times: `Tests 3 passed (3)`, with the case at 12209 ms and 10483 ms. It is the same kind of load-sensitive stall; t206 was measuring this very file at the same time. My change can only skip a store read, never add one.
- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` -> exit 0, no output.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (200 warning(s), 354 baselined).` It also printed `1 baseline entries can be lowered`. The entry was not named, and I did not run `pnpm structure:baseline`.

## Not verified

- Live browser or Lab behaviour: no Lab run, as the brief said.
- The full Core suite outside the three named areas.
- The root cause of the intermittent ~15 s stall in real-run tests (reader and preservation).
- Which baseline entry the audit says can be lowered, and whether this change is what lowered it.

## Open questions or contradictions found

- The brief says the reader test "fails alone". It does, intermittently, but it fails the same way at e7d8e84f, before lane B, so it is not this regression.
- In a real session, the trace and the record agree about the failed step. If a stored record ever held a later target-level failure that the session trace lacks (merged attempts from an earlier pass), the gate would skip a run the decision might have routed. I found no path that produces that. Lane B's tests all still pass.
