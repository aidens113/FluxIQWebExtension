# Run debug — `run-murz83zy-5030820f`

t195 lane D, slot-4, live round 1002-M run 2: social-network-feed `confirm-requests`, built from the extension chat,
after Fixes 1-4 of `reports/t195-lead-1002M.md` (R2 `at`, R3/R7 an act never done twice, R4 read-before-act note, R6
tested values for the judge). Debugged from `test-runs/instances/t195-slot-4/run-murz83zy-5030820f/` (`steps/`
0001-0092, `snapshots/flow-lane.json`, `logs/core.log`) and `run-murz83zy-5030820f.ui-review.local/` (11 moments).
Trees: downstream `45965d7d` + lane changes, Core `424a70b3` + lane changes, Core rebuilt before the run; the Lab
prelude rebuilt domain and extension. `R` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`.

**What decided this run, in one line:** the model pressed Amara's Confirm before it ran the listing, so the listing
came after the act, and every `repeat <act> over <listing>` it sent (five in round 0, one in round 1) was refused
`over_not_before`, whose words told it to send exactly that and never named `reorder`; the judge then refuted a Flow
whose Confirm was, correctly, a single click (on Tom's card, the template the model chose from the column's `at`).
Round 2 got the repeat in place (a new press on Freya, repeated over the listing) but the purse ran out before that
test was judged.

## Header

- Run id: `run-murz83zy-5030820f`; no runtime run (no Flow proposed).
- Scenario / task: `social-network-feed` / `social-network-feed-confirm-requests` (expected-dataset, 4 records).
- Command: as `run-murwcaj0-40e56557` (launcher `live-run-d.sh 2`). Live guard `admitted`, fingerprint
  `sha256:b6302982...` (changed). Headed.
- Date, provider, model: 2026-10-03 05:56-05:59Z (2026-10-02 22:56 PDT); DeepSeek `deepseek-flash`. Entry: chat
  (`became: build`, ending `failed`, 177.5 s).
- Provider calls, cost (step logs): **40 calls, $0.087679**: interpreter $0.000301; round 0 exploration 25 decisions
  $0.060066 + consequence reading $0.000318; round 1 3 decisions $0.007394; judge 2 calls $0.002056; round 2 8
  decisions $0.017543. Ledger $0.08767878, `buildsOverCeiling: 0`. No balance failure.
- Verdict: `failed`, `runtime.behavior`, `lab.chat_build_failed`; ending "The build stopped at its spending limit of
  $0.10 before the Flow was finished ... left $0.012, too little for another round".
- **Stage reached: 6 inside the build** (three rounds, one judged test refuted, the last test run whole but unjudged
  for money); no Flow, no playback.

## Stage 1 — the instruction and the expected chain

As in `run-murwcaj0-40e56557` (unchanged; written before reading either run). Expected: Amara Osei / "23 mutual
friends", Jonas Weber / "Aisha Khan and 4 other mutual friends", Lin Zhao / "11 mutual friends", Freya Holm / "5 mutual
friends". Chain: open, dismiss consent/notifications (optional), reach `~/friends/requests/`, close chat (optional),
list the 8 cards filtered to >= 5 mutual friends, press each kept row's Confirm (one press repeated over the listing),
re-read the list for "Request accepted" rows in order with `name`, `mutualFriends` verbatim.

## Stage 2 — exploration and repairs

| # | Decided | Action | Core said | Cost |
| --- | --- | --- | --- | --- |
| 0003 | dismiss consent | click `t476`, add | ok | $0.003443 |
| 0005 | open Friends | click `t12` | `target_covered` by the notifications layer, closeWith `t479`,`t481` | $0.002387 |
| 0007 | close prompt | click `t481` "Not now" | ok | $0.003435 |
| 0009 | open Friends | click `t12` | ok, `~/friends/` | $0.002424 |
| 0011 | close chat | click `t682` | ok | $0.002045 |
| 0013 | open requests | click `t542` "Friend requests" | ok | $0.002054 |
| 0015, 0017 | detect `t754` | extraction.1, .2 (8 items) | — | $0.003852 |
| 0019-0021 | detect `t754` x3 | not run: `already_answered` | — | $0.005326 |
| 0022 | press Amara's Confirm | click `t775`, `modify_existing`, add, act a1 | ok: "Request accepted" | $0.003288 |
| 0024 | consequence reading | instructed `modify_existing` quoted | — | $0.000318 |
| 0025 | detect | extraction.3 | — | $0.002445 |
| 0027 | amend: drop 13, add 14 `to: 8`, add 13 `to: 9`, repeat 13 over 14 | 2 applied, 13 and 14 `not_a_kept_step` (they were detections) | $0.002278 |
| 0028 | detect | extraction.4 | — | $0.001811 |
| 0030 | **amend: rerun 9 (Amara's Confirm, act a1) with `t763`, repeat 9 over 8** | **R7 live: reset, then `replay: verify` of `t763` (Tom's Confirm): "visible and enabled; it was not run"** -- the step takes Tom's card as its template; Tom is not accepted | $0.002219 |
| 0033 | detect | extraction.5; the "Request accepted" column now has an `at` (R2 live) | — | $0.002225 |
| 0035 | read | extract_list `{name, mutual, status}` (status = the "Request accepted" column) | 8 rows | $0.002316 |
| 0037 | amend: add 18 act a1 | `act_on_a_read` | $0.003218 |
| 0038 | amend: rerun 18 with where `atLeast: 5` | reset; act step 9 verified (not pressed); read: **4 rows, Jonas kept** | $0.003021 |
| 0042, 0043, 0044, 0046 | amend: repeat 9 over 18 (+ keep) | **`over_not_before`** each time | $0.010127 |
| 0045 | amend: rerun 18 | `changes_nothing` | $0.002157 |
| 0047-0054 | exploration stopped (unusable decisions); test of the draft | Confirm (Tom template) `verified`; listing 4 rows | — | — |
| 0055-0059 | round 1 (t241 look; rerun 7; keep 7; complete) | repeat 6 over 7 refused again (trace) | $0.007394 |
| 0060-0067 | test | Confirm (Tom template) `verified`, listing 4 rows (R6 live: left-out rows carry "1 mutual friend", "4 mutual friends", "", "3 mutual friends") | — | — |
| 0068, 0069 | judge x2 | `no`: "confirms only one friend request (Tom Becker) and never repeats"; also "No step outputs the accepted requests" | $0.002056 |
| 0070-0078 | round 2: look, detects, rerun 7 | 4 rows | $0.006 |
| 0079 | press Freya's Confirm | click `t835`, `modify_existing`, add, act a1 | ok: "Request accepted" on Freya (a kept row) | $0.002705 |
| 0081-0083 | amend: rerun 7; repeat 13 over 7 | repeat applied (the test runs it after the listing) | $0.006705 |
| 0084-0092 | test | Confirm on Tom's template `verified` (single, unrepeated); listing 4 rows; Confirm on Freya's template `verified` (repeated) | — | — |
| end | — | purse: $0.088 spent, $0.012 left < $0.015 for a decision and a judge: not judged | — | — |

## Stage 3 — the proposed Flow

None proposed. The last draft tested (0084-0092): navigate `~/`; Decline cookies; Friends; Close chat; Friend
requests; **Confirm, template Tom Becker's card, act a1, unrepeated**; listing `where atLeast 5` (4 rows, Jonas kept);
**Confirm, template Freya's card, act a1, repeated over the listing**. No read after the confirms (R4's note: not
seen to fire; the listing with `status` was kept before the repeated act, so every read giving the columns was before
the last act -- see open question).
- Divergences: the unrepeated Tom Confirm (R10, the model never dropped it); no post-confirm read; the popup dismissals
  kept unconditional.

## Stage 4 — replay (the build's tests)

- Act steps are checked, not done again (R3 live): 0053, 0066, 0090, 0092 `core.replay.verified` "it was not run".
- Consent and Close chat `remembered`; navigation and listing `replayed`.
- t243 state routing / t250: no `state_routed` row (nothing unavailable). t243 open item 2: not exercised.
- Provider calls during replay: zero.

## Stage 5 — the answer

NO EVIDENCE: no Flow proposed. Records expected 4, returned 0.

## Stage 6 — judgement and repair

- Judge (round 1's test): `no`, stillAchievable yes, advice "Step 6 must repeat the confirm over the rows step 7 keeps
  ... Step 7's condition should select the requests now shown as accepted". Right this time: the Confirm was not
  repeated. It read the R6 values and did not object to the filter (Jonas kept).
- Repair: two rounds; t240 did not stop it; the purse did (honest money ending, not "not doable").
- t244 `core.run_flow`: not used. t249: not exercised.

### UI review (11 moments)

- **R7 verified on the page:** at the end only Amara and Freya show "Request accepted"; Tom Becker still has Confirm.
- **U5 (new, from R7):** 05 shows "Click · Confirm — Working on it" and the overlay "Checking an earlier step is still
  done: clicking “Confirm”" for the rerun that was only checked; the card says a press happened that did not.
- **U6:** the money ending (11) says "The Flow so far was kept, and building again carries on from it" and then "What
  is left: the Flow ..., empty"; also "1 of the 1 things you asked" (plural) and internals ("decisions", "the model").
- Overlay: a readable card at every moment, no dot, no flicker; "Couldn't fix your Flow / Build stopped: a budget ran
  out" at the end. It sits over Freya's and Marta's buttons at 863,638.

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| R8 | **`over_not_before` never says how to put the listing first.** The listing (18) ran after the act (9); the refusal said "over names that listing, and it must come before the act: send {step: <act>, change: repeat, over: <listing>}", which is what the model sent six times. `reorder` exists in the schema; the refusal does not name it. | Core `R/flow-draft/amendment.ts`, `R/llm/draft-amendment-feedback.ts` | Say, with the real numbers, to reorder the listing before the act, then repeat. | t195-w38 |
| R9 | **The act's template is the column's `at` (Tom's card).** The model took the Confirm column's `at` (the first card) as "the Confirm control" in both runs; the schema says "that row's own control, never one on a row it leaves out". At playback a repeated step is re-found in each row (`draft-routing.ts` wires the For Each `item`; domain `scopedToRow`; the extension's record gate), so a repeated template is harmless; an unrepeated one presses Tom. | domain `structure/packet.ts` (`AT_NOTE`) | Say `at` is one item's own element: acting on it acts on that item. | t195-w39 |
| R10 | **An unrepeated act step stayed beside the repeated one.** Step 6 (Tom, single) and step 13 (Freya, repeated) both do a1; nothing in the draft says to drop step 6. At playback it would accept Tom once. | Core `R/flow-bootstrap/instructed-acts/` | The checklist marks a single-row step of a plural act when another step repeats it: drop it. | t195-w38 |
| J1 | **The judge reads a repeated press's template row as its only object** (run 1 round 0: "one remembered target repeated"). | Core `R/result-verification/build-test/summary.ts`, `R/llm/diagnosis-instructions.ts` | A repeated step's target says it is found again in each row of its listing; the judge is told so. | t195-w39 |
| R11 | **not_doable after a repair that made no measured progress** (run 1): `phases.ts:401` ends `no_progress` as `not_doable`, though the judge said stillAchievable yes and named the fix (supervisor's defect 2; user rule: not doable only when there is absolutely no way). | Core `R/flow-bootstrap/unfinished-build/phases.ts`, `progress.ts`, `not-doable.ts`, `not-done.ts` | not_doable only on a judged "cannot be had"; other stops end as not done with the judge's advice; one more round when the judge named a fix and the purse funds it. | t195-w37 |
| M1 | The purse ran out before round 2's test was judged ($0.012 left). | — (the $0.10 rule) | R8/R10 would have saved round 0's six refused amendments (~$0.013) and round 1. | — |
| U5 | A checked rerun is shown as a click in the chat card and overlay. | extension chat / Core activity wording | Say it was checked, not pressed. | lane B (finding) |
| U6 | Money ending: "kept, carries on from it" and "empty"; "1 things". | Core `R/flow-bootstrap/unfinished-build/not-done.ts` | — | t195-w37 (plural, contradiction) / lane B |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 3 | (Answered from `steps/*/request.txt`.) R4's note fired live in round 2 (0081-0083): "Every read in the draft that gives "name", "mutualFriends" runs before step 13, the last step that does what the instruction asks ...". Rounds 0-1 got the older note instead ("a column "mutualFriends" that no read in the draft gives", 0037-0056), because the model named the column `mutual`. The build ran out of money before acting on it. | — |
