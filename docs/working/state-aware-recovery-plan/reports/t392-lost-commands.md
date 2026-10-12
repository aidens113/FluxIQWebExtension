# t392 F1 lost commands (Core side): worker report

Brief: task t392, unit F1. Items 1 (late results), 3 (contract `interrupted`) and 4
(orphaned-run sweep) of the Core side of reconciling lost commands (C8, B3). Trees
`fxwork/t392/!FluxIQ` and `fxwork/t392/!FluxIQWebExtension`, branch
`task/t392-executor-integration`. Nothing committed. The executor was not touched.

## Outcome

Partial. Late results, the contract and the sweep are implemented and tested, with two gaps:

1. **The sweep cannot write the literal status `interrupted` yet.** It ends the run
   `failed` and says it was interrupted in `metadata.interruption`. Two files I do not
   own would have to change first (see "Contradictions" 1).
2. **Live late results are attributed to their run only after a two-line host wiring that
   I do not own.** Durable commands already carry their run. Ordinary (legacy-path)
   commands need the `commandOwner` hook and the listener wired in
   `programs/_shared/runtime.ts`, and an activity scope reader (see "Contradictions" 2).

| Item | State |
| --- | --- |
| 1. Late results recorded on the run's evidence, never applied, never resolving another waiter | Done in gateway and AS; host wiring outstanding |
| 2. Contract `interrupted`, mapped as the wire status, old form still accepted, dist rebuilt | Done |
| 3. Orphaned-run sweep at service start | Done; status written as `failed` plus `metadata.interruption` |
| 3. `service.ts` wiring only, no growth, packing at most 44 | Done: 4366 lines (baseline 4368), 44 packed lines |
| 4. One statement per line | Done; structure audit passes |

## What changed and why

### Contract: `packages/contracts/src/client-gateway.ts`

- `CLIENT_GATEWAY_REPORTED_ACTION_STATUSES` / `ClientGatewayReportedActionStatus`: Core's
  five statuses plus `interrupted`.
- `ClientGatewayReportedActionResult` is what a client sends. The `client.action_result`
  envelope in `ClientGatewayClientMessage` now carries it.
- `ClientGatewayActionResult`, with its status `ClientGatewayActionResultStatus`, keeps
  its five statuses. It is what Core hands to callers.
  - Adding `interrupted` to that type directly would have spread to
    `runtime/client-gateway-transport.ts` (it returns the result as a
    `FluxIQRuntimeCommandResult`), to the durable ledger's receipt statuses, and to the
    domain.
  - Core reads `interrupted` before anything waits on it, so no caller ever meets it.
- I rebuilt the dist with `pnpm --filter @fluxiq/contracts build`.
- **The extension and the domain can now send `interrupted` natively**, as
  `status: "interrupted"` typed as `ClientGatewayReportedActionResult`. Core still accepts
  today's `unknown`/`failed` with `payload.status: "interrupted"`. That follow-up is not
  part of this unit.

### Client gateway: `packages/fluxiq/src/client-gateway/`

- `service/action-result-reading.ts` (new), `readClientGatewayActionResult`: reads
  `interrupted` the way the wire status is read.
  - The domain's failure record must parse and state `effect: "unacted"` for the result to
    become `failed`.
  - Anything else (`ambiguous`, no record, a record that does not parse) becomes
    `unknown`, an uncertain outcome. A missing acknowledgement is never "did not happen".
  - "Committing" is the domain's fact, carried on that record. This follows the existing
    `faultFromRecord` rule in `executor/defensive/assess.ts`.
  - It reports whether the result was interrupted, by status or by payload marker.
- `service/command-history.ts` (new), `ClientGatewayCommandHistory`: the last 512
  commands sent. For each it keeps the session, the client, the action type, whether it
  was durable, the owner run, and how Core closed it (`settled`, `timed_out`,
  `uncertain`, `closed`).
  - `intake` turns a result for a command nobody awaits into a
    `ClientGatewayLateActionResult`. This holds closed fields only, never the message,
    payload or target.
  - It accepts such a result only from the client the command was sent to, on any session,
    so a reconnect counts.
- `service/commands.ts`:
  - `settle` takes the reading.
  - It records each closure: settle, timeout, close, and the durable outcome (through
    `executeDurable`).
  - A result for a command no caller awaits goes to `settleLate`, which:
    - audits `command.late_result`;
    - publishes the result to the `onLateActionResult` listeners (a failing listener is
      audited as `command.late_result_unrecorded`);
    - returns `"late"`.
  - It resolves nothing. It does not reach the durable ledger, whose entry is already
    gone, so nothing is ever committed. Ids are random UUIDs, or ledger-claimed ids that a
    re-dispatch cannot send again, so no other waiter can be resolved.
  - I also unpacked two lines that held two statements each.
- `service/inbound.ts`: reads the result, then settles it. The diagnostic
  `client.action_result` event is still emitted for late and unknown ids, as before (the
  existing test pins this). Its payload is the read result, so no listener meets
  `interrupted`.
- `service/types.ts`: a new option, `commandOwner?: () => { projectId, runId } | undefined`.
- `service.ts`: passes `commandOwner` through and adds
  `onLateActionResult(listener)`. It re-exports the new types.
- `service/index.ts`: barrel entries.

### Automation Studio: `AS/runtime/service/runtime-session/`

- `orphaned-run-sweep.ts` (new), `AutomationStudioOrphanedRunSweep`. It sits in front of
  the parked-run expiry's `read`/`list` ports, and sweeps each project once per service,
  before that project's first read. It sweeps only a session that is:
  - `running`;
  - started before this process started (`performance.timeOrigin`); this is the
    restart-clearance rule, since same-process consumption is not clearance;
  - not owned by a live executor of this service (`runtimeAbortControllers`).
- What the sweep writes for such a session:
  - status `failed`;
  - a trace message;
  - `metadata.interruption = { state: "interrupted", reason: "process_ended", at, sessionStatus: "running", lastingAct: "unknown", lastNodeId? }`,
    on the session, and on the run detail through a second merged save.
- What the sweep leaves alone:
  - `waiting`, `queued` and ended sessions.
- If a sweep fails, the read still goes ahead. The error is kept in `lastFailure` and the
  next read retries.
- The status the sweep writes is the single constant `AUTOMATION_STUDIO_INTERRUPTED_RUN_STATUS`.
- `late-action-result.ts` (new), `AutomationStudioLateActionResults.record(late)`:
  - Under the run's session lock (`parkedRunExpiry.withRun`), it reads the stored detail
    without falling back to the session. That fallback would deadlock, because the lock is
    already held.
  - It appends to `metadata.lateActionResults`, keeping at most 20 and recording a
    repeated answer once.
  - The merge in `run-detail-merge.ts` keeps the key across the run's later saves.
- `session-files.ts` (new): the session file and session-index write, moved out of
  `service.ts`'s `writeRuntimeSession`. This makes room for the wiring.
- `index.ts`: barrel entries.

### `AS/runtime/service.ts` (wiring only)

- The parked-run expiry is built on `new AutomationStudioOrphanedRunSweep({...}).sessionPorts`.
- A new public field: `readonly lateActionResults = new AutomationStudioLateActionResults({...})`.
- `listRuntimeSessionSummaries` now also expires `running` rows, so the run list triggers
  the sweep. Before, it expired `waiting` rows only.
- `writeRuntimeSession` calls `writeAutomationStudioRuntimeSessionFiles`.
- The packed line unit A added (`let routedFailedTraceAttempt ...; const subflowFrame = ...`)
  is split.
- I removed the now-unused `type RuntimeIndex` import.
- Result: 4366 lines against a baseline of 4368, and 44 packed lines (I counted them with
  the rule's own algorithm).

### Docs

- `docs/architecture/automation-studio/client-gateway.md`: a new subsection, "Interrupted
  and late action results".
- `docs/architecture/automation-studio/persistence.md`: covers the sweep and
  `metadata.lateActionResults`.

### Tests (new)

- `client-gateway/service/tests/action-result-reading.test.ts` (5)
- `client-gateway/service/tests/command-history.test.ts` (3)
- `client-gateway/tests/late-action-result.test.ts` (9):
  - a timed-out command's late `interrupted` result is attributed to its run, while
    another command's wait stays unresolved and then settles normally;
  - a repeat after settle is late and the first outcome stands;
  - a result from a foreign client is not recorded;
  - a reconnected session counts;
  - a result after close is late, as `closed`;
  - a failing listener is audited;
  - `interrupted` on a waiting legacy command reads as `unknown`/`failed`;
  - `interrupted` on a waiting durable command reads as `outcome_unknown` (ledger
    `unknown`) or as a committed `failed` receipt;
  - a late result for a durable command is never committed (ledger stays `unknown`) and is
    attributed from the command context.
- `AS/runtime/service/runtime-session/tests/orphaned-run-sweep.test.ts` (4)
- `AS/runtime/service/runtime-session/tests/late-action-result.test.ts` (3)
- `AS/runtime/tests/session-recovery/tests/service-wiring.test.ts` (3), on a real service
  with a temporary data directory:
  - after a simulated restart, the orphan is ended with `metadata.interruption` on the
    session and the run detail;
  - a `running` session started in this process is untouched;
  - the run list shows the orphan ended;
  - a gateway late result reaches `getFlowRunDetail().metadata.lateActionResults`, with
    none of the client's words.
- `runtime/tests/` already holds 25 files, which is its limit, so this test is in a
  feature subfolder.

## Commands run and observed results

- `pnpm --filter @fluxiq/contracts build` -> `{"build-cache":"build","step":"contracts:build",...}`.
  `dist/client-gateway.d.ts` contains `interrupted`.
- `cd packages/contracts && npx tsc --noEmit -p tsconfig.json` -> exit 0.
- `cd packages/client-gateway-websocket && npx tsc --noEmit -p tsconfig.json` -> exit 0. This
  package sends `client.action_result`, so I checked that it still compiles against the
  new type.
- `cd packages/fluxiq && npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`
  -> exit 0, no output.
  - Earlier in the session the same command printed errors only in
    `runtime/executor/graph-run.ts` and `executor/lifecycle-run/tests/*`. Those files
    belong to another worker and were still being edited; the errors had gone by the final
    run.
- `cd packages/fluxiq && npx vitest run src/client-gateway/tests src/client-gateway/service/tests src/client-gateway/service/command-ledger/tests src/programs/automation-studio/runtime/service/runtime-session src/programs/automation-studio/runtime/tests/session-recovery`
  -> `Test Files 22 passed (22)  Tests 160 passed (160)`.
- Neighbours affected by the inbound and session-write changes:
  `npx vitest run src/programs/automation-studio/client-gateway/tests src/programs/automation-studio/api/handlers/tests/cancel-runtime-session.test.ts src/programs/automation-studio/api/handlers/tests/run-control.test.ts src/programs/automation-studio/runtime/service/command-execution/tests src/programs/automation-studio/runtime/service/command-run/tests src/runtime/tests/client-gateway-transport.test.ts`
  -> `Test Files 9 passed (9)  Tests 92 passed (92)`.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` (Core root) -> `structure-audit: passed (308 warning(s), 1160 baselined).`
  - Before my change the same command printed `1 violation(s) across 1 rule(s)`. That was
    `statement-packing` on `service.ts`, at 45 against a baseline of 44.
  - Advisory warnings on my files:
    - `ClientGatewayService` now has 31 methods (advisory threshold 25);
    - `contracts/src/client-gateway.ts` is 460 lines (advisory threshold 400).
- `wc -l AS/runtime/service.ts` -> 4366.

## Not verified

- **Live behaviour.** I did not exercise a real extension worker restart, reconnect and
  late `interrupted` report against a running Core, nor a real Core process kill followed
  by a restart. The restart test simulates the dead process by writing the session with an
  old start time.
- **Domain and extension typechecks** against the new `ClientGatewayClientMessage` payload
  type. The type only widened the status, so this should be compatible, but I did not
  run them.
- **Two concurrent Core processes on one data directory.** A session that a second, still
  live process started before this process started would be swept. Nothing in Core stamps
  a process owner on a session, so the sweep cannot tell the two cases apart.
- **No full suites**, per the brief.

## Open questions or contradictions found

1. **The literal `interrupted` session status** needs two out-of-ownership changes.
   Adding `"interrupted"` to `AutomationStudioRuntimeSessionStatus` (`model/runtime.ts`)
   and `AutomationStudioFlowRunStatus` (`model/flow-adaptation.ts`) fails tsc in:
   - `storage/project/runtime-stream-store.ts:730` `sqlRuntimeStatus` (owned by P), whose
     SQL check allows only `queued|running|succeeded|failed|cancelled`. It would need
     `status === "interrupted" ? "failed"`;
   - `runtime/run-control/progress-status.ts:56`, a switch with no return for the new
     value.

   Two readers also treat a status outside their list as not ended:
   - `api/handlers/run-control.ts:39` (`ENDED`);
   - `result-verification/run-record.ts:142`.

   Once those are changed:
   - set `AUTOMATION_STUDIO_INTERRUPTED_RUN_STATUS = "interrupted"` in `orphaned-run-sweep.ts`;
   - add the two union members;
   - add `interrupted` to `isTerminalRuntimeSessionStatus`.

   Nothing else in the sweep changes.
2. **Live attribution of legacy-path late results**, which is how web runs dispatch today,
   needs:
   - In `programs/_shared/runtime.ts`, which I do not own:
     - `commandOwner: () => <run scope>` in the `new ClientGatewayService({...})` options;
     - `clientGateway.onLateActionResult((late) => { void automationStudio.lateActionResults.record(late); })`.
   - A run-scope reader exported from `AS/runtime/activity/` (not mine). Its storage is not
     in the barrel, and the imports rule refuses a deep import, so I could not add one in
     my own module. It would be, for example:
     `export function automationStudioActivityRunScope() { const f = automationStudioActivityStorage.getStore(); return !f || f.pending || f.scope.kind !== "run" ? undefined : { projectId: f.scope.projectId, runId: f.scope.id }; }`.

   Without these, a late result is still never applied and is audited, but it is not
   attributed to a run. Durable (required-mode) commands are attributed already.
3. **The run log.** Late results and interruptions are on the run detail's metadata, and
   so on its API. They are not on the runtime event stream: that needs a new event kind in
   `storage/project/runtime-stream-store.ts` (owned by P).
4. **A `queued` session left by a dead process** still holds a project's adaptive
   admission. The brief named `running` only, so I left queued sessions alone.
