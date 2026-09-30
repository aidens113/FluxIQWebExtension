# t180 — Human takeover and run controls (Core)

Lane lead report. Core tree `C:\Users\osrs_\FluxStuff\fxwork\t180\!FluxIQ`,
branch `task/t180-run-control`. Nothing committed; no live runs, no provider
calls.

## Outcome

Done. The Core seam, the API, the chat capabilities and the web run view are
built and wired into the real service (the supervisor approved the
`runtime/service.ts` wiring, the header Pause button and the coverage verbs in
round 2). A test proves it end to end on a real `AutomationStudioService` run:
it holds between nodes, resumes to the same completion as an unpaused run, and
a held run that is cancelled ends `cancelled`.

## Design

- **Pause between nodes only.** `runtime/executor/graph-run.ts` asks
  `options.runControl.checkpoint({ nodeId, step })` once per step, right after
  the existing abort check and before the node executes. A pause asked while a
  step is in flight is recorded as `pause_requested`; the step finishes and the
  run holds at the next checkpoint. `checkpoint` returns `null` synchronously
  when not paused, so unpaused runs keep identical scheduling.
- **Nothing is released while held.** The run's promise stays pending, so its
  abort controller, adaptive admission, stored status (`running`), LLM grant
  hold and grant lease are untouched. Pausing does not extend the grant lease
  either (its 10-minute claimed-run backstop keeps ticking).
- **Deterministic resume.** A resumed run continues at the node it held
  before, with values, variables, loop positions and step budget untouched;
  a test proves the attempt sequence equals an unpaused run's. Only the page
  may differ after a takeover; the next node reads it as it finds it.
- **Bounded.** A held run stops itself (trace `cancelled`, message "stayed
  paused for more than 15 minutes") after
  `AUTOMATION_STUDIO_RUN_CONTROL_MAX_PAUSED_MS` = 15 min, matching the web
  panel's read-back window. Cancel while held ends the run `cancelled`
  ("Run cancelled while it was paused.").
- **Takeover** = pause with `holder: "person"`. "Continue after manual action"
  = resume with `afterManualAction: true` (recorded in history). "Return
  control to FluxIQ" = resume without it. Stop = existing cancel.
- **Paused is live state, not stored status.** The session record stays
  `running` (admission, `ending.ts`, summaries unchanged); the live control is
  read through `get-runtime-run-control`. No mid-run session writes, so no
  race with the run's own terminal write or with cancel.
- **Progress statuses (3.4).** `automationStudioRunProgress(session, control)`
  maps to exactly the nine required states: queued→Ready, running→Running,
  held→Paused, held by person→User action required, phase adapting→Adapting,
  waiting+parked ask→User action required, waiting→Waiting,
  succeeded→Completed, failed→Failed, cancelled→Stopped.

## Files

Core, new:
- `packages/fluxiq/src/programs/automation-studio/runtime/run-control/{types,run-controller,registry,progress-status,host-registry,index}.ts` + `tests/{run-controller,registry,progress-status}.test.ts`
- `packages/fluxiq/src/programs/automation-studio/api/handlers/run-control.ts` + `tests/run-control.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/executor/tests/graph-run-pause.test.ts`
- `apps/web/src/features/automation-studio/runtime/{RunControlBar.tsx,useRunControl.ts}` + `tests/run-control-interactions.test.tsx`

Core, edited (small, outside the listed ownership but required; flag for integration):
- `runtime/executor/contracts.ts` (+`runControl?` option, 8 lines), `runtime/executor/graph-run.ts` (+checkpoint, 9 lines)
- `runtime/index.ts` (+1 barrel line), `api/contracts/endpoints.ts` (+3 names), `api/handlers/register.ts` (+2 lines)
- `apps/web/.../runtime/{FlowRunView.tsx,run-commands.ts,runtime-host.ts}`, `conversation/capabilities/catalog/running.ts`

## Endpoints (Core API contract)

All take `{ projectId: string, runId: string }` and answer
`{ runId, sessionStatus, live, runControl, progress }`:
- `live`: the run is executing in this FluxIQ and can be held.
- `runControl`: `{ projectId, runId, state: "running"|"pause_requested"|"paused", holder: "fluxiq"|"person"|null, phase: "executing"|"adapting", nodeId?, step?, requestedAt?, pausedAt?, expiresAt?, reason?, lastNodeId?, history[] }` or `null` when not live.
- `progress`: `{ status, label, detail? }`, `status` one of `ready|running|waiting|paused|adapting|user_action_required|completed|failed|stopped`; `null` for an unknown run.

| Endpoint | Extra payload | Permission / class |
| --- | --- | --- |
| `pause-runtime-session` | `takeControl?: boolean`, `reason?: string` (≤500) | `runtime.control` / authoring |
| `resume-runtime-session` | `afterManualAction?: boolean`, `note?: string` (≤500) | `runtime.control` / authoring |
| `get-runtime-run-control` | — | `programs.read` / read |

A run not executing here (queued, parked, ended, unknown, or a host without
the registry) answers `ok: true, live: false, runControl: null` — never an
error, like cancel. Missing ids or non-boolean flags answer `ok: false`.

## Gateway message contract for the extension lane

The extension reaches Core the way Stop does (`background/panel/run-control.ts`
→ `context.call(endpoint, payload)`). Proposed panel messages, mirroring
`PanelStopRunRequest` in `apps/extension/src/shared/protocol.ts`:

```ts
/** `pause-runtime-session`. `takeControl` hands the page to the person. Reply: Core's run-control answer. */
export type PanelPauseRunRequest = { projectId?: string; runId?: string; takeControl?: boolean; reason?: string };
/** `resume-runtime-session`. `afterManualAction` for "Continue" after the person acted. Reply: Core's run-control answer. */
export type PanelResumeRunRequest = { projectId?: string; runId?: string; afterManualAction?: boolean; note?: string };
/** `get-runtime-run-control`. Poll (~1.5 s) while a run is live to show Paused / User action required. */
export type PanelRunControlStateRequest = { projectId?: string; runId?: string };
```

With no `runId`, resolve active runs the same way `stopRun` does
(`list-runtime-sessions`, non-ended) and act on each. While `runControl.state`
is `paused` and `holder` is `person`, the extension must not send any action
of its own for that run; Core dispatches nothing while held. UI: Pause, Take
control (while running); Resume, Take control (paused); Continue and Return
control to FluxIQ (person holds the page); show `progress.label`/`detail`.

## `runtime/service.ts` wiring (applied in round 2)

Applied as specified in items 1–5 below; 6 was not applied. The net change is
+5 lines (4547 to 4552, under the 4558 ratchet) and no new methods. Item 5
is a single line: `maybeAnnotateRunDetailWithRuntimeLlm` calls
`automationStudioMarkRunAdapting(input.graphOptions?.runControl)` (new
`run-control/mark-adapting.ts`), and the controller goes back to `executing`
at its next checkpoint, so no "after" call is needed. The `finally` close shares
the abort-controller delete line.

Original specification:

1. Import beside the other runtime imports:
   `import { AutomationStudioRunControlRegistry } from "./run-control/index.ts";`
2. Field, next to line 396 (`private readonly runtimeAbortControllers ...`). It
   must be public and named `runControl`; the API finds it with
   `automationStudioRunControlOf(service)`:
   `readonly runControl = new AutomationStudioRunControlRegistry();`
3. In `runRuntimeSession`, directly after line 2684
   (`this.runtimeAbortControllers.set(\`${input.projectId}:${session.runId}\`, abortController);`):
   `graphOptions.runControl = this.runControl.open(input.projectId, session.runId, abortController.signal);`
   (graphOptions is reused by `rerunAfterRepair`/live patch, so reruns of the
   same run are pausable through the same gate.)
4. In the `finally` block, next to line 2850
   (`this.runtimeAbortControllers.delete(...)`):
   `if (input.projectId && session) this.runControl.close(input.projectId, session.runId);`
5. Optional, for the Adapting state: around each recovery call in
   `runRuntimeSession` (lines 2763 and 2822 `maybeAnnotateRunDetailWithRuntimeLlm`,
   through the `rerunAfterRepair` calls at 2777 and 2832):
   `this.runControl.setPhase(input.projectId, session.runId, "adapting");` before,
   and `"executing"` after. Without it, Adapting is never reported.
6. Optional, to keep the control history on the run record: before the
   terminal `writeRuntimeSession` calls (2743, 2819), merge
   `runControl: this.runControl.snapshot(projectId, runId)?.history` into
   `metadata`. Not needed for behaviour.

After wiring, re-run `api/handlers/tests/run-control.test.ts` and
`apps/web/.../capabilities/tests/core-contract.test.ts`.

## Round 2 (wiring, header, coverage, end to end)

- `workspace/shell/WorkspaceHeader.tsx`: Pause is restored, rendered only while
  a run panel is mounted and enabled only when that panel reports `canPause`
  (from Core's answer). The existing "no control that can never be enabled"
  test still holds, because no panel is mounted there.
- `capabilities/tests/coverage.test.ts`: `pause-` and `resume-` are added to
  `MUTATING_VERBS`.
- `api/handlers/run-control.ts`: for pause and resume, `live` now means "the
  request reached a live run and took effect". A resume whose run finished
  before the answer was read had wrongly answered `live: false`, and the
  real-service test caught it. `runControl` and `progress` still describe the
  run after the request (null and Completed for a run that has ended).
- New real-service tests in `api/handlers/tests/run-control.test.ts`
  ("pausing a real service run"): start → `run-runtime-session` → the
  pause endpoint holds; a resume and pause in the same turn holds again at
  exactly `step + 1` on a different node (strictly between two nodes); the
  session stays `running`; `get-runtime-run-control` reports
  `user_action_required`; the resume endpoint with `afterManualAction` leads to
  `succeeded` with attempts identical to an unpaused run; control is closed
  afterwards. A second test cancels a held run, which ends `cancelled` with
  its control closed.
- Web `run-control-interactions.test.tsx`: a new case in which the header's
  Pause is absent with no panel, enabled while a run is live, calls Core's
  pause, and is disabled while the run is held.

Round 2 validation (observed):
- `packages/fluxiq` and `apps/web` `npx tsc --noEmit`: both exit 0.
- `node scripts/structure-audit.mjs`: passed (195 warnings, 355 baselined).
  "1 baseline entries can be lowered" appeared before this lane's changes too.
- run-control, executor pause and handler run-control tests (including the
  real-service ones): 28/28, run twice, both green.
- Web runtime tests and workspace tests: 11 files, 69 tests passed.
- Regression: `runtime/tests/service-adaptation/**`, `api/handlers/tests/runs.test.ts`
  and `run-detail-preservation.test.ts` with 2 workers: 81/82 passed on the second
  pass. The one failure was a 15 s timeout in `llm-diagnosis.test.ts` under
  load, and that file passed 8/8 when run on its own. On the first pass, 6 tests
  timed out at 15 s under load.
- `coverage.test.ts` passed. The full `core-contract.test.ts`
  (`--testTimeout=120000 --minWorkers=1 --maxWorkers=2`) printed "capability
  contract: 51/51 variants accepted by Core across 43 capabilities", with 58/58
  tests passed.

## Validation (round 1, observed)

- `packages/fluxiq`: `npx tsc --noEmit` → exit 0, no output.
- `apps/web`: `npx tsc --noEmit` → exit 0, no output.
- `node scripts/structure-audit.mjs` → `passed (195 warning(s), 355 baselined)`;
  also prints "1 baseline entries can be lowered" (not investigated, not run
  `structure:baseline`; baseline is shared).
- `packages/fluxiq` vitest: `runtime/executor`, `runtime/run-control`,
  `api/handlers/tests/run-control.test.ts`, `cancel-runtime-session.test.ts`
  (`--no-file-parallelism`) → 23 files, 305 tests passed.
- `apps/web` vitest: `runtime/tests` + `workspace/tests/studio-action-registry.test.ts`
  + `routine-actions-never-authorize.test.tsx` → 12 files, 69 tests passed.
- `apps/web` capabilities: `registry`, `dispatch`, `coverage`, `versions`
  passed; `core-contract.test.ts` filtered to `run.pause`, `run.takeControl`,
  `run.resume`, `run.progress`, `run.cancel`, and both classification tests →
  all PASS (`run.progress` and classification needed `--testTimeout=120000`:
  free RAM was ~1 GB and each contract world took 11–21 s). The full
  `core-contract.test.ts` run crashed a vitest worker and timed out
  pre-existing capabilities under the same memory pressure — environmental,
  not re-run in full.

## Not verified

- No live browser run and no extension wiring; the extension lane owns that.
- Parked-run resume (`executor/resume.ts`) has no host caller yet. When one
  is added it should pass the same `runControl` gate.
- A process restart drops live control, as it drops the abort controller: a
  held run then becomes an orphaned `running` session, the same as today.
- Wiring item 6 (control history on the terminal run record) was not applied.
- Architecture docs (`docs/architecture/automation-studio/client-gateway.md`,
  `persistence.md`) are not updated; the endpoint table above is ready to copy.
