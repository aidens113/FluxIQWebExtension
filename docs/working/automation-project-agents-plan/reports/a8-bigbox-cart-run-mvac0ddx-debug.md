# A8 frozen pair 6: `candidate` bigbox cart, run-mvac0ddx-f52ba929 (debug, read-only)

Run: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-15/run-mvac0ddx-f52ba929`, task
`bigbox-retail-pickup-cart`, mode `candidate`, lane `fxwork/t565`. Source read at
downstream `49b65bc9` (HEAD `c208c863` differs only in docs) and Core `4e51c1da`.
No source changed.

## Outcome

Done. One general runtime defect explains both the failed playback and most of
the failed trials. The interference clearing in the extension closed the store
picker that the Flow's own step had just opened. It did this while it ran an
optional "No thanks" step whose target was already gone. The step after that one
needs the picker open, so it found its button hidden (zero-size) and failed.
Whether this happens depends on a race: does the bigbox email promo, shown 2.2 s
after consent is answered, appear before or after the picker press? The race
comes from this site's timing. The defect itself is general.

## Outcome detail

### 1. The playback failure

Flow (revision 6): s1 navigate, s2 "Reject all" (optional), s4 open store picker
(`t7`), s5 "dismiss the email signup popup if it shows" (`No thanks`, optional),
s7 "Set as my store" for the Millbrook row, then search, product pages and cart
adds.

Playback, in order (`steps/0106`-`0113`, `snapshots/flow-lane.json` `actions`):

| Step | What happened |
| --- | --- |
| s2 (0107) | Consent "Reject all" was pressed at about 02:25:41.2. The fixture's promo timer starts now (`apps/scenario-lab/src/scenarios/bigbox-retail/client/shell-script.ts`: `PROMO_DELAY_MS = 2_200`, `schedulePromo()` runs on the consent answer). |
| s4 (0108) | The picker press was refused as `obstructed_target` because the promo had just appeared over it. The recovery loop pressed the promo's own `×`, retried and opened the picker: "recovered on attempt 2 after absorbing obstructed_target, closing 1 dialog the page had put in the way". |
| s5 (0109) | "No thanks" was absent because s4's defence had already closed the promo. The fault is `target_absent`, so `runWithRecovery` asked `clearableLayerOverPage(clearingTarget(...))`. The picker flyout was a clearable layer: in the page view it is `t2 banner close t334` / `t3 covers 4 close t334`. It does not hold the step's selector (`body > div:nth-of-type(3) > a`) or the name "No thanks", so nothing spared it. The loop pressed the picker's `×` ("closing 1 dialog the page had put in the way") and the step was then skipped as sometimes-present. The page after s5 (`0109/page.txt`) has no picker. |
| s7 (0110-0113) | "Set as my store" still resolves (selector match, 1 candidate, score 0.708). The flyout is now `hidden` (`flyout.hidden = true` in the fixture's close handler), so the button has a zero-size box. The gate reports it as `hidden` (`web.target.not_shown`). |

**Screenshots.** At `00038` (02:25:42.4) the page has no promo and no picker yet;
the chat shows step 2. At `00039` (02:25:57.5) the chat reads "...was covering
the page, so it was closed and the step went on. Clear the page: Done", and then
s7 "Didn't work" with the picker closed. The page view at failure shows only the
"Chat with us" card (`t313 covers 1`, shown 3 s after load by `CHAT_CARD_DELAY_MS`)
in a corner. Nothing covers the header.

**Why the target was zero-size.** The picker's store list lives in the
`vr-fulfillment-picker` shadow root inside a flyout that toggles the `hidden`
attribute. A closed flyout leaves its buttons in the DOM with no box.

**Why the recovery ladder did not clear it.** Each attempt in the extension
(4 attempts, 1350 ms) and in Core (`retry_node` ×4, backoff 250/1000/2000) met
the same thing. `TARGET_NOT_SHOWN` maps to `obstructed_target`
(`recovery/fault.ts`), so the loop pressed the ways out of the layers over the
page and found nothing to press. The account names no dismissal. Nothing was
over the target: its own container was closed, and no rung reopens a container.
Core state routing returned `no_match` (each 0110-0113 result has
`stateRouting.outcome: no_match`). It did not route back to s4, the opener. The
routing record's reason sentence is not in the Lab's playback step, so I could
not tell why. See Not verified.

**Repair lane.** The diagnosis (0114) was right: "the store picker that step s4
opened is no longer open". The runtime patch (0130) tried to override s7's
target to `t7` and was rejected (`runtime_patch.target_override_rejected`). The
result-reauthor lane then spent 0136-0186 on `amend_draft` calls: 10 were
refused `already_so` or `already_in_flow`, and 2 were ignored as
`draft_amendment_undone`. It ended `flow_bootstrap.build_not_finished`. The
oracle's `store-switched` holds only because the repair lane pressed the store
itself at 0133. The towels and napkins facts did not hold.

### Why the judged trial passed and playback did not

Both started from the same state, so this is not a reset or per-visit
difference. Every trial started from `start: "reset"`, and s2 "Reject all"
succeeded in every trial, so the consent banner and the pending promo were back
each time. Playback navigated fresh and met the same banner. In both, the promo
appears 2.2 s after consent is answered, which falls inside s4's press window.
What differs is which side of the race s4 lands on:

| Run | s4 | s5 | s7 |
| --- | --- | --- | --- |
| Trials rev1 ×2, rev2 ×2, rev4 ×2 (0048, 0050, 0060, 0062, 0080, 0088) | interruption, closed promo `t317` | skipped, interruption closed `t334` (the picker's `×` in every page view: 0010, 0064, 0072, 0092) | failed (`not_shown`, or `not_found` in rev4) |
| Trials rev5, rev6 (0096, 0102) | no interruption | pressed "No thanks" (promo arrived after the picker opened) | succeeded |
| Playback | interruption | skipped, closed 1 dialog | failed `not_shown` |

The pattern holds in 6 of 6 failures and 2 of 2 passes. Revision 5 has the same
digest as revision 2 (`d5915cd0…`). Revision 2 failed twice and revision 5 ran to
the end, so the Flow's content made no difference. The trial result was a coin
toss on the timer.

### 2. Why the build needed so many submissions

Counts: 13 `core.submit_candidate` calls (6 accepted revisions, 4
`unchanged_submission`, 2 repeat-guard refusals, 1 completion refusal) and 8
trials. The brief says "20 submissions". I count 13 submit calls; 20 may count
decisions or include test calls.

The first wrong move was in authoring revision 1, made worse by the runtime:

1. **Exploration (0005-0011).** The first picker press was refused as covered,
   and nothing was done (0006: `target_covered`, closeWith `t317`/`t332`). The
   model pressed "No thanks" (0008), pressed the picker again and it opened
   (0010), then set the store (0012). The script kept the picker step in the
   position of the refused press: picker, then dismiss promo, then set store.
   That put an optional popup dismissal between an opener and its use. The
   passing Flows in pairs 4 and 5 (`run-mva43ude-f7e0d2a0`,
   `run-mva6m19x-2820f326`) have no such step. Their order is picker then set
   store, and the runtime defence handled the promo there, sparing the picker
   because it held the target.
2. **Trial 1 (0048).** The defect above closed the picker. The feedback
   misdescribed what happened in two places:
   - s7's `web.target.not_shown` was reported through Core's near-miss path
     (`runtime/service/candidate-trial/target-on-page.ts`, which keys on
     category `target_not_found`). It said: "The step could not find its
     control where it was saved, though one like it is on the page. The step
     itself is right … test this same revision again". The control was found;
     it was hidden.
   - s5's interruption said "The page put a dialog in the way, and the run
     closed it by pressing its way out, t334". The page did not put it there;
     s4 opened it. Nothing told the model that `t334` was the picker.
3. **What followed.**
   - 0049 retested as told.
   - 0051-0057 "fixed" the napkins search, which had not failed, and hit the
     unchanged and repeat guards.
   - Revision 2 failed twice the same way. The gate then said to change "that
     step, or the steps that lead to it".
   - The model re-targeted s7 (revisions 3 and 4, 0063-0089). Along the way it
     set Millbrook as the store live at 0067, a lasting act the trial reset
     undid. It took the new row handle from a picker listing "Stores near
     Millbrook", so after the reset revision 4's row address matched nothing
     (`not_found`). The picker was closed in those trials anyway.
   - At 0081 it guessed right: "the picker's store list is not open when the
     step runs". It could not see why, and resubmitted unchanged.
   - Revision 5 reverted to revision 2's content and won the race. Its judge
     said no because the towels quantity was 1, a real Flow defect. Revision 6
     added a second "Add to cart" press, labelled "raise the paper towels
     quantity to two packs", and won the race again: yes.

So the extra cost came from one runtime defect plus feedback that described it
wrongly: "found but hidden" was reported as "not found, test again", and the
Flow's own layer was called the page's. The model's ordering slip only set it
up.

### 3. Did t652-t655 play a part?

No.
- t652 (split labelled, kept conditions; Core `trial-gate.ts` and
  `unchanged-submission.ts`) changes only the wording for `unsure` verdicts.
  This run had none: verdicts were `execution_failed`, then `no`, then `yes`.
- t653 (judge verdict survives a loop): the four judge replies (0097, 0098,
  0103, 0104) were complete and consistent.
- t654 (unseen-row claim refuted): revision 5's `no` was correct (towels qty 1)
  and was not refuted.
- t655 (read accounts, together rows, page groups): the Flow has no list read.
  The page views the model read show the picker list normally. Nothing touches
  interference clearing, recovery, state routing or the trial's target-on-page
  wording.
- Revision 6's label "raise … quantity to two packs" on an Add-to-cart press is
  a mislabel the 0103 judge repeated. It did not change the verdict: the cart
  showed qty 2, and 0104 read the two presses correctly.

### General or site-specific

| Cause | Kind |
| --- | --- |
| Clearing for a `target_absent` step closes a layer the Flow itself opened (no provenance; only the failing step's own target is spared) | **General**: any Flow that opens a menu, drawer or picker and then runs an optional "dismiss X if it shows" step |
| A `target_absent` step clears any layer with a way out, including a non-modal popover covering 4 elements, not only a wall that could hide the target (the t174 rationale) | **General** |
| No rung or route reopens a closed container when the target is present but not shown; state routing gave `no_match` | **General** (reason unrecorded) |
| Trial feedback calls `not_shown` "could not find … step is right, test again" and calls the run's own layer "the page put a dialog in the way" | **General** |
| Script placed an optional dismissal between an opener and its use, copying the position of a press that did nothing | **General** model slip; Core does not check it |
| Promo 2.2 s after consent racing the picker press | **Site-specific** trigger (bigbox timing) |

## Proposed structural fixes (by owning module, with the proving test)

1. **The clearing spares layers the run opened.** Owner: extension
   `apps/extension/src/content/action-runtime/interference/`.
   - Add `run-opened.ts`. After a press that succeeded, it records which new
     layers came over the page and are tied to the pressed control: same
     composed root or shadow host, `aria-controls`, or `aria-expanded` on the
     pressed control. `overlays.ts`/`clearing-target.ts` spare those layers the
     way they spare the step's own, until the layer leaves.
   - A body-level timed promo is not tied to the press and stays clearable.
   - Tests:
     - `interference/tests/run-opened.test.ts`, with a DOM fixture of a shadow
       chip toggling a flyout, plus a body promo: an absent-target clearing
       spares the flyout and still presses the promo.
     - `actions/tests/execute.test.ts`: an absent-target click with a run-opened
       flyout dismisses 0.
     - A content Playwright spec on `bigbox-retail` (realistic scenario):
       promo cleared during the picker press, absent optional "No thanks", then
       "Set as my store" succeeds.
   - Keep `e2e/content/tests/dialog-dismissal.spec.ts` and `safe-clearing`
     green.
2. **On a missing target, clear only a wall.** Owner: extension
   `interference/presence.ts` (and its call in `recovery/attempt.ts` /
   `actions/execute.ts`).
   - `clearableLayerOverPage` answers yes only for a page-blocking layer: a
     painted `aria-modal` or a scrim over the viewport centre. This is what
     company-website's consent wall was (t174). A non-modal popover in the
     header is not a wall, and a target cannot be "hidden behind" it.
   - Test: `interference/tests/presence.test.ts`. A header flyout returns false
     and a consent wall returns true. The t174 regression keeps passing.
3. **A target that is present but not shown is described as such.** Owners:
   - Downstream: `domain/src/runtime/failure/codes.ts` and the resolution
     measurement add a closed `shown: false` (or its own category) for
     `TARGET_NOT_SHOWN`.
   - Core: `runtime/service/candidate-trial/target-on-page.ts` and
     `absorbed.ts`, `runtime/flow-bootstrap/candidate/trial-gate.ts`. A
     measured "found but not shown" never takes the "step is right, test
     again" path. It says the control is on the page but not shown, and that a
     step before it must show it.
   - The interruption sentence names the layer's kind and word (already in
     `clearedLayers`). It says "a layer step N opened" when fix 1 recorded it as
     run-opened, and never "the page put".
   - Tests: a new case in `candidate-trial/tests/target-on-page.test.ts`
     (`shown: false` gives no `targetOnPage`, and the happened text says not
     shown); `trial-gate.test.ts` checks the instruction. Wording stays generic.
4. **Route back to the opener for a target that is not shown.** Owner: Core
   `runtime/executor/state-routing/` (new `reopen.ts`, called from
   `decision.ts` before ranking).
   - Trigger: a step fails "present but not shown", and the nearest earlier
     step had no lasting act and a recorded after-state that showed the failing
     step's target.
   - Then: route backward to that step once, through the progress guard.
     `repeated-act.ts` still refuses any lasting act.
   - Core refutes nothing here. It acts only on its own recorded after-state.
   - Test: `state-routing/tests/reopen.test.ts`. s4 has consequences none and
     its after-state shows the target; s7 fails not-shown; the run routes to s4
     once. A lasting-act opener is never re-run. A second return stops.
5. **Record why routing said no_match, and which layer was cleared.** Owner:
   downstream `packages/test-runner/src/lab-runs/write-playback-steps.ts`.
   - Copy the state-routing record's reason sentence and each `clearedLayers`
     kind/word into the playback step's summary and result.
   - Test: `lab-runs/tests/write-playback-steps.test.ts`.
   - Without this, the no_match in this run cannot be explained from evidence.
6. **(Advisory) Script order against the presses that worked.** Owner: Core
   `runtime/flow-bootstrap/candidate/` (submission diagnostics).
   - When a step's control was pressed in exploration first with no effect
     (refused as covered) and then again with effect after another step,
     placing it before that other step gets a note naming both steps. It is a
     note, not a refusal.
   - Test: in `candidate/tests/`, a submission that reverses the effective
     exploration order carries the note, and one that matches it carries none.
7. **(Secondary) Repair amend loop.** Owner: Core result-reauthor or
   `llm_evidence_loop` repeat guard. Ten refused `already_so` / `already_in_flow`
   amendments in a row (0138-0186) should end the lane the way three refused
   repeats end the build loop.
   - Test: an amend loop refused `already_so` N times stops with an honest
     ending.

Fixes 1 and 2 alone remove the playback failure and all six failed trials, and
make the trial outcome independent of the promo timer. Fix 3 stops the model
chasing a target it never lost.

## Commands run and observed results

- Read `steps/index.md`, `summary.json`, step folders 0001-0186 (calls, results,
  page views, decisions), `snapshots/flow-lane.json` (authoredNodes, graph,
  trials, actions, failure, oracles, harnessRecovery), `review/timeline.json`,
  screenshots `00038`/`00039`, `logs/core.log`.
- Python extraction over results:
  - Every failed trial shows s4 `interruptions` (`t317`) and s5 `skipped` plus
    `interruptions` (`t334`).
  - The passing trials 0096 and 0102 show neither.
  - `t334` is the picker's `×` in page views 0010, 0064, 0072 and 0092.
  - Revisions 2 and 5 have the same digest `d5915cd0…`.
- `grep` of the fixture shell script: `PROMO_DELAY_MS = 2_200`, `schedulePromo`
  on consent, and the picker close sets `flyout.hidden = true`.
- Source read:
  - Downstream: `content/actions/execute.ts` (clearing wiring),
    `action-runtime/recovery/{fault,attempt}.ts`,
    `action-runtime/interference/{clear,clearing-target,presence,overlays}.ts`.
  - Core: `runtime/executor/state-routing/decision.ts`,
    `service/candidate-trial/target-on-page.ts`,
    `flow-bootstrap/candidate/trial-gate.ts`, the t652 diff of
    `unchanged-submission.ts`.
  - The `git show --stat` of t652-t655 in both repos.
  - `git diff --stat 49b65bc9 HEAD` downstream: docs only.
- Earlier runs `run-mva43ude-f7e0d2a0` and `run-mva6m19x-2820f326`: their final
  script order has no popup step between the picker and set store.

## Not verified

- **Why state routing answered `no_match` and did not route back to s4.** The
  playback step and flow-lane record only `outcome`, not the reason. Possible
  causes:
  - s4's after-state was judged still holding;
  - its before-state layers differed, because the chat card or promo is timed;
  - a guard refused it.
- **The trials' cleared-layer refs.** That `t334` in the trials' interruptions
  is the picker's `×` is inferred from the same ref in four exploration page
  views of the identical page. The trials' own page views at s5 are not logged.
- **The exact millisecond the promo appeared** relative to s4's first hit test
  in playback. It is consistent with consent at about 41.2 s plus 2.2 s.
- Whether pairs 4 and 5 met the promo during the picker press in exploration.
- None of the proposed fixes were prototyped or tested.

## Open questions or contradictions found

- The brief's "20 submissions" against the 13 `core.submit_candidate` calls
  found here (8 trials).
- Exploration's `run_node` refuses a covered press and tells the model to close
  the layer (0006). Playback's defence instead closes the layer itself. So the
  model authors explicit dismissal steps that the runtime then races. The
  extension's "every node retries automatically / clears interference"
  behaviour is not applied in exploration, by design (t401 and earlier). It is
  worth checking that this asymmetry is still wanted.
- `TARGET_NOT_SHOWN` shares category `target_not_found` with a genuinely
  missing target. Core's near-miss wording (t420/t426) therefore covers both.
  The fix needs the domain to say "shown" on the measurement without Core
  learning web codes.
