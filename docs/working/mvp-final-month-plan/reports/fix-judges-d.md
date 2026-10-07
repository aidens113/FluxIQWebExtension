# fix-judges-d: the re-author's honest "nothing to change" ending (W17, muw5zv4m cause 2)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t286/!FluxIQ` (branch task/t286-fix-judges). R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

**Partial.** The recovery side is done and tested. The service side (port, build) is done and tested. The brief is done and tested. One piece is not wired: the build's completion check lives in `R/service.ts`, which this brief must not touch. Until the lead applies the patch below, nothing hands the watch to the build, so the ending cannot fire in a real run. Every other path behaves as before.

## What a re-author can end with today (from the code and the run's step folders)

- **The model has one ending of its own: `complete`.** No decision lets the model say "not doable". That ending comes only from the build's own judge (`stillAchievable: "no"`, `flow-bootstrap/unfinished-build/phases.ts:532`). Every other ending is Core's: budget exhausted (rounds, cost, duration, iterations: `flow_bootstrap.evidence_budget_exhausted`), not finished (no progress, repeated unchanged), replies unreadable, provider unavailable, or a person or permission question.
- **A completion whose draft equals the seed is not refused in round 0.** `unfinished-build/unchanged-complete.ts` refuses it only after the build's own judge said `no`. Otherwise the following happens in order:
  1. The service's completion check accepts it (`service.ts:1581`).
  2. The loop's test runs the whole Flow from its start, live (`llm/evidence-loop/completion-attempt.ts`). This makes no provider call, but it replays every carried step.
  3. The build judge is called (provider calls).
  4. On a yes, the build proposes an extend adaptation with the same graph. The re-author approves and holds it (`service/runtime-adaptation/reauthor-build.ts`) and the repair marker goes to `rerunning` (`recovery/refuted-result/repair.ts`).
  5. The run is re-run from the start on the unapplied candidate, and the post-run check judges it again (two judge calls).
  6. A second refutation with the same answer digest tells the next attempt "changed nothing". Two in a row stop the repair as `result_repair.not_converging`.

  So today an unchanged completion is tested and judged, proposed as an empty edit, held, and re-run from the start.
- **What happened in muw5zv4m** (step folders 0092-0224 of `t262-slot-3/run-muw5zv4m-52d83027`, read for decision kinds and codes only):
  - There were 46 decisions: 4 `tool_call`, 41 `amend_draft` and 1 unusable. There was not one `complete`.
  - Rounds 0-4 alternated `draft_rerun` (applied) with `draft_unchanged` (`changes_nothing`, refused).
  - The run ended on budget. The model did what the brief ordered ("Change the Flow so that it does"), and nothing told it a Flow can need no change.
- **The budget:** the re-author's loop is held to what is left of the repair purse (`purse.ts`, at most the $0.10 run ceiling). When the purse runs out, the build fails with `flow_bootstrap.evidence_budget_exhausted`. Because the build explored, the patch ladder is skipped (`ladder-skip.ts`), and the repair settles `not_rerun`.

## What changed and why

The ending reuses an existing decision. A re-author that **completes its seeded draft unchanged** is saying the Flow needs no change, and its completion `summary` is the reason. There is no new tool and no new schema field.

- `R/recovery/refuted-result/nothing-to-change.ts` (new). `automationStudioReauthorEndingWatch()`, the `AutomationStudioReauthorEndingWatch` and `AutomationStudioReauthorNothingToChange` types, and `AUTOMATION_STUDIO_REAUTHOR_NOTHING_TO_CHANGE = "nothing_to_change"`.
  - `completed({ seed, steps, result })` checks whether the completed draft has the seed's Flow signature (`automationStudioFlowDraftFlowSignature`, the rule unchanged-complete already uses). If it does, the watch keeps the reason and answers an error, which the completion check throws.
  - The loop propagates a thrown check as a decision error, and phases rethrows it. So the build stops at that decision: no test, no judge, no further decision.
  - The reason is screened like the check's own reading (`result-verification/repair-directive.ts` `screenedText`). A credential-shaped reason is withheld whole (`reasonWithheld: true`). A locator inside it is rewritten and flagged the same way.
- `R/recovery/refuted-result/reauthor.ts`.
  - `generate()` may answer `{ nothingToChange, accounting? }`. Then nothing is approved, applied or held.
  - `automationStudioRefutedResultReauthored` records `outcome: "nothing_to_change"` with `reason` (or `reasonWithheld`) on `resultReauthor`, both on the latest fields and on the attempt.
  - `automationStudioRefutedResultFlowWasReauthored` stays false, so nothing is re-run. `repair.ts` then settles the repair marker `not_rerun`, unchanged.
- `R/recovery/refuted-result/history.ts`. The entry now carries the run's own record as the check was shown it:
  - `changes`: the per-step `flowShape[].changed`, for steps with a change only.
  - `startView` and `endView`.
  - All of it is already screened by the summary. It stays in memory, and `automationStudioResultRepairHistoryRecord` does not write it, so the answer digest is unchanged.
- `R/recovery/refuted-result/brief.ts`.
  - The opening now reads "Change the Flow so that it does, unless the run's own record shows it already does (see "When the Flow needs no change" below)".
  - A new section, "What the run itself recorded (Core's record of the page, not the check's reading):", lists the start page, each step's changes per run and the end page.
  - A last section, "When the Flow needs no change:", says when to use the ending (the run's record contradicts the check), how to take it (complete the seeded draft unchanged, the summary as the reason naming the steps and their changes), and what Core then does. It also says "This is not a way out of a fix" and that an unchanged completion ends the repair this way.
- `R/recovery/refuted-result/index.ts`: the barrel exports the new module.
- `R/service/runtime-adaptation/reauthor-build.ts` (unowned R/service file, needed for the ending).
  - `deps.generate` takes an optional 5th argument, `ending`.
  - `automationStudioReauthorBuild` takes `nothingToChange?: true` and builds a fresh watch for each build, passed only when set.
  - When the build throws and the watch has spoken, the build answers `{ nothingToChange }` with whatever accounting the caught diagnostic kept, instead of a failure. A purse charge counts it as having reached the provider.
- `R/service/runtime-adaptation/refuted-result-port.ts` (unowned R/service file). The wrong-answer route passes `nothingToChange: true`. No failure follows, so the patch ladder does not run either. The step-failure route passes nothing and is unchanged.

**The verdict stays refuted.** The run's `resultVerification` is untouched, and the reason sits beside it on `resultReauthor`. This is the smaller change:
- The verdict lives in `result-verification/**`, which this brief must not touch, and `run-outcome.ts` is at its 800-line limit.
- The re-author's conclusion is one model reading against the check's. No judged run has settled it, so reading it as passed would let a model overrule the check unseen.
- A "disputed" state would need a new verdict value, new wording and new readers. The record already holds both readings for a person or a later judge.

### service.ts wiring for the lead (not applied; `R/service.ts` is must-not-touch)

It adds no lines; every change is in place on an existing line:

1. Line 89 import from `"./recovery/index.ts"`: add `type AutomationStudioReauthorEndingWatch`.
2. Line 1472, the `generateFlowBootstrapAdaptationInternal` signature: append the parameter `repairEnding?: AutomationStudioReauthorEndingWatch`.
3. Line 1581, inside `checkCompletion`, right after `if (unchanged) { accepted.verdict = undefined; return unchanged; }`, add:
   `const nothing = repairEnding?.completed({ seed: extend?.seed.steps, steps: context.steps, result }); if (nothing) { accepted.verdict = undefined; throw nothing; } // A re-author that completed its seeded draft unchanged: the Flow needs no change; the build ends here, untested (`recovery/refuted-result/nothing-to-change.ts`).`
   It goes after the unchanged refusal on purpose: a Flow the build's own judge said `no` to is still refused, not ended.
4. Line 2548: `generate: (request, brief, costLeftUsd, startPages, ending) => this.generateFlowBootstrapAdaptationInternal(request, brief, costLeftUsd, startPages, ending),`

### Person-facing sentence (for the activity stream; `R/activity/**` not touched)

- **Where:** `R/activity/wording/run-ending.ts`, in `repairEnding`, before the "Not re-run, or never settled" block. The repair marker is `settled`/`not_rerun`, so the case reaches that block.
- **Add:** `if (reauthor?.outcome === "nothing_to_change") return "the fix changed nothing: the run's own record shows it was done";`
- **Full line:** "Run failed: the check found its result doesn't answer what you asked, and the fix changed nothing: the run's own record shows it was done." That is 138 characters, or 152 with a row count, within the 160-character status line.
- **Today it falls through to** "the fix didn't finish", which is false.

## Commands run and observed results

All from `packages/fluxiq`.

**Red, with the watch stubbed off** (`completed` answering nothing), on `recovery/refuted-result/tests/nothing-to-change.test.ts`: 4 failed, 2 passed.
- The loop-level replay failed with "expected Error: stalled to match object { Object (name) }": without the watch, the unchanged completion went on to the loop's test and the round stalled.
- The other 3 failed with "expected undefined to be an instance of Error" or "expected undefined to be true".
- The stub was then restored. `grep -c` found 0 stub lines left.

**Red before implementing**, on `npx vitest run …/brief.test.ts …/reauthor.test.ts …/service/runtime-adaptation/tests/refuted-result-port.test.ts`: "Tests 6 failed | 50 passed (56)". The failures:
- brief: both new cases (expected the body to contain "unless the run's own record shows it…" and "What the run itself recorded (Core's…").
- reauthor: all 3 new cases ("expected "spy" to not be called at all, but actually been called 1 times"; "expected { routed: true, attempt: 1, …(1) } to deeply equal …").
- port: "ends with no second build…" ("expected "spy" to not be called at all").
- The port's real-fix case already passed: the behaviour it guards is unchanged.

**Green:** `npx vitest run src/programs/automation-studio/runtime/recovery/refuted-result/tests …/runtime-adaptation/tests/refuted-result-port.test.ts …/reauthor-build.test.ts …/step-failure-port.test.ts` gave "Test Files 13 passed (13) | Tests 132 passed (132)". That covers the whole `recovery/refuted-result/tests` folder (10 files, the new one included).

**Neighbours:** `npx vitest run …/result-verification/tests/run-outcome-repair.test.ts …/runtime-adaptation/tests/judged-reauthor.test.ts …/runtime/tests/refuted-result/tests/carried-steps-as-saved.test.ts` gave "Test Files 3 passed (3) | Tests 30 passed (30)".

**Typecheck:** `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check-t286d.tsbuildinfo` printed nothing (0 lines), so there are no errors anywhere.

**One existing assertion changed:**
- `brief.test.ts` "sorts after the person's own instruction…" bounded the 3-attempt brief at 6,000 characters. It was about 5,970 before this change, and the new section brought it to 6,893.
- I raised the bound to 7,000 with a comment. The resolution within 4,000 tokens and the no-conflict check are unchanged and pass. The new text avoids "always" and "never" so that the conflict detector stays quiet.

## Not verified

- **The service.ts wiring is not applied, so no real build hands the watch to its completion check.** The end-to-end proof at that seam stands in two halves:
  - the loop-level replay (`runAutomationStudioLlmEvidenceLoop` with a seeded draft, `fullRunRequired`, and a check that asks the watch and throws): it rejects after 1 decision and 1 check, with no tool call beyond the first look;
  - the port test, whose fake build wraps the throw through the real `automationStudioFlowBootstrapGenerationCatch`.
  - Not exercised: the observers in service.ts (`observeAutomationStudioEvidenceLoop`, `automationStudioLlmEvidenceLoopRouteChecked`, `creation.run`, the database hold). By reading, the activity observer and the progress trace re-throw.
- **Spend of a "nothing to change" build is not on the attempt.** The service sets `failureAccounting` only after the loop returns, so the caught diagnostic carries no cost. The attempt has no `accounting`, and the purse counts it under `unreportedParts`. The Lab still counts the calls from the step logs. Carrying the cost needs a service.ts change: end through `callerEnding` with the loop's accounting, as the permission requests do.
- **The chat shows a "Checking the proposed Flow" note that is never closed.** The activity observer emits it before the check runs, and the throw leaves it open. This belongs to the activity stream.
- No Lab, browser or provider calls were made. I did not run `fluxiq:check`, the structure audit or `pnpm build`, as the brief said. The new files follow the one-thing-per-file, barrel and `tests/` rules. The recovery tests folder now holds 10 files.

## Open questions or contradictions found

- **A re-author that reruns carried steps with their own arguments and then completes reads as "nothing to change"**, because the Flow signature is equal. muw5zv4m's last decision was exactly this ("Rerunning the carried steps … then completing"). That is right, since the Flow is the same Flow. But its summary may describe the Flow rather than give a reason. The brief asks for the reason, and Core cannot enforce it.
- **The ending also fires in a repair round whose judge said `unknown`**, or in a round that stopped short. It does not fire after a judge's `no`, because unchanged-complete refuses first. I think that is right, and it is the lead's call.
- **`NOT_RUN_LINES` still says the repair is finished only by a whole-Flow run.** The opening and the new section now name the exception. That sentence is pinned verbatim by `brief-rerun-carried.test.ts`, so I left it as it was.
- **`screenedText` now exists twice**: privately in `result-verification/repair-directive.ts` (must-not-touch) and in `nothing-to-change.ts`. A later change could export one and use it in both places.
