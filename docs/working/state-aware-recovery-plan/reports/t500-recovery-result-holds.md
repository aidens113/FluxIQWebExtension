# t500 recovery-result-holds: worker report

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t500/!FluxIQ` (branch `task/t500-recovery-result-holds`). Nothing committed.

## Outcome

**Partial.**

- **Done:** Goal 3's brief (F3), as far as the run record allows, and goal 4's stall ending (F4).
- **Blocked:** Goal 1 (F2, take the success edge) and the mechanical "never reverse a lasting act" refusal (part of goal 3). Both need files outside the owned set. As the brief says to, I stopped there. The exact files are listed below.
- **Contradiction:** the B round-16 shape cannot take the success edge on Core's own evidence as it stands. See the open questions.

## What changed and why

### 1. `runtime/recovery/refuted-result/step-failure-brief.ts` (F3, goal 4)

The failed-step brief now carries two things the run already recorded, and offers two new outcomes.

**What it carries:**

- **The diagnosis's verdicts**, from `llmGate.structuredDiagnosis`: stillAchievable, deterministicRecoveryPossible and patchNeeded. Example: "The run's diagnosis of this failure concluded: the step's intended result is still achievable (yes); it can be recovered without rebuilding the step (yes); the Flow needs a change (yes)."
- **What Core's own page check found**, from the failed attempt's `stateRouting`. This is said only when the node recorded an effect (`routeSignatures.effect`).
  - On `no_match`: Core compared the page with what the step changed when the Flow was built, and did not find all of it. Part of that change may have been incidental, so the model should judge the page itself.
  - On `unobserved`: Core could not observe the page.

**What it offers:**

- **"Already done" first.** Look whether the page already shows the step's result. If it does, keep the step, make it run only when its result is not shown (a step passed over when its control is absent, or a state route), and go on with the later steps. "Re-find" comes next, as "Otherwise".
- **Rule 7.** "Never change a lasting choice the site already holds that this build did not make: do not choose a different option where one is already chosen, and do not act on another record in place of the step's own."

**Wording.** Every word is abstract. A test asserts that no scenario word appears ("store", "pickup", "millbrook", "cart").

**What the brief still cannot carry.** The diagnosis prose (`observed`, "already set") is not on the run. `structured-diagnosis.ts` deliberately records verdicts only, so the brief can carry only verdicts.

### 2. `runtime/flow-bootstrap/unfinished-build/phases.ts` (F4)

**The new rule.** A build now ends not finished (`no_progress`, saying what stood still) when all of these hold for a repair round:

- it is unmeasured (its Flow holds carried steps that have not run);
- it stalled, with `unusable_decisions` or `repeat_without_progress`;
- the request still has acts to do;
- it newly did none of them (`acts_done` / `acts_proven`) and ran no carried step again (`fewer_steps_not_run`).

**Why.** A changed Flow alone (`flow_changed_unmeasured`) is no longer enough to open another round. This is the round-16 shape: round 1 swapped one press for another, `actsDone` stayed 1, and round 2 ran to `run_budget_calls_exhausted`.

**Where it lives.** The rule is in `phases.ts`, not `round-ending.ts`, because `round-ending.ts` only maps the loop's outcome. The decision to open a next round is made in `phases.ts`.

**Why `no_progress` rather than a new ending kind.** A new kind would need `flow-bootstrap/generation-failure/build-ending.ts`, which I do not own, and the readers downstream of it. The existing not-finished message says honestly what happened: "My last attempt to fix it got no further than the one before: no more of what you asked has a step than before, and it could not be run from the start."

**Scoped so t194-w70 still holds.** A round with nothing left to do still repairs again, so murwcmx2's tests (its checklist is empty) are unchanged and still pass.

### 3. Tests

- **`recovery/refuted-result/tests/step-failure-brief.test.ts` (new, 8 tests).** It covers the round-16 shape: diagnosis yes/yes/true, `stateRouting: no_match`, an effect recorded, and a fix refused `target_unanchored`. It checks the verdicts, the page check, the already-done outcome, the no-reversal rule, that the ladder and re-find text are kept, that nothing is said when nothing was recorded, the `unobserved` case, and that no site words appear.
- **`flow-bootstrap/unfinished-build/tests/never-run-whole.test.ts` (+3 tests).** These cover: a stalled repair with a changed Flow and no new act ends after 2 rounds; one with a new act opens round 3; one that reruns a carried step opens round 3.
  - I put them here rather than in a new file because a new file made that `tests/` directory hold 26 source files, which fails the audit's `directory-files` rule.

`llm/deepseek/tests/system-prompt-pins.json` is untouched, because no system-prompt text changed.

## Commands run and observed results

**Fail-first, brief.** `npx vitest run …/recovery/refuted-result/tests/step-failure-brief.test.ts` before the change printed `Tests 6 failed | 2 passed (8)`.

**Fail-first, F4.** I ran the F4 tests against `phases.ts` from HEAD, then restored mine: `npx vitest run …/unfinished-build/tests/never-run-whole.test.ts` printed `Tests 3 failed | 10 passed (13)`. A separate new file had shown the same 3 failures before the move.

**After the changes:**

- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build src/programs/automation-studio/runtime/recovery …/service/runtime-adaptation/tests/step-failure-port.test.ts …/runtime/tests/service-bootstrap/tests/unfinished-build.test.ts` printed `Test Files 79 passed (79)`, `Tests 838 passed (838)`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (340 warning(s), 1159 baselined)`. It also printed "2 baseline entries can be lowered". I removed no violation, so this was most likely already there; I did not run `structure:baseline`.
- `npx tsc --noEmit -p .` in `packages/fluxiq` printed nothing and exited 0.

## Not verified

- No Lab, provider or live run (as briefed), and no full suites.
- I did not check that a real model follows the "already done" outcome or rule 7.
- I did not check whether a domain-side reader (the Lab) keys on the old numbering "1. Re-find step". The `step-failure-port` test still passes.

## Open questions or contradictions found

### 1. Goal 1 cannot be met on Core's evidence for the B round-16 shape as it stands

- **What Core's evidence said in round 16.** The host's `routeEffectHolds` said false at every attempt, because the chat-card name is in the effect (debug F1). Using the domain's `seen.ts`, `routeEffectSeen` would be `unknown` (2 added names is fewer than `MIN_ADDED_FOR_ABSENCE` = 3).
- **If it had said true.** Then `executor/state-routing/decision.ts` would already have taken the success edge before recovery ran. So recovery has no Core evidence to agree with the diagnosis.
- **Options:**
  - (a) Land F1 downstream. The round-16 shape then never reaches recovery.
  - (b) Add a weaker host question, such as "the step's result is shown". That needs `runtime/host-runtime.ts` and the domain's `route-state/effect/`.
  - (c) Follow the debug's F2 citation: the domain checks that the step's record is on the page and the step's control is absent from it.

### 2. Files goal 1 (F2) needs

**A machine channel for "the result already holds"** (the diagnosis has none today):

- `llm/harness/structured-response.ts`: add a field to `AutomationStudioLlmDiagnosisFields`, for example `resultHolds: yes|no|unknown`.
- `llm/harness/provider-result.ts`: validate it.
- The diagnosis output schema in `llm/deepseek/output-schema.ts`.
- `llm/diagnosis-instructions.ts`: the sentence asking for it. This changes `system-prompt-pins.json` for runtime_diagnosis.
- `recovery/structured-diagnosis.ts` (owned) to read it.

**A way to take the success edge** (no patch kind or recovery outcome does this). Either:

- a patch kind `step_result_holds`, which touches `llm/harness/provider-result.ts` (`RUNTIME_PATCH_KINDS`), `llm/harness/runtime-patch-schema.ts`, `llm/harness/structured-response.ts`, `runtime/live-patch.ts`, `runtime/live-patch/overlay.ts` and `service/runtime-session/in-run-repair-unit.ts`, plus `recovery/plan.ts` (owned) to offer it; or
- an executor resume hook. That is under `executor/`, and `executor/step-loop/` is off-limits.

### 3. The reversal refusal (goal 3) needs the build's evidence loop

- **Where the presses happened.** In round 16 the wrong presses (0103, 0152) were made in the re-author build's evidence loop (`llm/evidence-loop/`, the llm-evidence tool dispatch), not in recovery.
- **Proposed detection from Core's evidence:**
  - The failed node's recorded effect E (`routeSignatures.effect`), and the run's own attempts showing that node never succeeded in this run, so the run did not set the state.
  - Before an act that declares a lasting consequence (`modify_existing`), ask the host `routeEffectHolds(E, page)`. If it holds, the site already holds a state this run did not set. Refuse the act with a reason such as `reverses_state_not_set_in_run`.
  - After an act, a change from holds to not-holds means the act reversed it. Record that and refuse any further lasting act on it.
- **It depends on F1.** In round 16, E never held, because of the chat-card name.
- **Why no current guard caught it.** The repeat guard missed these presses because each one used a fresh handle.

### 4. Carrying the diagnosis prose into the brief

This needs a channel from `recovery/annotation/annotate.ts` to the step-failure port that is not saved with the run. The port is in `service/runtime-adaptation/step-failure-port.ts`, and the route runs through `result-verification/run-outcome.ts`, which is off-limits. Storing the prose on the run would break `structured-diagnosis.ts`'s rule that only verdicts are recorded.

### 5. F4 partly reverses t194-w70

t194-w70 says nothing is concluded from an unmeasured round. F4 now concludes "not finished" from one: a stalled repair round with acts still to do and no new act. I limited it to that case. The supervisor should confirm this narrowing is acceptable.
