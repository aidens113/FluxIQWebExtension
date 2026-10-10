# t420: trial feedback for a control that is still on the page

Worker report. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t420/!FluxIQ`, branch `task/t420-trial-feedback-stale-address`. Nothing
was committed. The downstream tree is unchanged apart from this report.

## Outcome

Done.

When a trial step fails with `target_not_found` and the domain's measurement shows its control is still on the page, the
feedback now says so plainly. It also says the script does not need to change, and it marks the step retryable. The trial
gate's instruction then names the step and says to test the same revision again. That re-test carries `retry_allowed`,
so the repeat guard does not refuse it.

If the same step fails the same way again, the existing same-failure rule closes the revision. The instruction then names
the step and gives one other way for it to find its control. A target that is genuinely absent keeps today's feedback.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- **`service/candidate-trial/target-on-page.ts`** (new, exported through the barrel `index.ts`): this module decides
  whether a failed step's control is still on the page.
  - It applies only to a failed attempt whose failure category is `target_not_found`, which includes
    `executor.ready_state.not_shown`.
  - It reads the domain's `resolution` (`candidateCount`, `bestScore`, `runnerUpScore`) from
    `outputs.result.result.resolution`. That is where the web domain's `webAutomationActionResultPayload` puts it,
    beside `textPresence`, which `check-step.ts` already reads. It uses the final attempt, or the latest earlier
    not-found attempt that has a measurement.
  - The control counts as on the page when all of these hold:
    - at least one same-family control was found;
    - `bestScore` is at least 0.12;
    - `bestScore` leads `runnerUpScore`, when there is one, by at least 0.1.
  - Why 0.12: the extension's scoring notes put controls recovered after their address changed at 0.149 to 0.27, and
    different controls that only resembled the saved one at 0.010 and 0.088. A wrong call costs one bounded re-test.
  - For such a step it replaces `happened` and adds `targetOnPage: true`, an `onPage` sentence, an `advice` sentence and
    `retryable: true`. The `onPage` sentence names the step number, the step's label, the control's words when it has
    any, the count of similar controls, and the best and runner-up scores.
- **`service/candidate-trial/feedback.ts`**: computes the on-page reading for each failed step and adds its fields last.
  It passes `targetOnPage` to the absorbed module.
- **`service/candidate-trial/absorbed.ts`**: takes a new optional input, `targetOnPage`. With it set, the absorbed
  not-found tries say "could not find its control by the address it was saved with, though the control is on the page",
  not "not found on the page". In R4a that phrase was repeated three times.
- **`flow-bootstrap/candidate/trial-gate.ts`**: reads `targetOnPage` on the last failed step of an `execution_failed`
  feedback.
  - First time, while re-tests are left: the instruction says "Step N ("label") could not find its control by the
    address it was saved with, though the control is on the page. Nothing in your script needs to change for this: test
    this same revision again, with the same revision and digest, before looking for the control or acting on it."
  - The completion refusal says the same.
  - The verdict was already transient, so `resultReason: retry_allowed` is unchanged. A test now proves the identical
    re-test reaches the port and is not refused as a repeat.
  - On the same failure twice, these three answers carry the new step-specific instruction in place of the generic one:
    the second trial's answer, the `candidate.trial_same_failure` refusal, and the completion refusal. It tells the model
    to give the step another way to find its control: one fresh look at the page, find the control by its own visible
    words or the words beside it, and put the handle printed for it now in the step.
  - The header documents the change.

## Commands run and observed results

All were run from `C:/Users/osrs_/FluxStuff/fxwork/t420/!FluxIQ`.

- `npx vitest run src/programs/automation-studio/runtime/service/candidate-trial` (in `packages/fluxiq`): 6 files and 62
  tests passed. That includes the new `tests/target-on-page.test.ts` with 10 tests:
  - the R4a rebuild: not-found after 4 attempts, the R4a `expected`/`actual` word for word, and `resolution` with 3
    candidates and best 0.27;
  - the step is retryable even when the domain says it is not;
  - the measurement is read from an earlier try;
  - six genuinely-absent cases keep today's feedback: no measurement, 0 candidates, best 0.05, best -0.4, a tie, and a
    malformed measurement;
  - a step that failed another way is left alone.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/candidate`: 9 files and 76 tests passed,
  including 5 new gate tests:
  - the "test again" instruction, with no `repeat_refused` on the same page and the re-test reaching the port
    (`[1, 1]`);
  - the completion refusal says the same;
  - the same failure twice gives the step-specific instruction on the second answer, on `candidate.trial_same_failure`
    and on completion;
  - an absent target keeps the generic instruction;
  - the scenario-word guard: `LAB_TASK_WORDS`, copied from `flow-script-format.test.ts`, does not match the gate's fixed
    wording.
- `npx tsc --noEmit -p tsconfig.json` (in `packages/fluxiq`): exit 0, no output.
- `node scripts/structure-audit.mjs 2>&1 | grep -E "FAIL|structure-audit:"`: printed
  `structure-audit: passed (322 warning(s), 1160 baselined).` None of the warnings name a touched file.

## Not verified

- **The resolution numbers on R4a's real trial.** The trial session's trace is not in the run's files. The fixture's
  `resolution` is rebuilt from the `actual` text: 3 candidates, best 0.27. The runner-up score (0.02 in the fixture) is
  assumed. If the real runner-up was within 0.1 of 0.27, R4a would not have qualified.
- **The `resolution` reaching the attempt.** I traced it through the extension's `actionFailure` and the domain's
  `webAutomationActionResultPayload`, and the `outputs.result.result` placement follows `check-step.ts`'s documented
  path. I did not see it on a live failed attempt.
- **Whether a re-test now passes.** That depends on t419's matcher fix. Without it, a re-test of R4a fails the same way,
  and the second answer gives the alternative.
- **The model's behaviour.** No live or paid run was made.

## Open questions or contradictions found

1. **The handle cannot be named.** The brief's example names the handle ("(t964)"), but Core cannot do that here.
   Validated plan nodes "must name no handle" (`llm/harness-options/plan-parameter-resolution.ts`). The handle-to-node
   mapping lives only in the submission's `handleViews`, which `flow-bootstrap/candidate/authoring-loop.ts` holds, and
   I do not own that file. Naming it would mean passing `handleViews` (node key to handle) into the gate, then matching
   them by the graph nodes' `metadata.bootstrapSymbolicKey`. The feedback names the step by number and its own label
   instead.
2. **The brief's alternatives cannot be written for a step.** The format guidance allows a step target only as a handle
   the evidence printed ("never invent one, describe one"). `at "<locator>"` is page-fact syntax only
   (`script-statements/fact-locator.ts`), and the domain's plan resolution has no step-target locator. So the
   alternative given is the one a candidate can write: a handle read again from a fresh look, found by the control's
   visible words or the words beside it. I did not verify that a handle read again from a newer view changes the
   resolved target. If it resolves to the same id-based identity, the alternative will not help, and the domain backstop
   from the R4a debug report (`webPlanElementIdentityAcrossViews`) would be needed.
3. **Step numbers do not match the script.** Feedback step numbers count graph nodes, merges included (R4a: step 9 in
   the feedback was script step 7). The quoted label is what ties them together. This is unchanged and was noted in the
   R4a UI review.
