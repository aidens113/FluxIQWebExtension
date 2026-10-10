# t392 F1b: finishing lost-command reconciliation (Core side), worker report

Brief: task t392, unit F1b. Trees `fxwork/t392/!FluxIQ` and `fxwork/t392/!FluxIQWebExtension`,
branch `task/t392-executor-integration`. Nothing was committed. AS means
`packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done. All three items are implemented and tested:

- The literal `interrupted` status is stored, shown and treated as terminal.
- Late results on ordinary commands are attributed to their run through the host and put
  on the run's event log.
- A `queued` session left by a dead process is swept.

Package tsc and the web typecheck pass. The narrow suites pass (669 tests). The structure
audit has one violation, which is in another worker's file (see below).

## What changed and why

### 1. The literal `interrupted` status

**Storage: new migration `0024_runtime_run_interrupted_status`**

- File: `AS/storage/project/schema/runtime-run-interrupted-status.ts`.
- It is exported from `schema/index.ts` and appended last to
  `AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS` (`administration.ts`).
- It rebuilds `runtime_runs` so that the status CHECK also allows `interrupted`. The steps:
  1. Copy the rows to a plain copy table (CTAS).
  2. Drop the table.
  3. Create it again under the same name, with the same columns in the same order, with
     the new CHECK.
  4. Copy the rows back, then drop the copy table.
  5. Recreate the 6 indexes and the 10 foreign-key guard triggers (`foreignKeyGuards`).
- All of this runs in the migration runner's single transaction. No row is dropped.
- **Why the table is never renamed.** Other tables' guard triggers name `runtime_runs`
  (`run_datasets`, `adaptations`, `runtime_event_chunks`, `compiled_plan_adoptions`), and
  an `ALTER TABLE ... RENAME` would rewrite or refuse those references.
- **Why rows are copied back before the guards return.** A row whose referenced object was
  removed since it was written is kept as it was, rather than refused.
- **Why the id starts with 0024.** My first id, `0029_...`, broke 98 tests:
  - The ledger, authority-guard, candidate-verification and accepted-state stores run
    `[...ADMIN, 0025..0028]`.
  - `validateMigrations` requires ids to ascend.
  - `0024_runtime_...` sorts after `0024_run_dataset_answers` and before `0025`. There is
    precedent for a shared prefix: there are two `0009` ids and two `0011` ids.

**Storage: `runtime-stream-store.ts`**

- `sqlRuntimeStatus` now stores `interrupted` as itself. It is no longer folded into
  `failed`, so a reader that filters on `failed` does not find it there.
- `error_count` is 1 for both `failed` and `interrupted`.

**Run progress: `run-control/progress-status.ts`**

- A tenth progress status, `interrupted`, with:
  - label "Interrupted";
  - detail "FluxIQ stopped while this run was in progress. Check the page before running it
    again."
- Its test covers the new status and confirms that a stale paused control never masks it.

**The sweep and the terminal check**

- `AUTOMATION_STUDIO_INTERRUPTED_RUN_STATUS = "interrupted"`, and the file's header comment
  is updated to match.
- `isTerminalRuntimeSessionStatus` now includes `interrupted`.

**Readers that treat `failed` as a run's end**

| Reader | What it does with `interrupted` | Change |
| --- | --- | --- |
| `runtime-adaptation/judged-promotion.ts` | It used to return `{ waiting: true }`, so the patch was held for ever. Now it returns `{ apply: false, reason: "run_failed" }` whatever the verdict. | Changed. I reused `run_failed` rather than adding a new reason: `apps/web` `adaptations/application-state.ts` keys a Record on the reason union, and that file is not mine. |
| `runtime-adaptation/repair-rerun.ts` | Already returns null for anything but `failed`. | None; a test now pins it. |
| `judged-reauthor.ts` | Not succeeded, so not applied. | None. |
| `recovery-state.ts` | Annotates only a failed run. | None. |
| `parked-expiry.ts` | Handles only `waiting` runs; `cancel` checks the terminal status, so an interrupted run is never cancelled again. | None. |
| `ending.ts` | Ends only `queued` or `running` runs. | None. |
| Run list (`listRuntimeSessionSummaries`) | Reads the swept status. | None. |
| `service.ts:2532` | `runRuntimeSession` with the `runId` of an interrupted run now returns it unrun, as it already did for `cancelled`. Before this, the swept run was run again and ended `succeeded`; I watched the test fail with the guard removed. | One-line edit with a trailing comment. `service.ts` stays at 4366 lines, and statement-packing passes. |

**Readers outside my ownership that need a change**, described rather than edited:

- `api/handlers/run-control.ts:39`: `ENDED = new Set(["succeeded", "failed", "cancelled"])`
  should include `"interrupted"`. Without it, a stale controller for an interrupted run
  could be reported as holding.
  - This is unlikely, since a swept run has no live controller, but it is wrong.
  - The fix is to use `isTerminalRuntimeSessionStatus`.
- `runtime/conversations/commands/run-flow.ts:66` only names `failed` and `cancelled`.
  - A `run-runtime-session` answer is never `interrupted` today, because only the sweep
    writes that status, so this has no effect now.
- `result-verification/run-outcome.ts:273` sends any non-succeeded run to
  `repairFailedStep`. That function returns at once unless the run is `failed`, so it is
  safe as it is.

### 2. Late results on ordinary commands

- `AS/runtime/activity/run-scope.ts` (new) and its barrel export: `automationStudioActivityRunScope()`.
  - It returns `{ projectId, runId }` for a bound run frame. For a build, a pending run or
    no frame it returns `undefined`.
  - **This adds a file beyond "export only".** No such reader existed, and the imports rule
    forbids reading `storage.ts` from outside the directory. The file is 15 lines and
    touches no existing file.
- `programs/_shared/runtime.ts`:
  - It passes `commandOwner: automationStudioActivityRunScope` to the host gateway.
  - It wires `clientGateway.onLateActionResult(async (late) => { await automationStudio.lateActionResults.record(late); })`.
  - The listener returns its promise on purpose. A failed write is then audited by the
    gateway (`command.late_result_unrecorded`). A `void` call would have left an unhandled
    rejection.
- **The run log.** `getFlowRunDetail` and `listFlowRunEvents` are read from the runtime
  event stream, so I put late results on the stream:
  - The new event kind is `late_action_result` (`AutomationStudioRuntimeEventKind`,
    `isRuntimeEventKind`).
  - `runtimeEventsFromDetail` emits one event per `metadata.lateActionResults` record.
    - eventId: `late_action_result:<commandId>:<reportedStatus>`, so the same answer sent
      again is the same event;
    - status: the read status;
    - entityId: the commandId;
    - timestamp: `receivedAt`.
  - Records with a malformed id or time are skipped. `runDetailFromEvents` does not fold
    these events, because the detail already reads them from the envelope's metadata.

### 3. A `queued` session left by a dead process

The restart rule is "same-process consumption is not restart clearance". The sweep keeps
its existing clearance: it ends a session only when it was queued or started before this
process started, and no live executor of this service owns it.

`orphaned-run-sweep.ts` now also sweeps `queued` sessions:

- It marks them `interrupted`.
- It records `interruption.sessionStatus: "queued"` and `lastingAct: "none"`, because a
  queued session is written before anything runs and `running` is written before the Flow
  executes.
- Its trace message is "...interrupted before it started... It took no action."
- `AutomationStudioRunInterruption` widened to `sessionStatus: "running" | "queued"` and
  `lastingAct: "unknown" | "none"`.

### 4. Statement packing

The one packed line I wrote, in `interrupted-run.test.ts`, was caught by the audit and
unpacked.

### Tests added or changed

- `storage/project/schema/tests/runtime-run-interrupted-status.test.ts` (new, 2 tests). On a
  database created at the previous schema with rows in place, the migration:
  - keeps every column of every row byte-equal;
  - recreates the same index and trigger set, with no copy table left behind;
  - refuses `interrupted` before it runs and accepts it after;
  - still refuses an unknown status;
  - keeps both the table's own guard and another table's guard against it working.
- `runtime-adaptation/tests/interrupted-run.test.ts` (new, 3 tests): the status is
  terminal, it is never promoted, and it is never re-run, with no port touched.
- `run-control/tests/progress-status.test.ts`: covers `interrupted`.
- `runtime-session/tests/orphaned-run-sweep.test.ts`:
  - expects the status `interrupted`;
  - new case: a queued orphan is swept with `lastingAct: "none"`;
  - a queued run from this process, and a failed run, are left alone.
- `runtime/tests/session-recovery/tests/service-wiring.test.ts`, on a real service:
  - expects `interrupted` on the session, the stored detail (which goes through the SQL
    row) and the run list;
  - new: a queued adaptive orphan no longer blocks `admitAutomationStudioRuntimeSession`,
    while one queued in this process still does;
  - new: an interrupted run is never run again under its id.
- `programs/_shared/tests/late-action-result-wiring.test.ts` (new, 2 tests). End to end
  through `createGlobalProgramRuntime`:
  - An ordinary command is sent inside a run's activity scope and times out (the 30s wait
    is run on fake timers), then a late `interrupted` answer arrives. It lands on:
    - the run detail's `lateActionResults` (`durable: false`, `closedAs: "timed_out"`,
      `status: "unknown"`);
    - the run's event log, as `late_action_result`.
  - It is never applied:
    - the caller still holds `timed_out`;
    - the session status, the summary status and the action attempts are unchanged;
    - the page's words never appear.
  - A command sent outside any run is not attributed.

## Commands run and observed results

All commands were run in `packages/fluxiq` unless a different directory is named.

- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`
  - Before my changes it printed the two errors from the brief: `progress-status.ts(56,101)`
    TS2366 and `runtime-stream-store.ts(730,171)` TS2322.
  - After my changes it prints no output (exit 0).
- `npx vitest run src/client-gateway src/programs/automation-studio/runtime/run-control src/programs/automation-studio/runtime/service/runtime-session src/programs/automation-studio/runtime/service/runtime-adaptation src/programs/automation-studio/runtime/tests/session-recovery src/programs/automation-studio/storage/project src/programs/_shared/tests/late-action-result-wiring.test.ts`
  - With the first migration id (`0029_...`), 98 tests failed with "Automation Studio
    migrations must have unique, ascending IDs." I changed the id.
  - Final run: `Test Files 78 passed | 2 skipped (80)  Tests 669 passed | 4 skipped (673)`.
    The skipped files are the ledger and authority-guard `process*.test.ts` files, which are
    skipped by their own condition.
- Fail-first for the never-run-again guard: with the `|| existing?.status === "interrupted"`
  guard removed, `-t "never run again"` failed with `Expected "interrupted"` and
  `Received "succeeded"`. I restored the guard; the count is 1.
- `apps/web`: `npx tsc --noEmit` exits 0 with no output.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` (Core root) prints
  `structure-audit: 1 violation(s) across 1 rule(s).`
  - The violation is `[imports] AS/runtime/executor/lifecycle-run/tests/recovery-paths-fixtures.ts`,
    which imports `../../../activity/default-hub.ts`. That file belongs to the executor
    workers (D2/F2), not to me.
  - My earlier statement-packing violation in `interrupted-run.test.ts` is fixed.
  - The advisory warnings on files I touched were already over their thresholds:
    - `runtime-stream-store.ts` is 789 lines and has 28 methods;
    - the `schema/` directory has 20 files, `runtime-session/` 16 and `runtime-adaptation/`
      17.
- `wc -l AS/runtime/service.ts` prints 4366, unchanged.

## Not verified

- **Live behaviour.** I did not kill a real Core process and restart it, and I did not
  reconnect a real extension that then sent a late answer. The restart is simulated with old
  start times, and the late answer is sent through `gateway.receive`.
- **The migration on a real user database** with many rows. It was tested on a freshly
  migrated database holding a few rows.
- **The rebuild on large databases.** The migration copies the whole table inside one
  transaction. I did not measure how long that takes on a large `runtime_runs` table.
- **Two Core processes sharing one data directory.** The caveat from F1 still stands, and it
  now covers queued sessions too.
- **The web UI.** No web code shows the new `Interrupted` progress status or the
  `late_action_result` event kind. I checked only that `apps/web` typechecks.
- **No full suites**, per the brief.

## Open questions or contradictions found

1. **A file outside "export only".** `AS/runtime/activity/run-scope.ts` is new: the reader the
   brief asked me to export did not exist.
2. **Two changes needed in files that are not mine:**
   - `api/handlers/run-control.ts:39` `ENDED` should use `isTerminalRuntimeSessionStatus`, or
     add `interrupted`.
   - `apps/web`, if wanted: show the label for the new `interrupted` progress status and the
     `late_action_result` event kind; add an `"Interrupted"` reason if a dedicated promotion
     reason is ever added in place of `run_failed`.
3. **The migration number.** The migration's id is `0024_runtime_run_interrupted_status`
   rather than the next number, because of the ascending-id rule across stores. A later
   project-administration migration must sort after it and before `0025`, or the
   per-store sets must be reordered.
4. **The trace status.** On a swept session the trace keeps `trace.status: "failed"`, because
   the trace status vocabulary is the executor's and not mine. The session and run status
   are `interrupted`.
