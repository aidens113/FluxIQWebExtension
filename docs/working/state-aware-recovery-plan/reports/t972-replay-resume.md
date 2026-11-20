# t972: a saved Flow's replay resumes after a person clears a check (F18)

## Outcome

Done. Root cause found and fixed in Core: Continue on a person-needed check at
a saved Flow's **last** step was read as Stop, so the replay ended failed after
the person had cleared the check. A replay now goes on from every step a person
cleared, the last included, with zero model calls, and (lead's addition, same
seam) a cleared check no longer counts as a replay deviation, so a replay that
stands needs no judge call. Proven provider-free by a new recovery-matrix case
15, which passed: run succeeded, two traffic screens cleared (one mid-Flow, one
at the last step), 0 model calls.

## Cause, with evidence

Live run `run-mwoq9g4l-dbd69bd6` (crossborder-marketplace, free-hubs-under-ten),
steps under `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-20/run-mwoq9g4l-dbd69bd6/steps`.

What the replay steps show (attempt 2 is 0234-0245; attempt 3 is 0290-0301, the same pattern):

| Step log | Node | Result | What the run did next |
| --- | --- | --- | --- |
| 0236 | s3 navigate | `web.intervention.required`, spans `ask-or-park`, `person-cleared` | re-ran s3 (0237), which passed: `rerun` |
| 0238 | s4 click | same | went on to s5 (0239): `go_on` |
| 0241 | s7 next page | same | went on to s8 (0242): `go_on` |
| 0244 | s10 next page, **the Flow's last step** (draft position 24) | same; `person-cleared` took 0 ms (the plain-press `go_on` path, no effect check) | **nothing ran; the run ended failed**, note 0245 "stopped at step 24: web.intervention.required" |

So the person's Continue *was* routed to the replay and the replay *did* resume
at the interrupted step three times in each attempt. Only the last step failed.
The flow-run report the model then got (0247 request) lists positions
1,4,9,10,12,13,14,21,23,24 with 24 the last and `failed`, which confirms s10
had no step after it.

How Continue is routed during a replay (Core, `!FluxIQ/packages/fluxiq/src`):

1. `framework/automation-service/service/answer-first/flow-run/flow-run.ts:110-152`
   runs the saved Flow on the real engine with the attempt's own parking port,
   `flow-run/person-check-port.ts:37-62`, which lets only the person-needed ask
   through and waits for the answer in place. Exploration does not go through
   the engine graph at all (each `core.run_node` call is asked and answered on
   its own), which is why clearing the check there carried on.
2. `engine/automation/step-loop/ask-or-park.ts:44-110` raises the person-needed
   ask for a `user_intervention_required` failure, waits, and records the
   answered ask on the attempt with `route: "success"` (Continue's route is the
   ask's `granted` route, `runtime/parking/person-needed-ask.ts:63-67`).
3. `engine/automation/graph-run.ts:522-525` judges the step
   (`engine/automation/person-cleared.ts`): `go_on` for a plain press such as
   next page, then `route = "success"` (graph-run.ts:555).
4. **The defect.** `graph-run.ts:576-581`: the last node has no `success` edge,
   so before the frame's end is reached it asks
   `automationStudioPersonNeededEnding(attempts, node, "success")`
   (`engine/automation/person-needed.ts:110-121` before the fix; 123-135 after). That function
   matched any *answered* person-needed ask whose route equals the route asked
   about, and returned "the person pressed Stop". Continue's route is
   `success`, so Continue on a last step matched, and the run ended `failed`
   with the person-needed ending. It was written for Stop (route `failed`) and
   timeout (route `failed`) on a step with no failed edge; the `success` case
   was never excluded.
5. The engine's receipt was not `succeeded`, so `flow-run.ts:152` reports
   `reachedEnd: false`, `steps-ran.ts` names the last failed attempt (position
   24, `web.intervention.required`) and the attempt went back to the model to
   "fix that step". Attempt 2 then spent its budget (`budget_out`); attempt 3 was
   stopped.

## Fix (root)

`!FluxIQ/packages/fluxiq/src/engine/automation/person-needed.ts`:
`automationStudioPersonNeededEnding` returns nothing for an ask answered down
`success` (Continue). A node with no `success` edge is the frame's last step,
and graph-run then takes its ordinary end (`automationStudioStepFrameSucceeded`).
Stop and nobody answering still end with the person-needed ending; no new ending,
no PIN, and the person-cleared judgement (`person-cleared.ts`) still decides
whether the step runs again (`rerun`), goes on (`go_on`) or is held as Outcome
uncertain, so a lasting act whose effect is uncertain is still never repeated.
The same function serves a durably parked run resumed by Continue
(`graph-run.ts:401-405`, then the same edge choice), so that path is fixed too.

### Same seam, added at the lead's request: a cleared check is no replay deviation

`!FluxIQ/packages/fluxiq/src/framework/automation-service/service/answer-first/completion/replay-stands.ts:58`
(before the change) sent any replay with a step whose check a person cleared to
the judge (`check_cleared`), so on hubs every saved-Flow replay spent one judge
call even when it went exactly as saved. The engine has already settled the step
the check met (`person-cleared.ts`): an unmade act ran again and its own record
counts (a failure is `step_failed`; a retry the ladder asked for is
`step_retried`; the rerun right after a clear carries no `retry` record, because
`graph-run.ts:525` re-enters the loop without setting `ctx.pendingRetry`), a made
act went on, and a lasting act nothing could settle stops the run as Outcome
uncertain, which reads as `run_not_whole`. So `check_cleared` is no longer
named: a replay that stands now needs no judge. The contract word stays in
`api-contracts/automation/task-attempt.ts` (comment updated) because attempts
stored before t972 carry it, and `attempt-store/replay-verdict.ts` must still
read them; the extension's exhaustive map
(`apps/extension/src/panel/chat/transport/ports/results/read-task-outcome.ts:18`)
therefore needs no change. `AUTOMATION_STUDIO_ANSWER_FIRST_REPLAY_DEVIATIONS`
and `AutomationStudioAnswerFirstReplayDeviation` are now the contract's words
without `check_cleared`.

## Proof

### Core unit tests (`engine/automation/tests/person-needed.test.ts`)

- "reaches the Flow's end on Continue when the check met its last step, which
  has no edge on (F18)": in-place ask, last node checked, Continue -> run
  `succeeded`, the checked press executed once, nothing re-pressed.
- "reaches the Flow's End on Continue when the check met the step before it".
- "resumes to the Flow's end on Continue when the parked step is its last, with
  no edge on (F18)": durable park, resume with Continue -> `succeeded`.
- The existing "does not let the Flow's last step succeed by being stopped"
  still holds (Stop on a last step ends failed).

### Recovery matrix case 15 (extension `packages/test-runner/src/recovery-matrix`)

- `flows/checked-hub-search.ts` (`CHECKED_HUB_SEARCH`): crossborder search,
  Free shipping, 4 stars and up (s7: the third results load, so the traffic
  screen, mid-Flow), Price up, Max 10, OK (s10: the third load after the screen
  was passed, so the screen again, at the Flow's last step). Core keys nodes by
  place and adds a merge after each optional step (s2, s4), which the first
  matrix run showed. Selectors are the
  build's class hashes for seed 7342, computed with the scenario's own FNV-1a
  emitter (`apps/scenario-lab/src/build-classes.ts`).
- `matrix-rows.ts` row 15 / case "15": `workflowId: free-hubs-under-ten` (its
  person-check row is "completes"), check `person-cleared-resume`,
  `personCleared: { steps: ["s7", "s10"] }`, site
  `{ kind: "crossborder-checks-passed", checksPassed: 2 }`.
- `run/case-person.ts`: a case that names person-cleared steps has the Lab play
  the person (`person-simulation/startLabPerson`) for its run; the hand-offs go
  into the case result's `observed.person`. Other cases are unchanged (nobody
  answers).
- `checks/matrix-checks.ts` `personClearedResume`: zero model calls (the floor),
  run `succeeded`, each named step has an attempt the person cleared, no
  unexpected cleared step, and the last named step is the Flow's last step.
- `records/attempt-records.ts`: `clearedByPerson` read from Core's
  `metadata.ask` (personNeeded, answered, route success).
- `records/site-state.ts`: `crossborder-checks-passed` reads
  `search.checksPassed` (a step pressed again after the clear is one more
  results load and so one more screen), `search.challenged`, cart and orders.

## What changed

Core (`C:/Users/osrs_/FluxStuff/fxwork/t972/!FluxIQ/packages/fluxiq/src`):

- `engine/automation/person-needed.ts`: Continue (an ask answered down
  `success`) is never a person-needed ending (the root fix).
- `engine/automation/tests/person-needed.test.ts`: three tests (last step in
  place, step before End, last step after a durable park).
- `framework/automation-service/service/answer-first/completion/replay-stands.ts`:
  `check_cleared` is no longer a deviation. The exported list and type leave it out.
- `framework/.../completion/tests/replay-on-record.test.ts`: the deviation list
  without `check_cleared`; a replay with cleared checks (the last step included)
  stands; a completion closing such a replay makes no judge call; what the clear
  left still counts (`step_retried`, `run_not_whole`); the "deviated" test now
  uses `step_retried`.
- `api-contracts/automation/task-attempt.ts`: comment only (word kept for stored
  attempts).

Extension (`C:/Users/osrs_/FluxStuff/fxwork/t972/!FluxIQWebExtension/packages/test-runner/src/recovery-matrix`):

- new `flows/checked-hub-search.ts`, `run/case-person.ts`; barrels
  `flows/index.ts`, `run/index.ts`.
- `matrix-row.ts` (check id, site kind, `personCleared` field),
  `matrix-rows.ts` (row 15), `checks/matrix-checks.ts` (`person-cleared-resume`),
  `records/attempt-records.ts` (`clearedByPerson`), `records/site-state.ts`
  (`crossborder-checks-passed`), `run/run-matrix-case.ts` (starts and finishes
  the Lab person for such a case; the hand-offs go into `observed.person`).
- tests: `checks/tests/matrix-checks.test.ts`, `records/tests/site-state.test.ts`,
  `records/tests/attempt-records.test.ts`, `tests/matrix-rows.test.ts` (row
  list, ready rows, 17 cases, and the case-15 key check).

## Commands run and observed results

Every vitest, build, audit and Lab run went through
`cd C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots && node heavy-slot.mjs run t972-<step> -- ...`.

- Core vitest (`packages/fluxiq`, `node ../../node_modules/vitest/vitest.mjs run`
  on `engine/automation/tests/person-needed.test.ts`,
  `engine/automation/tests/person-cleared.test.ts`,
  `answer-first/completion/tests` (10 files),
  `answer-first/attempt-store/tests/replay-verdict.test.ts`,
  `answer-first/flow-run/tests` (21 files)) -> `Test Files 34 passed (34)`,
  `Tests 195 passed (195)`.
- Pre-fix probe: the fix line commented out, then `person-needed.test.ts` ->
  `Tests 2 failed | 17 passed (19)`, the two F18 tests failing. File restored
  from a copy, and the restore was confirmed with grep (1 match).
- Core targeted tsc (scratch tsconfig extending `packages/fluxiq/tsconfig.json`,
  `files` = the 5 changed Core files plus `completion/check.ts`,
  `completion/replay-verdict.ts`, `completion/index.ts`,
  `attempt-store/replay-verdict.ts`) -> exit 0, no errors.
- Extension targeted tsc (scratch tsconfig extending
  `packages/test-runner/tsconfig.json`, 14 changed or importing files) -> exit 2,
  20 errors, **none in a changed file**: all in untouched files that import the
  unbuilt `@fluxiq-web-extension/domain/node` (10) and `browser-host/reaper` (2),
  plus implicit-any errors that follow from those. The Lab prelude then built
  `test-runner:build` (package `tsc -p`) from the final source without error,
  since the matrix ran.
- Extension unit tests: esbuild-bundled with workspace packages from source
  (scratch runner), `node --test` on `checks/tests/matrix-checks.test.ts`,
  `records/tests/site-state.test.ts`, `records/tests/attempt-records.test.ts`,
  `tests/matrix-rows.test.ts` -> `# tests 34`, `# pass 34`, `# fail 0`.
  (`apps/extension/scripts/test-extension.mjs` covers `apps/extension/src` only,
  and these files are in `packages/test-runner`.)
- `pnpm lab recovery-matrix --case 15`:
  - run 1 refused: the Core build was stale. Rebuilt with
    `pnpm --filter fluxiq build` (exit 0) and
    `pnpm --filter @fluxiq/ui-components build` (exit 0).
  - run 2 (`rmx-2026-11-20T10-04-51-026Z-2f5801`): verdict `failed`, only
    because the case named the wrong node keys (s5/s8; Core saved s7/s10). The
    run itself `succeeded`, with 0 calls and checks passed = 2.
  - run 3 (`rmx-2026-11-20T10-14-45-038Z-aaf246`, after the keys were
    corrected): **`passed`**. Run `succeeded`, 10 attempts. s7 and s10 each
    failed `user_intervention_required/web.intervention.required`, were cleared
    by the Lab person (`traffic-screen`, `cleared`, `person_done` twice), and
    the run went on: s8 and s9 succeeded after s7, and the run ended succeeded
    after s10. Accounting: `calls: 0`, `interventions: 0`. Site:
    `checksPassed: 2`, nothing left waiting, no cart lines, no orders.
- Structure audit, both repos (`node scripts/structure-audit.mjs`, rerun after
  the last edit) -> Core `passed (558 warning(s), 911 baselined)`, extension
  `passed (254 warning(s), 551 baselined)`.

## Not verified

- No live (paid) run: the fix is not yet seen on `run-mwoq9g4l`'s own task, a
  live free-hubs-under-ten attempt with its saved Flow replayed.
- No matrix run of case 15 on the pre-fix Core: the pre-fix failure is shown
  only by the Core unit probe and by the live run's logs.
- The judge-free replay (`replay-stands.ts`) is proven by unit tests only. No
  attempt-level run showed a replay with a cleared check closing with 0 judge
  calls.
- Package typechecks were not run (user rule). Extension tsc was targeted;
  errors in untouched files come from unbuilt workspace dists.
- Other matrix cases were not rerun. `run-matrix-case.ts` changes them only
  when a case sets `personCleared`.

## Open questions or contradictions

- The brief says the replay "did NOT resume from step 24". The step logs show
  it did resume at every interrupted step except the Flow's last one; the run
  ended there because Continue was read as Stop, not because it was routed
  elsewhere.
- The acceptance matrix in `docs/working/state-aware-recovery-plan.md` (and any
  architecture document that lists the matrix rows) does not name row 15 yet.
  These are shared documents, left for the lead (I did not check which ones list
  rows).
- `check_cleared` stays in the contract's closed words but is no longer
  produced. The extension's `read-task-outcome.ts` map still lists it, which is
  correct for stored attempts. Removing the word would need a migration of
  stored attempts.
