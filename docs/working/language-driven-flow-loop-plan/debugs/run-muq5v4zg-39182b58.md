# Run debug — `run-muq5v4zg-39182b58`

Live run 37 of lane t195 (Runs table row 37). Written by worker t195-w24c from the
decision dumps, the run directory and the screenshots; no Lab, browser or model
call was made for it. `R` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`.
Line numbers marked HEAD are Core `30f65794` (what the run's code said); lines
marked "now" are after w24c's fix.

---

## Header

- Run id: `run-muq5v4zg-39182b58`
- Scenario / variant / task: `social-network-feed` / none / `confirm-requests`
  (`social-network-feed-confirm-requests`), seed 5101, lane `created-flow`, built
  through the extension's chat (`panelInput: view-dom`).
- Command: not recorded in the run directory (`run.json` carries no command
  line). Slot `t195-slot-4`.
- Date, provider, model: 2026-10-01 23:24:11Z to 23:29:16Z; `deepseek` /
  `deepseek-flash`, profile `production`.
- Provider calls, tokens, cost (from the dumps; the Lab's own accounting saw 1
  call and $0, see Instrumentation gaps):

  | Round | Calls | Input tokens | Cache-hit input | Output tokens | Model ms | Cost |
  | --- | --- | --- | --- | --- | --- | --- |
  | Exploration (`build-2026-10-01T23-27-18-495Z-34560.jsonl`) | 16 | 376,552 | 221,056 | 2,285 | 25,061 | $0.0507 |
  | Repair (`build-2026-10-01T23-28-24-905Z-34560.jsonl`) | 17 | 374,494 | 233,472 | 1,505 | 23,563 | $0.0455 |
  | **Total** | **33** | **751,046** | **454,528** | **3,790** | **48,624** | **$0.0962** |

  Input per call ran 16,790 (#1) to 26,899 (#16) in exploration and 19,563 to
  23,167 in repair; build wall time 113.9 s.
- Verdict as reported: `failed`, `runtime.behavior`, `lab.chat_build_failed`; no
  Flow created (`flowCreated: false`). Chat ending: "nothing I tried did it. The
  Flow as far as it got (5 steps) ran from its start, but it does none of what
  you asked ... over 33 decisions".
- **Stage reached:** 2, exploration. It never proposed a Flow. The stalled round
  went to the unfinished-build test and judgement (stage 6 machinery) and one
  repair, and neither proposed one.

## Stage 1 — the instruction and the expected chain

Copied from the lane report ("Stage 1, confirm-requests", written before run 34).

- The instruction, verbatim (screenshot 00003): "Go through my friend requests
  and confirm everyone I have at least five mutual friends with, and leave every
  other request as it is. Then give me a table of every request the list now
  shows as accepted, in the order the list shows them, with columns name and
  mutualFriends, where mutualFriends is written exactly as their request shows it."
- The node chain a correct Flow must have:
  1. Open Friends, then "See all" to `friends/requests/` (the Friends home shows only 4).
  2. A list read of the request cards (name, mutual line), `where` mutual >= 5
     (F8 reads "X and 4 other" as 5).
  3. A For Each over the kept rows whose body presses that row's Confirm; the
     fourth confirm meets "You're going too fast" and is pressed again after the
     countdown (F7).
  4. A list read of the accepted cards (`name`, `mutualFriends`).
- A wrong answer that looks right: Tom Becker or Priya Nair confirmed (an act
  before the filter), Jonas Weber dropped (no leading number), or Freya Holm
  missing (the rate limit swallowed her confirm).

## Stage 2 — exploration

The draft entry the model was shown is the authored telling (`R/flow-draft/entry.ts:46` HEAD,
`AUTHORED_INSTRUCTION`). "Step" below is the draft position as shown.

| # | What it was asked | What it decided | Action and parameters | Result | In / out / hit tokens, $ |
| --- | --- | --- | --- | --- | --- |
| 1 | Initial look refused `not_at_start_location`; draft empty, acts `a1` confirm (plural, `no_step_added`) | Go to the start | `browser-navigate` start URL, `add: true` (step 2) | succeeded | 16,790 / 106 / 640, $0.00498 |
| 2 | Feed with cookie dialog | Dismiss cookies | `dom-click` `selector: t477`, add (step 3) | succeeded | 21,044 / 86 / 12,160, $0.00284 |
| 3 | Feed | Open Friends by URL | `browser-navigate` `http://127.0.0.1:60374/friends/` (step 4) | refused `address_not_shown` (wrong URL: no `/scenarios/social-network-feed`) | 21,374 / 97 / 12,160, $0.00295 |
| 4 | Refusal names "click the link" | Dismiss the notifications dialog | `dom-click` `t481`, add (step 5) | succeeded | 22,393 / 84 / 12,416, $0.00317 |
| 5 | Feed clear | Open Friends | `dom-click` `t12`, add (step 6) | succeeded, now on `friends/` | 22,375 / 90 / 12,800, $0.00306 |
| 6 | Friends home | Detect the requests list | `detect_repeating_structure` `t557` (step 7, look) | detected; F39 "continues: See all" | 21,568 / 69 / 12,800, $0.00279 |
| 7 | F39 says the list may be partial | Press "See all" | `dom-click` `t554` (step 8), **not added** | succeeded, now on `friends/requests/` | 22,370 / 85 / 14,464, $0.00256 |
| 8 | Requests page | Detect again | `detect_repeating_structure` `t749` (step 9, look) | detected | 22,830 / 72 / 13,056, $0.00310 |
| 9 | Fields offered | Read the list | `dom-extract_list` `extraction.2`, fields `name`, `mutualFriends` = `..._div_x1507i5...` (step 10) | 8 records, wrong mutual column | 23,736 / 188 / 15,360, $0.00283 |
| 10 | Wrong column | Read again, other column | same, `mutualFriends` = `..._span_x0gwrdxv...` (step 11) | read | 24,343 / 192 / 14,080, $0.00339 |
| 11 | Still wrong | Read again, third column | same, `mutualFriends` = `..._div_x1a4yqcp...` (step 12) | read, right column | 24,988 / 188 / 15,232, $0.00324 |
| 12 | Right column | Filter | same + `where: [{field: <mutual>, atLeast: 5}]` (step 13) | **4 kept: Amara Osei, Jonas Weber, Lin Zhao, Freya Holm; 4 left out alone: Tom, Priya, Diego, Marta**: exactly right | 25,642 / 239 / 15,616, $0.00339 |
| 13 | Draft with step 13 taken, a1 `no_step_added` | Put the Flow together and loop | `amend_draft`: `2 add`, `3 optional`, `5 optional`, `6 add`, `13 add`, **`13 repeat over 13 through 13`** | 3 applied (3 optional, 5 optional, 13 add); refused: 2 and 6 `already_in_flow`, **13 `over_not_before`** | 26,480 / 112 / 16,128, $0.00334 |
| 14 | `over_not_before` told (below) | "rerun the requests listing with a where keeping only rows of at least 5" (chat) | `amend_draft` `13 rerun` with input identical to step 13's argument | refused `changes_nothing`, not run | 26,891 / 224 / 18,048, $0.00303 |
| 15 | `changes_nothing` | Same reasoning (chat) | identical `13 rerun` | refused `changes_nothing`, `repeated` | 26,829 / 227 / 18,048, $0.00301 |
| 16 | `changes_nothing` repeated, "stop sending it" | Same reasoning (chat) | identical `13 rerun` | refused `changes_nothing`; **third refused repeat in a row: RG stalls the round** | 26,899 / 226 / 18,048, $0.00303 |

- Repeats, and what the loop believed was progress: #9-#12 are four reads of one
  list, each with a changed argument (field, then `where`): real progress, no
  guard fired. #14-#16 are one identical rerun, refused unrun each time. The no-
  progress count stood at 2 of 8 after #15; RG's own count reached 3 at #16.
- Rejections and refusals received, and whether each said enough to route around:
  - #3 `address_not_shown`: said to click the link from the packet; the model did (#5). Enough.
  - #13 `over_not_before` (`R/llm/draft-amendment-feedback.ts:55` HEAD; the check is
    `R/flow-draft/amendment.ts:309` HEAD): "repeat goes on the act that is done to each
    row -- the press, or the first of the steps done to a row -- never on the step that
    lists the rows. over names that listing, and it must come before the act: send
    {"step": <the act>, "change": "repeat", "over": <the listing>}." **Not actionable
    for this draft**: there was no act step at all. It never said "no step does the act
    yet: press Confirm on one row step 13 kept, add it, then send {"step": <that press>,
    "change": "repeat", "over": 13}". It named no step number.
  - #14-#15 `changes_nothing` (`R/llm/draft-amendment-feedback.ts:57` HEAD): "That rerun
    was already run with exactly this argument on this same page ... Change what differs
    in the step's argument, change the page first, or go on with the result you have."
    Accurate and not actionable: "go on" did not say *to what*. #15 added "stop sending
    it" (`:75`), again with no alternative.
- Where the context was evicted or truncated: nowhere. Every entry was shown whole
  (`truncated: false`; the draft listed all 13 steps).

### What the model saw after #12 (the three questions)

1. **The filtered rows.** The `extract.filtered` entry: `extracted` = Amara Osei
   "23 mutual friends", Jonas Weber "Aisha Khan and 4 other mutual friends", Lin Zhao
   "11 mutual friends", Freya Holm "5 mutual friends"; `rejectedRows` with all four
   others as `rowsAlone`; and the page with every row's Confirm handle (`t763`,
   `t775`, `t787`, `t799`, `t811`, `t823`, `t835`, `t847`). Four of those Confirms
   (Priya `t787`, Jonas `t799`, Freya `t835`, Marta `t847`) were `covered-by t850`,
   the "Chat with Elena Sokolova" dialog, which "covers 12". The model had everything
   needed to press Amara's `t775`.
2. **The per-item telling**, `R/flow-draft/entry.ts:46` HEAD: "To do one act to every
   item of a list, add the step listing them with a where keeping only those to act
   on, add the act done to one item, then amend_draft repeat over the listing step,
   and never act yourself on the items your listing left out." The model did the
   first clause (`13 add`) and the third (`repeat`) in one decision and skipped the
   second. "repeat over the listing step" does not say which step the repeat goes
   on; it sent it on the listing. Its chat line at #13 (screenshot 00007, top):
   "... the filtered request listing to the Flow, then confirm each qualifying
   request": it read the repeat as what confirms each row.
3. **The amendment schema's repeat text**, `R/flow-draft/amendment.ts:145` HEAD
   (`change.description`): "To do one act to every listed item: **first rerun the
   listing with a where** that keeps only the items to act on (every row it returns
   is acted on), do the act to one row it kept (never to a row it leaves out), then
   repeat with over that listing, right before this one". This is the cause of
   #14-#16: once the repeat was refused, the model went back to this recipe's first
   step, literally, and its chat lines say so (screenshot 00007): "I'll rerun the
   requests listing with a where keeping only rows of at least 5 mutual friends, so
   the Flow acts on exactly those requests" (#14), "... so the confirm step can act
   on exactly those" (#15), "... so the Flow confirms exactly those and leaves the
   rest" (#16). Its listing already had that `where`; the schema says "first rerun"
   unconditionally.

### Why #14-#16 resent an identical rerun

The schema's recipe begins "first rerun the listing with a where" (above); the
listing already had exactly that where, so the rerun's merge patch produced the
same argument. `R/llm/evidence-loop/rerun-request.ts:69-71` found the same call on
the same page in RG's outcomes and refused it `changes_nothing`, unrun. The telling
said "go on with the result you have" without naming the next step, so the model
had no other recipe step to take: step 2 of the recipe (the press) was never
described as the thing to do *now*.

### Why the round ended with $0.20 and 49 decisions left

Budget at #16: `decisionsLeft 49`, `costLeftUsd 0.1991`, `secondsLeft 493`. A rerun
refused `changes_nothing` counts as a refused repeat (`R/llm/decision-handlers/amendment.ts:103-110`
-> `refused-repeat.ts:52-63`); three in consecutive iterations (`R/llm/repeat-guard/outcomes.ts:130`,
`AUTOMATION_STUDIO_LLM_EVIDENCE_MAX_REFUSED_REPEATS_IN_A_ROW = 3`, `R/llm/repeat-guard/feedback.ts:20`)
stall the round, and the build moves to test-and-judge then repair
(`core.resumed.0`: `stopped: unusable_decisions`, `outstanding: [repeat_refused]`,
`judgement: {test: replayed_clean, stepsInFlow: 5, actsDone: 0, actsTodo: [a1]}`).
**The lifecycle moved on as designed.** RG ended exploration before any act was
tried, but what it stopped was three byte-identical refused reruns, which is what it
is for; the defect is upstream, in the tellings that sent the model back to the
rerun. Lane B may still want to weigh whether a stall with zero acts tried and $0.20
left should spend one more decision on a directed hint before the repair, but that
is a design choice, not a malfunction.

## Stage 3 — the proposed Flow

- Node list as authored: none proposed. The draft that went to the repair (5 steps in the
  Flow): (1) `browser-navigate` start URL; (2) `dom-click` `t477` cookies, optional;
  (3) `dom-click` `t481` notifications, optional; (4) `dom-click` `t12` Friends; (5)
  `dom-extract_list` `extraction.2` name + mutual, `where atLeast 5`.
- Divergences from the stage 1 chain:
  - "See all" (`t554`, exploration step 8) is missing: it ran but was never added, so
    the listing replays on `friends/` (the Friends home's 4 requests), not the full list.
  - The per-row Confirm and its repeat are missing entirely.
  - The final read of accepted cards is missing (never reached).
  - The Elena Sokolova chat dialog covering 4 of the kept rows' Confirms is not dismissed.
- For each: See all, misread the grammar (a navigation press "taken" and not added, while
  the AUTHORED telling says getting to the page is part of the Flow); the Confirm loop,
  misread the grammar (repeat on the listing, then the schema's "first rerun");
  the rest, never reached.

## Stage 4 — replay

The unfinished-build test of the 5-step draft (`judgement.test: replayed_clean`):

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| 1 navigate start | yes | `replayed` | NO EVIDENCE: per-node durations of the unfinished-build test are not in the dumps or the run directory | NO EVIDENCE | - |
| 2 cookies (optional) | site memory | `remembered` | NO EVIDENCE | NO EVIDENCE | site memory |
| 3 notifications (optional) | site memory | `remembered` | NO EVIDENCE | NO EVIDENCE | site memory |
| 4 Friends `t12` | yes | `replayed` | NO EVIDENCE | NO EVIDENCE | - |
| 5 filtered listing | yes | `replayed` on `friends/` | NO EVIDENCE | NO EVIDENCE | - |

- Any node that reported success while doing nothing: step 5 replayed "clean" on the
  Friends home, a partial list (F39's "continues" pointed at suggestions there, see
  the repair's `detect.requests.list`). Not wrong by its own lights, but the Flow reads
  the wrong page.
- Provider calls during replay: zero (no dump records between the two rounds).

## Stage 5 — the answer

- Records expected vs returned: 4 expected (Amara, Jonas, Lin, Freya); none returned.
  No Flow was created, so no run and no dataset.
- Fields compared: none. The comparison never ran (`oracleVerdict: null`).

## Stage 6 — judgement and repair

- Did the system judge its own result: yes. `core.resumed.0` told the repair the test
  replayed clean with 5 steps, 0 of 1 acts done, `a1` todo, stopped for `repeat_refused`.
- Did a repair trigger automatically: yes, one (17 decisions, $0.0455).
- What context the repair received: the resumed entry (stop reason, judgement, acts
  todo), the draft with every step's parameters and `replayed` outcome, budget, history.
  **Absent: the page.** Its first look was refused `not_at_start_location`
  (`initial.core.run_node`, entry key `4db7af88f17ec9f0`, the same entry as exploration's)
  although the test had left the browser on `friends/`; the repair never saw a packet
  with handles or hrefs. Also absent: the conversation and the exploration's own steps
  (the See-all press `t554` it had already found).
- The repair, decision by decision:

  | # | Decision | Result | In / out / hit, $ |
  | --- | --- | --- | --- |
  | 1 | `detect_repeating_structure` | `friends/`, 6 items (suggestions), continues See all -> `friends/suggestions/` | 19,563 / 65 / 12,160, $0.00237 |
  | 2 | `browser-navigate` `.../scenarios/social-network-feed/friends/requests/` | refused `address_not_shown` (that href was in no evidence this round had) | 20,454 / 102 / 12,416, $0.00261 |
  | 3 | `detect_repeating_structure` | same as #1 | 20,720 / 66 / 12,928, $0.00249 |
  | 4 | same navigate | **RG refused, unrun** (`refusedInARow 1`) | 21,375 / 107 / 13,184, $0.00266 |
  | 5 | `find_on_page` "mutual" | 20 matches: 4 request cards + suggestions | 21,638 / 74 / 13,696, $0.00255 |
  | 6 | `detect_repeating_structure` | `looked_again_unchanged` | 21,836 / 69 / 13,696, $0.00261 |
  | 7 | same navigate | RG refused (`1`) | 22,122 / 103 / 13,184, $0.00288 |
  | 8 | same navigate | RG refused (`2`) | 22,389 / 102 / 14,336, $0.00262 |
  | 9 | `find_on_page` "Friend requests" | `t541` li, **`t542` link "Friend requests"**, `t553` h2 (no href shown) | 22,392 / 69 / 14,336, $0.00259 |
  | 10 | same navigate | RG refused (`1`) | 22,118 / 103 / 14,080, $0.00262 |
  | 11 | `find_on_page` "Friend requests" | `looked_again_unchanged` | 22,386 / 71 / 14,208, $0.00262 |
  | 12 | same navigate, `add: true` | RG refused (`1`) | 22,415 / 107 / 14,080, $0.00271 |
  | 13 | `find_on_page` "Friend requests" | `already_answered`; `no_progress` 4/8 | 22,683 / 75 / 14,336, $0.00268 |
  | 14 | same navigate, `add: true` | RG refused (`1`) | 23,034 / 111 / 14,208, $0.00287 |
  | 15 | `find_on_page` "Friend requests" | `already_answered`; `no_progress` 6/8 | 23,059 / 66 / 14,208, $0.00282 |
  | 16 | same navigate | RG refused (`1`) | 23,143 / 103 / 14,208, $0.00289 |
  | 17 | same navigate | not run (no tool record); no-progress reaches 8, round ends | 23,167 / 112 / 14,208, $0.00291 |

- **Why 8 identical navigations, and why RG "did not stop them"** (for lane B). The
  lead's triage is half right. The repair decided the same navigation nine times; only #2
  ran. The other eight (#4, #7, #8, #10, #12, #14, #16, #17) were refused by RG, unrun, each
  costing a decision (`core.repeat_check.*`; #17 has no tool record and ended the round).
  RG never ended the round because its count is consecutive iterations only
  (`R/llm/repeat-guard/outcomes.ts:130`: `iteration === lastRefused + 1 ? +1 : 1`), and
  the model put a `find_on_page`/`detect` between almost every pair, each itself
  answered from memory (`looked_again_unchanged`, `already_answered`). So the count went
  1, 1, 2, 1, 1, 1, 1, 2 and never reached 3; the no-progress guard (7 after #16, 8 at #17)
  ended the round instead. The model
  kept navigating because (a) its first look was refused, so it never saw the page's
  hrefs, (b) `address_not_shown` refused an address that was correct but not in this
  round's evidence, and (c) `find_on_page` showed `t542 link "Friend requests"` without
  an href, and the model never clicked it (the refusal's "instead" said to).
- Was the repair persisted, and did a re-run use it: nothing was persisted; no Flow.

## UI review (screenshots 00001-00015; 00003, 00005, 00006, 00007, 00008, 00009, 00010, 00012, 00015 read)

- **Chat.** Every decision posts a heading and the model's reason. The exploration's three
  reruns post three near-identical "Updating the draft Flow -- I'll rerun the requests
  listing with a where ..." lines (00007/00008) with no card and no word that each was
  refused. RG-refused navigations in the repair post "Opening a page -- I'll open the friend
  requests page ..." with no result card (00009, 00010), so the person reads four page
  openings that never happened.
- **The stall's telling is wrong.** "Testing the Flow so far -- The build stopped before the
  Flow was finished: every attempt to finish was refused" (00007, 00008, 00012). The model
  never tried to finish; it was stopped for three refused reruns.
- **The final message is posted twice** (00015: the "stopped because the build could not
  finish ..." paragraph appears in full twice), and the ending is a wall of text.
- **Cards.** "Click · the page" names no control (00005: the notifications dismissal and the
  Friends link both read "Click · the page"). "Open page -- Didn't work: the step wasn't
  accepted" gives no reason (00005; the reason was `address_not_shown`). "Look at page" is
  used for both detect and search. "Read list · the page" (00006) is fine.
- **Overlay.** The Elena Sokolova chat dialog sits at the right edge of the page, under the
  side panel (00006 onwards, x ~ 865-893): the person cannot see what covered four of the
  Confirms the Flow needed. The page under the panel is unreadable at the right edge.
- 00010: the home feed shows skeleton placeholders while the repair "opens" pages that
  were never opened.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | The amendment schema's repeat recipe began "**first rerun the listing** with a where", unconditionally; a model whose listing already had the right `where` reran it unchanged three times (#14-#16, its chat says so) | Core `R/flow-draft/amendment.ts:145` HEAD | **Fixed (w24c):** three steps in order; "rerun it only when its where is missing or wrong, never to run it again as it stands"; "The repeat goes on the act, never on the listing itself" (`:153` now); `over` says "the listing, a step before this one" (`:160` now) | t195-w24c |
| 2 | The per-item telling "add the act done to one item, then amend_draft repeat over the listing step" did not say the repeat goes on the press; the model sent `13 repeat over 13` with no press in the draft | Core `R/flow-draft/entry.ts:46` HEAD (and `:39` transcript telling) | **Fixed (w24c):** "three steps in this order ... do the act to one row it kept -- press that row's own control -- and add that press with its act; then send amend_draft {"step": <that press>, "change": "repeat", "over": <the listing>} ... The repeat goes on the press, never on the listing, and a listing that already keeps the right rows is not run again" (`:52`, `:45` now) | t195-w24c |
| 3 | `over_not_before` told the rule in general and named no step; with no press in the draft, "send {step: <the act>...}" had nothing to point at | Core `R/llm/draft-amendment-feedback.ts:55` HEAD, `R/flow-draft/amendment.ts:309` HEAD | **Fixed (w24c):** the refusal carries the `over` it named (`amendment.ts:130,319,235` now); the feedback adds `next` with numbers: "Step 13 is the listing, so the repeat cannot go on it. No step after step 13 does anything to a row yet ... do it to one row step 13 kept -- press that row's own control ... with add true and its act, then send {"step": <that press>, "change": "repeat", "over": 13}", or names the press after the listing (adding "add step N with its act, then" when it is not in the Flow) (`draft-amendment-feedback.ts:162-190` now) | t195-w24c |
| 4 | `changes_nothing` on an unchanged rerun of a listing said "go on with the result you have" without saying to what; "repeated" added only "stop sending it" | Core `R/llm/draft-amendment-feedback.ts:57,75` HEAD | **Fixed (w24c):** reason text adds "A listing whose rows are right is never run again: go on to the act on one row it kept" (`:68` now); for a read step `next` says "Step 13 already ran with exactly this argument, so its result stands as shown: do not run it again ..." plus the row-act sentence; the instruction says "next ... is what to do instead" (`:90` now) | t195-w24c |
| 5 | The "See all" press (`t554`, step 8) ran and was never added; the Flow's listing replays on the Friends home (4 requests, partial) | model behaviour against `R/flow-draft/entry.ts` telling; no check catches a Flow step that reads a page only a non-added step reached | Not fixed. A check belongs where the replay/judgement runs: a listing whose `location` at build differs from the page the replay reaches it on | lane D (F39 See-all) / lane B (judgement) |
| 6 | The repair's first look is refused `not_at_start_location` though the test left the browser on `friends/`; the repair never sees a page packet (no handles, no hrefs) | Core repair lifecycle (`R/flow-bootstrap/unfinished-build/`) / domain start-location guard | Not fixed. The repair's opening look must be answered on the page the test left | lane B |
| 7 | RG's refused-repeat count resets on any non-consecutive iteration; seven refused identical navigations interleaved with looks answered from memory never reached 3 | Core `R/llm/repeat-guard/outcomes.ts:130` | Not fixed. Count refused repeats of the same call since the page last changed, not in consecutive iterations | lane B |
| 8 | `address_not_shown` refused the correct requests URL in the repair because no evidence of that round carried its href; `find_on_page` shows links without hrefs | domain navigate guard / `web.find_on_page` result | Not fixed. Either the guard accepts addresses the build's earlier rounds saw, or find results carry a link's href | lane B (with the domain owner) |
| 9 | The stall's chat line says "every attempt to finish was refused" when the stop was refused repeats | Core `R/flow-bootstrap/unfinished-build/phases.ts` telling | Not fixed | lane B |
| 10 | The final failure message is posted twice; refused calls post a reason line with no card; cards say "Click · the page" and "the step wasn't accepted" with no control name or reason | extension chat UI | Not fixed | t191 |
| 11 | Latent next obstacle: 4 of the 8 Confirms (`t787`, `t799`, `t835`, `t847`; two of them kept rows) were `covered-by t850` (chat dialog) | scenario page; the Flow needs an optional dismissal before the loop | Not reached in this run; watch for it in run 38 | lane D |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| Header | The Lab's accounting saw 1 call and $0 for a 33-call, $0.0962 chat build (`live-llm.json observed.calls: 1`, `flow-lane.json build.providerCalls: null`) | Lab live-llm/flow-lane snapshot writers |
| 2 | The model's reasons (its chat lines) are only in the screenshots, not in the decision dumps | decision-dump writer (decisions carry no reason/say field) |
| 2 | The request's decision schema (the amendment schema text actually sent) is not in the dumps; only the evidence entries are | decision-dump writer |
| 4 | Per-node durations and retries of the unfinished-build test | unfinished-build test / dumps |
| Header | The command line that started the run | `run.json` |
