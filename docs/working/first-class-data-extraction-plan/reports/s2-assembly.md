# Report: s2-assembly (read-list redesign S2, do-while assembly)

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ`, branch `task/t283-read-list-s2-loop`. No commits.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. The do-while routing (C1) now compiles into C4's graph in `draft-routing.ts`, beside the two existing loops,
which are unchanged. The fail-first tests failed first and now pass. The whole `R/flow-bootstrap/authoring/tests/`
directory passes (12 files, 141 tests).

## What changed and why

`R/flow-bootstrap/authoring/draft-routing.ts`
- New `repeatWhile()` beside `repeat()`. The dispatcher picks it when `automationStudioFlowDraftRepeatIsWhile(routing)`
  is true. `repeat()` now takes `AutomationStudioFlowDraftRepeatOverRouting`, so `routing.over` is a `string` there.
  That should clear the five fluxiq:check errors at the old lines 213-243, but I did not run fluxiq:check (see below).
- Graph emitted (C4): `prev.success -> loopK.branches` (prev made `routed`); `loopK` (Merge) falls into `passK`
  (`builtin.control.repeat`, `routed`); `passK.body -> first`; `passK.done -> exitK.branches`; members in order;
  `last.success -> loopK.branches`, plus `last.<every output with role "branch"> -> exitK.branches` (`routed`); `exitK`
  (Merge) falls into the next step. `most` goes on the Repeat step as an entry `most=<n>` only when the routing
  carries it.
- Library check: `builtin.control.repeat` is required in addition to Merge and For Each only when a draft holds a
  do-while. Drafts without one behave as before.
- Refusals:
  - `flow_draft.repeat_while_never_ends` (C4): the last step's node declares no `branch` output and the routing has
    no `most`.
  - `flow_draft.repeat_body_is_routed` (existing rule): another member of the span carries routing.
  - `flow_draft.repeat_span_unknown`: `through` is not in the Flow, `through` comes before the step, or
    `while !== through`. The last is defensive, because parse already drops that case (C2).
  - `flow_draft.repeat_not_after_its_source` (not in the contract, see Open questions): a do-while at the very start
    of the Flow, with no step before it. The head Merge would have only the back edge into it, so the Flow would
    have no root and no run could begin (`executor/start-node.ts` `no_root`).
- Header table gains a "repeat while" line.

`R/flow-bootstrap/authoring/assemble-draft.ts`: not edited. `repeatSpans` (~:308) reads only `routing.through`, and
`through` is the span's end for both shapes, so it holds for a do-while.

`R/flow-bootstrap/authoring/tests/draft-routing.test.ts`: new describe "a span that repeats while its own last step
succeeds". It uses a test-local next-page definition: the fixture's click shape with id `web.output.dom-next_page`,
`fixedOutputId` `web.dom.next_page`, and the added output `{ id: "ended", role: "branch" }`. Tests:
- Graph: the exact node order (click, Merge, Repeat, extract_list, next_page, Merge, click) and the edges
  `search:success -> loop:branches`, `loop:success -> pass:in`, `pass:body -> read:in`, `next:success -> loop:branches`,
  `next:ended -> exit:branches`, `pass:done -> exit:branches`, `exit:success -> after:in`. The read is entered only by
  `pass.body`, and `next` has only those two edges out.
- `most`: with `most: 7` the Repeat node's parameter is 7, and it is the only node carrying `most`. The script step's
  entries are `["most=7"]` with `most` and `[]` without it, checked via `routeAutomationStudioFlowDraftSteps`. Without
  `most`, the plan node reads 50, because the assembler fills every unsaid parameter with its default.
- The validator accepts the plan, with and without `most`.
- A last step with no `branch` output (a click) and no `most` is refused `repeat_while_never_ends`. With `most: 5` the
  same draft assembles, without the ended edge.
- A routed member (`optional` on next) is refused `repeat_body_is_routed`.

`R/flow-bootstrap/authoring/tests/repeat-loop.test.ts`:
- Added the same next-page definition to the registry, plus `type` and `next` writers.
- `run()` now registers only the definitions it has implementations for. Widening the fixed `used` set broke the two
  existing runs ("Missing trusted-local implementation web.dom.type"), and this is the fix for that.
- New describe, run end to end with fake natives:
  - The draft is `type -> read (repeat while next) -> next -> after`, and next answers route `ended` on its 3rd
    attempt. Result: 3 read attempts, 3 next attempts with routes `[success, success, ended]`, `after` ran once, the run
    `succeeded`, and no attempt carries `recoveryDecision` or `stateRouting`.
  - With `most: 2` and next never ending: 2 reads, 2 nexts, Repeat routes `[body, body, done]`, `after` ran once, the
    run succeeded, and there is no recovery or state routing.

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ/packages/fluxiq`.

1. Fail-first, before any change to `draft-routing.ts`:
   `npx vitest run src/.../authoring/tests/draft-routing.test.ts src/.../authoring/tests/repeat-loop.test.ts`
   -> `Tests 9 failed | 28 passed (37)`. Seven of the failures were the new tests:
   - The five draft-routing tests failed. Three got an error issue where none was expected; the refusal tests got
     `repeat_span_unknown` instead of `repeat_while_never_ends` or `repeat_body_is_routed`.
   - Both new repeat-loop runs failed on assembly errors.

   The other two failures were existing repeat-loop runs, broken by my `used` set ("Missing trusted-local
   implementation web.dom.type"). I fixed the test helper as described above.
2. After implementation: the same command -> `Tests 1 failed | 36 passed`. The failure was my own assertion
   (`expected 50 to be undefined`): the assembler fills defaults. I corrected the assertion and added the direct
   entry check.
3. The same command again -> `Test Files 2 passed (2)`, `Tests 37 passed (37)`.
4. `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/` ->
   `Test Files 12 passed (12)`, `Tests 141 passed (141)`.

## Not verified

- fluxiq:check, the structure audit and any build were not run, as the brief says. I have not observed by a compiler
  that the five `routing.over` type errors are gone, and the new test code has not been typechecked (vitest strips
  types).
- C5 dependency: test (b) passes independently of the C5 change in `R/executor/node-execution.ts`, which was present
  in the tree, modified by another worker, when the final runs happened. The fake native implementation returns
  `route: "ended"` directly with no effect, and a native result's route already passed through unchanged. So (b) proves
  the graph and the executor following a `branch` route. It does not cover the dispatched-effect path
  (`payload.route` lifted by `io-policy.ts`, then filtered by `declaredBranchRoutes` in node-execution). That path is
  the C5 worker's to test.
- No Lab, browser or provider run.

## Open questions or contradictions found

- A do-while as the very first step of a Flow is refused with `flow_draft.repeat_not_after_its_source`. C4 does not
  cover this case. Without the refusal the assembled Flow would have no root node (the head Merge's only way in is the
  back edge), and the run would fail to start. If the lead prefers a dedicated code, it is a one-line change.
- The `repeat_while_never_ends` message hard-codes "after 50 passes" (the Repeat node's `DEFAULT_MOST`, which is not
  exported). If that default changes, this sentence goes stale.
- C4 lists the library check as "Merge and Repeat". I kept For Each in the check for every routed draft, as before,
  and add Repeat only when a do-while is present. A library without For Each still cannot build a do-while.
