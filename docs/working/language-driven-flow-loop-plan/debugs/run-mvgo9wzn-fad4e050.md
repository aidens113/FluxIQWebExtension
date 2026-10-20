# Debug: run-mvgo9wzn-fad4e050

- Instance: rr3-slot-2 (rerun round 3), lane tree `fxwork/t719`, task `job-board-save-quillmark-remote`, built from
  the real extension chat. Frozen source downstream `e1363c31` / Core `e74e0890` (dev with t738's fixes: the
  reset-witness precondition `candidate.reset_witness_required`, unissued-ref refusal, settle words, ending
  truth). $0.25 ceiling.
- Verdict: **failed**, 127 steps, 62 provider calls, $0.0343, about 3.5 minutes of build (12:48 to 12:51 UTC). No
  Flow, no draft revision, no trial, no judged run, no oracle, no replay.
- The site was never changed: no call in the run declared a consequence, and no save control was ever pressed.
  The t738 witness rule therefore never fired, and the site's "first save of each page load fails" behaviour was
  never reached.
- Read-only diagnosis. Evidence: `steps/` (decisions, calls, results, screenshots), the fixture source
  (`apps/scenario-lab/src/scenarios/job-board/`), the domain and Core sources at the frozen commits, the run
  folder's `logs/`, `summary.json` and `.ui-review.local/` panels, and the slot-2 Lab log (no environment fault:
  no errors, clean ending, cost recorded).

## How far it got

| Phase | Steps | What happened |
| --- | --- | --- |
| Plan | 0002 to 0010 | Supervisor read the task, wrote one subflow with both parts, dispatched brief-1. |
| Brief-1 | 0011 to 0065 | Dismissed consent, searched by the employer's name, read the 7-card results list, opened a job's pane. Then asked `find_on_page` for "Save", "save", "saved", "Save job" six times (0029 to 0039, the last refused `already_answered`), each "0 matches ... hidden elements included". It went back and forth between results, the pane and My jobs (0043 to 0057), then pressed a stale handle on My jobs (0059 `target_unobserved`), and its next three calls were refused as repeats (0061 and 0063 `same_result`, a third identical navigation from My jobs to the results page; 0065 `failed`, the stale press again). Brief ended on the repeat stall. |
| Brief-2 (resent unchanged) | 0067 to 0124 | Same opening; closed the chat and sign-in layers; four more word searches for a save control (0087 to 0093), the job's own page (0095, two more searches), My jobs (0101). Then a stale handle (0104), an invented address (0106 `address_not_shown`), two resends of the stale call refused (0108, 0110). Back to results (0112), opened the "Remote" filter menu (0114), pressed its first option (0116): **`target_not_actionable`, 4 attempts, 22 s**. Reopened the menu (0118) and pressed the same option again three times: each refused `llm_evidence_loop.repeat_refused` (`the same call before: failed`) at 0120, 0122, 0124. Brief ended on the repeat stall. |
| End | 0125 to 0127 | Supervisor looked once and completed `ended: blocked`. |

Against round 2 (`run-mvgf4pk5-55343613`): **less far**. Round 2 pressed the save control three times, submitted
revision 1 and reached a trial refusal and a reset brief. Round 3 never found the save control, so no draft, no
trial and no lasting act. One thing did move forward: My jobs was read complete in both briefs and issued a
destination ref (`resetDestinations.collections` with one ref, count 2, on 0043, 0051, 0057 and 0102). So the
R9 native-completeness path works live on that list, and a save pressed after 0043 would have had a ref to name.

## The failed call at 0116, and why it was repeated

**What it was.** `web.output.dom-click` on the filter menu's first option, a plain link (`results-page.ts`
`FILTERS`), pressed while the menu stood open (0114's page lists the option lines and `COVERING` for the open
menu; 0114's screenshot shows it open).

**Why it failed: the site's rate limiter, then a retry on a page that no longer showed the option** (inferred
from four independent signals; nothing in the run logs a 429 by name):

1. The fixture refuses every sixth results page with 429 and a five-second retry-after (`route.ts`
   `RATE_LIMIT_EVERY = 6`; every `/jobs` request counts, `results-view`). Results pages served in this run:
   0015, 0045, 0053, 0070, 0112. The option link at 0116 asked for the sixth. Pane opens use `replaceState` and a
   fetch of `/pane`, which do not count.
2. The extension's click landing (`apps/extension/src/runtime/click-landing.ts`) fails a click that lands on a
   429 or 503 page as `RATE_LIMITED` and takes the tab back with `chrome.tabs.goBack`. 0116's page is the first
   in the run to say `ARRIVED back_forward`, at the same address as before the press.
3. The browser's forward arrow is grey in 0114's screenshot and dark in 0116's: a forward history entry appeared
   during 0116, which is the 429 page the tab was taken back from.
4. The page after 0116 has the menu closed (a reloaded document). The click went out 4 times over 22 s. That
   fits a first attempt that landed on the 429 page, then three retries that waited for a target no longer shown
   (`TARGET_NOT_SHOWN` maps to `target_not_actionable`, `action-failure/refusal.ts`).

**What the model was told.** Only the last attempt: `code: target_not_actionable`, `attempts: 4`, no reason
(0116 `result.json`). `node-run/retries/dispatch.ts` `webNodeDispatchWithRetries` returns "the last attempt's
own" answer, so the first attempt's `RATE_LIMITED` (which the domain maps to `page_busy_try_later`) and the fact
that the tab had been taken back were both dropped. The chat card said "Didn't work: the step wasn't accepted".

**Why the builder repeated it.** It did the right thing: it reopened the menu (0118) and pressed the option again
(0119). The guard (Core `llm/repeat-guard/outcomes.ts`) keys a call on its tool, its input and the page it found
(`stateDigests.before`). 0119 found the same page that 0116 had found (menu open, same address), so it matched a
key recorded `failed`, and the call was refused unrun. Core already exempts any outcome that may work later
(`llm/repeat-guard/retry-later.ts`, matches `rate limit`, `busy`, `try again`, ...). `page_busy_try_later` would
have been exempt, but `target_not_actionable` is not. Had it run, the seventh results page would have been served
200 (the reload by `goBack` was the sixth request, `6 % 6 = 0`).

**Did the feedback name what to change?** No. The repeat note says the call "did not work then" and to use a
different control or input. Both the tool result and the repeat note left out the one fact that mattered: the
site said "too many requests, wait 5 s". After 0120 the model sent the identical call twice more (0121, 0123),
with no new information. Its later decisions (0121, 0123) are model behaviour, but the dead end came from what
it was told.

## First divergent step (versus round 2)

**0028 (brief-1), again at 0087 (brief-2).** The save control on this site is a heart icon with no text, no label
and no title (`board/shell.ts` `HEART_SVG`, "It carries no text and no label"), and hashed classes. The page view
prints it correctly as `clickable icon class="..."` in every card (`page-view/element/icon-hints.ts`). A person
sees a heart. The model sees one wordless icon per card.

- Round 2's builder called `web.describe_element` on that icon (round 2, 0031), guessed "bookmark icon" and
  pressed it.
- Round 3's builders searched for the word instead, ten times across both briefs. Each zero-match answer
  (`page-find/search.ts`) said nothing on the page holds those words "hidden elements included", and pointed away
  from the page: "To look across the site, type it into the site's search field ... or follow a link to the page
  that lists it". Both builders followed that advice: to the job's own page, to My jobs, back to results. Neither
  ever described or pressed a wordless icon.

## Cause

**Two product defects, one decisive for how the run ended and one decisive for how far it got.** Not task,
oracle, fixture or environment. The task is achievable (the heart is the save control, and the rate limiter and
wordless icons are documented fixture traits, `manifest.ts`). The Lab log shows no fault, and the cost was well
under the ceiling.

1. **Decisive for the ending (domain): a press whose first attempt the site rate-limited is reported by its last
   attempt's failure.** `domain/src/runtime/llm-evidence/node-run/retries/dispatch.ts`
   `webNodeDispatchWithRetries`, which returns `outcome.result`, the last attempt's answer, from Core's
   `automationStudioDispatchWithNodeRetries`. Once the first attempt's 429 landing had been answered by taking
   the tab back, the retries ran on a reloaded document where the target, inside a menu the person had opened,
   was gone. The model got `target_not_actionable`, and Core's repeat guard, which exempts retry-later
   outcomes, saw a plain failure. So a correct retry after reopening the menu was refused three times, and that
   ended brief-2.
2. **Decisive for distance (generic guidance gap in product text): a zero-match `find_on_page` answer steers away
   from the page's wordless controls.** `domain/src/runtime/llm-evidence/page-find/search.ts`, the "Nothing on
   this page holds those words" sentence (lines 96 and 97). When a control's purpose is written nowhere, the
   answer says only that the page lacks it and points to other pages. Round 2 found the control by luck
   (`describe_element`). Round 3 did not.

Model behaviour on top, not the cause: brief-1 looped between results, pane and My jobs until three repeat
refusals (0061 to 0065, which the guard rightly refused). Brief-2 used a stale handle and an invented address
(0104, 0106).

## t738's rule and the round-2 prediction

- `candidate.reset_witness_required`: **never fired.** No call declared any consequence and no heart was pressed
  (no `reset_witness_required` in any step). Whether its refusal leads the model to read My jobs first was not
  exercised. One point for later: by 0043 a ref had already been issued, but the refusal's words
  (`site-reset/words.ts` `witnessRequired`) say to observe the list without naming refs already issued. Also, the
  `resetDestination` parameter description (`site-reset/undoes-tool.ts`) still opens "For an identified
  reversible create_new", although t738 now requires a ref (or another witness) for any reversible press made
  before the seal.
- "The site fails the first save after each page load": **not reached.** No save was attempted.

## Chat and UI

- 0116's card: "Click · Remote only. Didn't work: the step wasn't accepted". It gives no hint that the site
  refused the page for too many requests, or that the tab was taken back (the same loss as defect 1).
- Ending (`13-failure-panel.png`): the panel truthfully says the build changed nothing it knows of, and lists the
  presses it made as things to check. Two defects remain from round 2's note. The ending sentence appears twice
  ("FluxIQ could not finish the Flow. -- I could not finish ..." and then "The build failed: FluxIQ could not finish
  the Flow: i could not finish ..."). The second copy also lower-cases the model's first word ("i"). The likely
  join is near Core `conversations/commands/progress.ts` (`project.build_blocked`). Not traced.

## Proposed fix (least general) and its test seams

**Decisive, downstream domain.** In `node-run/retries/dispatch.ts` `webNodeDispatchWithRetries`, keep the first
attempt's failure when that failure says the site refused for now (`RATE_LIMITED`, or any failure the read marks
retry-later), the tab was returned, and a later attempt failed only because its target was no longer shown or
actionable. Return that earlier failure, with its `retryAfterMs` and the tab-returned fact, as the node's answer.
It maps to `page_busy_try_later`. Core's `retry-later.ts` then exempts the model's next identical press. The
press is not repeated blindly, because the site's own retry-after is said. An alternative is to stop retrying
once a returned tab no longer shows the target, which saves the 15 s of waits. Either way, the answer must not
be the last attempt's.

- Test beside it, `node-run/retries/tests/` (generic example, such as a library catalogue's filter link): a
  fake gateway answers attempt 1 `RATE_LIMITED` (tab returned, retry-after 5 s) and attempts 2 to 4
  `TARGET_NOT_SHOWN`. The node's answer is the rate-limited one, it reaches the model as `page_busy_try_later`,
  and `attempts` is 4. A dispatch whose attempts all fail `TARGET_NOT_SHOWN` is still reported as such.

**Secondary, downstream domain (generic guidance in product text).** In `page-find/search.ts`, when a query
finds nothing and the page holds wordless controls (lines the view prints with `icon` hints), add one generic
sentence to the zero-match answer: some controls here show no words, only an icon (their first few handles), and
what such a control does is not written anywhere, so describe one (`web.describe_element`) or watch what it
changes. Keep the sentence about the site's search. Test in `page-find/tests/search.test.ts` with a generic
fixture, such as a recipe card's star icon: a zero-match query on a page with wordless icons names them, and one
on a page without any reads as today. The sentence must name no site, word or task.

**Small, Core, when the witness path is next exercised:** in `site-reset/words.ts` `witnessRequired`, name the
refs already issued when there are any. In `undoes-tool.ts`, make the `resetDestination` description say that it
covers any reversible press made before the seal that has no other witness, not only `create_new`. Test in
`site-reset/tests/` that the refusal lists an issued ref.

**UI, Core:** dedupe the ending sentence, and keep the model's casing when it is quoted after a colon.

Not proposed: any change to the rate limiter, the heart's markup, the task, the oracle, or any guidance that names
hearts, saving or job boards.

## Not verified

- That 0116's first attempt landed on the 429 page. This is inferred from the results-page count, `ARRIVED
  back_forward`, the forward-arrow change in the screenshots, and the 4-attempt, 22 s timing. No log names the
  429, and the per-attempt answers are not written to `steps/`. It also assumes the site's request count started
  at zero for this run, and that no Lab check loaded a results page before 0015.
- That the retries' answers were `TARGET_NOT_SHOWN` rather than another not-actionable failure. Only the final
  code was recorded.
- That a retry after the menu was reopened would have been served 200. This follows from `route.ts` arithmetic
  and was not run.
- The source of the duplicated, lower-cased ending sentence.
