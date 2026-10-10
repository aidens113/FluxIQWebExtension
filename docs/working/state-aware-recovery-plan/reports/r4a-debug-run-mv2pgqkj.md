# R4a debug: run-mv2pgqkj-f3552c70 (second paid attempt)

This is a read-only debug of R4a's second paid live run. No product code was changed.

- **Run:** `run-mv2pgqkj-f3552c70`, crossborder-marketplace. Task `crossborder-marketplace-hub-to-cart-flash-deal-during-build`,
  variant `flash-deal`, candidate authoring mode, deepseek-flash, `--llm-max-calls 48`.
- **Trees:** Core `4842a4ac` and downstream `f583fd2a` (`C:/Users/osrs_/FluxStuff/fxwork/t418/`). Both include t419, t420
  and t421. The launch log shows `extension:build` and `domain:host-build` rebuilt from those trees.
- **Evidence:** `fxwork/t418/!FluxIQWebExtension/test-runs/instances/t418-proofs/run-mv2pgqkj-f3552c70/` (step folders
  0001-0098, `logs/core.log`, `snapshots/live-llm.json`), the UI review `.ui-review.local/` with its `.json` (14
  moments), and the launch log `scratchpad/r4a-4.log`.
- **Previous attempt:** [r4a-debug-run-mv2nlh9l.md](r4a-debug-run-mv2nlh9l.md).

## Outcome

The verdict is failed (`runtime.behavior`) and no Flow was created. The run spent $0.0779 of the $0.10 ceiling on 49
model calls: 1 chat call and 48 build decisions. 48 decisions is the run's whole decision budget.

**How far it got.** Exploration reached every control except the quantity box and closed the flash deal itself.
After four handle refusals, revision 4 of the script passed the static checks.

- **Trials 1 and 2 (revision 4):** both failed at the quantity step with `web.target.not_found`, with no score this
  time.
- **Revision 5:** the model rebound every handle to a newer view and split the quantity step into "clear" and "type".
- **Trial 3 (revision 5):** got past resolving the quantity box, then failed on the clear step with
  `web.validation.output_not_observed`, because the site puts "1" back in the box.
- **Revision 6:** refused again for the same cookie-step handle as before.
- **Revision 7:** accepted. It sets the quantity by typing "3" and is plausibly correct.
- **The end:** the model then answered `complete` and claimed revision 7's "trial passed", but revision 7 was never
  tested. Core refused the completion (`candidate.trial_required`). That was decision 48, the build's last, so the
  build ended: "it reached the limit on how many decisions it may make". No judge ran and nothing was promoted.

## Decisive cause

**The quantity step's saved identity held no signal except the selector `#fb1l6ufkg`, which addresses the box
through the id the page mints again on every load.** t419 correctly set that selector aside, which left nothing to
score. The box was never resolved, and t420's "the control is still on the page" reading never fired.

The causal chain:

1. **The snapshot knows the box's label, but the saved identity drops it.**
   - The scenario's box is `<input class=… id="${rotatingId(state,"qty")}" type="text" inputmode="numeric" value="1">`.
     It has no `aria-label`, `title`, `placeholder` or `<label for>` (`apps/scenario-lab/src/scenarios/crossborder-marketplace/markup/item.ts:60`).
     Its accessible name is therefore empty (`apps/extension/src/content/identity/accessible-name.ts:49-54`).
   - The extension infers its label "Quantity" from the sibling `<div>` (`content/identity/label.ts:103`, t229). The
     snapshot carries that label: `web.describe_element` on t964 (0064) printed `context: implicitRole="textbox" label="Quantity"`.
     The view prints `t964 field "Quantity"` from the packet's `label`, because `name` is empty (`page-view/element/words.ts:43`).
2. **The node identity is built without the label.** A created node's `parameters.element` comes from
   `webPlanElementIdentity` (`domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts:101-117`, called
   from `target-packets.ts:366`).
   - Its type is `Pick<…, "tagName" | "role" | "accessibleName" | "visibleText" | "selector" | "inputType">` (line 83).
   - It never copies `element.label`.
   - It drops `visibleText` for inputs (line 113), and `inputType` "text" is already undefined (`elements.ts`).
   - So the saved identity of the quantity step is in effect `{ tagName: "input", selector: "#fb1l6ufkg" }`. The
     selector is its only identity signal.
3. **t419 drops that selector.** On the trial's reset page the box's id is `fb8y7yz1` (seen by `describe_element`
   at 0064, and the same value as the previous run). `comparableSelector` (`apps/extension/src/content/identity/score.ts:319-331`)
   finds that no element carries `fb1l6ufkg` and drops the selector as `absent`. It does not drop it as generated,
   because `isVolatileIdentifier("fb1l6ufkg")` is still false.
4. **Nothing is left to score.** `hasIdentitySignal` (`score.ts:218`, list at `:342`) counts only `visibleText`,
   `accessibleName`, `label`, `id`, `testId`, `selector` and `classNames`. With only `tagName` left it returns
   `{ outcome: "unmatched", ranked: [] }`.
   - `notFound` (`content/action-runtime/resolve-target.ts:664-677`) then writes no `best scored`, `bestScore` or
     `runnerUpScore`.
   - The trial's `actual` reads "nothing matched; 3 control(s) of the same family are on the page; …". The previous
     run's ended "; best scored 0.27".
5. **t420 cannot fire without a score.** `target-on-page.ts:94` (Core `runtime/service/candidate-trial/`) requires
   `bestScore` to be a number. The step's feedback therefore has no `targetOnPage`, `onPage` or `advice`. The
   absorbed tries still say "The step's control was not found on the page", and the gate's instruction is the
   generic one.

**Where to change it:** `domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts`.
- Add `"label"` to the `Pick` at line 83.
- Set `label: secret ? undefined : whole(element.label)` in `webPlanElementIdentity` (lines 110-117).
- Keep it in `webPlanElementIdentityAcrossViews` as an agreed field (`agreed(earlier.label, newer.label)`).

Core's matcher weighs `label` at 20 (`fingerprinting/element-fingerprint.ts:93`). The page's candidates carry the same
inferred label (`content/identity/candidates.ts:212,224`), and `corroboration.ts:53` counts an exact `label`
agreement as distinguishing. Of the 3 same-family inputs (search, quantity, chat), only the quantity box would agree.
Also consider:
- the class names. The candidate side has them, and t419's own test (`identity/tests/page-tokens.test.ts:54-61`)
  assumed the recording did too;
- the raw id, so the id-specific rule in `score.ts` can apply.

Neither t419's tests nor t420's tests saw this. t419's fixture gave the saved quantity box `label` and `classNames`,
which a created node never carries. t420's fixture assumed a measured best of 0.27. Both workers flagged this as not
verified.

**Interaction to note.** Before t419, the same identity scored 0.27 against 3 candidates. That would have met t420's
threshold (≥ 0.12, with the runner-up unknown). t419 removed the only thing being compared, so the two fixes defeat
each other on an identity that is only a selector. The label fix restores a score and should let t419 resolve the box
outright.

## Secondary causes

1. **Rebinding passed only because the scenario repeats its ids.** Revision 5 rebound t964 to view 30, the page after
   trial 2, where the id is `fb8y7yz1` (submission 0090 `changedPaths` shows `nodes.5-9.parameters.element.selector`
   changed). Trial 3's reset page drew `fb8y7yz1` again, so the selector matched exactly. The rotating id depends on
   seed, view count and key, and the reset replays the same view count. Both runs show `fb8y7yz1` after a trial.
   A real site would not repeat its ids like this, so it is not a fix.
2. **The model spent 19 of its 48 decisions on refusals and unusable replies:**
   - 10 `already_answered`: 0040, 0054, 0056, 0058, 0066, 0068, 0070, 0080, 0082, 0086;
   - 1 `look_withdrawn` (0072);
   - 2 `kind: "callId"` (`llm_output.invalid_evidence_decision`, 0050 and 0084);
   - 2 unparseable JSON (`llm.provider_malformed_response`, 0012 and 0052);
   - 2 `repeat_refused` (0034, 0036);
   - 1 `trial_stale_revision` (0042: it tested "revision 3" with the refusal's fingerprint `f687a11e` as digest);
   - 1 `trial_required` (0098).

   After trial 1 its summaries say "the quantity field's handle went stale" 14 times. The feedback never told it
   otherwise (cause 5 above).
3. **The decision budget ran out with a plausible revision untested.** Revision 7 types "3" into the box, which is
   bound to view 30, and drops the clear step. It would probably have passed: trial 3 showed the box resolving and
   steps 1-8 succeeding. The model completed instead of testing, and claimed a trial that never happened ("Completing
   with revision 7, whose trial passed"). Core's `candidate.trial_required` refusal was correct.
4. **A clear step cannot be seen to work on this box** (`client/item-script.ts:120` puts "1" back on `change`). The
   clear step ran, the box read "1", and the step failed with `output_not_observed` after 4 attempts. Typing replaces
   the value, so the clear step was never needed. This is the same as the first attempt.
5. **The flash-deal step targets the wrong control.** Submissions used:
   - t1049 "⚡ Flash Deal", refused as `not_a_control`;
   - t1050 (the deal's text), refused as `not_a_control`;
   - t1052 **"Grab the deal"**, accepted in revisions 3-7.

   The deal's close control was t1048 "Close", which the model itself pressed at 0014. The deal never showed in the
   three trials, so the step was skipped ("Skipped “Grab the deal”: it was not shown"). Had the deal shown, the
   Flow would have pressed the deal's call to action, not its close. Nothing caught this. The handle check confirms
   only that the target is a control, not that it matches the step's label ("close the flash deal notice").
6. **The cookie step.** t1035 (title text) was refused as `not_a_control`, t1034 (body text) the same, and t1036
   (never printed) as `web.handle.unknown`. The model dropped the step in revision 4, then brought back t1036 from
   memory in revision 6 and was refused again. The control was t1041 "Accept all", which it pressed at 0016. The
   trials got through without the step because the interference clearing closed the banner (overlay "Recovered:
   Closed 2 notices the page put in the way", trial 1 step 7).
7. **Weaker choices that did not decide this run:**
   - the coupon step is `optional: yes` again, although the instruction depends on it;
   - exploration never typed into the quantity box or added to the cart; it submitted right after Spain (0025), so the
     quantity step was written blind again;
   - revisions 6 and 7 use non-canonical node ids (`web.dom.click`, `web.browser.navigate`); they were accepted.

## Exploration (0002-0024)

| Step | Act | Result |
| --- | --- | --- |
| 0002 | navigate start | ok; the home page is covered by t476 (welcome coupons) |
| 0004 | click t475 (cookie) | `target_covered`, closeWith t478/t488 |
| 0006 | click t488 "No thanks" | ok, the welcome layer is gone |
| 0008 | type t8 "Voltbay USB-C hub" + submit | ok |
| 0010 | click t647 (result) | ok; the item opened in a new tab; view: `COVERING t1046 covers 51` (Flash Deal) |
| 0011/0012 | (JSON with `"kind":"callId":…`) | `llm.provider_malformed_response` |
| 0014 | click t1048 "Close" | ok, "⚡ Flash Deal … Hubsmith 8 in 1 … 40% off" is gone |
| 0016 | click t1041 "Accept all" | ok, the cookie banner is gone |
| 0018 | click t934 "Get coupons" | ok on attempt 2, "Coupon collected" |
| 0020 | check t940 Space Grey | already chosen, nothing pressed |
| 0022 | check t951 7-in-1 | ok |
| 0024 | check t958 Spain | ok |

**Flash deal:** it was met on the item page and closed by the model with the deal's own Close. The cookie banner
was then accepted. The flash deal did not reappear in any trial.

## Submissions and refusals

| # | Step | Result | Refusal and line | Fixed? |
| --- | --- | --- | --- | --- |
| 1 | 0025/0026 | refused, rev 1 | `web.handle.not_a_control` + `:target`, line 5 (t1049) and line 10 (t1035) | no |
| 2 | 0029/0030 | refused, rev 2 | `not_a_control`, line 5 (t1050) and line 10 (t1034) | no |
| 3 | 0033/0034 | `repeat_refused` (same as #1), refusedInARow 1 | — | no |
| 4 | 0035/0036 | `repeat_refused` (same as #1), refusedInARow 2 | — | no |
| 5 | 0037/0038 | refused, rev 3 | `web.handle.unknown` + `:target`, line 10 (t1036) | line 5 "fixed" to t1052, the wrong control |
| — | 0041/0042 | `test_candidate` rev 3 → `candidate.trial_stale_revision` | — | — |
| 6 | 0043/0044 | **ok, rev 4**, `8d633994…` | — | cookie step dropped |
| 7 | 0089/0090 | **ok, rev 5**, `4d6957aa…` | — | clear + type; all handles rebound to view 30 |
| 8 | 0093/0094 | refused, rev 6 | `web.handle.unknown`, line 10 (t1036, cookie step brought back) | no |
| 9 | 0095/0096 | **ok, rev 7**, `42a5ce47…` | — | type only, never tested |

Between submissions, `core.run_node` with `write: true` added `dom-clear` (0074) and `dom-type` "3" (0088) on t964 to
the Flow ("Added to the Flow, not run yet"). No grammar or requirement-gate refusal appears. No parts, handlers,
`call:`, `start at:` or `done when:` were used.

## Trials

All three started from `reset`. Node numbers count merge nodes (script step 7 is feedback step 9).

**Trial 1** (0046, rev 4, 41.5 s): `execution_failed`, `candidate.execution_incomplete`, `retestsLeft` 2.

| Node | Step | Result |
| --- | --- | --- |
| 1 | open the item page | succeeded |
| 2 | close the flash deal (control "Grab the deal") | skipped: "Its control was not on the page" |
| 4 | collect the coupon | succeeded on attempt 2; absorbed `web.action.rate_limited`, waited 250 ms |
| 6-8 | Space Grey, 7-in-1, Spain | succeeded |
| 9 | type quantity | **failed**, `web.target.not_found`, 4 attempts, waits 250/1000/2000 ms (3750 ms) |

- **Resolution measurement:** `expected` reads "an element matching selector #fb1l6ufkg, element fingerprint, selector
  #fb1l6ufkg in the page's open shadow roots, element fingerprint in the page's open shadow roots". `actual` reads
  "nothing matched; 3 control(s) of the same family are on the page; the execution did not recover within its 5
  attempts after absorbing target_absent ×5, waiting 3750 ms".
  - **There is no best score and no runner-up.** The dropped token (`#fb1l6ufkg`, `absent`) is not reported
    outward; t419 left `dropped` on the content side only. It is inferred from the missing score.
- **Interruptions:** the overlay showed "Recovered: Closed 2 notices the page put in the way" during node 9.
- **Feedback text, exactly:** `"retryable": true`, `"happened": "The step's control was not found on the page."`.
  The absorbed tries say "The step's control was not found on the page. The run waited 0.3 s and tried the step
  again." Instruction: "The candidate did not run to its end, so this revision cannot complete. Read the feedback for
  the step that failed: what it says happened, and whether trying again may pass (retryable). If it may, test this
  same revision again; otherwise correct that step, submit the whole candidate, then test the new revision."

**Trial 2** (0060, rev 4, 40.4 s): the same nodes, and the same failure at node 9, with the same `expected` and
`actual`. The overlay showed "Recovered: Closed a notice the page put in the way" at node 2. The instruction was "This
revision stopped at the same step with the same failure in two trials, so testing it again would fail the same way.
Change that step, or remove it if it only checks the act before it (the judge reads the page the run ends on), submit
the whole candidate, then test the new revision." `retestsLeft` 0. This is the generic same-failure text, not t420's
step-specific alternative.

**Trial 3** (0092, rev 5, 25.4 s): nodes 1-8 as before. Node 9, "clear the quantity field", **resolved the box**, but
failed with `web.validation.output_not_observed`, 4 attempts: `expected` "the field is empty", `actual` "the field
holds \"1\"", `retryable: true`. The instruction was the generic retest text, `retestsLeft` 2. It was never used.

## Did t419 and t420 take effect?

- **t419: yes, and it did what it was built to do.** The trials' `actual` lost the previous run's "; best scored 0.27".
  `notFound` (`resolve-target.ts:669`) appends that only when `decided.ranked[0]` exists, and ranking is empty only
  when no identity signal is left (`score.ts:218`) or no candidate passes the record gate. With only a selector in the
  saved identity, dropping it as `absent` (`score.ts:325-329`) is the only route. It did not resolve the box, because
  nothing remained to score it by.
- **t420: no.** Neither failed step carries `targetOnPage`, `onPage` or `advice`. The absorbed tries still say "not
  found on the page", and both instructions are the generic ones quoted above. `target-on-page.ts:94` returns
  `undefined` without a numeric `bestScore`.
  - The model did re-test once (0059: "Retrying the trial of revision 4, since the quantity step's failure was a
    transient not-found"). That followed the generic `retryable: true`, not t420's text. The re-test reached the port
    (`retry_allowed`) and wasted 40 s on a certain failure.

## Judge, promotion and ending

No judge verdict, because no trial ran to its end, and no promotion. At 18:11:20 the model sent `complete` for revision
7, which had not been tested. The completion check answered `candidate.trial_required` ("Test this candidate first …
revision 7 and digest 42a5ce47…"). That was iteration 48 of 48. At 18:11:21 the build threw
`AutomationStudioFlowBootstrapGenerationError` (`core.log`). The final chat message:

> The build failed: it reached the limit on how many decisions it may make. I kept the latest version of the Flow's
> steps that I wrote as a draft, but nothing was put into the Flow. A version of it was test-run from the start 3
> times, and the last test run did not get to the end. …

## Cost and calls, compared with the first attempt

| | First attempt `run-mv2nlh9l` | This run `run-mv2pgqkj` |
| --- | --- | --- |
| Model calls | 34 (1 chat + 33 build) | 49 (1 chat + 48 build: the budget) |
| Cost | $0.0525 | $0.0779 |
| Input tokens | 811,781, 60% cached | 1,228,591, 61% cached |
| Output tokens | 4,352 | 7,038 |
| Prompt per call | 17.0k → 29.1k | 17.0k → 25.4k |
| Trials | 1 | 3 |
| Ended by | `repeat_refused` ×3 | decision budget (48) |
| Got as far as | node 9 not found | trial 3 resolved the box, clear unobservable; rev 7 untested |

Spend by phase in this run:

| Phase (steps) | Calls | Cost |
| --- | --- | --- |
| chat routing (0001) | 1 | $0.00016 |
| exploration (0003-0023) | 11 | $0.0193 |
| submissions to trial 1 (0025-0045) | 11 | $0.0171 |
| after trial 1, to the retest (0047-0059) | 7 | $0.0108 |
| after trial 2 (0061-0073) | 7 | $0.0090 |
| rewrite, rev 5, trial 3 (0075-0091) | 9 | $0.0152 |
| revs 6-7 and `complete` (0093-0097) | 3 | $0.0064 |

From trial 1 to the end the run spent $0.0413, 53% of the total. No call came near the ceiling.

## UI review (14 moments)

1. **Start.** The panel still shows the yellow "FluxIQ needs a model key before it can build" card. t421's poll
   re-asks every 4 s, and this frame was taken at the start, so one frame cannot show whether the poll lifted it.
   Moment 2 shows the chat, not that card. No overlay, which is correct.
2. **Chat:** the user's message and "Starting…". **Overlay:** "Starting…" → "Building your Flow | Opening where the
   Flow starts". Fine.
3. **Overlay and chat:** "The AI model's answer didn't make sense, so FluxIQ is asking it again. If that keeps
   happening, the build stops." This internal detail is still shown to the person on the page and in the chat. The
   scenario shows the flash deal with "Grab the deal" and its × close, plus the cookie banner and the price-drop
   notice.
4. **Exploration cards:** "Tick · Space Grey", "Tick · 7-in-1", "Ticking “Spain”"; the overlay also says "Ticking
   “Spain”". **t421's "Choose" did not reach exploration.** A `core.run_node` press there apparently has no element
   identity, so it falls back to "Ticking". Trial cards in moments 6 and 12 do read "Choose · choose Space Grey". So
   finding 5 is half done.
5. **Chat:**
   - "Saving the Flow's steps — Send the Flow again with the cookie-banner step dropped, since no view printed a
     usable accept control, then test the new revision." t421's "resubmit → send … again" works, but "no view printed
     a usable accept control" and "revision" are still jargon;
   - "Test run · Not done: only the latest saved steps can be tested" (the stale-revision test) is honest;
   - "Testing the whole Flow from the start — The test of the whole Flow didn't go through, so it showed nothing
     about this version" is vague about why.

   **Overlay:** "Testing your Flow | Step 1 of 8", consistent with the 8 script steps.
6. **Trial 1, step 7.** Cards "Choose · …" ×3, then "Type · set the quantity to three — Working on it". The scenario
   shows the Quantity box plainly on screen at "1".
7. **t421 wording shows:** "Type · set the quantity to three — Didn't work: **FluxIQ couldn't find it where it was
   saved**". That replaced the previous run's false "it wasn't on the page". Then "Trying the step again — The step
   didn't work, and a step like this often works on a second try". The overlay says "The test failed: a step didn't
   work. Next: changing the Flow and testing again". Accurate.
8. **Chat:** "Looking over the whole page — This is exactly the step it had already tried, so it was not done again"
   ×2 (the `already_answered` refusals). The trial 2 card reads "Click · close … deal notice if it shows". The label
   is elided in the middle, which reads oddly. The overlay shows "Skipped “Grab the deal”: it was not shown". This is
   the only place a person could notice the step targets the wrong control.
9. **Trial 2:** the same "couldn't find it where it was saved" card, "Closed 2 notices the page put in the way" with
   a "Clear the page · Done" card, and the retry. The overlay says "A step didn't work in the test: FluxIQ couldn't
   find it where it was saved". The words are consistent between chat and overlay (t421 finding 1).
10. **t421 "handle" rewording shows:** "I will re-read the item page to find the current quantity input before
    sending it again"; "…to find its current control before sending it again". The top still carries "…what the Flow
    says to do when this step fails", the false promise t421 left open. The "Look · the "Quantity" label" card
    describes t964, the field itself, as a label, which is wrong.
11. **Chat:** "Typing into “Quantity” — I'll write a clear-then-type step pair into the Flow to set it to 3, then send
    it again", with the card "Type · Quantity — Added to the Flow, not run yet". Clear and honest. One more "answer
    didn't make sense" card.
12. **Trial 3:** "Clear field · clear the quantity field". The overlay says "A step didn't work in the test: it ran,
    but **the page didn't change the way it should have**". t421 promised "it ran, but the site set the box back" for
    a typing or clearing step. **The clear step was not classified as kind `type`**, so the generic wording showed.
13. **Overlay "Build failed | Build failed: it reached the limit on how many decisions it may make".** It now gives a
    reason, which fixes t421 finding 6 for this ending. **Chat:** "Saving the Flow's steps — The AI model sent a
    version of the Flow's steps, but it was refused…", then "Change the Flow · Done: the steps were accepted", then
    the final message. The final message is honest, but:
    - it does not say the newest version was never tested;
    - it does not name the step that stopped the tests (the quantity box);
    - "the limit on how many decisions it may make" means little to a person.
14. **Failure.** Same as 13. The scenario shows the cart at 0 and the box at "1". The cookie banner and the
    price-drop notice are open again; the reset page shows them.

## Commands run and observed results

- Read `steps/index.md`. Read every `decide/response.txt` and every tool and answer `call.json`, `result.json` and
  `meta.json`, summarised with `scratchpad/r4a3/sum.py`, which strips page text.
- Read `logs/core.log` (tail), `summary.json`, `snapshots/live-llm.json` (`declared.maxCallsPerRun` 48;
  `runSpend.totalEstimatedCostUsd` 0.077911002, 49 calls; build `decisionCount` 48) and the launch log.
- Summed `usage` over the 48 decision files plus 0001's `meta.json`:
  - 1,226,648 input + 1,943 = 1,228,591 input tokens;
  - 751,232 + 1,152 cached;
  - 6,967 + 71 output tokens;
  - $0.077911.
- `grep -rlaF fb1l6ufkg` over the run: the token appears only in trial results and later prompts. No file dumps a
  saved node identity.
- Read `element-identity.ts`, `target-packets.ts:350-375`, `elements.ts:180-230`, `page-view/element/words.ts`,
  `score.ts`, `resolve-target.ts:245-386` and `:664-693`, `label.ts`, `corroboration.ts:53-69`, Core
  `target-on-page.ts`, `element-fingerprint.ts` (label weight 20), and the scenario's `item.ts:60`.
- Viewed panel screenshots 01-14 and scenario screenshots 03, 06 and 14. Read every overlay text from the UI review
  JSON.

## Not verified

- **The saved identity of t964 is not dumped by the run.** That it was `{tagName:"input", selector:"#fb1l6ufkg"}` comes
  from `webPlanElementIdentity`'s code and from the missing score. The previous run's score of 0.27 also implies no
  `label` was compared.
- **The fix was not tested.** I did not run the matcher with `label: "Quantity"` added, and did not check its score
  against the floor of 0.35 and the margin of 0.2. The reasoning rests on label weight 20, exact label agreement
  corroborating, and only one of the 3 candidates carrying that label.
- **The repeated id.** That the reset page always draws `fb8y7yz1` is inferred from the same value appearing in both
  runs and from trial 3 resolving by selector. I did not read `rotatingId`'s view counter.
- **The notices.** Which notices the trials' interference clearing closed is not shown in the evidence.
- **The start card.** Whether the missing-key card was lifted by t421's poll is not visible: moment 1 is the only
  frame of the empty chat.

## Open questions

- Should the domain identity carry `id` and `classNames` as well as `label`? The candidate side produces all three,
  and t419's id rule then applies to the id itself, not only to a selector that quotes it.
- Should the handle check refuse a press target whose words contradict the step's own label ("close …" on "Grab the
  deal")? A wrong-but-real control passes it today.
- t419's `dropped` list still does not reach the wire. Had the trial's `actual` said "the saved address #fb1l6ufkg is
  on no element; nothing else identified the control", both the model and the debug would have seen this at once.
