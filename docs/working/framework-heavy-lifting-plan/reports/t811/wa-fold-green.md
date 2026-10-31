# t811 / wa-fold-green (Core): finish and validate the submit/test fold

## Outcome

Partial. Everything in my owned paths now compiles and passes, and the structure audit is clean. One fold-caused failure is left: `project-agents/dispatch/tests/whole-trial-port.test.ts`. It is on my must-not-touch list (`project-agents/**`), so I did not edit it. A proposed patch is below.

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t811/!FluxIQ`. Paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`. Below, SC means `subflow-candidate/`.

## What changed and why

**1. Structure: the new source files sit in a sibling directory, not `SC/submit-then/`.**
- `SC/submit-then/X.ts` would be 10 path segments. The audit's depth limit is 9 (`naming.mjs`, `maxPathSegments`), and that rule does not ratchet, so the directory the brief named cannot pass. W2 hit the same limit with `candidate/test-pair/`.
- I moved the four files to `flow-bootstrap/subflow-submit-then/` instead, with its own `index.ts` barrel. `SC/index.ts` re-exports that barrel, as the brief asked.
- `flow-bootstrap/index.ts` is not changed and must not re-export it. Like SC, it imports values from `llm/` and `activity/`, and that barrel's header explains the cycle this would create.
- Imports go through barrels, so the `imports` rule is not ratcheted:
  - `builder-loop.ts` imports the new modules in one statement from `../subflow-submit-then/index.ts`.
  - `builder-test-call.ts` takes types from `../subflow-candidate/index.ts` and `../../llm/index.ts`. These are `import type`, which is erased, so there is no runtime cycle.
- The three integration tests and `then-fixture.ts` are now in `SC/tests/submit-then/tests/`. They drive `builder-loop.ts`, and this follows SC's existing pattern (`tests/from-step/tests/`, `tests/contradicted/tests/`).
- The one pure unit case of the wrapper moved beside its subject, to `subflow-submit-then/tests/builder-auto-complete.test.ts`.
- Counts now: SC has 24 source files, SC/tests has 25 (Wb had already moved `subflow-trial-gate-latest.test.ts`), and the new directory has 5.

**2. tsc.** The `undefined` versus JsonValue errors in the auto-complete test are fixed with `submitted.revision!` / `submitted.digest!`, the same pattern `builder-trial-view.test.ts` uses. tsc now exits 0 with no output.

**3. Code fixes.**
- `SC/builder-loop.ts`: the auto-complete is not ready while `repair.standing` (see adversarial finding A below).
- `subflow-submit-then/submit-then-words.ts` + `builder-auto-complete.ts`: changed the chat line Core writes when it completes.
  - It is now the constant `completed = { did: "Finished this part of the task", because: "the latest version passed its test, so nothing was left to decide" }`, which gives "Core finished this part of the task because the latest version passed its test, so nothing was left to decide."
  - W1's line was "Core completed this brief with revision 1 of its subflow because its test answered yes for that exact revision...". The activity screening rewrote it to "Core completed this brief with its subflow because its test answered yes for that exact version". The chat never names a brief, a subflow or a revision (`activity/wording/person-words.ts`, the `MACHINERY` list in `ended-reason.ts`).
  - The new line passes `automationStudioActivityReasonText(line, undefined, {decision: true})` unchanged. A test now asserts that.

**4. Tests changed, and why.**
- `SC/tests/builder-ending.test.ts`, changed by design. Since t811, Core completes as soon as a yes stands, so the model's next completion is never asked:
  - "refuses an ending ... and one while a yes stands": the `passed` build no longer expects `subflow.ending_after_yes`. It now asserts that only 2 decisions were asked (`shown` has length 2), that there is no `ending_after_yes`, that `ended` is undefined and that the trial is yes.
  - "is refused naming the one shape ...": the `passing` build no longer looks for the `ending_shape` refusal that names the receipt. It now asserts 2 decisions, no `ending_shape`, and that the loop ended ok.
  - Both refusal texts are still in the code. They can only be reached when a yes is held back, so I moved their exact-text assertions into a new case in `builder-loop-auto-complete.test.ts` (below). They were moved, not dropped.
- `SC/tests/builder-trial-view.test.ts`: it read the test's answer from the evidence of the decision after the test, which a yes no longer reaches. It now reads the answer through `observe`, as the builder hands it to the loop. All four cases keep their assertions unchanged.
- `SC/tests/submit-then/tests/builder-loop-auto-complete.test.ts` (W1's, moved):
  - Fixed the tsc errors and updated the expected chat line.
  - Added "does not complete while a repair stands beside the yes".
  - Added "tells the model the exact receipt when it sends anything else after a yes Core held back for a repair". This covers the `ending_shape` and `ending_after_yes` instructions word for word, and a t601 receipt sent beside an ending, which is accepted.
  - The "last decision" case was failing with `llm_evidence_loop.invalid_configuration`: the fixture gave the guards 3 against `maxIterations` 2.
- `SC/tests/submit-then/tests/then-fixture.ts`:
  - Added an `afterCall(callId, repair)` hook.
  - Holds `maxConsecutive` and `maxInARow` to the iteration cap. Behaviour is unchanged when `iterations` is not given.
- `subflow-submit-then/tests/builder-auto-complete.test.ts` (new):
  - W1's unit case, plus an assertion that the line survives screening.
  - A new case: no receipt means the model is asked, and each new revision gets its own single Core decision.
- `submit-tests-on-accept.test.ts` and `submit-then-sequence.test.ts`: only the paths changed.

**5. `submit-then-sequence` `from: "second"`.** It passes now. Wb's label store had landed by run 1, and the whole file was 3 of 3 in runs 1, 2 and 3.

## Adversarial reading of the decide wrapper

A. **Never while a repair stands: this was not guaranteed, and is fixed.**
- `gate.completion` (`subflow-trial-gate.ts` around line 631) returns `ok` on a yes before it checks the repair. So W1's `ready = passed() && gate.completion(...).ok` would complete while a repair stands, if a yes and a repair ever stood together.
- Inside one gate they cannot: a whole test's yes clears the repair (`pending-repair.afterWholeTest`).
- But the repair memory crosses briefs (`pendingRepair`, dispatch `REPAIRS`). So `ready()` now also requires `!repair.standing`, and a test covers it by injecting a repair through the shared memory.
- Note for Wb or the lead: the gate itself still accepts the model's own receipt in that state (yes first). I did not touch `subflow-trial-gate.ts`.

B. **No completion loop on a refused Core completion: holds.** The `made` set is keyed by revision and digest, so a refusal hands the next decision to the model (unit test). `ready()` uses the same `gate.completion` that `receiptCheck` uses, so a refusal can only come from loop-level checks. A new revision gets one new attempt.

C. **Never on a from-step answer: holds.** A from-step run records no verdict, and a folded `then:{from}` makes a new latest revision with no verdict, so `passed()` is undefined.
- A yes standing from an earlier step completes before any later from-step call, on the next decision that offers completion.
- That completion rests on the standing yes, never on the from-step answer.

D. **Never on an unconfirmed yes: holds.** `passed()` needs `verdict === "yes" && entryPrepared`.
- An unconfirmed yes is `not_judged` and a rows-held yes is `unsure`. Both are tested, and in both the model decides.

E. **The chat line is present: yes, now in person words (fix 3).**
- The observer's `decide` wrapper (`activity/observer.ts` around line 317) reads `DecisionReason.of(decision)`.
- `wording/decision.ts` maps `complete` to the verifying phase, so `narration.decided` says the line.
- I did not run the real observer end to end. The coverage is the screening assertion plus `person-facing-sweep.test.ts` (7 of 7 passed).

F. **Open (llm/**, not mine), as W1 reported:**
- The loop returns `exhausted("budget")` before `decide` when `decisionsLeft === 0` on tokens or duration, or at the `maxIterations` cap.
- A yes earned on the last decision therefore ends the brief without Core's completion. The yes still stands in `outcome.trial`.

## Commands run and observed results

All three commands ran inside `heavy-check.lock`. I first waited from 02:18 to 03:02 behind other lanes.

**Run 1** (03:02:17 to 03:05:21):
- `tsc --noEmit -p .` -> `tsc exit 0`, no diagnostics.
- vitest over SC, `subflow-submit-then`, dispatch, single-subflow, service/project-build, `llm/tests/loop-budget.test.ts` and `activity/tests/person-facing-sweep.test.ts` -> `Test Files 3 failed | 93 passed (96); Tests 5 failed | 555 passed (560)`. The failures were:
  - the chat line, twice;
  - the fixture's configuration;
  - the held-back case reading the wrong evidence;
  - `whole-trial-port`.
- `structure-audit` -> 2 violations, both in Wb's `flow-bootstrap/step-label/{keys,resolve}.ts` (`imports`, `../subflow-candidate/contracts.ts`). None was in my paths, and there was no `directory-files` violation.

**Run 2** (03:13:42 to 03:16:15):
- `tsc exit 0`.
- vitest -> `Test Files 2 failed | 94 passed (96); Tests 2 failed | 558 passed (560)`. The failures were `whole-trial-port`, and the fixture's `maxInARow` 3 against `maxIterations` 2.
- `structure-audit` -> `audit exit 0`.
- These passed: `builder-ending.test.ts` (15 tests), `builder-trial-view.test.ts` (4), `loop-budget.test.ts` (34), `person-facing-sweep.test.ts` (7), `submit-then-sequence.test.ts` (3), `submit-tests-on-accept.test.ts` (6) and `builder-auto-complete.test.ts` (2).

**Run 3** (03:19:22 to 03:20:41), after the fixture fix:
- `tsc exit 0`.
- `vitest run .../subflow-candidate/tests/submit-then .../subflow-submit-then` -> `Test Files 4 passed (4); Tests 17 passed (17)`.

## Not verified

- I did not re-run the full brief set after the last fixture-only change. Run 3 covered only the t811 test directories, and that change touches only `then-fixture.ts`.
- I did not run the real activity observer end to end on a Core-made completion.
- `whole-trial-port.test.ts` still fails (see below).

## Open questions or contradictions found

1. **The brief's `SC/submit-then/` directory is impossible under the 9-segment depth rule.** I used the sibling `flow-bootstrap/subflow-submit-then/`, which is outside the owned paths the brief listed. The lead should confirm the placement.
2. **`project-agents/dispatch/tests/whole-trial-port.test.ts` needs an edit, and I am not allowed to make it.**
   - The case "answers a build brief's test in place of its subflow trial port..." pushes `seen.tested` in its third scripted decision. A yes now completes through Core, so that decision is never asked and `seen.tested[0]` is undefined.
   - Proposed fix: capture the answer as `builder-trial-view.test.ts` now does, and drop the push in step 3. Its yes branch is unreachable now. Its blocked branch still runs in the repair case.

     ```ts
     build.dispatcherInput.runBuilder = (input) => runAutomationStudioSubflowBuilderLoop({ ...input, observe: (loop) => {
       const inner = input.observe ? input.observe(loop) : loop;
       return { ...inner, executeTool: async (call) => { const answered = await inner.executeTool(call);
         if (call.toolId === AUTOMATION_STUDIO_SUBFLOW_TEST_TOOL_ID) seen.tested.push((answered as { evidence?: JsonObject }).evidence ?? {}); return answered; } };
     } });
     ```
3. `subflow-trial-gate.ts` `completion()` takes a yes before a standing repair (finding A). Wb or the lead should decide whether that order is intended.
4. The `decisionsLeft === 0` budget gap is in `llm/**` (finding F).
