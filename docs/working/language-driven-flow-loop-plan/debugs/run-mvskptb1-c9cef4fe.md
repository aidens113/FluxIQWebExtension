# Debug: run-mvskptb1-c9cef4fe (photo-social-newest-likes, round 6 rerun slot 4)

Status: FAILED. Diagnosis only (brief D-r6b-4, 2026-10-28). No source edits, builds, browser runs or paid runs.

**Correction (supervisor, from t787's fix 2, 2026-10-28).** The in-run handler did not fail because its condition
named a page-view layer line, as sections 2, 3 (fix 2) and Not verified below infer: its target `t275` resolved, to
the layer's element. The model wrote the repair condition's `fact` as a description, the domain read that as
`unknown`, and the condition never held. t787 takes `fact` from `op` for a condition about a control and refuses a
comparison that never says what it compares (`recovery.fact_kind_unread`); the layer-line refusal was not built,
because it would have refused this run's correct handler. See `../reports/t787.md`.

The posts are named by the fixture's own codes, as `breadth/newest-likes/expected.ts` names them:

- **A** `D1OKDvAEHfa`, **B** `DgYZxS8LJOe` (a reel) and **C** `DPIEH3I491a` are the oracle's answer, newest first.
- **P1-P3** are the three pinned posts at the top of the grid.
- **D** `D1cOJBYCLJM` is a later post that is not in the answer.

No page text, typed value or token is copied beyond control names and like counts.

## The run

- Task `photo-social-newest-likes`. It was built from the real extension chat (0001 `flow.createHere`) on instance
  rr6b-slot-4, in lane tree `fxwork/t567` (downstream `1bb6b93d`, Core `6f2d1a6c`), with a $0.25 purse and
  `--model-reset-only`.
- **Calls and cost: 63 calls, $0.0658** (`snapshots/live-llm.json` `runSpend`):

  | Phase | Calls | Cost |
  | --- | --- | --- |
  | Build | 50 | $0.0509 |
  | Judges | 10 | $0.0092 |
  | Playback repair | 2 | $0.0055 |
  | Chat | 1 | $0.0002 |

  The purse was not the limit.
- **Time.** The build ran from 20:40:10 to 20:57:02 (`build end status=proposed`, then `apply end status=applied`). The
  Flow was created (`flowCreated: true`, candidate `promoted`, verdict `yes`). Playback ran from 20:57:06 to 20:57:40.
- **Lab result.** `evaluation.json` says `verdict: failed`, `failureCategory: performance.budget`, `facilityFailure:
  scenario.execute / unclassified`, `oracleVerdict: null` and `reportedVerdict: null`. Its first failure (events seq 76)
  is "Live LLM budget exceeded: Core recorded 1 budget breach(es) of its own during the run".
- **Environment.** Every step `meta.json` is `status: ok`, there is no provider error, and `logs/core.log` ends with
  the build trace. **The environment is not the cause.**

## Answer to the brief's question

**The build ended with a judged pass. The Flow's playback then failed. The Lab threw a budget failure before it read
the oracle.** All three happened, in that order.

1. **The build ended with a judged pass, and the pass was false.** The whole run at 0126 was judged yes twice, but it
   un-liked B (section 2).
2. **Playback failed** at its first like (0141). The messages dock covered the post's Like button. The in-run repair
   proposed a handler to collapse the dock (0143), the handler never ran, and the re-attempt (0144) was covered the
   same way.
3. **The Lab never read the oracle.** After playback, `flow-lane/creation/lane.ts` calls `settleRun` (line 476) before
   `judgeCreatedFlowOracles` (line 489). `settleRun` holds the repair's usage to the caps, and Core had flagged the
   diagnosis call (0142) as a breach. The breach throws `performance.budget`, so the oracle verdict stays null and the
   playback failure is not recorded as the cause.

## 1. How far it got

| Phase | Steps | What happened |
| --- | --- | --- |
| Plan | 0003-0008 | One subflow `like_recent_posts` carrying p1 (like the three newest, `modify_existing`, "adds 3") and p2 (records, column `link`). `notAsked` lists other likes, saves, follows, messages and look-alike accounts. Correct. |
| Exploration | 0009-0051 | Declined cookies (0010) and dismissed notifications (0012). Opened the profile, the Reels tab, then A (0021, closed without liking). **Liked the three pinned posts as "the newest": P1 (0034, act-9), P2 (0038, act-11), P3 (0050, act-14).** Two presses were refused `target_covered`: 0041 by a dialog overlay, and 0045 by the messages dock (layer `t573`). **0046 collapsed the dock** (`t584`, `consequences: []`). The site keeps that on the account (`state.ts` `dockMinimized`), so no later trial met the dock. |
| Rev 1 | 0052-0058 | Opens the posts with a fixed tile handle, likes with `t1992` (P1's Like, pressed in exploration, so it was given `ensureState`), then waits for the text "Unlike". Offline check: refused `no_live_source` (0057). Live trial (0055): `execution_failed` at step 12. "Unlike" is not page text; Core's advice said so. Pass 1's like was correctly skipped ("already showed the asked state"). |
| Rev 2 | 0059-0065 | Drops the wait and adds "close the post". Offline check inconclusive. Live (0062): `execution_failed` at step 15. The fixed tile handle `t432` was not found on pass 2. |
| Rev 3 | 0066-0067 | Refused `candidate.unchanged_submission`. |
| Rev 4 | 0068-0074 | Opens each row by `$row.link`. Offline check inconclusive. Live (0071): `execution_failed` at step 12, close-dialog `t1708` not found, because a post opened by address has no dialog. |
| Rev 5 | 0075-0083 | Returns to the profile instead of closing a dialog. Offline check inconclusive. Live (0078): **judged no** (0082, 0083). The loop acted on P1-P3, each like was `already_in_state`, `proof: no_change`, and the record set held 24 links. The judges named the pinned posts. |
| Re-read | 0084-0099 | Re-detected the grid with a pinned-marker field (0093, 0095). Opened A from the grid (0099), where A's Like `t1157` was read showing `Like`. **`t1157` was never pressed while exploring.** |
| Rev 6 | 0100-0106 | Read with `where pinned is absent`, `limit 3`, like `t1157`. Live (0103): `execution_failed` at step 11, like target not found. |
| Rev 7 | 0107-0115 | The same text resubmitted. Live (0110): **judged no**. "pinned is absent" also dropped every Clip and Carousel tile, so it liked A, C and D. **act-19 liked A (842 to 843 likes, 0114 witness), act-20 liked C, act-21 liked D.** |
| Rev 8 | 0116-0124 | Condition changed to `pinned not contains "Pinned post icon"`. The read now keeps A, B, C (0123 `recordSets`). The like step is still `t1157`, a plain press with no `ensureState`. Live (0119): **unsure**. The judges disagreed, one "cannot be told" and one yes (0123, 0124). **The run flipped all three posts.** Pass 1 un-liked A: the witness went `Unlike` to `Like`, 843 to 842, yet the proof was `shown` for "adds 3". Pass 2 liked B. Pass 3 un-liked C. Core advised testing the same revision again. |
| Judged whole run | 0125-0132 | Rev 8 re-tested (0126, `trial.203a0e50…`, `wholeTest`): **verdict yes, judged twice** (0129-0132). The only witness, `w1`, sat at A's place and carried steps 11, 16 and 21. It showed A going `Like` to `Unlike` (842 to 843), and `proof: shown`. **Pass 2 un-liked B.** The trial trace (Core object `cc/45/cc454a53…`, pass 2 of `s10`) removed `button "Unlike"` and "1,106 likes" and added `button "Like" focused` and "1,105 likes". Pass 3 liked C (933 likes before, `Unlike` after). The judges never saw passes 2 and 3. |
| Completion | 0133-0134 | The builder and the supervisor completed. The Flow was promoted at candidate revision 7, which is subflow revision 8. |
| Playback | 0135-0144 | The Lab reset the site first (`lane.ts:454`), so consent is unanswered, the dock is expanded and nothing is liked. The cookie decline ran (0137), Not Now was skipped as absent (0138), and the read ran (0139). Then it navigated to A (0140). **0141, like: `web.target.not_actionable`, "the point 886,361 landed on a … part of fl-dock".** That came after 4 attempts. The failure is `retryable: false`. |
| In-run repair | 0142-0144 | The diagnosis (0142) was right: the dock covers the action bar, collapse control `t279`. The patch (0143) was `add_handler` before `s10`: when `t275` (the dock's layer line) is visible, press `t279`, then resume. Core recorded it (`adaptation_recorded`, `adaptationCount 1`) and re-attempted (0144, attempt 12, 20:57:37.5), **with no handler attempt in between**. The re-attempt landed on the dock again. The run ended `failed`, `repairedInRun: 0`. |
| Oracle | none | It never ran (section 3). Had it run: playback liked nothing, so `liked: []` against A, B, C, and no records. **It would have failed.** |

**Offline trials (P6).** All 7 offline checks were refused or inconclusive (for example 0121: 11 of 40 recorded
operations matched). Every verdict came from a live trial.

## 2. The cause

### Decisive for this run's failure (product, Core and domain): the build's exploration hid an interruption that the Flow then met

1. **0045-0046: the dock was dismissed once, and the site remembered.** Exploration met the messages dock covering a
   grid tile and pressed its collapse control. The site stores that on the account (`state.ts` `dockMinimized`;
   `client/overlay-script.ts`: the dock "expands by itself a moment later … until the visitor collapses it once, which
   the account remembers"). Every later trial ran on an account with the dock collapsed. Nothing in a trial could show
   the builder that the Flow depends on it.
2. **The model handled two of the three interruptions it met.** It wrote optional steps for the cookie dialog and the
   notifications prompt, which it met at the start, but none for the dock. Given what it was shown, that was a
   reasonable choice: from 0046 on, the dock never appeared again.
3. **Core has no mechanical carry-over for this.** t516's `service/runtime-session/interruption-learning.ts` learns a
   handler for a layer the client's defence closed while a step succeeded. A layer the build itself closed while
   exploring becomes nothing.
4. **Playback met the dock on a fresh account and failed (0141).** The Lab resets the site before playback, which is
   correct: the Flow must not depend on a side effect of its own build. A person running it on another account or
   device would fail the same way.
5. **The second line of defence failed too.** The in-run repair's handler was correct in intent, but it never
   executed. The executor's stream (Core object `59/23/59237ae5…`, seq 14 and 15) has attempt 11, then attempt 12, and
   no handler node between them. **Why it did not fire is not verified.** The most likely reason is that its `when`
   names `t275`, which is a page-view `layer covers 38` line and not a control. That fact may resolve to nothing
   visible, so the handler is skipped. See "Not verified".

### Decisive for the Lab's label (Lab, with a Core estimate): a 3% token under-estimate is reported as a budget failure

- **What Core counted.** The breach is 0142, the runtime diagnosis. Core reserves the request's measured size, UTF-8
  bytes / 3 plus 16 framing tokens (`llm/deepseek/request-body.ts` `measureAutomationStudioDeepSeekInput`; reserved in
  `llm/harness/run.ts`). That request was 43,880 content bytes, so it reserved about 14,643 tokens. DeepSeek reported
  **15,093**, which is 2.91 bytes per token. `run-budget.ts` `complete` counts `suppliedInput > reserved.inputTokens`
  as a `budgetBreach` (`providerCalls[0].budgetBreach: true` in the run's llmGate).
- **Core predicted this.** `harness/run.ts` `measuredInput`: "text that tokenizes more densely than 3 bytes a token
  would be under-counted … no tokenizer is shipped". The 2026-10-03 corpus minimum was 3.24. This prompt is dense with
  short handles and counts.
- **Every declared cap held.** The run used 63 of 250 calls and $0.066 of $0.25.
- **What the Lab did with it.** `packages/test-runner/src/live-llm/budget.ts` `liveLlmBudgetBreaches` fails the run
  on any `accounting.budgetBreaches > 0`. `flow-lane/creation/lane.ts` settles the repair (line 476) before it judges
  the oracle (line 489). On the throw path (lines 470-473) the breach replaces the run's own failure. The result:
  `oracleVerdict: null`, `facilityFailure: unclassified`, and the category `performance.budget` for a run whose real
  result is "playback failed at the first like".

### Contributing, and a false pass the fixes exposed (product, Core): a non-idempotent like step judged on one item's witness

t775 stopped resetting before trials, so rev 8's trials ran over rev 7's likes. That exposed two defects.

1. **No `ensureState` for the looped like step.**
   - `flow-bootstrap/script-statements/toggle-idempotent.ts` gives `ensureState` only to a step tied to a press made
     while exploring, by the same handle or the same resolved target. `flow-bootstrap/explored-toggles.ts` records only
     `core.run_node` presses.
   - Rev 1-5's like used `t1992`, which was pressed while exploring, and it skipped correctly (0055, 0078).
   - Rev 6-8 used `t1157`, A's Like read at 0099 and never pressed while exploring. It became a plain press. The
     playback call carries no `ensureState` (0141 `call.json` parameters: `element, selector, timeoutMs, checkWaitMs,
     target`).
   - Rev 7's own trial pressed `t1157` (act-19, Like to Unlike), but a trial press is never recorded as a toggle.
   - So 0119 flipped A, B and C, and 0126 flipped them again: it un-liked B.
2. **One witness for a looped step, and proof without direction.**
   - `flow-bootstrap/trial-change/witnesses.ts` builds witnesses from each step's submission stamp: one control place
     per step. All three passes were attributed to `w1` at A.
   - `trial-change/proof.ts` returns `shown` when any witness changed and leaves direction to the judge.
   - At 0119 the only witness showed a like removed, and Core still said `shown` for "adds 3". One judge then said yes.
   - At 0126 pass 2 removed a like that no witness covered, and both judges said yes.
   - The per-pass diffs, with their own locations, were in the trial trace. They are the same data `landed-acts.ts`
     reads for per-pass places (t772).
3. **Why it did not decide this run, and why it matters.** The Lab resets the site before playback, so playback started
   from an account with nothing liked, and a plain press liked correctly. Had playback passed, though, the promoted
   Flow would un-like all three posts on its second run. The build judged that Flow correct.

### Contributing (model): mistakes that recurred, and were corrected through Core's feedback

| Mistake | Where it recurred | Corrected by |
| --- | --- | --- |
| The pinned posts taken for the newest | Exploration (0034-0050), as in rounds 1 and 3-6 | Judge advice, by rev 8 (0078 to 0116) |
| A fixed tile handle inside the repeat | Rev 1-2 (0062) | Rev 4 |
| A wait for the text "Unlike" | Rev 1 (0055) | Rev 2, after Core's advice |
| "pinned is absent" also dropping reels | Rev 6-7 | The judge named the exact rows (0110 `checked`) |

None of these was decisive: the build reached a correct read.

### Contributing (product, Core): the build's own wrong likes stay on the account and nobody is told

- **Likes the build left.** It ended with P1, P2 and P3 liked (act-9, act-11, act-14 in `leftOnSite` at 0126), D
  liked (act-21), and A and C liked by the judged run.
- **That is the rule working.** Under "reset as rarely as possible" this is by design for acts a later trial does not
  need undone.
- **But nobody undoes or reports them.** The task says "do not like … anything else", and nothing undoes those acts or
  tells the person about them (section 4).
- **The Lab hides it.** The Lab resets before playback, so the oracle cannot see this. A person's account would keep 4
  wrong likes.

### Not a task, fixture or oracle defect

- The task is achievable and unambiguous. The honest workflow (`breadth/newest-likes/workflow.ts`) collapses the dock
  before the first like (`collapseDockSteps`). The grid marks pinned tiles. The oracle names exactly A, B and C, and
  the records in that order. The build's rev 8 read produced exactly those records (0123, 0129).
- The dock is one of the site's designed obstacles (`overlay-script.ts` item 2), not a fixture accident.

### Compared with round 6 (`run-mvrj7qgf-a44a1427`)

**This is not the same cause. Part of it is new, and part of it the fixes exposed.**

- **Fixed: round 6's decisive reset-settlement livelock.**
  - t775 retired the reset gates, and every reset step here is a `site_check admit` (0056, 0058, 0063, … 0128).
  - No undo was ever requested.
  - No `trial_reset_required`, `undo_already_back` or `completion_reset_first` appears.
- **Fixed or held:**
  - the judges were reached: 10 judge calls, against none in round 6;
  - t777's Like state is shown: the page view gives `button "Like"` / `"Unlike"`, and 0055's advice used it.
- **Exposed by the fixes:**
  - **Judging the change, with no reset,** made trials run over earlier trials' likes. That exposed the
    non-idempotent like on an unexplored handle and the single-witness proof, which produced the false yes at 0126.
  - **t781 does not apply here:** rev 4 onward opens posts by address, not in a dialog.
- **New, because round 6 never reached it:**
  - playback, and the dock;
  - the Lab's budget label from a reservation under-count.

## 3. The fix (generic: nothing names likes, posts, docks or this site)

**1. A layer the build closed while exploring becomes a handler of the Flow (required; Core and domain).**

- **Domain.** On a press that clears a covering layer (the page view's `COVERING … covers N` before, gone after), the
  answer carries `evidence.layerCleared`: the layer's opaque signature, and the control the press used.
  `domain/src/runtime/llm-evidence/` already reports a cover in `target_covered` (`covered_by_layer`).
- **Core.**
  - A new `flow-bootstrap/explored-interruptions.ts`, beside `explored-toggles.ts`, records the cleared layer.
  - `candidate/submission.ts` adds the same handler shape that `service/runtime-session/interruption-learning.ts`
    builds (when the layer shows, press its control, then resume), scoped to the subflow.
  - Both are mechanical. The model writes nothing.
- **Judgement call.** The alternative is guidance: "write an optional step for every layer you closed". The model
  already did that for two of the three layers here. Mechanical enforcement is preferred (the standing rule against
  advisory fixes).
- **Tests that fail first.**
  - Core `flow-bootstrap/tests/explored-interruptions.test.ts`: an exploration press that cleared a layer gives the
    submitted plan a handler. A run on a page where that layer shows presses it before the covered step.
  - A domain test in `llm-evidence/…/tests/`: a press that removes a `COVERING` layer reports `layerCleared`.

**2. The in-run handler must fire, or be refused at apply (required; Core; cause not verified).**

- Make the handler's `when` resolvable, or refuse the patch when it is not. In `recovery/annotation/step-evidence-resolution.ts`
  and `live-patch/overlay.ts`, a `when` that names a page-view layer line (not a control) is refused at apply. The patch
  call is then told to name the layer's own control (here `t279`) or the covered target's `covered` state.
- Today the patch is recorded as an adaptation, and a re-attempt runs it as if it had been tried.
- **Test:** Core `service/runtime-session/tests/in-run-repair.test.ts`, "an add_handler before the failed step whose
  layer is visible runs before the re-attempt". It must show a handler attempt between attempts 11 and 12, which this
  run did not have.

**3. A looped toggle is safe to repeat even when its handle was never pressed while exploring (required; Core).**

- `explored-toggles.ts` also records the domain's `toggle` answer from trial passes; the trace already carries each
  pass's control `before` and `after`.
- `toggle-idempotent.ts` ties a step to a toggle its own node made in an earlier trial. After rev 7's trial, rev 8's
  like would have carried `ensureState`.
- **Tests:**
  - `script-statements/tests/toggle-idempotent.test.ts`: a step whose only matching press came from a trial pass of
    the same node gets `ensureState`;
  - an executor test: a second run over items already in the asked state presses nothing.

**4. Each pass of a looped lasting step has its own witness, and proof has a direction (required; Core).**

- `trial-change/witnesses.ts` and `trial-change/session.ts`: a step that ran in N passes gets one control witness per
  pass, at that pass's own place and location, from the pass's own diff.
- `trial-change/proof.ts`: for a `change` effect with `direction: adds`, a witness whose control went back to the
  build's before-state (the opposite of the step's toggle signature) is a removal. That is not `shown`; it is a new
  `contradicted`, which can never be a yes.
- **Tests:**
  - `trial-change/tests/witnesses.test.ts`: a three-pass loop on three items gives three witnesses;
  - `trial-change/tests/proof.test.ts`: an `adds` part with one removed witness is not `shown`.
- With this fix, 0126 would have been judged no, and fix 3 would have followed.

**5. The Lab reports what happened (required; Lab; the cap semantics are a judgement call).**

- `packages/test-runner/src/live-llm/budget.ts`: when every declared cap held, Core's per-call reservation overruns
  are a finding (`reservation_undercounted`, with the call and the overrun), not a failure.
  - Judgement: alternatively Core counts a `budgetBreach` only when a cap would have been crossed
    (`llm/run-budget.ts`), or adds a margin to the bytes/3 estimate (`deepseek/request-body.ts`). The Lab change is the
    narrowest.
- `flow-lane/creation/lane.ts`: judge the oracle before `settleRun`, or keep the run's failure as the breach's `cause`
  on both paths (the existing `budgetOverProductFailure` covers only the build path). Then a breach never hides a
  playback failure or the oracle verdict.
- **Tests:**
  - `live-llm/tests/budget.test.ts`: "a Core reservation overrun within every cap is not a breach";
  - `flow-lane/creation/tests/lane.test.ts`: "a breach after a failed playback keeps the playback failure and the
    oracle verdict".

**6. The ending names what the build left (Core and extension).** Leftover acts of the build that no part asks for
(`leftOnSite` minus the acts the Flow's own judged run made) are named in the person-facing ending. That is a list of
likes to remove, or the build undoes them before completing when the task's `notAsked` covers them. Judgement call:
which of the two follows the 2026-10-27 rule is the user's.

**Would these have made this run pass?** Fix 1 alone very likely, and fix 2 alone likely:

- the Lab resets before playback, and the rev 8 Flow then reads A, B and C;
- it likes each with a plain press on an unliked post;
- the like target resolved at 0141 despite its saved words "Unlike";
- the records match the oracle's order.

Fix 5 makes the label right either way. Fixes 3 and 4 make the build's own verdict right.

## 4. UI review

There are 55 moments in `run-mvskptb1-c9cef4fe.ui-review.local/`.

**End of the build** (`53-before-flow-run-panel.png`):

- **Misleading.** "Check result — Passed: 3 rows came back. The result was judged to answer the request" and
  "Whole-Flow run — Passed". That run un-liked B (section 2).
- **Wrong and in build jargon.** "Built Like newest Harbourlight Studio posts — The subflow was tried on its own and
  its trial answered yes". It was the whole run, not a part on its own. "I complete the like recent posts brief with
  that exact version and digest" is build jargon.
- **Nothing about leftovers.** No word on the four wrong likes left on the account (P1-P3 and D).
- **Inconsistent count.** "Spent $0.06 · 56 calls · 8 tests" against Core's settle of 60 calls (events seq 72). Which
  count the chat means is not verified.

**Mid-build** (`52-mid-build-panel.png`):

- Each pass reads "Click · like the post — Done", including the pass that un-liked B.
- The trial feedback names every pass's control "Unlike" (rev 8), the words saved at submission (`step-control.ts`),
  even on passes that pressed "Like". The model and the judge see the same wrong words.

**Playback ending** (`55-failure-panel.png`):

- The chat shows the repair plan ("Add a handler … presses the dock's own control to dismiss it … then resume"). Then
  "Click · like the post — Didn't work" and "Not repeating the step — Another try wouldn't change what happened".
- **It never says the handler did not run.** The person is led to believe the dismissal was tried.
- "Run failed" is true. Nothing mentions a budget, which is also right: no cap was exceeded. The Lab's
  `performance.budget` label is the misleading one.

**Page** (`55-failure-scenario.png`):

- The expanded Messages dock covers the post's action bar, so the 0141 rejection was accurate.
- The overlay sits bottom-left at y 620 with "Run failed", clear of the site's logo, which was round 6's complaint.
- It was present at every mid-build moment, missing only across page loads (moments 23, 30, 39, 43 and 46: 15 of 16
  samples).

## Rerun notes

- The site is reset by the Lab before playback, and a fresh workspace is used per run. Nothing carries over.
- **Without fix 1 or fix 2, a rerun reproduces this** whenever exploration collapses the dock. That is likely, because
  the dock covers grid tiles.
- **Without fix 5, any run whose diagnosis prompt is dense is labelled a budget failure.**

## Not verified

- **Why the in-run handler did not fire.** It is inferred from the absence of any handler attempt between attempts 11
  and 12, and from `t275` being a page-view layer line. The handler's condition evaluation is not logged.
- **That playback would pass with the dock handled.** This is inferred from rev 8's trial reads and from 0141 resolving
  the target. It was not run.
- **The state of A, B and C after 0119.** It is inferred from 0119's `leftOnSite` changes and from 0126's per-pass
  `before` lines (B showed `Unlike`, C showed `Like` at 933). The state after 0126 is read directly from the trial
  trace.
- **Which of the chat's "56 calls" and Core's 60 is meant.**

## Evidence

- Steps (`test-runs/instances/rr6b-slot-4/run-mvskptb1-c9cef4fe/steps`):
  - 0006: plan;
  - 0034, 0038 and 0050: pinned likes;
  - 0045 and 0046: the dock met and collapsed;
  - 0052, 0059, 0068, 0075, 0100, 0107 and 0116: revisions;
  - 0055, 0062, 0071, 0078, 0103, 0110, 0119 and 0126: trials;
  - 0082/0083, 0114/0115, 0123/0124 and 0129-0132: judges (`siteChange`);
  - 0099: `t1157` read;
  - 0135-0141 and 0144: playback;
  - 0142/0143: diagnosis and patch.
- Run files:
  - `snapshots/live-llm.json` (`runSpend`, `repair.observed.accounting.budgetBreaches: 1`);
  - `snapshots/decision-trace.json` (recovery trace `adaptation_recorded`);
  - `events.ndjson` seq 72, 75 and 76;
  - `evaluation.json`.
- Core objects (workspace `claude-photo-likes-t567-20261028-r8`, project `e0a8188c…`):
  - `59/23/59237ae5…` (playback attempts, `repairedInRun: 0`);
  - `cc/45/cc454a53…` (judged trial `s10` per-pass diffs);
  - `64/85/64852ab7…` (`providerCalls[0].budgetBreach: true`).
- Code (Core `packages/fluxiq/src/programs/automation-studio/runtime/`):
  - `flow-bootstrap/script-statements/toggle-idempotent.ts`;
  - `flow-bootstrap/explored-toggles.ts`;
  - `flow-bootstrap/trial-change/witnesses.ts` and `proof.ts`;
  - `service/candidate-trial/step-control.ts` and `landed-acts.ts`;
  - `service/runtime-session/in-run-repair.ts` and `interruption-learning.ts`;
  - `live-patch/overlay.ts` (`addHandler`);
  - `recovery/annotation/annotate.ts`;
  - `llm/run-budget.ts` (`complete`);
  - `llm/harness/run.ts` (`measuredInput`);
  - `llm/deepseek/request-body.ts`.
- Code (downstream):
  - `packages/test-runner/src/live-llm/budget.ts` and `budget-over-product-failure.ts`;
  - `packages/test-runner/src/flow-lane/creation/lane.ts` (lines 454-489);
  - `apps/scenario-lab/src/scenarios/photo-social/state.ts`, `client/overlay-script.ts` and `breadth/newest-likes/`.
- Launcher log: `lab-runs/2026-10-28/round6b-slot4.log`.
