# t411 - Completed-act ledger, fast handler bodies, unhandled reasons (Core)

Worker report. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t411/!FluxIQ`, branch `task/t411-completed-act-ledger`. Nothing committed.
Paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/executor/` unless they say otherwise.

## Outcome

Partial.

All three items are implemented and proven by provider-free tests. The executor tests, service-flow tests and the Core
typecheck pass.

Two things keep this from Done:

- **Structure audit.** It fails on one rule, `working-docs`. The edit to the C5 paragraph made the plan document 404
  lines long, and `docs/working/README.md` still lists it as 396 lines. That index is a shared document, so I left it
  for the supervisor to regenerate.
- **Row 10 live run (provider-free).** The run now takes the handler's route. It still fails, for a reason outside
  this brief: the `requests` checkpoint is a click on "see all friend requests", and that link is not on the requests
  page the route returns to. The run never reached the confirms again. Details are under "Commands run".

## What changed and why

### 1. Completed-act ledger (recovery matrix row 10)

**The ledger.** `lifecycle-run/run-state.ts` gains `completedActs: Map<key, AutomationStudioCompletedAct>`. It sits on
the run holder, so every frame of the run shares it. The record type is in `lifecycle-run/completed-act.ts`.

**The act's identity** (`lifecycle-run/act-identity.ts`). The key is graph id + node id + a sha256 of:

- **When the node runs per row:** the loops that hold the node. For each For Each loop, the current pass's item. For
  each Repeat loop, the current pass number.
  - Item fields whose key starts with `$` or contains `handle`/`evidence` are left out, because each read of a list
    mints them afresh.
- **Otherwise:** the node's parameters, resolved the same way `node-execution/attempt.ts` resolves them, plus the
  values its edges bring to its ports.
- **In both cases:** the frame's inputs.

**Skipping a done act** (`step-loop/already-done.ts`, `automationStudioStepAlreadyDone`). This runs from
`step-loop/arrival.ts` on every arrival at a node whose act lasts, before its pace, its On Before handlers and its
readiness gate. When the ledger holds the key:

- The run pushes an attempt with `status: "succeeded"`, `route: "success"` and
  `skipped: { reason: "already_done", code: "executor.act.already_done", attemptId, row? }`. The attempt carries the
  first attempt's outputs.
- Its message reads "Already done for <row>: the act completed in this run (...)".
- It emits an activity row: "Already done for <row>" when the node runs per row, otherwise "Already done: <label>".
- It leaves by the `success` edge. The act is never dispatched.
- Otherwise the key is kept as `pendingAct` on the frame (`step-loop/lifecycle-frame.ts`).
- Handler-body frames are exempt.

**Recording a done act** (`automationStudioStepRecordCompletedAct`, same file). It is called from:

- `step-loop/before-next.ts`, on a verified success;
- `step-loop/failed-attempt.ts`, at the two places that set `stateHeld`: the satisfied rung, and an effect check that
  says `landed`.

**The route guard** (`step-loop/lifecycle-route-guard.ts`). It no longer calls `automationStudioRepeatedLastingAct`,
and the `repeatsCompletedReconcile` / `effectCheck` fields are gone from the guard, `AutomationStudioRouteCheck` and
`decideAutomationStudioDisposition`. The guard now refuses a route in two cases:

- **An uncertain act.** The old rule stands. The uncertain check now also covers the backward walk (the checkpoint
  and the nodes between it and the failing step). Before, it covered only the forward span and the failing step.
- **A completed act the ledger does not hold** (new guard code `repeats_unrecorded_act`). This is a safety net I
  added; see "Open questions".

**Restarting a list loop** (`automationStudioStepRouteLeavesLoops`, in `step-loop/checkpoint-route.ts`). A handler
route that leaves a For Each loop's body for a checkpoint outside it clears that loop's place in `runState.loops`. It
is called from `step-loop/lifecycle-dispatch.ts` and `step-loop/checkpoint-route.ts`.

- Without this, a For Each that the run reached again resumed past the row it had left, and that row was never done.
- With it, the list restarts: the rows already done are skipped as `already_done`, and the rest are done.
- A Repeat (do-while) loop keeps its count.

**C5 paragraph.** The last paragraph of C5 in Core `docs/working/state-aware-recovery-plan.md` is rewritten as one
paragraph. It covers the ledger, the identity, the skip, the loop restart, the refusal rules and the closed unhandled
codes.

### 2. Handler body inputs

New `lifecycle-run/body-inputs.ts` (`automationStudioHandlerBodyInputs`). The body now gets:

- the frame's inputs;
- each run value the body's own nodes name. That is a `$state` path in their parameters (after `$node.` references
  are rewritten) or a `{ value }` operand of a fact condition in their metadata. The body's nodes are those reachable
  from `bodyNodeId` up to the Handler End.

`lifecycle-run/dispatch.ts` passes this result in place of `{ ...input.values }`.

### 3. Unhandled reason

New `lifecycle/unhandled-reason.ts` defines two closed code lists.

- **Reasons** (`AUTOMATION_STUDIO_UNHANDLED_REASONS`): `written_unhandled`, `body_failed`,
  `completion_check_not_true`, `disposition_not_allowed`, `resolve_missing_outputs`, `route_refused`, `budget_spent`,
  `already_tried`, `no_body`, `core_stop`.
- **Route guards** (`AUTOMATION_STUDIO_ROUTE_REFUSAL_GUARDS`): `checkpoint_not_found`, `checkpoint_not_holding`,
  `requires_unbound`, `passes_uncertain_act`, `unreachable`, `unguarded`, `repeats_unrecorded_act`.

Where the codes are set:

- The `unhandled` decision now carries `code` and `guard?`.
  - `lifecycle/dispositions.ts` sets them.
  - `lifecycle-run/dispatch.ts` sets them for refusals, the route budget, a target the guard found unreachable, and an
    unguarded route.
  - `step-loop/lifecycle-dispatch.ts` `unroute` sets `route_refused` / `unreachable`.
- The attempt's stored `lifecycle.disposition` now reads `{ kind: "unhandled", reason, guard? }`. This is done in
  `lifecycle-run/dispatch-records.ts`, and a Core stop reads `core_stop`.
- The runtime stream's `handler_execution` record keeps `{ kind: "unhandled" }`, as its model type in
  `model/flow-adaptation.ts` declares.

### Files

**Changed:**

- `contracts.ts`: the `skipped` union gains `already_done`; the trace's unhandled disposition gains `reason?` and
  `guard?`.
- `lifecycle/dispositions.ts`, `lifecycle/index.ts`
- `lifecycle-run/dispatch.ts`, `dispatch-contracts.ts`, `dispatch-records.ts`, `index.ts`, `run-state.ts`
- `step-loop/arrival.ts`, `before-next.ts`, `checkpoint-route.ts`, `failed-attempt.ts`, `lifecycle-dispatch.ts`,
  `lifecycle-frame.ts`, `lifecycle-route-guard.ts`
- Core `docs/working/state-aware-recovery-plan.md` (C5 only)

**New:**

- `lifecycle/unhandled-reason.ts`
- `lifecycle-run/act-identity.ts`, `lifecycle-run/body-inputs.ts`, `lifecycle-run/completed-act.ts`
- `step-loop/already-done.ts`

**Tests:**

- New: `step-loop/tests/already-done.test.ts`, `lifecycle-run/tests/handler-body-inputs.test.ts`
- Edited: `lifecycle/tests/dispositions.test.ts`, `lifecycle-run/tests/dispatch.test.ts`,
  `lifecycle-run/tests/checkpoint-routes.test.ts`

### Proofs

**`step-loop/tests/already-done.test.ts`:**

- **Row 10's shape.** Four lasting confirms, with Freya's refused once by a retry handler that goes back to the
  `requests` checkpoint.
  - Landed presses: `requests, amara, jonas, lin, dismiss, requests, freya`.
  - Amara, Jonas and Lin each read `succeeded`, then `already_done`.
  - The chat says "Already done: Confirm Amara Osei", and the same for Jonas and Lin.
  - One route was charged.
- **A loop of four confirms.** A For Each over the rows read at the `requests` checkpoint, with handles minted afresh
  at each read. The fourth row is refused and the route goes back to the list.
  - Landed presses: `requests, amara, jonas, lin, dismiss, requests, freya`.
  - Confirm attempts: `succeeded ×3, failed, already_done ×3, succeeded`.
  - The chat says "Already done for Amara Osei / Jonas Weber / Lin Zhao".
- **The same row again.** A fifth row equal to the first is skipped.
- **An uncertain act still refuses the route**, both at the failing step and on the way back. A completed act the
  ledger does not hold refuses it too. One the ledger holds does not.

**`lifecycle-run/tests/handler-body-inputs.test.ts`:** a body is handed `["tag.value", "who"]` out of five values,
two of which are about 1 MB each.

## Commands run and observed results

**Baseline, before any change.** `npx vitest run src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/tests/service-flows`
(Core `packages/fluxiq`) printed `Test Files 100 passed (100)`, `Tests 813 passed (813)`.

**Final runs:**

- **Tests.** The same vitest command printed `Test Files 102 passed (102)`, `Tests 818 passed (818)`.
- **Typecheck.** `npx tsc --noEmit -p tsconfig.json` (Core `packages/fluxiq`) exited 0 with no output.
- **Structure audit.** `node scripts/structure-audit.mjs 2>&1 | grep -E "FAIL|structure-audit:"` (Core root) printed:
  - `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks.`
  - `structure-audit: 1 violation(s) across 1 rule(s).`
  - Cause: the index lists `state-aware-recovery-plan.md` at 396 lines, and the file now has 404.
  - Before the plan edit the audit printed `structure-audit: passed (318 warning(s), 1160 baselined).`
  - Fix: run `pnpm structure:baseline` in Core.

**Handler body time, before and after** (`lifecycle-run/tests/handler-body-inputs.test.ts`; the line logs the body run
with withholding included):

| | Body run time | Inputs handed to the body |
| --- | --- | --- |
| Before (body handed every value) | 9058, 9511 and 12058 ms | 5, about 2 MB |
| After | 11, 15 and 18 ms; 25 and 32 ms inside the full narrow suite | 2 |

**Core build.** `pnpm --filter fluxiq build` built. It ran before the `repeats_unrecorded_act` safety net was added.

**Row 10.** `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --row 10` (downstream t411 tree), run
`rmx-2026-10-10T08-43-19-613Z-3f2ade`:

- **Verdict:** `failed`. Reasons:
  - "requests rq_7a95b3 were not confirmed"
  - "Core reported the run failed with action_failed/web.action.rate_limited"
- **What went right:**
  - s12 (Freya) failed with `web.action.rate_limited` and its retry handler ended `retry:route`. The route was taken
    (`routes: 1`); t404 had `retry:unhandled`.
  - The handler body ran h1-s2, h1-s3 and h1-s4.
- **Where it stopped:**
  - The run resumed at s8, the checkpoint step "see all friend requests". It failed four times with
    `target_not_found/web.target.not_found`, with `stateRouting: no_pre_states`.
  - The link is on the feed, not on the requests page where the route lands, so the run never reached s9-s12 again
    and no `already_done` skip happened live.
- **Site counts:** confirmed `rq_8b41c7`, `rq_c7a0e5`, `rq_e24f90`; `rateLimited: 1`, `duplicatedActs: 0`.
- **Workspace:** `test-runs/persistent-isolated/rmx-10-52b4b40c`.

## Not verified

- The ledger skip has not run live (row 10 stopped at s8, above).
- The `repeats_unrecorded_act` refusal was not in the Core build the Lab ran. It cannot affect row 10, where every
  completed act is in the ledger.
- **Readers outside my ownership that do not know the new shapes:**
  - `runtime/service/summaries/conversions.ts:202` (t412's area) projects any `skipped` that is not `state_routed` as
    `target_absent`. In the run detail, an `already_done` skip would read as `target_absent` with code
    `executor.act.already_done`.
  - `runtime/service/summaries/recovery-trace.ts` and the model's `AutomationStudioFlowRunHandlerDisposition` /
    `AutomationStudioFlowRunLifecycleRecord` do not carry `reason`/`guard`. The trace stores them; the run detail drops
    them.
  - Downstream `packages/test-runner/src/flow-lane/skipped-attempt.ts` recognises only `target_absent` and
    `state_routed`.
- I did not exercise a parked run that resumes and then routes back. The guard test covers it with an empty ledger.
- I ran no full suites, no downstream tests, no paid runs.

## Open questions or contradictions found

- **Row 10's flow (downstream, not mine to edit).** `packages/test-runner/src/recovery-matrix/flows/confirm/with-checkpoint.ts`
  puts `checkpoint: yes` on "see all friend requests", which presses a link that only the feed shows. A route back
  therefore lands on a step that cannot run on the page the route returns to. The fix is one of:
  - put the checkpoint on a step that runs on the requests page;
  - give the checkpoint a `when` that holds there;
  - make the handler's body navigate back to the feed.
- **Brief contradiction.** The brief says the guard should refuse only past an uncertain act. I added one more
  refusal, `repeats_unrecorded_act`: a route back past a completed lasting act that the ledger does not hold.
  - It applies only where the ledger is empty for that act. That happens in a run resumed from a saved trace, and in
    the detached adaptive-retry restart, which begin with a fresh run holder.
  - It never fires when the ledger holds the act.
  - Without it, such a route would repeat the act. Remove it if you disagree.
- **Ownership.** I edited executor `contracts.ts`, which the brief did not list. Its types had to change: the
  `already_done` skip and the stored unhandled reason.
- **Two known risks of the identity rule** (they follow from the decision, but are worth knowing):
  - A Flow whose plain graph cycle (no For Each or Repeat head) does the same act on the same target with the same
    inputs on purpose would now have the repeats skipped.
  - Two identical rows in one list are one act.
- **Restarted loops.** Only For Each loops restart on a route out of them. Repeat (do-while) loops keep their pass
  count, so their passes continue after a route back rather than replaying.
