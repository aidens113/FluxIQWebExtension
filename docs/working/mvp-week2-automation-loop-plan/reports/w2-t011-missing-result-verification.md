# Report: w2-t011-missing-result-verification

## Outcome

The created Flow's playback itself succeeded: Core durably recorded all 9 action attempts as `succeeded`, with a terminal run status of `succeeded`. Result verification was not skipped by its grant and did not reach a provider. It was never invoked because the routed-run path remained awaited in the immediately preceding run-detail save.

The exact boundary is `packages/fluxiq/src/programs/automation-studio/runtime/service.ts:3233-3234`: line 3233 awaits the final routed detail save; line 3234 is the first call to `verifyAutomationStudioRuntimeSessionResult`. The stored detail already contained the routed summary and all attempts but neither the runtime session nor run detail contained `metadata.resultVerification`. The request stayed open until the facility's 30-second HTTP bound, then the runner polled the named run for its full 600-second granted-run bound and still found no verdict.

The save can be durable and still never resolve. `runtime/service/summaries/run-detail-writer.ts:91-101` persists the typed detail at line 93 and then awaits `store.close()` in `finally` at line 101. The project database lease release removes the pool entry and awaits closing the database at `storage/project/database.ts:57-64`; the close itself waits for the connection's operation tail before closing the SQLite handle at lines 175-179. Because the entry is removed before that await, concurrent result polling can acquire a new connection and keep reading the already-durable detail while the run request remains trapped closing the old one. That exactly matches this run: repeated readback saw the completed run, but the synchronous run endpoint never advanced to verification or returned.

## What changed and why

Only this report was added. No source was edited.

The smallest coherent fix is in Core's `AutomationStudioProjectDatabasePool`: do not delete and close a project database on every transition to zero leases. Retain the entry until `closeAll()` (or introduce a correctly synchronized idle-close state that `acquire()` can await/reuse). This removes the close/reopen race from every short-lived typed store, lets the line-3233 save settle, and allows line 3234 to invoke verification. A local timeout or a facility-side inference of `no_result` would only mask the stuck Core request and would weaken the no-false-success contract.

For this action-only run, once line 3234 is reached, verification is provider-free: `result-verification/run-outcome.ts:126-143` lists result sets first and routes a zero-set summary directly to `verifyAutomationStudioRunResult`; `result-verification/verify.ts:74-76,128-135` returns the durable `no_result` outcome without a model call. `run-outcome.ts:118-123` then writes that outcome to the runtime session and run detail.

## Commands run and observed results

- Read the assigned brief, relevant Current State, and the t012/t022 reports.
- Inspected only lifecycle/evaluation/closed accounting fields in the live isolated workspace and finalized bundle. Before cleanup, the project store reported one terminal run, 9/9 succeeded actions, zero effects/errors/adaptations, and no `resultVerification` or `llmGate`; the runtime session was also terminal `succeeded` with neither field.
- Inspected `snapshots/live-llm.json`: the repair grant purpose was `diagnose_and_adapt`, observed provider calls were 0, interventions were 0, and accounting/gate were absent. No credential or recorded-page value was read or emitted.
- Inspected Core grant mapping. `runtime/llm/grant-capabilities.ts:94-120` includes `loop_verification` in `diagnose_and_adapt`, and `runtime/llm/runtime-session-grant.ts:84-95` admits it on a runtime session. Authorization was therefore not the blocker.
- Inspected the final bundle after isolated cleanup. It finalized `failed` after 708,291 ms with `http.timeout` at `run-runtime-session`; the repair settlement was emitted at the end of the 600-second readback window and still recorded zero provider calls and no verdict.
- Inspected runner polling at `packages/test-runner/src/flow-lane/persisted-flow-run.ts:298-310,408-450`: a granted timeout polls the caller-chosen run id for the grant's 600-second maximum and correctly refuses to accept `succeeded` until `resultVerification` exists.
- No build, test, source edit, commit, push, or mutating live call was performed, per brief.

## Not verified

- The proposed database-pool lifetime change was not implemented or exercised; this brief was diagnosis-only.
- A same-scenario rerun after the fix was not performed. The required proof is one identical live created-Flow scenario showing: 9/9 playback, the original request or named-run readback settles before 600 seconds, `resultVerification.status === "no_result"`, zero repair/provider calls, and a passing facility verdict.
- No unit or full suite was run.

## Open questions or contradictions found

- The pool is named and used as a shared connection pool, but `storage/project/database.ts:57-64` destroys its entry whenever the last short-lived lease releases. This makes sequential store calls repeatedly close and reopen SQLite and lets a new connection appear while the prior connection is still closing.
- The final facility category is `environment.missing`, although the environment was present and playback completed. That category is the original bounded HTTP timeout preserved by `persisted-flow-run.ts:426-433`; it does not describe the underlying post-playback Core close stall.
