# t208: a build that cannot finish never just ends

Worker report, 2026-09-30. Branch `task/t208-build-never-just-ends` in both trees. All changes are in Core
(`C:/Users/osrs_/FluxStuff/fxwork/t208/!FluxIQ`). The only downstream change is this report. There was no Lab run, no browser
run and no model call. Nothing was committed.

`R/` below means `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done, with one open item: a timing-only test failure that predates this work (see "Not verified").

What the build does now, following the user's three-phase lifecycle:

1. **No silent end.**
   - Suppose an exploration round stops short with steps in its Flow. It might have run out of decisions or tool calls,
     stalled on refused completions, or been stopped by the no-progress guard.
   - That Flow then goes to phase 2. It is run from its start with the loop's own dry-run gate, which makes no provider
     call. It is then judged against the instructed-act checklist.
   - Then comes phase 3: a live repair round. The repair is seeded with that Flow and told the judgement, and it works
     with the same checklist. When the model says the Flow is ready, the loop tests it as usual, and an accepted Flow is
     proposed.
   - A repair that stops short is judged again. Another repair follows while each one gets further, up to 2 repairs.
2. **"Not doable" is an explicit ending with a stated reason.**
   - It is reached only when a repair got no further than the judgement before it. "Further" means:
     - more acts or choices done;
     - more steps in the Flow; or
     - fewer steps failing the test.
   - It ends as `flow_bootstrap.not_doable` and carries `diagnostic.ending`, which holds:
     - a message the person reads, with no codes in it;
     - the acts and choices not done, each with the person's quote and the checklist's reason;
     - what was tried: rounds, decisions, steps in the Flow, and what the last test found.
   - The message is shown in the chat in two places:
     - the build's final activity row, `detail.text` in `R/activity/build.ts`;
     - the conversation command's failure summary, in `R/conversations/commands/progress.ts`.
3. **A budget hit is reported as a budget hit, never as "not doable".**
   - It ends as `flow_bootstrap.evidence_budget_exhausted`, and it is retryable.
   - Its `ending.bound` is one of `cost`, `tokens`, `duration`, `calls` or `repair_rounds`.
   - The message names the budget, for example "its spending limit of $0.25".
   - A repair gets only what earlier rounds left of the build's cost, tokens and time, and of any call count the Flow's
     settings declared. The $0.25 per-build ceiling therefore holds across every round.
   - The decision backstop of 64 is not a budget. Each round meets it on its own.
4. **The checklist the model sees now lists each act's choices** (quantity, size, colour, version) under `choices`. Each is
   marked `done` (the step that makes it) or `todo` (why nothing does), by the completion check's own rule.
   - A step can now claim a choice with `act: "a2.quantity"`.
5. **The "Create a deterministic Start to End Flow" misreading is fixed in the reader, not the fixtures.**
   - `create` followed by the automation's own name within 7 words is no act. The names are Flow, Subflow, automation and
     workflow.
   - "Create a collection in my saved posts" is still an act.

Kept as required: the $0.25 ceiling (it now spans all rounds); money, delete and send/publish always asking (permission and
person-needed endings pass through the coordinator untouched); no LLM call grants. No page-capture or evidence code was
touched.

The supervisor asked for one more change mid-task, and it is done. `R/llm/evidence-loop/` had 26 source files, over the
25-file limit, and failed `pnpm check`. It now has 19. The progress group moved to a new sibling directory,
`R/llm/evidence-progress/`, which has its own barrel:
- `progress.ts`, `progress-trace.ts`, `no-progress.ts` and `authored-progress.ts`;
- plus `stall-redirect.ts` and `decision-dump.ts`, which the moved files depend on.

`evidence-loop/index.ts` still re-exports everything, so no consumer's import path changed. A subdirectory under
`evidence-loop/` was tried first and refused by the 9-segment depth rule.

## What changed and why

**New directory `R/flow-bootstrap/unfinished-build/`**
- `phases.ts` is the coordinator, `runAutomationStudioFlowBootstrapBuildPhases`. It runs the rounds, catches only its own
  stall marker, sums spending across rounds, and decides between repair, not doable and budget.
- `round-ending.ts` classifies a round's loop result:
  - `iteration_limit` with bound `iterations` or `tool_calls`, a budget bound of `iterations`, `repeat_without_progress`,
    or a stall means unfinished;
  - a budget bound of `cost`, `tokens` or `duration` means a budget hit.
- `unfinished-stall.ts` is the marker the loop's `stalled` hook now returns in place of the old failure, so the draft
  survives.
- `judgement.ts` builds the repair seed, runs the test, reads the checklist verdict, builds the entry value the repair is
  shown, and applies the "advanced" rule.
- `not-doable.ts`, `budget-exhausted.ts` and `not-done.ts` write the endings and their plain-English messages.
- `contracts.ts` and `index.ts` hold the types and the barrel.
- An exploration that stops with nothing in its Flow keeps its old ending (`evidence_unusable_decision` or
  `evidence_iteration_limit`), because there is nothing to test, judge or repair. This follows the brief's "with a draft
  that covers some acts" (see Open questions).

**Failure taxonomy (`R/flow-bootstrap/generation-failure/`)**
- There are two new codes in `codes.ts`.
- The new `build-ending.ts` holds the ending type and a parse that the producer and reader share.
- The `ending` field is added to the diagnostic and to its parser. It is required exactly beside its two codes, which
  `failure-state.ts` enforces as `ending: required`.
- `phase-failure.ts` gives way for those two codes, as it already does for `permission_required`.
- The new `flowBootstrapBuildEndingFailure` in `evidence-failure.ts` builds the error. It carries the exhaustion record
  when a round ran out of an allowance.

**Wiring**
- `R/service.ts`: the loop call becomes a `round` callback, and the coordinator gets these callbacks:
  - `test`: the dry-run gate;
  - `checklist`;
  - `keep`: `keeper.unfinished`;
  - `announce`: chat rows "Testing the Flow so far" and "Repairing the Flow".

  The final accounting sums every round. The net file size is under the ratchet (4,558).
- `R/llm/loop-configuration.ts` and `R/llm/evidence-loop.ts`: the `stalled` hook now receives the draft steps.
- `R/llm/evidence-loop/resume.ts`:
  - it has a repair variant: code `llm_evidence_loop.repair`, the `judgement`, and a repair instruction;
  - `stopped` now also accepts `repeat_without_progress`.
- `R/loop-limits/flow-bootstrap-evidence-loop.ts`: publishes `declaredCalls`.
- `R/flow-bootstrap/incomplete-draft/keeper.ts`: new `unfinished()` and `stalledEnding()` methods.
- `R/flow-bootstrap/incomplete-draft/parse.ts`: accepts choice ids and the new stop.

**Checklist and act ids**
- `R/flow-bootstrap/instructed-acts/checklist.ts` now lists `choices` for each act, and `NotDone` now includes choice ids.
- The act-id pattern now accepts `a2.quantity` in these places:
  - `R/flow-draft/amendment.ts` (the constant and the amendment schema);
  - `R/llm/evidence-loop-decision.ts` (the call schema);
  - `R/llm/evidence-progress/stall-redirect.ts`.
- `R/flow-bootstrap/instructed-acts/instruction-acts.ts`: the automation-itself exclusion for `create`.

**Tests**
- New:
  - `unfinished-build/tests/phases.test.ts` (9 cases);
  - `generation-failure/tests/build-ending.test.ts` (4 cases);
  - `tests/service-bootstrap/tests/unfinished-build.test.ts`, which goes end to end through the service. One case shows a
    stall that is repaired and then proposed; the other shows a repair that gets no further ending `not_doable` with its
    message.
- Added cases:
  - `checklist.test.ts`: choices done and todo, agreeing with the check;
  - `instruction-acts.test.ts`: the create fix;
  - `resume.test.ts`: the repair entry;
  - `activity/tests/scope.test.ts`: the ending message in the chat row.
- Updated for the intended behaviour change:
  - `cost-ceiling.test.ts` now expects `evidence_budget_exhausted` with bound `cost` and its message, and still expects the
    exhaustion record;
  - `incomplete-draft.test.ts`: a Flow that declared 4 calls and used them all is now a budget hit on `calls`, with its
    draft still kept and continued.
- `round-trip.test.ts` leaves the two ending codes out of its phase-failure sweep, as it already does for
  `permission_required`.

## Commands run and observed results

- `bash .../heavy.sh "t208 core tsc" npx tsc --noEmit -p tsconfig.json`, run from `packages/fluxiq`: exit 0, no output.
  This was the final run, after all changes.
- `node scripts/structure-audit.mjs`, run from the Core root: `structure-audit: passed (202 warning(s), 354 baselined).`
  - Before my changes, dev failed the audit with `llm/evidence-loop/: 26 source files exceeds the 25-file limit`.
  - The audit still prints "1 baseline entries can be lowered". That line was printed before my change too, and I did not
    run `pnpm structure:baseline`.
- `npx vitest run` from `packages/fluxiq`, with `--maxWorkers=2 --minWorkers=1`, over R/llm, R/flow-bootstrap,
  R/recovery, R/result-verification, R/tests/service-bootstrap, R/activity, R/conversations and R/loop-limits:
  - Before the regroup: `Test Files 216 passed (216)`, `Tests 2477 passed (2477)`.
  - After the regroup: `Tests 1 failed | 2476 passed (2477)`. The failure was
    `adaptation.test.ts > bridges a generated proposal ID ...` with "Test timed out in 15000ms". See Not verified.
- `npx vitest run .../unfinished-build.test.ts` (the new service test, written after the full runs): `Tests 2 passed (2)`.
- `npx vitest run .../adaptation.test.ts -t "bridges a generated" --testTimeout=90000`: passed in 19,694 ms.

## Not verified

- **`adaptation.test.ts > bridges a generated proposal ID ...` misses its 15 s timeout on this tree.**
  - It took 13.2 s and passed in the first full run.
  - It then took 15.1 s, three times.
  - With a 90 s timeout it passes in 19.7 s, with every assertion holding.
  - It does not build with `evidenceGuided`, so it runs the single-call build path. None of this change touches that path,
    and the regroup that preceded the failures moved files only.
  - Core dev has since merged t206, "tests stop depending on machine timing; project lookups make fewer round trips"
    (`9d9f1df8`), which this branch does not have.
  - Suggested check: merge dev into the branch and re-run this file. t206's only edit to a file I also edited
    (`incomplete-draft.test.ts`) is in a different hunk.
- No live, Lab or browser run. The behaviour against a real model is therefore unproven. The main risk is whether a
  real model makes use of the repair's judgement entry.
- There is no end-to-end browser test of the chat rows. The activity row and the conversation cause are covered by unit
  tests only.
- The whole Core test suite (`pnpm test`) and `pnpm check` were not run; only the brief's suites plus the ones I touched.
- I did not look for Core architecture docs describing the build's ending taxonomy. None were updated.

## Open questions or contradictions found

1. **When is "no route left"?** I end "not doable" after the first repair that gets no further. The rule counts acts or
   choices done, steps in the Flow, or fewer failing steps. The user's "only if absolutely no way" might argue for two
   such repairs.
   - `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_REPAIR_ROUNDS = 2` caps repairs that are still getting further. Reaching the
     cap is reported as a budget (`repair_rounds`), not as "not doable".
2. **An exploration that stops with nothing in its Flow keeps its old ending.** This follows the brief's "with a draft that
   covers some acts".
   - I entered repair for any draft with at least one step in the Flow, even when that step does no act yet. This is
     broader than the brief's wording.
   - The supervisor may want even an empty draft to get one repair.
3. **Time reserve.** Exploration may still use the whole 540 s deadline, and a repair then starts only with 30 s or more
   left; otherwise the ending is a budget hit on `duration`.
   - Reserving part of the deadline for phases 2 and 3 would make repair reachable more often. Doing so would change phase
     1 behaviour, so I did not do it.
4. **Evidence trace.** A build that finishes in a repair stores only the final round's trace as the adaptation's
   `evidenceTrace`. The diagnostic counts on an ending are also the last round's. Accounting, which covers money and
   tokens, is summed across rounds.
   - Lab tooling that reads `flow-lane.json` will see only the repair round's rows.
5. **Staged renames.** The regroup used `git mv`, so those renames are staged in the Core index. Everything else is
   unstaged.
6. **Downstream.** Downstream never keys on the old ending codes; they appear there in comments only. The Lab's verdicts
   (`flowCreated`) treat the two new endings as failures without changes. Showing `ending.message` in the Lab report
   would be a follow-up.

## Ready to commit

Ready to commit (Core tree `fxwork/t208/!FluxIQ`):

- modified:
  - `R/activity/build.ts`
  - `R/activity/tests/scope.test.ts`
  - `R/conversations/commands/progress.ts`
  - `R/flow-bootstrap/generation-failure/codes.ts`, `diagnostic-parse.ts`, `diagnostic.ts`, `evidence-failure.ts`,
    `failure-state.ts`, `index.ts`, `phase-failure.ts`
  - `R/flow-bootstrap/generation-failure/tests/round-trip.test.ts`
  - `R/flow-bootstrap/incomplete-draft/keeper.ts`, `parse.ts`
  - `R/flow-bootstrap/index.ts`
  - `R/flow-bootstrap/instructed-acts/checklist.ts`, `instruction-acts.ts`
  - `R/flow-bootstrap/instructed-acts/tests/checklist.test.ts`, `instruction-acts.test.ts`
  - `R/flow-draft/amendment.ts`
  - `R/llm/decision-handlers/amendment.ts`, `types.ts` (comments only)
  - `R/llm/evidence-loop-decision.ts`
  - `R/llm/evidence-loop.ts`
  - `R/llm/evidence-loop/index.ts`, `resume.ts`, `trace.ts`
  - `R/llm/evidence-loop/tests/authored-draft.test.ts`, `resume.test.ts`
  - `R/llm/loop-configuration.ts`
  - `R/loop-limits/flow-bootstrap-evidence-loop.ts`
  - `R/service.ts`
  - `R/tests/service-bootstrap/tests/cost-ceiling.test.ts`, `incomplete-draft.test.ts`
- moved from `R/llm/evidence-loop/` to `R/llm/evidence-progress/` (staged renames):
  - `authored-progress.ts`, `decision-dump.ts`, `no-progress.ts`, `progress-trace.ts`, `progress.ts`, `stall-redirect.ts`
  - `tests/decision-dump.test.ts`, `tests/no-progress.test.ts`, `tests/progress-trace.test.ts`
- new:
  - `R/llm/evidence-progress/index.ts`
  - `R/flow-bootstrap/generation-failure/build-ending.ts`
  - `R/flow-bootstrap/generation-failure/tests/build-ending.test.ts`
  - `R/flow-bootstrap/unfinished-build/`, the whole directory:
    - source: `budget-exhausted.ts`, `contracts.ts`, `index.ts`, `judgement.ts`, `not-doable.ts`, `not-done.ts`,
      `phases.ts`, `round-ending.ts`, `unfinished-stall.ts`
    - tests: `tests/phases.test.ts`
  - `R/tests/service-bootstrap/tests/unfinished-build.test.ts`

Downstream tree `fxwork/t208/!FluxIQWebExtension`: this report only.

Validation:
- `npx tsc --noEmit -p tsconfig.json` -> exit 0, no output.
- `node scripts/structure-audit.mjs` -> `passed (202 warning(s), 354 baselined)`.
- `npx vitest run <llm, flow-bootstrap, recovery, result-verification, service-bootstrap, activity, conversations,
  loop-limits> --maxWorkers=2 --minWorkers=1` -> 2476/2477 passed. The one failure is the `adaptation.test.ts`
  15 s timeout on the untouched single-call path, which passes in 19.7 s with a longer timeout.
- The new `unfinished-build.test.ts` -> 2/2 passed.
