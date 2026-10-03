# t258-w1: service-wiring "store cannot be opened" test fails on dev (report)

## Outcome

Done. The product was wrong, not the test. The failing case passes again, a module-level regression test now guards the cause, and both new guards fail when the fix is taken out.

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t258/!FluxIQ`, branch `task/t258-core-service-wiring-store`. Nothing is staged or committed. The changed files are:

- `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/judged-promotion.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts` (line count unchanged: 4419, which is its baseline)
- `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/tests/judged-promotion.test.ts`

## Reproduction

Command: `npx vitest run src/programs/automation-studio/runtime/service/datasets/tests/service-wiring.test.ts`, run in `packages/fluxiq` on the fresh tree (HEAD 75e66057). Result: `Tests 1 failed | 2 passed (3)`. The failure was `AggregateError: Automation Studio project database pool is closing. What the run held for its judged end could not be settled: Automation Studio project database pool is closing.`, thrown at `endAutomationStudioRuntimeSessionAfterThrow` (ending.ts:60) <- service.ts:2747 <- `runRuntimeSession` <- the test at line 181.

I wrapped the call in a temporary probe copy of the test, which is now deleted, and it printed the stacks of both inner errors:

1. The original error: `pool.acquire` (database.ts:84, the `closing` guard) <- object-repository/content-store/runtime-stream-store `open` <- `withConfiguredRuntimeStreamStore` <- `readAutomationStudioFlowRunDetail` <- `service.getFlowRunDetail` <- `settleAutomationStudioRunJudgedPromotions` (judged-promotion.ts:190) <- `judged` (service.ts:2553) <- service.ts:2690.
2. The settle error: the same read, called again from `endAutomationStudioRuntimeSessionAfterThrow` -> `settleAfterThrow` with `reason: "run_errored"`.

## Cause, with evidence

t249 (commits a171330c and ea866e7c, both ancestors of the 424a70b3 that t252 tested) made every judged end of `runRuntimeSession` call `settleAutomationStudioRunJudgedPromotions`. Its first act was `getFlowRunDetail`, a read from the project store, and that read happened for every run that has a Flow id. It was the same shape of defect that t207 removed from the failed-step route: an unconditional store read on a path where most runs have nothing to read. In the test, the deterministic run ends `failed` with `record_output.persist_failed`, and its session is written. Then `judged()` reads the record from the pool the test closed and throws. The catch path tries to settle again (`run_errored`), the read fails a second time, and the caller gets an `AggregateError` in place of the failed run.

t246's idle grace is not involved. The guard that fires is the explicit `closing` guard, which is reached because the test called `closeAll`.

That read could not find anything to settle in this run. A decision that waits for a judged run (`applyAt: "judged_whole_run"`, `applied: false`) is written only by `promoteAutomationStudioRuntimeAdaptation` (runtime-promotion.ts:67). It writes `autoApply` only when `decideAutomationStudioAdaptationPromotionGate` allows it, and that gate refuses first when `promoteAdaptations` is false (training-modes.ts:330). The context it reads is the run's own `adaptationContext`, which reaches it unchanged through annotate.ts:616 and patches.ts:228. `no_llm_intervention`, `manual_approval` and `dryRunLlm` all set `promoteAdaptations = false` (context.ts:44-60). The only place that sets it to true is the LLM-run override (runtime-session-llm.ts:32), and that runs before the final context is fixed (service.ts:2577).

## Fix

- `judged-promotion.ts`: `settleAutomationStudioRunJudgedPromotions` takes a new required input, `context: Pick<AutomationStudioRuntimeAdaptationContext, "behavior"> | null | undefined`. It returns the session without reading the store unless `context.behavior.promoteAdaptations === true`. The input is required so that no future caller can skip the gate. The doc comment says why, with the t258 history. I added no new export, and the file is 242 lines.
- `service.ts`, line-neutral (still 4419 lines):
  - `adaptationContext` is now declared on the same line as `session`, before the `try`, and is assigned at its old place. That lets the `catch` settle under the same context.
  - Both settlement calls (`judged` and `settleAfterThrow`) now pass `context: adaptationContext`.
  - Nothing else changed: `flowId: ended.flowId` in the catch path, and `ending.ts`, are as they were.
- A run that can promote still reads, settles and saves exactly as before. A store failure on such a run still joins the caller's error, as t249 intended.

## Regression tests

- `judged-promotion.test.ts`, new describe block "settling a run that has ended, from its stored record":
  - (a) For contexts `null` and `promoteAdaptations: false`, each both judged and with `reason: "run_errored"`, the store port throws "pool is closing" if it is called. The test asserts that the returned value is the same session, that there were no reads and no saves, and that the adaptation is still pending.
  - (b) A promoting context reads the record once, settles the patch (`not_rerun`, `judgedRunId`) and saves it once.
- The existing service-level case in `service-wiring.test.ts` is unchanged and covers the case end to end.
- Return check: I temporarily replaced the gate with the old `if (!input.flowId) return input.session;` and ran both files. The result was `Tests 2 failed | 17 passed (19)`, and the two failures were exactly (a) and the datasets case. I then restored the gate, and `grep -c "promoteAdaptations !== true"` printed 1.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t258/!FluxIQ` or its `packages/fluxiq`.

- Reproduction, before the fix, as described above: `Tests 1 failed | 2 passed (3)`, with the AggregateError.
- `npx vitest run .../datasets/tests/service-wiring.test.ts`, after the fix: `Tests 3 passed (3)`. The case took 747 ms.
- `npx vitest run .../runtime-adaptation/tests/judged-promotion.test.ts`: `Tests 16 passed (16)`.
- Gate removed temporarily: `Tests 2 failed | 17 passed (19)`, as described above. Restored afterwards.
- `heavy.sh "t258 neighbour tests" npx vitest run runtime/service/datasets/ runtime/service/runtime-adaptation/ runtime/service/runtime-session/ --maxWorkers=2 --minWorkers=1`: `Test Files 19 passed (19)`, `Tests 175 passed (175)`.
- `heavy.sh "t258 service-adaptation tests" npx vitest run runtime/tests/service-adaptation/ runtime/durable-behavior/ --maxWorkers=2 --minWorkers=1`: `Test Files 20 passed (20)`, `Tests 93 passed (93)`. These include the service-level judged-promotion, promotion-tier, adaptive-loop and failed-start tests, which use promoting contexts and thrown runs.
- `heavy.sh "t258 fluxiq check" pnpm --filter fluxiq check`: exit 0. The build cache reported `"step":"fluxiq:check","reason":"no stamp ..."`, which means tsc actually ran (52.6 s), with no errors.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (233 warning(s), 349 baselined).`, exit 0. No warning names a changed file.

## Not verified

- The full Core suite, by brief. Of the runtime/tests directory beside `service.ts`, only `service-adaptation/` ran, not the other directories.
- Live browser or Lab behaviour, by brief.
- A run in `fully_adaptive` mode whose project store is closed mid-run. It still throws, because its context can promote and, as the test's own comment says, the repair reads the conversation from the same pool. That predates t249 and is outside this brief.

## Open questions or contradictions found

- The settlement still mirrors or settles any adaptation id that the run's own record lists. Before this fix, a non-promoting run whose record listed another run's pending patch with no `runId` on its decision would have settled that patch. It now leaves the patch alone. `promoteAutomationStudioRuntimeAdaptation` always sets `runId: sourceRunId`, so I found no path that produces such a patch, and leaving it alone is the safer behaviour.
- `judged-promotion.test.ts` was CRLF in the working copy and is now LF throughout, because of a `sed -i` during editing. The committed file is LF, so the diff is only the 54 added lines. Git warns `LF will be replaced by CRLF` on its next touch, which is harmless.

## Follow-up: a fully adaptive run whose store goes away (coordinator request)

### Outcome

Done. A fully adaptive run whose store is closed mid-run now returns its session, ended `failed` for its own step (`record_output.persist_failed`), and no error of any kind escapes. Its session notes what the store could not take. When the store is healthy, the settlement behaves exactly as before. This supersedes the third "Not verified" item above.

### Reproduction, before this change

I ran the datasets case without `adaptiveMode`, as a temporary probe test (now deleted). The run threw `AggregateError: ... pool is closing. What the run held for its judged end could not be settled: ...`. The failure has two parts:

1. The original error comes from recovery, not from the judged end. The stack is `pool.acquire` <- conversations `store.open` <- `listConversations` <- `automationStudioRecoveryConversationTurns` <- `conversationForRecovery` (service.ts:2454) <- `annotate.ts:268` <- `recovery-state.ts:53` <- service.ts:2664.
2. The catch then settles with `run_errored`. A fully adaptive context can promote, so the record read runs, hits the closed pool, and throws a second time.

### What changed and why

- **`storage/project/store-unavailable-error.ts`** (new): `AutomationStudioProjectStoreUnavailableError`, with `code` and a static `is(error)` that also walks the `cause` chain. The pool's two `closing` guards in `database.ts` now throw it. The message is unchanged, so existing `toThrow("pool is closing")` assertions still hold. It is exported from the `storage/project` barrel. This lets the run code tell "the store is gone" apart from "the store answered with an error".
- **`judged-promotion.ts`**: a new reason, `store_unavailable`. In `settleAutomationStudioRunJudgedPromotions`, which only runs for a context that can promote:
  - If the record read finds the store gone, the session is noted (`step: "read_record"`).
  - In `settleAutomationStudioJudgedPromotions`, each adaptation is settled inside a try. That settling moved unchanged into `settleRecorded`. If the store goes away for a patch that is still held, its receipt gets `applied: false, notAppliedReason: "store_unavailable", error`. Nothing is applied, and the adaptation in the store keeps its hold, so no unattended apply can follow from it and a person can still review it.
  - An apply that the store goes away under is recorded as `store_unavailable`, not `apply_failed`.
  - The record is still saved. If that save finds the store gone, the session is noted (`step: "save_record"`).
  - Any receipt marked `store_unavailable` also produces a session note (`step: "settle"`).
  - The note is `metadata.judgedPromotionSettlement = { status: "store_unavailable", step, at, reason, recordSaved, adaptations: [{ adaptationId, applied, notAppliedReason }] }`. It is written through a new `writeRuntimeSession` port. Sessions are JSON files outside the pool (service.ts `writeRuntimeSession`), so this write still works when the pool is closed.
  - Every other error still throws.
- **`runtime-session/ending.ts`**:
  - It now returns `AutomationStudioRuntimeSessionEnding = { session } | { error }` in place of the error alone.
  - It uses the session that `settleAfterThrow` hands back.
  - If the thrown error says the store is unavailable, it writes `metadata.projectStoreUnavailable = { at, sessionStatus, reason }` and returns `{ session }`. A session that already recorded an outcome keeps that outcome and reason. A queued or running session is first marked failed with the store error as its `runFailure`, as before.
  - A failure to read or write the session itself still comes back as an `AggregateError`.
  - `markFailed` now returns the session it wrote.
- **`service.ts`**, line-neutral (still 4419 lines):
  - `judgedPorts` gains `writeRuntimeSession`.
  - The catch is now: `if (!input.projectId || !session) throw error; const ending = await endAutomationStudioRuntimeSessionAfterThrow(...); if ("session" in ending) return ending.session; throw ending.error;`.

### Tests

- `service-wiring.test.ts`, new case "ends a fully adaptive run failed for its own step, not by throwing, when its store goes away". It asserts:
  - the run resolves with status `failed`, `adaptiveMode` `fully_adaptive`, and the extract attempt failing with `record_output.persist_failed`;
  - there is no `runFailure`;
  - `projectStoreUnavailable` is present (`sessionStatus: "failed"`, reason "pool is closing");
  - `judgedPromotionSettlement` is present (`store_unavailable`, `read_record`, `recordSaved: false`);
  - no row text appears in the trace;
  - the stored session matches what was returned.
- `judged-promotion.test.ts`: the `settleRun` helper can now make the store go away at any one step. The cases are:
  - read: noted, nothing applied, the hold kept;
  - getting or saving the adaptation: the receipt says `store_unavailable`, the hold is kept, the session is noted (`settle`);
  - the apply: `store_unavailable` with `autoApplyFailed`;
  - saving the record: noted (`save_record`) with what was decided;
  - an ordinary store error at read, adaptation or save still throws, and nothing is noted;
  - a healthy store still writes no note.
- `ending.test.ts`: the existing assertions were updated to the `{ error }` / `{ session }` shape. Four new cases: an already-failed session is returned with its own reason plus the note; a running session ends failed and is returned; the settle's session is used, and the store error is recognised through `cause`; any other error still comes back to throw, and so does a store error whose session cannot be written.
- Return check: I temporarily made `is()` always return false and ran the three files. The result was `Tests 10 failed | 32 passed (42)`, and the 10 failures were exactly the new guards. I then restored the file (`grep -c Symbol.for` printed 0).

### Commands run and observed results

- Probe (fully adaptive, before the change): an AggregateError, as described above. After the change: `T258RESULT failed ...`, extract failing with `record_output.persist_failed`, `T258META {"p":{"sessionStatus":"failed","reason":"...pool is closing."},"j":{"status":"store_unavailable","step":"read_record","recordSaved":false,"adaptations":[]},"mode":"fully_adaptive"}`. The probe was then deleted.
- `npx vitest run judged-promotion.test.ts service-wiring.test.ts`: `Tests 26 passed (26)`.
- `npx vitest run ending.test.ts`: `Tests 16 passed (16)`. I ran it again after the type fix below, with the same result.
- `heavy.sh "t258 follow-up tests" npx vitest run runtime/service/datasets/ runtime/service/runtime-adaptation/ runtime/service/runtime-session/ runtime/tests/service-adaptation/ runtime/durable-behavior/ storage/project/ --maxWorkers=2 --minWorkers=1`: `Test Files 68 passed (68)`, `Tests 460 passed (460)`. This ran just before the one-line fixture fix in `ending.test.ts` below.
- `heavy.sh "t258 fluxiq check" pnpm --filter fluxiq check`:
  - First run: exit 2, `ending.test.ts(142,54): error TS2741: Property 'startedAt' is missing`. I added `startedAt: 100` to that test fixture.
  - Second run: exit 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (233 warning(s), 349 baselined).`, exit 0, before and after the fixture fix. No warning names a changed or new file.

### Not verified, and residual risks

- **Which failures count as "unavailable".** Only the pool's `closing` guard is classified that way. A database file that fails to open (locked, corrupt, a sqlite open error) still throws as before. Extending the classification there would change error types that other callers see, so I left it.
- **A false `applied: true` record is possible.** If the store goes away between the pre-apply record (`applied: true`, written before the apply by design) and the apply itself, the stored adaptation still says `applied: true` while nothing was applied. The receipt and the session say `store_unavailable`. A store that is gone cannot be corrected, so this window remains.
- **A caller-visible change in what `runRuntimeSession` does.** It now returns, instead of throwing, for any store-unavailable error once a session exists. That includes a run that never executed because the pool started closing at its start, for example during `service.close()`. Such a run is returned failed, with "pool is closing" as its `runFailure`. `database-hold.ts` checks `isClosing` on entry, so this mostly happens before a session exists.
- **Mid-run settlement in `repair-rerun.ts`.** It uses `settleAutomationStudioJudgedPromotions` mid-run and now gets `store_unavailable` receipts instead of a throw. Its next store write throws anyway and ends cleanly through the catch. No test covers that path specifically.
- Not run, by brief: the full Core suite, the rest of `runtime/tests`, and any live or Lab run.
- The recovery's conversation read still throws on a closed pool, and the run then ends through the catch. I did not make recovery treat an unreadable conversation as empty, because that file is not in this brief's scope.

### Files changed in the follow-up

All paths are under `packages/fluxiq/src/programs/automation-studio/`:

- `storage/project/store-unavailable-error.ts` (new)
- `storage/project/database.ts`
- `storage/project/index.ts`
- `runtime/service/runtime-adaptation/judged-promotion.ts`
- `runtime/service/runtime-session/ending.ts`
- `runtime/service.ts`
- Tests: `runtime/service/datasets/tests/service-wiring.test.ts`, `runtime/service/runtime-adaptation/tests/judged-promotion.test.ts`, `runtime/service/runtime-session/tests/ending.test.ts`

`git diff --stat` reports 8 files changed, 373 insertions and 47 deletions, plus the one new file. Nothing is staged or committed.
