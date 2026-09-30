# t193-wL: re-author a failed step the patch ladder could not repair (C2)

Core only, in `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ` (branch `task/t193-live-self-repair`). Nothing is committed.

Paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done.

A run that failed at a target-level step is now re-authored in extend mode when the ladder executed nothing and stopped for no permission or cost reason. The re-author is approved and applied, the Flow is re-run from the start, and the re-run is verified like any other run.

The new tests fail on the old code and pass on the new. The named suites, tsc and the structure audit pass.

## What changed and why

### Where the ladder's outcome was final

1. The service runs the ladder (`annotateAutomationStudioRunDetailWithRecoveryState` then `annotate.ts`). It saves the annotated detail (`service.ts` ~2737/2790) and calls `verifyAutomationStudioRuntimeSessionResult` with the failed session.
2. The verification's first line was `if (input.session.status !== "succeeded") return input.session;` (`result-verification/run-outcome.ts:239`). That is where a failed step's run ended.
3. `rerunAfterRepair` (resume) only runs when a patch receipt asked for a retry. So the 13 runs ended here, with the ladder's record saved and nothing after it.

### Entry point

`run-outcome.ts`: that first line now calls a new private `repairFailedStep(input)`. It does nothing unless the session is `failed` and the new optional port `repairFailedStep` is wired. When both hold, it:

1. reads the saved run detail (the ladder's record);
2. finds the failed trace attempt on `session.trace`;
3. calls the port with the detail, the Flow, the subflow and `ports.deniedEvidenceKeys`;
4. saves the detail it returns (the attempt is recorded before any re-run);
5. if the Flow was changed (`applied`), calls the existing `rerunRepairedFlow` (service: `rerunAfterRepair`, `from: "start"`);
6. recursively verifies the re-run session. A successful re-run is judged, and if refuted, enters the wrong-answer repair with the same purse. A failed re-run comes back to this hook and is refused as `already_reauthored`, so the failed run is handed back.

Port absent, or no route: the session is returned unchanged and nothing is written.

### Conditions (`recovery/refuted-result/step-failure-decision.ts`)

All are read off the run record; no model is asked. They are checked in order, each with a refusal code:

1. `run_not_failed`: `summary.status` must be `failed`.
2. `no_failed_step`: the last failed or unknown action attempt must have a failure record that parses.
3. `not_target_level`: its category must be `target_not_found` or `target_ambiguous`.
   - These are the two categories Core's taxonomy decides at `target_resolution` (the contract refuses them at any other stage).
   - Each says the recorded control is not on the surface as recorded, which is what a redesign looks like.
   - Excluded:
     - `page_changed`: a resolve/act race the ladder retries; not a redesign.
     - auth, person, side-effect and policy categories: a person or policy must act.
     - timeout, navigation, output, state, `action_failed`, unknown: the control was found, so re-finding it answers nothing.
     - router/graph-invalid: the build's own validation.
   - The reasoning is in the file's doc comment.
4. `ladder_not_run`: `llmGate.invoked === true`. This excludes a training-mode or budget gate, a deterministic-first stop, a provider that did not resolve, and a purse-spent ladder.
5. `ladder_patch_executed`: refused if any `runtimePatchAttempts` entry has `executed: true` or an `adaptationId`, or if `adaptiveRetry.attempted`.
6. `permission_required`: refused on any of:
   - `metadata.permissionRequest`;
   - `llmGate.patchSkippedCode` or `patchHeldCode` equal to `llm.runtime_patch_permission_required`;
   - the model's no-repair reason `person_required` or `control_refused`.
   - Robot checks and person-needed failures are also excluded by category (`user_intervention_required`, `auth_required`).
7. `cost_bound`: refused on any of:
   - `llmGate.bound === "cost"`;
   - any `llm_budget.*` code on the gate's `code`, its `diagnostics`, the skip code, or the resolution's failure code;
   - an exploration whose outcome was `budget_exhausted`.
8. `already_reauthored`: an earlier attempt on the `resultReauthor` marker has `brief.trigger === "failed_step"`. This allows one failed-step re-author per run.
9. `flow_unavailable`: the project id and Flow id must be in hand.

A routed decision carries a codes-only record, which is kept on the attempt's `brief`:

- `trigger: "failed_step"`, `nodeId`, `definitionId`, `failureCategory`, `failureCode`;
- `ladder: { skipCode?, skipRung?, failureCode?, targetRefusals?, patchesRefused?, declined? }`.

It covers all 13 C2 shapes: `goal_unachievable`, `asked_for_none`, a refused override (`target_unanchored`/`target_indistinguishable`), and an invalid patch (`patch_failed`).

### Brief (`recovery/refuted-result/step-failure-brief.ts`)

The instruction is `core.step_failure_repair.brief`, tagged `generation`/`error`, at minimum priority, never stored, and capped at 6,000 characters. Its content comes from `buildAutomationStudioRuntimeRecoveryContext` over the run record. That is the same screen the recovery's own model context passes, so locator-shaped text is removed and parameters are screened against the domain's denied keys (withheld whole when none were declared). The body:

> This build repairs a Flow that failed at a step. The Flow you start from (your draft) is the Flow that ran. The site it acts on has changed since the Flow was built: step `<node>` could not find what it acts on, and the run's own recovery could not re-point it (`<ladder codes>`).
>
> The failed step, as the run recorded it:
> - Step: `<node>` (`<definitionId>`), labelled "`<label>`"
> - Failure: `<category>` (`<code>`)
> - Expected / Actual: the failure record's short text, screened
> - What the step was authored to act on and with (screened): `<parameters>`
> - Parameters withheld from this brief: `<list>`, if any
> - How its target resolved: `<failed_target scores and signals>`
> - What it was expected to produce: `<expected route, status, output ids>`
>
> What to do:
> 1. Re-find the step on the site as it is now. It may carry a different name, or sit behind something to open first; if so, add the step that opens it.
> 2. Check every later step that depends on this one (reads what it produced, or acts on what it opened) and re-find it where it no longer matches.
> 3. Keep every other step exactly as it is.
> 4. The re-found step must still do what the request asked; if nothing does, say so in the completion summary.

### Purse

- Opened with `automationStudioResultRepairPurse(detail, flow.maxEstimatedCostUsdPerRun)`, which is $0.25, lowered by the Flow's own setting.
- Charged what the ladder's gate record reports: `llmGate.costAccounting.estimatedCostUsd` and its `calls`.
- The build is handed `limit - spent` and is then charged what it reports. The purse is written on the run's `resultReauthor.purse`, so a later wrong-answer repair of the re-run spends from the same total.
- Nothing left, or less than one more call at the average so far: no build starts and no model is asked. The attempt is recorded with code `llm_budget.run_cost_limit`, `providerInvocation: not_attempted`, and `purse.refusedParts: ["reauthor"]`, `bound: "cost"`.

### Approve, apply, retry

This is the same path the refuted route uses. The build, approve/apply as `runtime.result_repair`, reading a failure, retrying once on a retryable failure, and charging the purse were extracted unchanged from `refuted-result-port.ts` into `service/runtime-adaptation/reauthor-build.ts` (`automationStudioReauthorBuild`). Both ports call it, so they cannot drift.

A build that builds nothing ends as today: the failed run stands, and the attempt (code, stage, accounting, brief record) is on `resultReauthor.attempts`. There is no fallback to the ladder, because the ladder already ran.

### Files

New:
- `recovery/refuted-result/step-failure-decision.ts`: the decision, the refusal and decision types, and the `AutomationStudioFailedStepRepairPort` type.
- `recovery/refuted-result/step-failure-brief.ts`: `automationStudioStepFailureReauthorBrief`.
- `service/runtime-adaptation/reauthor-build.ts`: the shared build, retry and purse helper, plus its deps type.
- `service/runtime-adaptation/step-failure-port.ts`: `automationStudioStepFailureRepairPort`.
- `service/runtime-adaptation/result-repair-ports.ts`: `automationStudioResultRepairPorts(deps)` returns `{ repairRefutedResult, repairFailedStep }`, so the service wires both in one expression.

Changed:
- `recovery/refuted-result/index.ts` and `service/runtime-adaptation/index.ts`: barrels.
- `service/runtime-adaptation/refuted-result-port.ts`: now uses `automationStudioReauthorBuild`, with behaviour unchanged. Its deps type is `AutomationStudioReauthorBuildDependencies & {...}` with the same fields.
- `result-verification/run-outcome.ts`: the `repairFailedStep` port field, the hook, and a header note (677 to 725 lines).
- `service.ts`: line-neutral, 2 lines changed, same line count.
  - Line 275: the import `automationStudioRefutedResultRepairPort` became `automationStudioResultRepairPorts`.
  - Line 2597: `repairRefutedResult: automationStudioRefutedResultRepairPort({...})` became `...automationStudioResultRepairPorts({...})`, with the same deps object.

Tests:
- `service/runtime-adaptation/tests/step-failure-port.test.ts`: 12 tests.
- `tests/refuted-result/tests/failed-step-reauthor.test.ts`: 5 tests, through the verification with the real port.

None of the must-not-touch files were edited: `brief.ts`, `history.ts`, `repair-rerun.ts`, `executor/recovery-budget.ts`, `llm/diagnosis-instructions.ts`, `recovery/annotation/**`, `recovery/plan.ts`.

## Tests, and fail-before / pass-after

The brief's cases map to the tests as follows.

| Brief case | Test(s) |
| --- | --- |
| (1) `goal_unachievable`: generate once in extend mode, brief names the node, approve and apply, re-run | Port: "is re-authored in extend mode when the model said the goal was gone". Integration: "is re-authored in extend mode, approved, applied, re-run, and the re-run judged" (re-run judged `confirmed`) |
| (2) override refused | Port: `target_unanchored`. Integration: `target_indistinguishable` |
| (3) ladder patch executed: no generate | Port and integration |
| (4) permission stop / cost bound: no generate | Port: `permissionRequest`, `permission_required` skip code, `person_required`; `llm_budget.run_cost_limit` diagnostic, `bound: cost` |
| (5) purse | Port: $0.20 spent in 10 calls hands $0.05; the Flow limit $0.10 less $0.04 hands $0.06; $0.25 spent means no generate and the cost bound is named. Integration: a spent ladder is recorded `llm_budget.run_cost_limit`, not re-run |

Also covered:
- every refusal code;
- one re-author per run;
- a build that builds nothing ends failed with the attempt recorded;
- the brief carries the screened target ("Write something...") and no `data-testid`.

Fail-before:

- **Integration file, run with the new modules present but `run-outcome.ts` not yet changed:** 4 of 5 failed.
  - The failures: `expected "spy" to be called 1 times, but got 0 times` (x3), and `expected undefined to match object { code: 'llm_budget.run_cost_limit' }`.
  - The one pass is "leaves a run whose ladder patch executed exactly as it was", which the old code also satisfies.
- **Port file:** on the old code it cannot load, because `step-failure-port.ts` and the decision and brief modules did not exist. I did not run it against a tree without them.
  - In the same pre-hook run, 11 of 12 passed. One failed on a wrong expected failure code in my test, which I corrected.

Pass-after: both files 17/17, and `refuted-result-port.test.ts` 13/13 (30/30 together).

## Commands run and observed results

All from `packages/fluxiq` unless noted.

| Command | Result |
| --- | --- |
| `npx vitest run` on the 2 new files, before the run-outcome hook | `Test Files 2 failed (2)`, `Tests 5 failed, 12 passed (17)` |
| `npx vitest run` on the 2 new files plus `refuted-result-port.test.ts`, after the hook | `Test Files 3 passed (3)`, `Tests 30 passed (30)` |
| `bash .../heavy.sh "t193 wL vitest" npx vitest run $R/recovery $R/service/runtime-adaptation $R/result-verification $R/tests/refuted-result` | Three runs, below |
| `bash .../heavy.sh "t193 wL tsc" npx tsc --noEmit -p packages/fluxiq` (Core root) | First run: 1 error, in my test (a code literal not in the failure-code union); fixed. Then `tsc exit 0`, twice |
| `bash .../heavy.sh "t193 wL structure" node scripts/structure-audit.mjs` (Core root) | First run: 1 FAIL `[imports]`, because my integration test imported `result-verification/run-outcome.ts` directly; changed to the barrel. Then `structure-audit: passed (199 warning(s), 354 baselined)`, exit 0 |

The three runs of the named vitest suites:

1. **First run:** 4 failed of 694, in `recovery/tests/plan.test.ts` (2) and `recovery/annotation/tests/ladder-fixes.test.ts` (2).
   - These are the other t193 worker's in-progress plan/annotate files (modified or untracked in the tree).
   - None imports my files.
2. **Second run:** 1 failed of 694: `tests/refuted-result/tests/reauthor-service.test.ts` > "reaches the re-author and applies its edit on a diagnosis_only run, with no grant". Its error was not captured.
   - Run alone, the file passed 7/7, each test taking 18 to 42 s.
3. **Third run, output captured:** `Test Files 57 passed (57)`, `Tests 694 passed (694)`.

The audit also printed "1 baseline entries can be lowered". I did not run `pnpm structure:baseline`, because `.structure-baseline.json` is shared.

## Not verified

- **The full-service path.** No `AutomationStudioService` test drives a real failed step through the ladder to this hook. The wiring is type-checked and line-neutral but not executed end to end.
- **Live behaviour.** No Lab run. Whether the extend build actually re-finds "Create post" or "More actions > Save" on the redesigned sites is untested.
- **How the re-run's result check is decided.**
  - The service upgrades `runResultCheck` to a "repaired" check only on its own resume-retry path (`automationStudioRepairedRunResultCheck`).
  - This route re-runs through `rerunRepairedFlow` and keeps the run's original check decision, as the wrong-answer route does.
  - So if the schedule passed this run over, a successful re-run is recorded `unverified` rather than judged. Changing that needs service lines.
- **The cause of the one intermittent `reauthor-service.test.ts` failure.** It passed in the first and third suite runs and alone. It is probably its 20 to 40 s service tests under a loaded parallel run, but that is not confirmed.

## Open questions or contradictions found

1. **Cost-bound scope.** I read "never re-author for a cost/budget bound" to include an exploration that ended `budget_exhausted`: wall clock, action limit or provider-call limit, not only money. That is conservative; narrow it to `llm_budget.*` only if the supervisor prefers.
2. **Marker reuse.** Failed-step attempts are recorded on the existing `resultReauthor` marker, distinguished by `brief.trigger: "failed_step"`, so the purse and the Lab's `harness-recovery.ts` reader see both routes.
   - The top-level fields (`routed`, `applied`, `code`) describe the latest attempt, whichever route made it.
   - If the Lab needs to tell the routes apart, it should read `attempts[].brief.trigger`.
3. **The ladder's re-plan and patch codes are changing now** (the other t193 worker owns `plan.ts` and `annotate.ts`). The decision deliberately keys on no specific skip code: any ladder that ran and executed nothing qualifies, unless a permission or budget signal is present. New ladder codes therefore need no change here, unless one means "ask the person" or "budget", which should then be added to the refusal checks.
4. **The purse and the ladder.** The ladder itself is still not held to the purse; it keeps its own run-ceiling budget. The purse only charges its spend before the re-author, so a ladder that spent close to the ceiling leaves little or nothing.
