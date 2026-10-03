# Run debug — `run-murdouox-c5294247`

t195 lane D, slot-4, live round 1002-L run 1: social-network-feed `confirm-requests`, built from the extension chat.
Debugged from `test-runs/instances/t195-slot-4/run-murdouox-c5294247/` (`steps/`, `snapshots/flow-lane.json`,
`run.json`) and `run-murdouox-c5294247.ui-review.local/` (9 moments). Trees level with dev: downstream `76a9eede`, Core
`2bc0baac`, Core libraries and extension built 12:44-12:45 PDT. `R` = Core
`packages/fluxiq/src/programs/automation-studio/runtime/`.

**What decided this run, in one line:** the build's own Confirm on Amara removed her row's Confirm button, and the
listing's `confirm` column was required (the detection measured it on every card, so it proposed `required: true`), so
the Flow's listing failed when the test replayed it (R2). The repair's corrected listing never ran, because a rerun's
input is merged over the old argument and the column map the model rewrote kept the columns it left out (R3).

## Header

- Run id: `run-murdouox-c5294247`; Flow `flow.d5de844c-2c63-440a-91d6-61fe367a9d95`; no runtime run (no Flow was proposed).
- Scenario / variant / task: `social-network-feed` / none / `social-network-feed-confirm-requests` (judgeBy
  `expected-dataset`, step `extract-confirmed`, 4 expected records).
- Command (from `fxwork/t195/!FluxIQWebExtension`, launcher `live-run-d.sh` in this lead's scratchpad):
  `FLUXIQ_LAB_INSTANCE=t195-slot-4 FLUXIQ_BUILD_PROGRESS_TRACE=1 FLUXIQ_LAB_KEEP_RUN_STATE=1
  FLUXIQ_BUILD_DECISION_DUMP=<tree>/test-runs/instances/t195-slot-4/decision-dumps node scripts/lab/run-lab.mjs run
  social-network-feed --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task
  create-flow --instruction-task social-network-feed-confirm-requests --llm-max-input-tokens 992000
  --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 64 --llm-cost-ceiling-usd 0.10 --evidence events`.
  The live guard admitted it (`state: admitted`).
- Date, provider, model: 2026-10-02, run 19:51:01Z, build 19:55:05-19:57:15Z (131.1 s from the chat turn); DeepSeek
  `deepseek-flash`. Entry: **chat** (`build.chat`: person turn 1, answer turn 2, `became: build`, ending `failed`).
- Provider calls, tokens, cost: **26 calls, $0.056213 from the step logs** (379,983 in, 3,655 out): chat interpreter 1
  ($0.000339); exploration 20 decisions ($0.045694); the consequence reading 1 ($0.000318); repair round 4 decisions
  ($0.009862). No judge call. The Lab's figure is 24 calls and $0.055874 (see gaps). No balance failure.
- Verdict as reported: `failed`, `runtime.behavior`, `lab.chat_build_failed`; `flowCreated: false`; `stoppedAt: build`.
- **Stage reached: 4 (partial).** Exploration ended without completing; the draft as far as it got (8 steps) was tested
  from its start and failed at its step 7. Nothing was proposed, run or judged, so stages 5 and 6's judge did not run.

## Stage 1 — the instruction and the expected chain

Written before reading the run, unchanged from run 38's debug (`debugs/run-muqilf9s-c3211328.md`).

- The instruction, verbatim (step 0001): "Go through my friend requests and confirm everyone I have at least five mutual
  friends with, and leave every other request as it is. Then give me a table of every request the list now shows as
  accepted, in the order the list shows them, with columns name and mutualFriends, where mutualFriends is written exactly
  as their request shows it."
- The node chain a correct Flow must have:
  1. Open the start (feed). Dismiss the consent banner and the notifications prompt, optional.
  2. Reach `~/friends/requests/` (all 8; the Friends home shows 4). Close the site's chat popup, optional.
  3. `dom-extract_list` over the 8 cards with `name` and the mutual-friends column, with a `where` keeping a count of at
     least 5. "Aisha Khan and 4 other mutual friends" counts as 5.
  4. Press that row's own Confirm on one kept row, with `repeat` over the listing.
  5. Re-read the list for the rows showing "Request accepted", in list order, with `name` and `mutualFriends` verbatim.
- Expected: Amara Osei / "23 mutual friends", Jonas Weber / "Aisha Khan and 4 other mutual friends", Lin Zhao / "11
  mutual friends", Freya Holm / "5 mutual friends".
- A wrong answer that looks right: a `where` like `(?:[5-9]|[1-9][0-9]+) mutual`, which drops Jonas; a table taken from
  the pre-confirm read; Tom or Priya confirmed.

## Stage 2 — exploration

Cost is the step log's `costUsd`. "Core said" is what the next request showed the model.

| # | Asked | Decided | Action and parameters | Result (Core said) | Cost |
| --- | --- | --- | --- | --- | --- |
| 0001 | chat interpreter | `flow.createHere` | the instruction | build started | $0.000339 |
| 0002 | — | free opening | navigate `~/` | consent DIALOG covers the page | — |
| 0003 | decide 1 | dismiss consent | click `t476` "Decline optional cookies", add | ok, kept | $0.003545 |
| 0005 | 2 | open Friends | click `t12` | `target_covered` by `t478` (notifications), closeWith `t479`,`t481` | $0.002340 |
| 0007 | 3 | close prompt | click `t481` "Not now" | ok, kept | $0.003321 |
| 0009 | 4 | open Friends | click `t12`, add | ok, `~/friends/`; chat popup DIALOG | $0.002348 |
| 0011 | 5 | close chat | click `t682` "Close chat" | ok, kept | $0.001961 |
| 0013 | 6 | detect | `t553` | extraction.1, 2 items (wrong list) | $0.001995 |
| 0015 | 7 | detect | `t557` | extraction.2, 4 items (Friends home cards), fields carry `at` | $0.001526 |
| 0017 | 8 | open full list | click `t542` "Friend requests" | ok, `~/friends/requests/`, kept | $0.001769 |
| 0019 | 9 | detect | `t749` | extraction.3, 8 items | $0.002345 |
| 0021 | 10 | detect again | `t749` | extraction.5, 8 items (`sameAs` 9: a repeat, not refused) | $0.001822 |
| 0023 | 11 | read | extract_list extraction.5 `{name, mutual, confirm}`, where `mutual contains "mutual friends"` | **succeeded, 6 rows, firstRows shown** (C1 gone) | $0.002133 |
| 0025 | 12 | amend: keep 12, rerun 12 with where `matches "(?:[5-9]\|[1-9][0-9]+) mutual friends"`, add 12 and 13 act a1 | rerun.12: 3 rows (Amara, Lin, Freya; **Jonas dropped**); add 13 `no_such_step` | $0.002797 |
| 0027 | 13 | amend: keep 12, drop 13, rerun 12 same | all refused `already_in_flow`, `already_out`, `changes_nothing` | $0.002695 |
| 0028 | 14 | the same amendments again | refused, `repeated: true` | $0.002220 |
| 0029 | 15 | press Amara's Confirm | click `t775`, `modify_existing`, add, act a1 | ok: `t860 "Request accepted"` appeared | $0.002047 |
| 0031 | consequence reading | complete | instructed `modify_existing` quoted | (logged `phase: read`) | $0.000318 |
| 0032 | 16 | amend: repeat 14 over 12 through 14 | **applied**: step 14 `runs: "repeats through step 14, over step 12"` | $0.002660 |
| 0033 | 17 | amend: repeat 14 over 12 | refused `already_so` | $0.001657 |
| 0034 | 18 | amend: rerun 12 unchanged | refused `changes_nothing`, repeated | $0.002547 |
| 0035 | 19 | amend: repeat 14 over 12 | refused `already_so`, repeated | $0.002006 |
| 0036 | 20 | amend: repeat 14 over 12 | refused `already_so`, repeated → exploration stops `unusable_decisions` | $0.001961 |

- Repeats: 0027/0028 and 0033-0036. Every summary from 0032 on says "Adding the repeat" after the repeat was applied and
  shown on step 14. The model never added the second read the table needs (stage 1 step 5).
- What pointed it at step 12: the draft's `acts` carried `{"note": "The instruction asks for a column \"mutualFriends\"
  that no field of step 12 reads."}`. Step 12 is the filter listing the repeat runs over, not the result table, so the note
  steered it to rewrite or rerun that listing (0034) rather than add a read after the confirms. The note is written by
  `R/flow-bootstrap/authoring/instruction-record-columns.ts` (owned by t243; not edited here, see R4).
- Rejections: `target_covered` (0005) named the layer and its close controls and the model routed round it in one
  decision. `already_so`, `changes_nothing` and the repeat flag each said what they meant; the model ignored them.
- Context: nothing evicted; decision requests 11.8k-19.4k input tokens. The `core.route_state` observations are in the
  evidence (7 of them).

## Stage 3 — the proposed Flow

No Flow was proposed. The draft as tested (step numbers as the test numbered them):

| Step | Node and parameters | Disposition |
| --- | --- | --- |
| 1 | `browser-navigate` `~/` | kept |
| 2 | `dom-click` `t476` "Decline optional cookies" | kept (not optional) |
| 3 | `dom-click` `t481` "Not now" | kept (not optional) |
| 4 | `dom-click` `t12` "Friends" | kept |
| 5 | `dom-click` `t682` "Close chat" | kept (not optional) |
| 6 | `dom-click` `t542` "Friend requests" | kept |
| 7 | `dom-extract_list` extraction.5 `fields {name, mutual, confirm}`, `where matches "(?:[5-9]\|[1-9][0-9]+) mutual friends"` | kept |
| 8 | `dom-click` `t775` "Confirm", `modify_existing`, act a1, repeat through 8 over 7 | kept |

- Divergences from stage 1:
  - Step 7's `where` drops Jonas Weber ("Aisha Khan and 4 other mutual friends"): misread the page (the model wrote a
    digit regex over a line whose count is in words).
  - Step 7 reads `confirm`, the button column. Not wrong in itself, but it made the column required (R2).
  - No read after the confirms (stage 1 step 5): the model never wrote it (R1, R4).
  - The popup dismissals are not marked optional. With F38/F39 on dev the test remembered them; not a failure here.

## Stage 4 — replay (the build's test, round 0 and round 1)

| Node | Executed | Produced | Duration | Retries | Rung |
| --- | --- | --- | --- | --- | --- |
| reset | yes | page put back to `~/` | — | 0 | — |
| 1 navigate | yes, `replayed` | — | — | 0 | — |
| 2 Decline cookies | `remembered` (no banner after reset: site data kept) | — | — | 0 | — |
| 3 Not now | `remembered` | — | — | 0 | — |
| 4 Friends | `replayed` | `~/friends/` | — | 0 | — |
| 5 Close chat | `remembered` | — | — | 0 | — |
| 6 Friend requests | `replayed` | `~/friends/requests/` | — | 0 | — |
| 7 listing | **`core.replay.failed`**, `required_fields_missing`, missing `confirm`, 3 rows read of 8 | — | 6.7 s | 0 | none |
| 8 Confirm | `verified` (target present; a lasting effect is never repeated, D1) | — | — | 0 | — |

- Why step 7 failed: the page the test read had Amara's card as the build left it, "Request accepted" and a Message
  link, no Confirm button (0044's page: `t860 "Request accepted"`). Amara still passes the `where` (23). Her row has no
  `confirm`, and `confirm` was required. Where `required` came from: the read named its columns by the detection's keys
  (`fields: {confirm: "div_x0531l50_..._xu37y6r"}`), and the domain copies the detected column's spec
  (`domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts` `namedColumn`, `structuredClone(spec)`), whose
  `required` is `coverage >= 1` (`apps/extension/src/content/extraction/infer-fields.ts:267-275`). At detection time
  every card had a Confirm, so the column was required. The page's own rule since 2026-09-26
  (`apps/extension/src/content/actions/extract-list.ts:178-197`) is that a column some rows lack is a stated gap, never a
  failure, unless the author wrote `required: true`. The model never wrote it.
- The same holds in a real run: after the build, the person's Amara stays accepted, so the Flow's first run fails at
  its listing too.
- Provider calls during replay: zero.
- Round 1's test (0053-0061) is identical, step for step, because the repair changed nothing (stage 6).

## Stage 5 — the answer

- NO EVIDENCE of an answer: no Flow was proposed, run or judged. Records expected 4, returned 0.
- What the draft would have produced had step 7 passed: Amara, Lin, Freya from the pre-confirm listing, with `mutual`
  (not `mutualFriends`) and `confirm` columns. Jonas missing; the table taken before the confirms.

## Stage 6 — judgement and repair

- Judge: not called. The round-0 test failed at step 7, so no judge ran; C7's reply cap was not exercised.
- Repair: triggered automatically (`core.resumed`: `stopped: unusable_decisions`, `test: replay_failed`,
  `stepsThatDidNotWork: [7]`, `actsDone: 1`, `actsTodo: []`).
- **C3 + t241 verified live:** the round opened with a look where the test left the page (0046 `dom-capture_snapshot`,
  `held` = the Flow's 8 calls), on `~/friends/requests/`. No opening navigation was appended: the draft stayed 8 steps
  plus the look (step 9, `look`).
- Context the repair received: the Flow with step 7 marked `replayed: failed` (present); the failure's record
  (`core.resumed` outstanding codes) (present, but **not** the read's own `required_fields_missing` / `missingFields`:
  that reached the model only after its own rerun failed); the page where it broke (present, the look); the
  conversation (instruction present); prior steps' parameters and results (present in the draft).
- The repair's decisions:
  - 0047: rerun 7 with `fields {name, mutualFriends, confirm}` (renaming `mutual`). **Core ran
    `{name, mutual, confirm, mutualFriends}`** (`rerun.7`): the rerun input is a JSON merge patch
    (`R/llm/evidence-loop/rerun-input.ts`), so the omitted `mutual` stayed. It failed `required_fields_missing: confirm`.
  - 0050: the same rerun again → `repeat_refused` (refusedInARow 1).
  - 0051: rerun 7 with `fields {name, mutualFriends}` (dropping `confirm`, which is exactly the fix). Merged over step
    7's `{name, mutual, confirm}` it became the same call that had failed, so it was refused `repeat_refused` with "You
    already made this exact call". From the model's side it had not.
  - 0052: rerun 10 (the failed rerun's own step) with the same fields → `repeat_refused`, third in a row: round ends.
- **C8 / t240 verified live:** the round handed back the same Flow; its test failed at the same step; Core stopped with
  "made no measurable progress on the round before it" rather than opening a second identical round. $0.0457 was left.
- Not exercised: C4/C5 (no refuted result), C7 (no judge), C9/F38/F39/t242 skips at playback (no playback).

### UI review (screenshots in `run-murdouox-c5294247.ui-review.local/`)

- 03-mid-build-panel: clean ChatGPT-like stream; cards name the control ("Click · Friends", "Click · Not now"); the
  covered click says "Didn't work: a popup or banner on the page was covering it". Good (t193 verified live).
- 05-mid-build-panel: **every refused amendment is shown as work done**: three "Updating the draft Flow — Adding the
  repeat ..." entries and "Rerunning the request listing ..." for 0033-0036, all of which Core refused (`already_so`,
  `changes_nothing`). Same family as run 38's "Done" on refused reads. Then "Testing the Flow so far — The build stopped
  before the Flow was finished: too many of its decisions in a row could not be used, because the model kept asking for
  changes ..." exposes internals ("the model", "decisions").
- 09-failure-panel: the ending is one long paragraph of internals: "I tried 2 times live -- exploring, then one repair
  after testing what I had -- over 24 decisions ... no more of the **1 things** you asked had a step (1, as before)".
  Then "Before that I created the Flow ... and saved what it should do", which contradicts "I could not build this
  Flow". Then "FluxIQ attached something you can see in FluxIQ. Open FluxIQ", which says nothing. Sources: Core
  `R/flow-bootstrap/unfinished-build/not-doable.ts:70-84`, `R/conversations/commands/create-here.ts:49`, extension
  `apps/extension/src/panel/chat/view/message-view.ts:41`.
- Overlay: present from the first action; 04/06/08/09 show "Building your Flow / Trying step 12 again: reading the list —
  done" (exposes a step number), "Testing the Flow so far", "Couldn't fix your Flow / Not doable: this Flow could not be
  built". At moments 3, 5 and 7 the overlay is a 30x30 dot (x 1217 y 345 on `~/friends/`, x 16 y 674 on the feed) with
  its text unreadable. Moment 3 sampled 3 text changes in 3 s (`flickering`), moment 2 one presence toggle.
- 04/07 scenario: thick dark outlines stay drawn round page regions and each card's mutual-friends line during the
  build and the test. NO EVIDENCE of their source in the bundle; they look like FluxIQ's detection highlight.
- Site state after the build: only Amara accepted. The build acted on no one the instruction said to leave alone (run
  38's C6 did not recur).

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| R1 | **The model looped after its repeat was applied** (0033-0036) instead of adding the post-confirm read, and the exploration stopped `unusable_decisions` with all acts done and no result table. | model; steered by R4 | None in code beyond R4. | — |
| R2 | **A detected column is required because the detection saw it on every item.** `namedColumn` copies the detected spec, whose `required` is `coverage >= 1`. A column the Flow's own act removes from a row (Confirm → "Request accepted") then fails the whole read, in the build's test and in every later run on the person's page. | downstream `domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts` (source: `apps/extension/src/content/extraction/infer-fields.ts:273`) | **Done:** a column named from a detection is required only when the read writes `required: true`; otherwise a row without it is the stated gap (`blankFields`, `incompleteRecords`). A condition's own read is unchanged (the page forces it required itself, `item-filter.ts:144`). Failing-first test `plan-resolution/extraction/tests/columns.test.ts`. | this lane |
| R3 | **A rerun cannot rename or drop a column.** The rerun input is a merge patch, so a column map the model rewrites keeps every column it left out: 0047's rename ran with both names, and 0051's corrected map merged back into the failed call and was refused as an exact repeat the model never made. | Core `R/llm/evidence-loop/rerun-input.ts` | **Done (rename):** a key the patch adds whose value is the word of exactly one key it leaves out (or an object restating that key's stored object) renames it, keeping the stored members the model was not shown; the schema text says a left-out key is kept and how a rename reads. **Not done:** dropping a left-out key of a restated map, because the merge cannot tell a key the model saw from one the screen withheld (`selector` in a re-author's column specs) without the domain's denied keys, which the loop input does not carry (follow-up in the lane report). | this lane |
| R4 | **The draft's column note names the filter listing.** "no field of step 12 reads mutualFriends" points at the listing the repeat runs over, when the instruction's table is a read of the list after the acts. | Core `R/flow-bootstrap/authoring/instruction-record-columns.ts` | Say that no read of the Flow gives the column, without naming the listing an act repeats over (or name the last read after the last act). **Not edited: t243 owns `R/flow-bootstrap/authoring/**`.** | t243 / supervisor |
| R5 | **The model's `where` drops Jonas** (a digit regex over "Aisha Khan and 4 other mutual friends"). Recurs since run 34. | model | None in code now; the judge would refute it had the Flow been judged. | — |
| R6 | **The repair round was not told why step 7 failed** until it reran it: `core.resumed` lists codes (`core.replay.failed`) without the read's `required_fields_missing` / `missingFields`. | Core `R/flow-bootstrap/unfinished-build/` (the resumed entry) | Carry the failed step's reason and detail into `judgement`. Not done this round. | Core loop (supervisor) |
| U1 | Refused amendments shown as "Updating the draft Flow — ..." in the chat. | extension chat activity / Core progress words | A refused amendment's card says it changed nothing. | lane B (t193) |
| U2 | The not-doable ending: internals, "1 things", and "Before that I created the Flow ... and saved what it should do" after a failed build. | Core `not-doable.ts:70-84`, `conversations/commands/create-here.ts:49` | Plural fixed here (see report); wording to lane B. | this lane (plural); lane B |
| U3 | Overlay collapses to a 30x30 dot at varying corners with its text unreadable; one flicker sample. | extension overlay | — | lane B |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 1 | `snapshots/flow-lane.json` for a lane that stopped at build has no `buildEntry` (the complete snapshot has it); the entry had to be read off `build.chat`. | downstream `packages/test-runner/src/flow-lane/creation/lane.ts` (`incompleteCreatedFlowLaneEvidence`) |
| cost | The Lab's `providerCalls: 24` / `$0.055874` against the step logs' 26 calls / `$0.056213`: the chat interpreter's cost is left out, and the consequence reading's call is left out of the count but not the cost. | Core build accounting (the `runtime.settle` total) |
| 2 | 0031, the consequence reading, is logged `kind: decide`, `phase: read`, `iteration: 1` with a summary "No page evidence exists yet ..." that reads like a decision. | Core step-log meta for the consequence task |
| 4 | The source of the dark outlines on the page during the build. | NO EVIDENCE |
