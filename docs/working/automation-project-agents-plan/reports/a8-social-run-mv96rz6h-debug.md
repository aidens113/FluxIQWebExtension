# A8 social run `run-mv96rz6h-02502365`: debug

Read-only debug. Nothing was committed, no Lab or live run was started, and no model provider was called.
Evidence comes from the step folders under
`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-14/run-mv96rz6h-02502365/steps/`, the run folder
`fxwork/t566/!FluxIQWebExtension/test-runs/instances/a8-slot-3/run-mv96rz6h-02502365/`, and Core source at
`fxwork/t566/!FluxIQ` (pair `9f362856` / `72487d26`).

## Outcome

Done. The build had a passing Flow and lost it. Two Core defects caused this, and neither is a Lab defect:

1. **The ending (decisive).** The repair came back short, and Core told the supervisor that the passing test still stood. The supervisor then completed four times with the test's `revision` and `digest` and also `ended: "partial"` plus a `reason`. Core's shape check refused each attempt as `project.completion_shape`. On the fourth, the repeat guard stalled the loop. A stall is not one of the shortfalls (money, time, turns) that let a rescued pass stand, so the build ended `flow_bootstrap.evidence_repeat_without_progress` and no Flow was kept.
2. **The repair could never succeed.** The repair builder for a passing subflow was never shown the subflow it was repairing. It started blank on the start page and had to re-author the subflow from nothing. It wrote handles it had never seen. It then sent the same refused navigate call three times, and the refused-repeat guard ended it.

## What changed and why

Only this report was written. No source was changed.

### Q1. Why a repair was opened after a passing whole test

Yes, this was t603's interruption repair. At step 0058 (`core.test_candidate`), the whole test answered `verdict: "yes"` (trial `trial.e5101700-...`, revision 1, digest `768d95db...`). Step 21 of its step record shows that the run got through only by recovering from a slow-down by itself:

```
"step": 21, "label": "confirm the request", "attempts": 2,
"absorbed": [{ "failureCode": "web.action.rate_limited",
  "happened": "The site asked the run to slow down on pass 4, and to try again in 1.5 s.",
  "pass": 4, "askedWaitMs": 1500, "waitedMs": 250, "paceMs": 7145 }],
"interruptions": [{ "kind": "rate_limit", "wayOut": "t914",
  "said": "The page put the site's notice asking the run to slow down in the way, and the run closed it by pressing its way out, t914." }]
```

The gate's instruction in the same result was: "The trial passed, but the site asked the run to slow down, and this Flow does not answer that itself yet, so this revision cannot complete." It also returned `slowDown: [{ step: 21, paceAtLeastMs: 1500, wayOut: "t914", waitAtLeastMs: 1500 }]`. Steps 4, 9 and 13 also record consent and dialog interruptions. Under t612 these are filtered out: only the slow-down at step 21 admitted the repair, which is correct.

At step 0062 the supervisor dispatched `kind: repair, subflowKey: confirm_requests, failingReceipt: {candidate_trial, trial.e5101700-..., 768d95db...}`. It gave the reason "The whole test passed but the site asked the run to slow down at the confirm step, so the Flow must answer the rate-limit notice itself". Core admitted the dispatch at step 0063, and the brief carried `repairOf.verdict: yes` with `interruptions[step 21].needs = {paceAtLeastMs 1500, wayOut t914, waitAtLeastMs 1500}` and `REPAIR_RESCUED_NOTE`.

### Q2. Why the repair builder repeated without progress

**What it was asked.** This is the 0065 request, line 1146 (`REPAIR_RESCUED_NOTE`, `project-agents/dispatch/run-brief.ts:75`). It said: "give the span that repeats that step a `repeat pace:` ... add right after that step ... an `optional: yes` step that presses the notice's way out ... a `builtin.timing.wait` step ... **Keep every other step as it is**, then submit and test."

**What it saw.** It saw only the opening look, which was the build's start page, the feed (step 0064), with a cookie consent dialog (t468/t469) over it. The prompt says `routing.current: "The Flow is blank: it has no routes and no subflows yet."` (line 743). The subflow it was told to keep, builder 1's accepted script (step 0033: navigate to `/friends/requests/`, optional close of t846, `extractList: extraction.3` with hashed column keys, click t755 repeated over `requests`, wait for text), appears nowhere in its prompt. `grep friends/requests` over the 0065 request returns 0 matches. The repair builder had no way to "keep every other step".

**What it did.**
- **0065.** It re-authored the subflow from memory and guesswork. Its `extractList: extraction.1` names a handle that this builder session never extracted. It used a field `mutualFriends` that does not exist, and it used the notice's way-out handle `t914` from the trial's page as the target of the Confirm click itself. At 0066, Core refused it with `flow_bootstrap.evidence_completion_parameters_unresolved` (`web.handle.unknown` on the success check, and `web.handle.unknown_field` "mutualFriends", where the valid fields were `h2_...`, `a` and `a_url`).
- **0067, then 0068.** It tried `core.run_node web.output.browser-navigate url .../friends/requests/` to go and look. That address was never in this builder's evidence, so the address guard answered `web.action.rejected.address_not_shown`. The answer listed the alternatives, including "web.output.dom-click ... of the link that goes there". The start page did show `t12 link "Friends" ~/friends/`.
- **0069, 0071, 0073.** It sent the same navigate three more times. The repeat guard answered `llm_evidence_loop.repeat_refused` ("refusedInARow ... maxRefusedInARow: 3") each time, and the third refusal ended the builder. Step 0063's return reads: "The builder failed: Flow Bootstrap generation failed (flow_bootstrap.evidence_repeat_without_progress). It was stopped by llm_evidence_loop.repeat_refused." It spent $0.0062 over 5 calls with no trial.

The model's repeats were its own fault. But the brief set it up to fail: a repair of a passing subflow became a from-scratch rebuild with none of the original's evidence.

### Q3. Why the passing whole test did not stand

t603's fallback did fire on the dispatch answer. At step 0063, the result carried
`wholeTestStands: { complete: { revision: 1, digest: "768d95db..." } }` and the `next` text "Complete with the complete object under wholeTestStands: Core completes on that test and tells the person the Flow relies on the run's own recovery." In `dispatch-tool.ts:165-166`, `short` was set and `state.recoveryRepairsShort.set(key, "short")` ran.

The supervisor then completed four times, at steps 0075, 0077, 0079 and 0081. Each time it sent `revision: 1, digest: 768d95db..., ended: partial, reason: "...relies on the run's own recovery..."`. Each was refused `project.completion_shape` at steps 0076, 0078, 0080 and 0082, with the instruction "Complete with exactly the complete object of the latest assembly, or with ended (blocked or partial) and reason, and nothing else."

The code path was:

1. **`project-agents/supervisor/completion.ts:57-59`.** The `result.ended !== undefined` branch runs **first**. Any key other than `ended` or `reason` refuses with `project.completion_shape`. The candidate branch (lines 71-85), which would have found `recoveryRepairsShort` and accepted through `automationStudioProjectSupervisorReliesOnRecovery`, is never reached. The supervisor's result named exactly the standing test, and Core held everything it needed to accept it.
2. **`llm/decision-handlers/completion.ts:89-97`.** The repeated refusals were shown with the **draft** wording `SENT_AGAIN` ("The check reads the draft's steps ... run the step that is missing, or amend the steps they name"). The supervisor has no draft, and that advice does not apply to a shape error. The refusal never said which keys to drop, and never gave the complete object.
3. **`llm/evidence-loop.ts:298-317`.** `unusable()` counts each refusal. `sameDraftRefusedAgain` holds, because the supervisor's draft is always empty. `repeats.refusedAgain(...) >= AUTOMATION_STUDIO_LLM_EVIDENCE_MAX_REFUSED_REPEATS_IN_A_ROW` (= 3, `repeat-guard/feedback.ts:24`) is reached on the fourth attempt, so `unusableDecisions.stalled({issueCodes: ["project.completion_shape"]})` fires.
4. **`project-agents/supervisor/supervisor-loop.ts:240-262`.** The stall error is caught as `stalled`. The rescued-pass fallback at line 260 only covers `shortfall = outOfMoney ? "money" : timedOut ? "time" : iteration_limit ? "turns"`, and a **stall is not in that list**. The build falls through to `record.end(... "The supervisor stopped before a whole trial passed (project.completion_shape)")`, which is wrong because a whole trial did pass. It then reaches `throw stalled.error`.
5. **`service/candidate-failure/stall-code.ts:27-29`.** `project.completion_shape` is not in `REPLY_SHAPE`, so the stall maps to `flow_bootstrap.evidence_repeat_without_progress`. **`conversations/commands/progress.ts:223`** words that as "it kept trying without getting any further, so it was stopped". The Lab event at sequence 30 carries `issueCodes: ["flow_bootstrap.evidence_repeat_without_progress", "project.completion_shape"]`.

### Q4. Root causes and the smallest structural fixes

All of these are in Core. None is a Lab defect: the Lab reported what Core said, and the slow-down was the scenario's real rate limit.

**A. A rescued pass is lost to any guard other than money, time or turns.** This is the decisive cause. In `supervisor-loop.ts:260`, extend the shortfall to every guard-forced end of the loop: a stall, an unusable-decision run, a no-progress run, or a provider outage (t621), excluding only the person's cancel. When `state.rescuedTest(...)` exists, complete on it as `candidate` with `reliesOnRecovery` (add a `"stalled"` reason and a `SHORTFALL_WORDS` entry for it in `state.ts`). This makes "a repair that fails must never lose a passing Flow" structural: no path the model can drive ends a build while its latest assembled Flow holds a standing whole-test yes that the gate held back only for an unanswered slow-down. Add a test beside `project-agents/supervisor/tests/interruption-repair.test.ts`: rescued test, repair blocked, then four mixed-shape completions, expecting `status: candidate` and `reliesOnRecovery.why: "stalled"`.

**B. The completion check refuses a result that names the standing test.** In `completion.ts`, judge a result that carries `revision` and `digest` by the candidate branch first. Treat `ended` and `reason` beside it as words only: drop them, or keep `reason` as a note to the person. Use the ending branch only when no revision or digest is named. Also give `project.completion_shape` the `complete` object and the offending keys (`extra: ["ended", "reason"]`), the way `project.completion_not_latest` already carries `complete`. Give the supervisor's check its own `sentAgainInstead` words (the t581 mechanism in `llm/decision-handlers/completion.ts`) so that it never tells a draftless supervisor to "run the step that is missing".

**C. A repair builder is not shown the subflow it repairs.** In `project-agents/dispatch/run-brief.ts`, `repairOf()` (line 241) should add the subflow's latest passing proposal, meaning the accepted script whose `subflowKey`, `revision` and `digest` the earlier brief's `return.proposal` names, read from the build's subflow candidate store that `project.assemble` already reads. Show it as `yourSubflow` beside `interruptions`, so that "Keep every other step as it is" has something to keep. That subflow's addresses should then count as evidence for the address guard. A stronger follow-up is to have Core apply the slow-down answer itself when `needs` is complete: it is deterministic (pace, an optional press of the way-out, a wait), so it could be written as an amendment to the accepted script without a model. The way-out handle would need re-resolving by its fingerprint, which I did not check.

None of these fixes involves model guidance, and none mirrors this scenario's task, site, names or answer.

## Commands run and observed results

- `ls` of the run folder and the `steps/` folder. The steps run from 0001 to 0082 (the index lists 82 rows).
- `cat` of steps 0058 (`result.json`: `verdict yes`, the step 21 `absorbed`/`interruptions` record, and `instruction` and `slowDown` as quoted), 0062 (`response.txt`), 0063 (`result.json`: return blocked, `wholeTestStands`, `next`), 0065 to 0074 (the repair's decisions and answers), and 0075 to 0082 (the four completions and the `project.completion_shape` refusals, with `sameAsIteration: 8` and `timesSent` 2 to 4).
- `grep -n "friends/requests"` over the 0065 request returned nothing. Line 743 reads `current: The Flow is blank`.
- `summary.json` and the tail of `events.ndjson`: `lab.chat_build_failed` with issue codes `[flow_bootstrap.evidence_repeat_without_progress, project.completion_shape]`.
- Read the Core source files: `run-brief.ts`, `supervisor/completion.ts`, `supervisor/supervisor-loop.ts` (lines 55-100 and 160-330), `supervisor/dispatch-tool.ts` (lines 140-190), `supervisor/state.ts` (lines 85-135 and 240-275), `supervisor/guidance.ts` (lines 215-240), `llm/decision-handlers/completion.ts`, `llm/decision-handlers/refusal-run.ts`, `llm/evidence-loop.ts` (lines 280-350), `service/candidate-failure/stall-code.ts`, and `supervisor/tests/interruption-repair.test.ts`.

## Not verified

- I did not compare this run with the passing wave 3 run. I assume wave 3 met no slow-down notice, but I did not check.
- I did not read the t603, t611 and t612 reports. I relied on the code and its header comments.
- I did not confirm whether `resetBeforeEnding` ran. `lastingActsInPlace` was 0 after the repair's start hook, so I expect it did nothing.
- I did not find the exact store or port that holds an accepted subflow script for fix C.
- No fix was written or tested.

## Open questions or contradictions found

- `REPAIR_RESCUED_NOTE` tells the builder to "Keep every other step as it is", but the builder is never shown those steps (`routing.current` says the Flow is blank).
- The record's ending reason says "The supervisor stopped before a whole trial passed", but a whole trial did pass, at step 0058.
- t603's header says "A build its money, time or turns stopped first completes on it the same way". The supervisor's own stall is a fourth way to stop, and it is not covered.
