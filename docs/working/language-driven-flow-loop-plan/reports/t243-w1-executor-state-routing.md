# t243-w1 — Executor state routing (worker report)

- Brief: t243-w1-executor-state-routing (worker-high), 2026-10-02
- Tree: Core `fxwork/t243/!FluxIQ`, branch `task/t243-state-routing-runtime`. R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`
- Design implemented: "## Design" in `reports/t243-state-routing-runtime.md` (run side)

## Outcome

Done. The run side of state routing is in `R/executor/state-routing/` and wired into `graph-run.ts` at both former F38
sites. The new executor tests pass, the existing executor tests pass, and `pnpm --filter fluxiq check` passes. The
structure audit reports 3 failures, none of them in files this brief owns (listed below).

## What changed and why

New `R/executor/state-routing/`, with a barrel and one responsibility per file:

- `could-not-run.ts` holds two functions.
  - `automationStudioCouldNotRun`: true for a failed attempt with category `target_not_found`, and nothing else.
  - `automationStudioNotShownAttempt`: the synthesized `executor.ready_state.not_shown` attempt, moved out of
    `graph-run.ts`.
- `progress-guard.ts` holds the return limit, the progress mark and the guard.
  - `AUTOMATION_STUDIO_STATE_ROUTE_RETURN_LIMIT = 3`.
  - `automationStudioRunProgressMark` counts distinct nodes that succeeded and were not skipped, plus For Each passes
    into a body.
  - `automationStudioStateRouteGuard()` is one per run. It keeps a mark and a return count for each target. Progress
    resets the count, and targets are counted separately.
- `ranking.ts` (`automationStudioRankStateRoutes`) orders matches by closeness, then forward before backward-only,
  then breadth-first edge distance, then document order. A node not connected either way reads as backward at
  distance Infinity.
- `decision.ts` (`decideAutomationStudioStateRoute`) runs the decision in the design's order:
  1. F38's declared way on (`automationStudioAbsentStepSkip`, unchanged, no observation).
  2. Candidates: other nodes with a `before` signature. With none, the outcome is `no_pre_states` and nothing is
     observed.
  3. Observe, then sign. A failure is `unobserved`.
  4. Match. An acted node is excluded when its `after` matches or it has no `after`. The failing node is never a
     candidate.
  5. Rank, then the guard. The outcome is `routed` or `stopped`; an empty match list is `no_match`.

  The `no_match` reason says when matches were excluded because they had already acted.
- `routed-attempt.ts` (`automationStudioStateRoutedAttempt`) shapes the attempt for each outcome.
  - declared: today's F38 skip, byte for byte.
  - routed: `succeeded`, route `state_routed`, `skipped {reason:"state_routed", code, toNodeId, direction}`,
    `stateRouting`. `failure`, `fault` and `message` are stripped.
  - stopped and none: the attempt stays failed, with `stateRouting` added.
- `announcement.ts` (`announceAutomationStudioStateRoute`) posts the chat message through
  `emitAutomationStudioActivity` and `automationStudioActivityHumanLabel`.
  - declared: the same message as today.
  - routed: "Passed over “X”: the page is already past it. Continuing at “Y”", or "...the page went back to an
    earlier step...". A node without a label is named `step N` by its document position.

`R/executor/graph-run.ts` went from 789 to 749 lines.

- **Before dispatch.** An unmet gate (`checkedConditionCount > 0`) builds the not-shown attempt and asks the
  decision. Any outcome other than `none` skips the dispatch. With `none`, the node is dispatched and the attempt
  carries the record.
- **After execution.** For `routeOverride === undefined && automationStudioCouldNotRun(attempt)`, the code runs
  `routing ??= decide(...)`, which reuses the pre-dispatch decision, and then reshapes the attempt.
  - stopped: returns a failed trace with `currentNodeId` set to the failing node.
  - routed: announces, sets `currentNode = target` and continues. The arrival resets at the top of the loop because
    the node id changes.
  - declared: today's skip-edge path, with the region transition.
  - none: falls through to the unchanged ladder.

  Routed adds no defence-ledger entry and no "Recovery started".
- `withholdRunInputs`, `withheldInputEntries` and `withheldInputValue` moved verbatim into `trace-withholding.ts`
  as `automationStudioWithholdRunInputs`.
- `notShown` needed an explicit type, because TS7022 saw circular inference through `currentNode = routing.node`.

`R/executor/contracts.ts`:

- New types `AutomationStudioStateRouteDirection` and `AutomationStudioStateRoutingRecord`.
- `skipped` widened with the `state_routed` variant, and a `stateRouting?` field added to the attempt.
- The record holds counts, target, direction, closeness and reason only. It never holds a state or a signature.

`R/executor/index.ts` exports these:

- `AUTOMATION_STUDIO_STATE_ROUTE_RETURN_LIMIT`
- `automationStudioCouldNotRun`
- `decideAutomationStudioStateRoute`
- `AutomationStudioStateRouteDecision` (type)

`docs/architecture/automation-studio.md` has a new bold-led paragraph, "A step that cannot run continues where the
page is.", placed before the F38 paragraph. It covers:

- the rule and what "cannot run" means;
- the decision steps, with F38 as step 1;
- the progress guard and its bound;
- the order against the ladder;
- the behaviour before dispatch;
- the behaviour without pre-states.

The F38 paragraph now opens as "state routing's first case". Its last sentence now says a straight-line absent
target goes to the rest of state routing first.

**projectId and flowId (brief item 5).**

- `flowId` is `flow.flowId`.
- `projectId` is `flow.metadata.projectId` when it is a non-empty string, else `flow.ownerId`. For a canonical Flow
  that is the flowId; for a compiled plan it is the projectId.
- No option was added and `R/service.ts` is untouched. The web host's `observeRouteState` ignores both values.

## Commands run and observed results

**Failing first, against unchanged executor code:**

```
pnpm exec vitest run src/programs/automation-studio/runtime/executor/tests/state-routing-run.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests
```

Run from `packages/fluxiq`. It printed `Test Files 5 failed (5)` and `Tests 7 failed (7)`.

- The 4 unit files failed to load, because `state-routing/index.ts` did not exist.
- All 7 run tests failed. Examples:
  - `expected [ 's1', 's2', 's3' ] to deeply equal [ 's1', 's3' ]` (readiness gate);
  - the missing `stateRouting` on the no-pre-states case;
  - `currentNodeId` on the guard case.

**After implementation**, the same command printed `Test Files 5 passed (5)` and `Tests 25 passed (25)`.

**Whole executor tree**, run from `packages/fluxiq`:

- `pnpm exec vitest run src/programs/automation-studio/runtime/executor/tests src/programs/automation-studio/runtime/executor/state-routing/tests`
  printed `Test Files 25 passed (25)` and `Tests 304 passed (304)`. That includes `absent-step.test.ts` (9) and
  `optional-failed-route.test.ts` (12).
- `pnpm exec vitest run src/programs/automation-studio/runtime/executor` printed `Test Files 29 passed (29)` and
  `Tests 364 passed (364)`. That adds `defensive/tests`.

**Type check:** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t243-w1 check" pnpm --filter fluxiq check`

- First run: one error in my file, `graph-run.ts(414,13): error TS7022: 'notShown' implicitly has type 'any'`.
- After the fix: no errors, ending with
  `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; stored in the shared store ..."}`.
- That pass covered the whole package, including the other worker's files as they stood at that moment.

**Structure audit:** `node scripts/structure-audit.mjs` in the Core root reported `3 violation(s) across 2 rule(s)`.
All 3 are outside my lane and I did not fix them:

- `[failure-as-empty] runtime/route-state/signatures.ts` lines 50 and 111. These are the lead's `catch { return
  undefined }` blocks.
- `[imports] runtime/flow-bootstrap/adaptation.ts:25` imports `../route-state/signatures.ts` instead of the barrel.
- `[imports] runtime/flow-bootstrap/plan/parsing.ts:9` imports `../../route-state/signatures.ts` instead of the
  barrel.

My files raised only advisory warnings:

- `executor/` has 25 source files, unchanged. I added none directly in it.
- `executor/tests/` has 20 files.
- `contracts.ts` is 464 lines.
- `graph-run.ts` is 749 lines.

## Not verified

- No end-to-end run with the real web signer and comparator. That is unit C, and the domain side is W3's.
- No Lab run, no live browser, no provider call (the brief excludes them).
- The full Core `pnpm test` was not run; only the executor tree's tests were.
- Behaviour in a resumed (parked) run: the guard is per execution, so a resumed run starts with a fresh guard. This
  was not exercised.
- Region handling when a state route crosses regions: no `regionTransitions` entry is recorded, because there is no
  edge for one. Not exercised.

## Open questions or contradictions found

1. **The guard bound is open to two readings.** The design says "the fourth such route (LIMIT = 3)", where "such
   route" is a return without progress. The brief's test line says "the 4th route into the same node with no
   progress". I implemented the design:
   - the first route into a node sets its mark;
   - returns 1 to 3 without progress are allowed;
   - return 4 stops the run.

   In the run test the first route has mark 0 and the second sees progress, because s1 had acted, so s1 is dispatched
   5 times and the 6th route stops. To stop on the 4th route in total, use `returns >= LIMIT` in `progress-guard.ts`
   and adjust two tests.
2. **The `projectId` passed to `observeRouteState` comes from the document, not the run.** It is `metadata.projectId`,
   else `ownerId`. A host that keys on projectId would get the flowId for a canonical Flow. Passing the real projectId
   would need a graph option, which the brief ruled out because it would change `R/service.ts`.
3. **Downstream readers may not count the new route as a skip.** A routed attempt has `route: "state_routed"`, not
   `"skipped"`, although it carries `skipped`. Anything downstream that treats a step as skipped by
   `route === "skipped"` will not see state-routed steps as skipped. The Lab's t242 actions table, `run.json` and
   `steps/` work came up in the commit history; their files were not read. Readers should key on `skipped` or check
   both routes.
4. **`route-state/**` needs no change for this brief.** The barrel's four functions were enough. The audit failure in
   `signatures.ts` is the lead's to resolve.
