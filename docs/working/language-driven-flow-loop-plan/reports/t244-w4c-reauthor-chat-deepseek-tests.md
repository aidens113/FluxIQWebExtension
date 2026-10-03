# t244-w4c — re-author, extension chat and DeepSeek-bootstrap tests under the full-run rule

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t244/!FluxIQ`, branch `task/t244-partial-runs-full-judged-gate`.
R = `packages/fluxiq/src/programs/automation-studio/runtime`. Tests only; no source touched. Nothing committed.

## Outcome

Done. All 5 owned files pass: 27/27 tests, up from 9/27. No cause was found in source. Every fix wraps
the stand-in binding with `automationStudioReplayingBinding`, scripts the rerun of each carried step, makes the
scripted judge's yes stand, or rewrites an expectation that rested on the old rule.

| File | Before | After |
| --- | --- | --- |
| R/tests/refuted-result/tests/reauthor-service.test.ts | 1 pass / 6 fail | 7 / 7 |
| R/tests/refuted-result/tests/repair-replay-chain.test.ts | 0 / 1 fail | 1 / 1 |
| R/conversations/commands/tests/extension-chat.test.ts | 4 pass / 4 fail | 8 / 8 |
| R/tests/deepseek-bootstrap/tests/exploration.test.ts | 3 pass / 5 fail | 8 / 8 |
| R/tests/deepseek-bootstrap/tests/answerability.test.ts | 1 pass / 2 fail | 3 / 3 |

## What changed and why (per test)

### deepseek-bootstrap: `harness.ts`, `replies.ts` (support used only by the two owned tests; grep confirmed)

- `harness.ts`: the stand-in `lookBinding` is now wrapped with `automationStudioReplayingBinding`. There is a new option,
  `looksAreSteps`. With it, the demo look is an act that applied (`effect: mutate`, `draft.proposes: true`), as the
  web-registry look already was.
- `replies.ts`: a new `lookAdded(iteration)` is a look with `add: true`. `repeatedBuildReply` now adds its first six looks
  (calls 1-6) to the Flow. Its doc comment says why.

### exploration.test.ts (5 failing -> pass)

- **Cause.** The demo look only observed, and the completion wrote a Start-to-End plan out whole. No step of the Flow
  ran in this build, so every completion was refused `llm_evidence_loop.full_run_required` ("nothing ran"). The builds
  ended on `evidence_budget_exhausted`.
- **Change.** The creating cases now pass `looksAreSteps: true`, and their first or good look is `lookAdded`:
  - "malformed decision"
  - "deadline"
  - "bad replies across a good one"
  - "looked more than sixteen times" (look 1 is added; looks 2-18 stay plain looks)
  - "token totals" (look 1 is added)

  Decision counts, reveal counts and accounting are unchanged. The dry-run replays are answered by the helper and are
  not provider calls. "malformed decision" now also asserts `judgeRequests[0].stepCount === 1`: the judge read a test
  that ran the step.
- **Unchanged.** The three cases that do not finish a build pass as before and keep the plain observe look:
  - six unreadable replies
  - credential rejected
  - ran out after 20 decisions
- **Result.** 8/8.

### answerability.test.ts (2 failing -> pass; premise rewritten, titles kept honest)

- **Cause.** The old premise was that the drafted steps are looks and never a Flow's kind, so the judged Flow had no
  step and round 2 explored again from nothing. Under the rule, a Flow with no step that ran is never judged: it is
  refused. Both cases looped on `full_run_required`.
- **Change.** The measured script now adds its six looks, so the judged Flow is those six steps, run again from the
  start. Round 2 is therefore a seeded repair (`llm_evidence_loop.repair`, `draftSteps: 6`, `stepsInFlow: 6`), not
  `explore_again`.
  - Round 2's first decision is now offered `["amend_draft","tool_call","tool_call"]` (look first, no complete).
    Later decisions also carry the second tool-call shape (`core.run_flow`).
  - The draft shown is `6 + iteration - 1` steps.
  - Both cases assert every judge read a 6-step test.
- **Case 1, observed new ending.** Retitled "...and ends not doable when the repair's Flow is judged the same no". The
  repair's Flow is tested whole and judged the same no, so source ends it `flow_bootstrap.not_doable`:
  - `retryable: false`
  - ending `kind: not_doable`, with `stepsInFlow: 6` and `tested: replayed_clean`
  - message "I could not build this Flow ... the judge found the same as before"

  It used to end `evidence_budget_exhausted`/calls. Unchanged: 26 decisions, 4 judge calls, 30 reveals, the same token
  accounting, no answerability refusal anywhere.
- **Case 2.** Converges on decision 12 as before. `observations[11]` now shows the repair seed (7 steps, `repair`
  code). Result, accounting and audit counts are unchanged.
- **Result.** 3/3.

### repair-replay-chain.test.ts (1 failing -> pass)

- **Cause.** The re-author is an extend build seeded with two carried steps, click `f1` and extract `f2`. The script
  reran only the extract. The click never ran in this build, so every completion was refused `full_run_required`, the
  build never finished, and 20 calls were made instead of 6.
- **Change.**
  - The binding is wrapped with the helper and its `replays` are exposed.
  - Decision 1 reruns the carried click as it stands (`{step:1, change:"rerun", input:{consequences:[]}}`).
  - Decision 2 is the judge-directed repair of the read.
  - Decision 3 completes.
- **Step-number change.** `repairDecision` now finds the read's step number in the `core.flow_draft` it was sent
  (`actionId === EXTRACT_ID && inResult`). After the click's rerun takes position 1, the replaced click stays listed as
  step 2 and the read becomes step 3. The hard-coded `step: 2` reran the dropped click with the extract's node: wrong
  in the model's own terms. This keeps the file's rule that the re-author decides only from what it was handed.
- **Assertions.**
  - Task kinds are now `lv, lv, etd, etd, etd, lv, lv`: one extra decision, counted.
  - The judge indices shifted from 4/5 to 5/6.
  - New: the build test's replay steps were `[CLICK_ID, EXTRACT_ID]`, so the whole repaired Flow ran.
  - The denied `selector` still never reaches any provider request.
  - The applied Flow holds `where: "red"` with the selector intact, and the replays make no provider call.
- **Result.** 1/1, about 10-18 s. The first run took 59.8 s, cold transform load; reruns took 18 s and 10 s.

### reauthor-service.test.ts (6 failing -> pass)

- **Cause.** Two things blocked the build:
  - The stand-in answered every call raw, `core.run_node` included, so a rerun could never apply.
  - The script completed at once, so the carried `f1` (extract) never ran. Every completion was refused
    `full_run_required`, the re-author never finished, and nothing was applied (`applied: true` missing).
- **Change.**
  - The binding is wrapped with the helper.
  - `core.run_node` answers as an applied execution, the same shape as the chain test.
  - Decision 1 reruns step 1 with `consequences: []`; decision 2 completes.
  - The task-kind assertions gain the second `evidence_tool_decision`, and `decisionPayloads` length goes from 1 to 2.
  - The harness exposes `replays`. The caller test asserts the applied Flow's step ran in the re-author's test
    (`[EXTRACT.id]`).
- **Result.** 7/7 for all four intents, the overlap case, the caller case and the structured-failure case.

### extension-chat.test.ts (4 failing -> pass)

- **Cause.** The scripted provider answered every task with an evidence decision, including the build judge's
  `loop_verification`, so no build got a judge yes. Builds ended unaccepted and no adaptation was applied
  (`adaptations: []`). The improve case then failed downstream (`flow_bootstrap.blank_target_required`).
- **Change.**
  - The binding is wrapped with the helper; the inner `toolInputs` recording is unchanged.
  - `runTask` answers `taskKind === "loop_verification"` with `diagnosis.answersRequest: "yes"`.
  - `improveOnce` scripts the rerun of the carried search step (`step 1`, `consequences: []`) before its completion.
- **Result.** 8/8. The locked-key case still stops at the first call.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t244/!FluxIQ/packages/fluxiq`.

- Baseline, all five files together:
  `npx vitest run <the five files>` -> `Test Files 5 failed (5)`, `Tests 18 failed | 9 passed (27)`.
- Final, all five files together: the same command -> `Test Files 5 passed (5)`, `Tests 27 passed (27)`. Durations:
  answerability 4.6 s, repair-replay-chain 10.3 s, exploration 14.3 s, extension-chat 28.7 s, reauthor-service 39.5 s.
- Per-file runs during the work: exploration 8/8, answerability 3/3, repair-replay-chain 1/1, reauthor-service 7/7,
  extension-chat 8/8. No timeouts and no EBUSY.
- `npx tsc --noEmit -p .` -> exit 0, with 0 `error TS` lines. That covers the whole package, including other lanes'
  in-progress source.

## Not verified

- The full Core vitest suite, and any test file outside the five owned ones.
- Whether the improve case would also pass without the scripted carried rerun. Under the rule it should not, but I did
  not run a negative probe.
- Live browser behaviour (not applicable here).

## Open questions or contradictions found

1. **The stored plan can differ from the Flow the judge saw (possible gap in the rule; source, not mine to change).**
   In answerability case 2 the build's test ran and the judge read the six added `demo.look` steps
   (`judgeRequests[*].stepCount === 6`). The stored adaptation's `buildPlan` is the completion's own `plan`
   (`builtin.control.start, web.output.browser-navigate, web.output.dom-type, web.output.dom-extract_list,
   builtin.control.end`), none of which ran. So a completion carrying a `plan` that differs from its draft steps is
   accepted on the test of the steps. If "the Flow as it finally stands" is the stored plan, this path does not
   enforce the rule. Evidence: the debug dump of `run.stored.buildPlan` nodes against the judge `stepCount` in that
   case. The supervisor should route this to the dry-run gate or completion owner.
2. **Case 1 now ends differently.** Answerability case 1 ends `not_doable` (no progress: the same judge finding), not
   `budget_exhausted`, although it also spent all 26 calls. That is source's progress rule choosing the ending. I
   asserted it as observed and noted it in the test.
3. **Rerun renumbering is a trap for scripted models.** A rerun of step N takes position N, and the replaced step
   stays listed after it, so every later step's number shifts by one. Scripts that rerun several carried steps must
   read the numbers from the shown draft. Live models face the same renumbering.
