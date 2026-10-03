# t244-w3 — Phases: a build finishes only on a judged yes about the Flow as it stands

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t244/!FluxIQ`, branch `task/t244-partial-runs-full-judged-gate`. Not committed.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. A finished round is now the build's result only when the verdict is `yes` and its `flowSignature` equals
`automationStudioFlowDraftFlowSignature(ending.loop.steps)`. Every other verdict goes to the judged-wrong repair path,
under the existing funding, progress and round bounds. The owned tests pass (124/124) and `pnpm --filter fluxiq check`
is clean. 43 integration tests fail. A probe attributes 30 of them to this gate and 13 to earlier work in the tree (see below).

## What changed and why

- `R/flow-bootstrap/unfinished-build/contracts.ts`
  - Every `AutomationStudioFlowBootstrapTestVerdict` variant gains `flowSignature?: string`, documented as the Flow
    signature of the test the verdict judged.
  - The `judged_wrong` doc now says "not judged to do what was asked". That covers no, unsure, not judged, and a yes
    about another version or about no test.
  - The `JudgedWrong` doc says unknown and not_judged apply to any such Flow, not only one with carried steps.
  - The progress measure `carried_steps_judged` is renamed `judged_after_unjudged`, with a new doc. A grep found no
    other users of the old name.
- `R/flow-bootstrap/unfinished-build/phases.ts`
  - The module header paragraph "A Flow the model says is ready is judged (t195)" is rewritten to the user's rule of
    2026-10-02. It also states that a build with no `judge` is unchanged and finishes unjudged.
  - The gate is `verdict.verdict === "yes" && verdict.flowSignature === standing`.
  - A yes that fails the gate becomes `not_judged` through the private helper `yesNotAboutThisFlow`, in Core's words:
    - With no signature: "the judge's yes was about no test of the Flow, so the Flow as it now stands was not judged".
    - With another signature: "the judge's yes was about a test of another version of the Flow, not of the Flow as it
      now stands, so the Flow as it stands was not judged".
    - The signature it was about is kept on the converted verdict.
  - `unknown` and `not_judged` go to `automationStudioFlowBootstrapJudgeFinished` unchanged.
  - The outcome's `judged?` is narrowed to the `yes` variant, which is the only verdict it can now hold.
- `R/flow-bootstrap/unfinished-build/judgement.ts`
  - The header and the `JudgeFinished` doc are updated.
  - **Change beyond the letter of the brief:** a non-`no` verdict whose `flowSignature` is not the finished Flow's
    signature (absent or different) now gives `tested: "not_tested"`, not `"replayed_clean"`. That Flow was not run
    whole, so "replayed_clean" would be a claim. As a result, a later round whose Flow is tested and judged also counts
    `test_passes`. A `no` is unchanged and stays `replayed_clean`.
- `R/flow-bootstrap/unfinished-build/not-done.ts`
  - `STOP_WORDS.judged_wrong` is now "the Flow it said was ready was not judged to do what you asked". `budget-exhausted.ts`
    uses this for a judged_wrong round that ran out of budget.
  - `judgedTestSaid` gains wording for an unsure verdict, one tested and one not tested.
  - `automationStudioFlowBootstrapRepairingJudgedSaid` for unknown/not_judged now says "The Flow was not judged to do
    what you asked: <why>. Repairing it live, to test it from its start and judge it again." When steps were carried,
    the same opening names the carried steps.
- `R/flow-bootstrap/unfinished-build/progress.ts`: a header paragraph explains the rule, and the measure is renamed. The
  logic already counted unknown/not_judged followed by `no`.
- `R/service/flow-bootstrap-commands/build-judge.ts`
  - `judge` reads `lastTest` once. When this round observed a test, it returns `{ ...verdict, flowSignature: lastTest.signature }`;
    otherwise it returns the verdict without a signature. `roundStarted` already resets `lastTest`.
  - `unverified`, its type member and the imports it used are removed. `calls` is kept. The header is rewritten.
- `R/service.ts`: only the `buildJudge.unverified(...)` line is removed. That line carried a trailing comment, "Not
  doable, or a budget ran out first...", which was removed with it.
- Tests
  - `tests/judged.test.ts`:
    - `YES` is now a yes about the judged loop's own signature.
    - The tests that expected "finished unverified" (unknown, carried run 41, no cost left) now expect a repair, or a
      budget ending with the Flow kept.
    - New tests cover: not_judged; yes about another version; yes about no test; unknown followed by no counted as
      progress; unknown followed by the same Flow unknown ending not doable; the purse unable to fund the next round
      after not_judged ending `budget_exhausted`/cost with "The Flow so far was kept"; and no judge finishing unjudged.
  - `tests/repair-rounds.test.ts` and `tests/shared-purse.test.ts`: the yes verdicts now carry the loop's signature.
  - `service/flow-bootstrap-commands/tests/build-judge.test.ts`: two new tests. One checks that the signature is stamped
    on both `no` and `not_judged` (no cost). The other checks that no signature is stamped after `roundStarted` with no
    new test, even though an earlier round observed one.

## Commands run and observed results

- Failing tests first, before any source change: `npx vitest run .../flow-bootstrap/unfinished-build .../service/flow-bootstrap-commands`
  gave 10 failed / 114 passed. The 9 new judged tests and the build-judge stamping test failed, as intended.
- After the change, the same command gave **15 files passed, 124 tests passed**. My first version of the two
  budget-ending tests expected `keep` to receive the stop `"judged_wrong"`. A budget ending passes `"budget"`, which
  is the existing behaviour, so I changed those assertions to check that the 3-step Flow was kept.
- First run of `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t244 w3 check" pnpm --filter fluxiq check` from
  the Core root: it failed with `phases.ts(424,3): TS2322 ... not assignable to type 'never'`. The cause was
  `Extract<..., {verdict:"not_judged"}>` being `never`, because that variant's verdict is a union. I fixed the type.
  The rerun printed only the build-cache line `"reason":"no stamp; stored in the shared store"`, with no errors.
- Record only: `npx vitest run src/programs/automation-studio/runtime/tests/service-bootstrap src/programs/automation-studio/runtime/tests/refuted-result src/programs/automation-studio/runtime/conversations/commands/tests/extension-chat.test.ts`
  gave **17 files failed / 14 passed; 43 tests failed / 124 passed**.
- Attribution probe. I temporarily set the phases gate back to "any non-no finishes" and reran the same set: **13
  failed / 154 passed**. So 30 failures come from this gate and 13 from earlier work in the tree. A temporary
  `console.error` in the gate showed which verdicts reach it in service-bootstrap plus extension-chat:

  | Count | Verdict |
  | --- | --- |
  | 42 | `yes` with no signature |
  | 23 | `unknown` with no signature ("the verification call did not come back usable") |
  | 6 | `yes` with a matching signature |
  | 4 | `no` with a matching signature |
  | 1 | `not_judged` with a matching signature (no cost) |

  I restored `phases.ts` after each probe and checked it was byte-identical to my version with `cmp`.

### Failing integration tests and their one-line causes (not fixed)

**Caused by this gate: 30 tests.** In each, the scripted build completed a draft that was never tested whole, so there
was no observed test. The cause is that `R/llm/node-tools/dry-run-gate.ts` returns a pass without a test when
`!automationStudioFlowDraftReplayable(steps)`. The judge's `yes` therefore has no signature, or the scripted judge's
reply was unusable and gave `unknown`. The build now repairs, and the repair round's script ends it as shown below.

- `service-bootstrap/creation-spend.test.ts` > (b) clears the record when a build proposes a Flow: `not_doable`.
- `service-bootstrap/incomplete-draft.test.ts` > keeps the proposable steps ... next build continues and clears it: `not_doable`.
- `service-bootstrap/judged-build.test.ts` > proposes the Flow, said to be unverified, when the build has no cost left
  to ask the judge: now `evidence_budget_exhausted`. This is the intended new behaviour, and the test expectation needs
  rewriting. It also failed in the old-rule probe, so earlier work in the tree affects it too.
- `service-bootstrap/generation.test.ts`, 3 tests, all `evidence_invalid_configuration` after a repair round:
  - runs a bounded evidence loop ...
  - keep gathering past eight decisions ({looks:10, calls:11, finishes:true})
  - packs opted-in reusable context ...
- `service-bootstrap/permission-ask.test.ts`:
  - opens the ask ...: `permission_required`.
  - goes ahead with the action when granted: `evidence_budget_exhausted`.
  - asks about another control after a decline: `evidence_budget_exhausted`.
- `service-bootstrap/permission.test.ts`:
  - carries on when an exploration step needs it: `permission_required`.
  - builds a Flow whose steps have no lasting consequence: rejected.
  - keeps what the instruction asked for ... permits the money: `not_doable`.
  - never reads the instruction for a build with no lasting consequence: rejected.
  - takes the action while exploring and builds the Flow: `not_doable`.
- `service-bootstrap/person-needed.test.ts` > waits for the person, and on Continue goes on: `evidence_invalid_configuration`.
- `service-bootstrap/plan-parameters.test.ts`, 5 tests, all ending in `evidence_invalid_configuration` or a rejection:
  - builds the node with the parameter the domain resolved
  - builds a node whose handle carries the location
  - hands a guessed locator back
  - hands a plan the registry refuses back
  - refuses to persist a plan that still names a handle
- `service-bootstrap/provider-unavailable.test.ts` > carries on to a proposed Flow when an unanswered request is followed by an answer: rejected.
- `service-bootstrap/state-digest-and-trace.test.ts`, 3 tests:
  - asks the domain for the state either side ...: `evidence_budget_exhausted`.
  - keeps what each step did ...: `evidence_budget_exhausted`.
  - takes no digest from a domain that cannot observe: rejected.
- `service-bootstrap/unfinished-build.test.ts`:
  - does not end while budget remains ... its Flow is proposed: rejected.
  - tests and judges what it has, then repairs it live, and the repaired Flow is proposed: `not_doable`.
- `service-bootstrap/unreadable-replies.test.ts` > asks again ... carries on to a proposed Flow: rejected.
- `conversations/commands/tests/extension-chat.test.ts`, 3 tests: the build no longer proposes, so the adaptation list
  is empty (`expected 0 to be greater than 0`).
  - creates an automation from the page
  - builds from a job the person only described
  - explores and builds a blank automation

**Not caused by this gate: 13 tests.** They also fail with the old finish rule restored. They are the re-author/extend
path, consistent with w1/w2's `full_run_required` refusal of carried steps.

- `service-bootstrap/extend.test.ts`, 4 tests, `evidence_budget_exhausted`:
  - opens for a non-blank Flow
  - runs the step the Flow was missing
  - presents the extend build's caller
  - applies an extend in place
- `service-bootstrap/adaptation.test.ts` > bridges a generated proposal ID through ... approve, and apply endpoints:
  15 s timeout. This one passed in the old-rule probe, so it may be flaky or slow under load; the attribution is uncertain.
- `refuted-result/reauthor-service.test.ts`:
  - 4 tests "reaches the re-author and applies its edit on a <mode> run, with no grant" (diagnosis_only,
    diagnose_and_adapt, explore_and_adapt, verify_result): the result is not `applied: true`.
  - "uses the run's caller for verification, extend, approval, and apply": the result is not `applied: true`.
  - "does not leak private retention to a same-caller generation on another Flow": the stage list has 10 entries
    where 5 are expected.
- `refuted-result/repair-replay-chain.test.ts` > is refuted, repaired ... replays with no provider call: the stage list
  has 19 entries where 6 are expected.
- `extension-chat.test.ts` > improves an automation, asks before applying ...: the build failed with
  `flow_bootstrap.blank_target_required`, and no ask was found.
- `judged-build.test.ts` > "proposes the Flow, said to be unverified ..." fails under both rules (listed above).

## Not verified

- No live browser or Lab run.
- I did not run the structure audit (`scripts/structure-audit.mjs`) or any suite outside the named ones.
- I did not trace each of the 30 failures past the verdict tally. The tally shows the build now repairs where it
  finished, but which repair-round ending each test reaches depends on its script.
- The "not caused by this gate" group is attributed by the old-rule probe only. Its root causes are not traced.

## Open questions or contradictions found

1. **The dry-run gate passes an untestable draft without a test** (`R/llm/node-tools/dry-run-gate.ts`, the check
   `if (!automationStudioFlowDraftReplayable(input.steps)) return undefined;`). Under the user's rule such a completion
   can never be a judged success. With this gate, the build now repairs it until progress stops (not_doable) or the
   money runs out. Most likely it should be refused at completion like `full_run_required`, so the model is told within
   the round. This is outside my ownership (R/llm), and it causes most of the 30 integration failures.
2. **Wording I could not reach:**
   - `R/llm/evidence-loop/resume.ts` `UNJUDGED_INSTRUCTION` tells the repair model "its test did not run every step"
     for every unknown/not_judged. That is wrong for a judge that was unsure about a clean test, or a yes about
     another version.
   - `R/flow-bootstrap/unfinished-build/not-doable.ts` `judgedSaid` says "the steps it carried from the earlier Flow
     were never run in this build" for any non-`no` judge. That is now reachable without carried steps (unknown →
     same Flow unknown → not doable).

   Both files are outside my ownership.
3. The `judgement.ts` `tested: "not_tested"` refinement for non-`no` verdicts that are not about this Flow's test goes
   slightly beyond the brief's letter. I did it so the judgement and its ending say the Flow was not run whole. Revert
   it if unwanted.
