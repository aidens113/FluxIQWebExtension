# t197-w2: Core run executor, person-needed hand-off

Worker w2. Tree: `fxwork/t197/!FluxIQ`, branch `task/t197-robot-check-handoff`, not committed.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. A node attempt that fails with category `user_intervention_required`, and raises no ask of its
own, now asks the person with the fixed person-needed ask, but only when a parking port is bound.
Continue goes down `success`. Stop, or nobody answering, ends the run failed with a person-needed
message; the ladder and LLM repair do not run. The attempt keeps its failure category and code. Durable
resume works the same way, and a run asks at most 3 times.

## What changed and why

- **New `R/executor/person-needed.ts`** holds the logic, so graph-run.ts only gets small hooks:
  - `automationStudioPersonNeededStep({attempt, node, attempts, raised, parkingBound})` returns one of
    three results:
    - `none`: the attempt did not fail for this reason, raised its own ask, or no port is bound.
    - `ask`: the synthesized ask. It is built with `automationStudioPersonNeededAskDraft({askId:
      attempt.attemptId})` and normalized through `automationStudioAskInEffects`, so it has the same
      shape as a raised ask. `raisedBy` is `{stage:"execution", nodeId, definitionId, attemptId}`.
    - `exhausted`: the cap is reached. It carries the ending message.
  - `automationStudioPersonNeededEnding(attempts, node, route)` returns the ending message. It applies
    when the node's latest attempt settled a person-needed ask down `route` and the Flow has no edge
    for that route. It reads the attempts, so it also works after a durable resume.
  - `automationStudioIsPersonNeededAsk` detects the ask by its marker `control.kind === "person_check"`.
    `automationStudioAttemptNeedsPerson` tests the attempt.
  - `AUTOMATION_STUDIO_PERSON_NEEDED_ASKS_PER_RUN = 3`.
  - All of these are exported from `R/executor/index.ts`.
- **`R/executor/contracts.ts`**: the attempt's `ask` record gains an optional `personNeeded?: true`.
  - Only person-needed asks get it, so permission asks and approvals are unchanged.
  - A durable resume needs it: the saved attempt is the only record of what the ask was.
  - It is also how the cap counts asks across parks.
  - `resume.ts` already spreads `attempt.ask` when it settles the ask, so the flag survives with no
    change to resume.ts.
- **`R/executor/graph-run.ts`**:
  - The ask block (~:489) calls the step function. When the result is `exhausted`, the run records the
    fault as `stopped` on the defence record and returns failed. When the result is `ask`, the ask goes
    through the existing parking path unchanged:
    - `openAutomationStudioAsk` delivers it.
    - `settleAskInPlace` waits for the answer when the port has `awaitAnswer`.
    - Otherwise the run returns a durable `waiting` trace.
  - Once the ask settles, `routeOverride` is set, so the failure/ladder branch never runs. That is why
    neither the ladder nor LLM repair runs.
  - Before this change, a node whose failure route had no edge would end with a generic "no matching
    outgoing edge" message. Now, when a person-needed ask was settled down that route, the run returns
    the person-needed ending instead. This check runs before the success check, because otherwise a last
    node with no outgoing edges would have "succeeded" when the person pressed Stop.
  - Continue is not written into `values` as `answer` or `<node>.answer`. It carries no data, and under
    the bare `answer` key it would overwrite a real output.
- **Ending text:** `Run stopped: a person was needed at step <label|id> to complete a check on the page
  (user_intervention_required, <failure.code>), and the person pressed Stop.` When nobody answers, the
  last clause is "nobody answered in time". When the cap is reached, it is "a person was asked 3 times
  and the check was still there". The failed attempt is the run's last attempt and keeps `failure`
  `{category: user_intervention_required, code: web.intervention.required}` unchanged.
- **Success route after a failed attempt:**
  - The failed attempt's outputs, `{}` for a check, are written as for any failed attempt. This is the
    same as the ladder's existing `satisfied` path.
  - The next node's wired inputs take only values that exist (`collectWiredNodeInputs` skips undefined
    ones), and the test shows the next node gets `{}` and succeeds.
  - A downstream parameter bound to an output the checked step never produced fails that node with
    `executor.parameter.unresolved_state_path`. That is a named failure, not a crash, and I left it as is.
- **Activity (item 5):** changed in graph-run.ts only, not in `R/activity/**`. The existing
  `waiting_permission` emission now uses `label = ask.text` and `detail.title = "Waiting for a person"`
  for a person-needed ask; other asks are unchanged. w1's report was not yet written, so this uses
  `emitAutomationStudioActivity`'s current API.

## Commands run and observed results

From `fxwork/t197/!FluxIQ/packages/fluxiq`:

- `pnpm vitest run src/programs/automation-studio/runtime/executor/tests/person-needed.test.ts` printed
  `Tests 14 passed (14)`.
- **Fail-before check.** I temporarily replaced graph-run.ts with `git show HEAD:...graph-run.ts`, ran the
  same test file, and restored the file. The run printed `Tests 12 failed | 2 passed (14)`. The 2 that
  passed are the unchanged-behaviour guards: no port bound, and a step that raises its own ask.
- `pnpm vitest run src/programs/automation-studio/runtime/executor` printed
  `Test Files 19 passed (19)`, `Tests 295 passed (295)`.
- `pnpm vitest run src/programs/automation-studio/tests/conversation-parking.test.ts
  src/programs/automation-studio/runtime/parking src/programs/automation-studio/runtime/activity` printed
  `Test Files 6 passed (6)`, `Tests 42 passed (42)`. The brief gave the path as
  `tests/conversation-parking.test.ts`; the file actually lives at `src/programs/automation-studio/tests/`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t197 w2 tsc" pnpm --filter fluxiq check` printed
  `[heavy] t197 w2 tsc holds b4`, then `tsc --noEmit` exited with no errors. That includes w1's
  concurrent edits.
- `node scripts/structure-audit.mjs` (repo root) reported 2 violations, both in w1's file
  `R/flow-bootstrap/person-needed.ts`:
  - `failure-as-empty` at line 137.
  - `imports`: it imports `../llm/node-tools/replay.ts` instead of the barrel, at line 40.

  My files add advisory warnings only: executor/ now has 25 files (advisory limit 15), contracts.ts
  407 lines (advisory 400), graph-run.ts 757 lines (hard limit 800).
- **Broader run** of `src/programs/automation-studio/runtime/tests` and `src/programs/automation-studio/tests`,
  run together while other work was loading the machine. It printed 30 `×` lines before the captured
  output was cut off, so I have no vitest summary.
  - 29 of the 30 took 15–60 s each. They are service-level tests failing on the 15 s timeout.
  - I re-ran one of those files, `service-adaptation/tests/llm-run-caller.test.ts`, with
    `--no-file-parallelism`. It passed.
  - The 30th failure is deterministic: `native-node-runtime.test.ts > registers manifests and isolates
    implementation inputs to declared ports`, `expected NaN to be 8`. It fails the same way with HEAD's
    graph-run.ts swapped in (`Tests 1 failed | 14 passed`), so it predates this work. The likely cause is
    that native implementations now receive only wired inputs (`collectWiredNodeInputs`, from lane t195),
    and that test's flow has no edge carrying `in`.
  - I did not re-run the other timed-out files serially.

## Tests added (`R/executor/tests/person-needed.test.ts`, 14 tests)

- A failing attempt with `user_intervention_required` opens the ask with the expected id, kind, parks,
  text, marker, options and raisedBy.
- Continue, answered in place:
  - The run succeeds and the next node runs with `{}` inputs.
  - The checked node is not executed again and has no `recoveryDecision`.
  - `values.answer` is not written.
- Stop and nobody answering, in place: the run fails with the person-needed message, category and code
  are preserved, the node is executed only once, and there is no `recoveryDecision`.
- A last node with no edges that is stopped ends failed, not succeeded.
- An authored `failed` edge is followed.
- No port: the run fails as before, the ladder runs, and no ask is raised.
- A step that raised its own ask gets no second ask.
- Durable park: the parked record has the marked ask and routes.
- Durable resume: Continue takes success without re-executing the node. Stop, and a timeout past the
  300 s expiry, each give the person-needed ending with the failure preserved.
- Cap in place: 4 checked steps produce 3 asks, then an exhausted ending with no ladder.
- Cap across durable parks: 3 parks, then the ending.

## Not verified

- **Live or browser behaviour, the Lab, and the downstream domain.** Not run: out of scope, and only
  one live run is allowed at a time.
- **How the Lab reads "the run's failure".** The trace has no run-level failure field. I made sure the
  failed attempt is the last attempt, keeps `failure.category`/`code`, and that the message names both.
  If the Lab reads the category from somewhere else (for example the service's `failureReason`, which is
  `trace.message`), w5 or the lead should confirm.
- **LLM repair in the service layer after a failed run.** I did not trace it. Preserving the category
  keeps `adaptive-orchestrator.ts` treating the failure as ineligible, since
  `user_intervention_required` is refused there, but I did not run a service-level test.
- **Call Flow child runs.** A child gets the parking port through its options, so it asks too. The cap
  is per graph run, so a parent and a child each have their own 3 asks.

## Open questions or contradictions found

- **Authored failed route.** The brief says that on Stop or a timeout "the run ends failed". The design
  says the run "goes down `failed`". I made Stop or a timeout follow an authored `failed` edge when the
  Flow has one, as every ask and the old ladder's deterministic path did, and end with the person-needed
  ending only when there is no such edge. That is the common case for built Flows. If Stop must always
  end the run, change `automationStudioPersonNeededEnding` to run before edge selection, and drop the
  authored-failed-route test.
- **Brief path.** `tests/conversation-parking.test.ts` is at `src/programs/automation-studio/tests/`.
