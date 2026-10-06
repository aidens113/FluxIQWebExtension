# Run debug — `run-musp474o-e0ed7432`

t195 lane D, slot-4, live round 1003 run 1: social-network-feed `confirm-requests`, built from the extension chat on
the tree synced to dev (downstream `45bd6232`, Core `6beae684`: t252 general authoring and t254 true purse landed).
Debugged from `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-03/run-musp474o-e0ed7432/` (`steps/` 0001-0124,
`snapshots/flow-lane.json`, `snapshots/live-llm.json`) and the bundle's `run-musp474o-e0ed7432.ui-review.local/` (12
moments). `R` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`.

**What decided this run, in one line:** the build did author the row-general Flow (listing with a `where`, the Confirm
pressed once on a kept row, `repeat` over the listing, tested once per kept row and never pressed), but (a) the
per-row check checked the template card's control on every pass, not the row's own (extension `assert.ts`); (b) the
model's regex `where` dropped Jonas, which the judge caught; (c) round 2 applied the judge's fix, then a rerun's stale
receipt, inserted as step 7 with the old `where`, drew three useless reruns and the round stopped short; and (d) that
stopped round's clean, changed Flow was never put to the judge, so the build ended "not finished" with half its purse.

## Header

- Run id: `run-musp474o-e0ed7432`; no runtime run (no Flow proposed).
- Scenario / task: `social-network-feed` / `social-network-feed-confirm-requests` (expected-dataset, 4 records).
- Command: launcher `t195-live-run-d.sh 1` (scratchpad): `FLUXIQ_LAB_INSTANCE=t195-slot-4 FLUXIQ_BUILD_PROGRESS_TRACE=1
  FLUXIQ_LAB_KEEP_RUN_STATE=1 FLUXIQ_BUILD_DECISION_DUMP=... node scripts/lab/run-lab.mjs run social-network-feed
  --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow
  --instruction-task social-network-feed-confirm-requests --llm-max-input-tokens 992000 --llm-max-output-tokens 8000
  --llm-max-total-tokens 1000000 --llm-max-calls 64 --llm-cost-ceiling-usd 0.10 --evidence events`. Headed. Live guard
  admitted.
- Date, provider, model: 2026-10-03 17:57-18:07Z (10:57-11:07 PDT), 505.5 s; DeepSeek `deepseek-flash`. Entry: chat.
- Provider calls, cost (step logs, by `part`/round/phase): **43 calls, $0.049502**: chat interpreter $0.000140 (part
  null); creation round 0 explore 19 calls $0.024609 + read $0.000155; round 1 repair 15 calls $0.017569; judge 2 calls
  $0.001320; round 2 repair 5 calls $0.005709. `live-llm.json`: total $0.049501812, perBuild build $0.04936194 (ceiling
  $0.10, not over), `observed.phases.judge` 2 calls $0.00131958 (booked apart: t255 record present). No balance failure.
- Verdict: `failed`, `runtime.behavior`, `lab.chat_build_failed`; ending (chat): "I have not finished this Flow yet: the
  last repair made no measurable progress on the round before it: no more of the 1 thing you asked had a step (1, as
  before); it stopped before it was ready, where the round before it had finished. ... The Flow as far as it got (7
  steps) ran from its start without failing. I tried 3 times live -- exploring, then 2 repairs after testing what I had
  -- over 39 decisions. The Flow so far was kept as a draft ..."
- **Stage reached: 6 inside the build** (three rounds, three whole tests, one judged); no Flow, no playback.

## Stage 1 — the instruction and the expected chain

- The instruction, verbatim: "Go through my friend requests and confirm everyone I have at least five mutual friends
  with, and leave every other request as it is. Then give me a table of every request the list now shows as accepted,
  in the order the list shows them, with columns name and mutualFriends, where mutualFriends is written exactly as
  their request shows it."
- Expected chain (carried unchanged from `run-murwcaj0-40e56557`, written before either run was read): open; dismiss
  consent/notifications (optional); reach `~/friends/requests/`; close chat (optional); list the 8 cards with a
  `where` keeping >= 5 mutual friends (Amara 23, Jonas "Aisha Khan and 4 other" = 5, Lin 11, Freya 5); one Confirm press
  repeated over that listing (row-general: re-found in each row); after the loop, read the list for "Request accepted"
  rows in order with `name`, `mutualFriends` verbatim. Expected 4 records.
- A wrong answer that looks right: 3 records (Jonas dropped by a numeric reading of "4 other"); Tom/Priya/Marta/Diego
  confirmed by an unscoped press; the table read before the confirms.

## Stage 2 — exploration and repairs

| # | Decided | Action | Core said | Cost |
| --- | --- | --- | --- | --- |
| 0002 | — | navigate `~/` (start step) | ok | — |
| 0003 | dismiss consent | click `t476` | ok | $0.001823 |
| 0005 | open Friends | click `t12` | `target_covered` by notifications, closeWith `t479`,`t481` | $0.001298 |
| 0007 | close prompt | click `t481` "Not now" | ok | $0.001822 |
| 0009 | open Friends | click `t12`, add | ok, `~/friends/` | $0.001320 |
| 0011 | close chat | click `t682` | ok | $0.001129 |
| 0013, 0015 | detect `t557`; read | extraction.1 (4 items); extract_list `{name, mutual}` | 4 rows (preview strip) | $0.002186 |
| 0017 | open all requests | click `t554` "See all" | ok, `~/friends/requests/` | $0.001321 |
| 0019, 0021 | detect `t749`; read | extraction.2 (8); extract_list `{name, mutual}` | 8 rows | $0.002326 |
| 0023 | amend: drop 8, add 9, drop 10, add 11, **bind 11 with a whole extractList + where**, add 12 a1, repeat 12 over 11 | 4 applied; `bind_not_a_binding` (bind used as "set parameters"), `no_such_step` x2 (12 not run yet) | $0.001525 |
| 0025 | amend: rerun 11 with `where matches "(^\|[^0-9])([5-9]\|[1-9][0-9]+) mutual friend"`, keep 11 | rerun applied: **3 rows, Jonas left out** | $0.001145 |
| 0027 | (read phase) | instructed `modify_existing` quoted | — | $0.000155 |
| 0029, 0031 | amend: keep 11, repeat 11 over 11 | `already_in_flow`, `over_not_before` | $0.002488 |
| 0033 | **press Amara's Confirm** (a kept row) | click `t775`, `modify_existing`, add, act a1 | ok: "Request accepted" | $0.001158 |
| 0035 | **amend: repeat 13 over 11 through 13** | **applied: the row-general loop is in the draft** | $0.001452 |
| 0037-0041 | rerun 11 again / repeat 13 over 11 again / keep 11 | `changes_nothing`, `already_so`, `already_in_flow` | $0.003616 |
| 0043-0052 | round 0 stops short (unusable decisions); test | reset; nav, consent `remembered`, Friends, chat `remembered`, See all, listing 3 rows; **Confirm passes 1-3 `verified`** | — |
| 0053-0061 | round 1 (repair: "missing mutualFriends column"): look, detect x2, read `{name, mutualFriends}` + same where | 3 rows | $0.006076 |
| 0062-0066 | amend: add 12 `to 7` act a1, repeat 7 over 7; drop 6, repeat 7 over 7, drop 8 | `act_on_a_read`, `over_not_before`; partly applied | $0.003517 |
| 0067 | amend: rerun 8 (Confirm, act a1) with `t861` | check, not press: `t861` is Amara's "Message" | $0.001110 |
| 0072 | amend: rerun 8 with `t787` | check: `t787` is **Priya Nair's** Confirm (4 mutual, a left-out row) | $0.001133 |
| 0077-0088 | rerun 8 / repeat 8 over 7 / keep / a read after the confirms (0082, not added) / repeat 8 over 7 | two `repeat_refused (the same call before: failed)`; repeat applied at 0088 | $0.006114 |
| 0089 | complete | — | $0.001025 |
| 0090-0099 | test | listing 3 rows; **Confirm passes 1-3 `verified`** (template: Priya's card) | — |
| 0100, 0101 | judge x2 | `no`, stillAchievable yes: (1) "the filter's regex ... rejects Jonas Weber even though he has five mutual friends"; (2) "no step stores or returns such a table" | $0.001320 |
| 0102-0107 | round 2: look; **rerun 6 (listing) with `... \| and ([4-9]\|[1-9][0-9]+) other mutual friend`** | applied: **4 rows, Jonas kept**; draft now 6 new listing, **7 old listing (dropped, old where)**, 8 Confirm | $0.002191 |
| 0108-0113 | rerun "step 7" with the fixed where, x3 | `changes_nothing` x3 | $0.003519 |
| 0114-0124 | round 2 stops short; test | listing 4 rows; **Confirm passes 1-4 `verified`** | — |
| end | — | checklist judgement only; "no measurable progress" -> `not_finished`; $0.0505 left | — |

- Repeats, and what the loop believed was progress: 0029/0031 (repeat on the listing itself), 0037-0041 (re-sending
  applied amendments), 0108-0112 (the stale step 7). Each got an honest refusal; the last one's words
  (`changes_nothing`: "already run with exactly this argument") never said step 6 already held that argument.
- Rejections that did not say enough: 0109-0113 `changes_nothing` on the rerun receipt (cause R13). `bind_not_a_binding`
  at 0024 did say enough (the model switched to `rerun`).
- No context eviction.

## Stage 3 — the proposed Flow

None proposed. The last draft tested (0114-0124): navigate `~/`; Decline cookies; Friends; Close chat; See all; listing
`extractList {name, mutualFriends}` where `matches "(^|[^0-9])([5-9]|[1-9][0-9]+) mutual friend|and ([4-9]|[1-9][0-9]+)
other mutual friend"` (4 rows: Amara, Jonas, Lin, Freya); **Confirm (template Priya's card, `modify_existing`, act a1)
repeated over the listing**. That is the row-general Flow t252 asked for (a For Each over the listing; the Confirm
re-found per row by the domain's row scope). No `write: true` was used (the model pressed one kept row, Amara, live:
allowed, and the Confirm she needed anyway) and no `$row` binding was needed (a click is re-scoped through `item`).
- Divergences: no read after the loop for the accepted table (the judge's second finding; the C2 note "every read ...
  runs before step 8" was in the draft); the template is a left-out row's card (harmless at playback, wrong per the
  guidance); dismissals not optional.
- Why: the read was the model's omission while it fought the stale step 7; the template choice misread the page
  (`t787` sits before Jonas's link; the model thought it was a kept row's).

## Stage 4 — replay (the build's tests)

| Test | Steps | Confirm passes |
| --- | --- | --- |
| round 0 (0043-0052) | reset; 6 straight steps (`replayed`/`remembered`) | 3 x `verified` (`dryrun.1.7.pass.1-3`) |
| round 1 (0090-0099) | same | 3 x `verified` |
| round 2 (0114-0124) | same | 4 x `verified` |

- **Any node that reported success while doing nothing: yes, every Confirm pass.** Each pass's call carries
  `element.context.record` scoped to the pass's row (`item` fields `name`, `mutual`), but the check
  (`web.dom.assert`, domain `node-run/verify.ts`) went to `apps/extension/src/content/actions/assert.ts`, whose
  `assertionTarget` hands a top-level `selector` to the evaluator unresolved: the record gate never ran, and every pass
  checked the template card's Confirm. Proof: pass 1 of round 0 is Amara's row, whose Confirm was replaced by "Request
  accepted" + "Message" at 0033 (screenshot 0099 still shows it), yet it answered "target is on the page, visible and
  enabled". The judge read "pass 1, row: Amara Osei, verified". Cause R12.
- The test's reset does not undo the site's state (Amara stays accepted through all three tests).
- Provider calls during replay: zero. t243 state routing and t250: not exercised (no playback).

## Stage 5 — the answer

NO EVIDENCE: no Flow proposed. Records expected 4, returned 0.

## Stage 6 — judgement and repair

- Judged: round 1's test only (0100, 0101; t244 second ask). Verdict `no`, stillAchievable yes, advice: widen the
  where for "N other mutual friends" (call 1); add a read after the confirms storing the accepted rows (call 2). Call 1
  also misread its own `endView` ("the three kept rows show Request accepted"; the endView shows only Amara, `t860`)
  -- harmless here, noted.
- Repair: automatic, two rounds. Round 1's context had the draft, acts checklist, the R4 note, the page; round 2's had
  the judge's account. Round 2 applied the named fix (0105-0107), then lost the round to R13.
- Not judged: round 0's and round 2's clean tests. Round 2's Flow differed from the judged one and passed whole, but
  `R/flow-bootstrap/unfinished-build/phases.ts` judged a round that stopped short from the checklist alone, measured no
  progress against round 1's judged judgement, found no judge-named fix on a checklist judgement, and ended
  `not_finished` with $0.0505 of $0.10 left. Cause R14.

### UI review (12 moments; `pageLoads`/timing records present)

- Overlay present and readable at every build moment (01 absent before the build, correct); #2 one presence toggle as
  it first appeared; #9 one page load with the overlay gone across it (a load gap, counted, not a defect); no flicker.
- **Verified from 1002-M:** U5 fixed: test passes read "Testing: Click · Confirm — Checked, not pressed" and the overlay
  "Trying the Flow from the start: clicking “Confirm” — checked, not pressed" (0099 screenshot).
- **U7 (12-failure-scenario):** the overlay ends a creation build with "Couldn't fix your Flow" — no Flow existed to fix.
- **U8 (12-failure-panel):** the ending is a wall of internals: "too many of its decisions in a row could not be used,
  because the model kept trying again what had already failed or changed nothing", "no more of the 1 thing you asked had
  a step (1, as before)", "over 39 decisions", and "What is left: the Flow "...", with what you asked saved on it."
- U1 (1002-M) still open: the three pass cards are identical "Click · Confirm"; none says whose row.
- The dark outlines around "N mutual friends" and the top-right icons are the scenario's own styling (present from
  step 0004, before any FluxIQ read; no extension code draws outlines).
- Lab nit: the `[lab] ui review` line prints `windowMs {from: -4, to: 165}` as "taken -4-165 ms".

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| R12 | **A per-row check of a repeated act checks the template card, not the row.** `assertionTarget` returns `{selector}` whenever the command has one, so `context.record.values` (the pass's row) never reaches the record gate. The test proved a different control from the one the Flow's click (`resolveTarget`) presses; Amara's pass read `verified` with her Confirm gone. | downstream `apps/extension/src/content/actions/assert.ts` | A check whose element carries row `values` resolves through `resolveTarget` (row's own control, or nothing matched -> `present`). | t195-w40 |
| R13 | **A rerun renumbers the draft and leaves a stale copy between kept steps.** `rerun-replacement.ts` put the withdrawn listing (old where, full input) right after the rerun as step 7 and moved the Confirm to 8; the model reran "step 7" three times; `changes_nothing` never named step 6. Round 2 stopped short. | Core `R/llm/evidence-loop/rerun-replacement.ts`, `R/flow-draft/entry.ts`, `amendment.ts`, `R/llm/draft-amendment-feedback.ts` | Rerun keeps the replaced number; receipt at the end with `replacedBy`, shown without its argument; an amendment naming it is refused naming its replacement. | t195-w41 |
| R14 | **A stopped round's clean test of a changed Flow is never judged.** Only a reserve stop was judged; the build ended `not_finished` with $0.05 left and the fixed Flow unjudged (against t254's aim). | Core `R/flow-bootstrap/unfinished-build/phases.ts`, `reserve-judging.ts` | A round stopped short with a clean test of a Flow other than the last judged-no one is judged as a reserve stop is; yes finishes, no goes on through phase 3's rules. | t195-w42 |
| M2 | The model's regex `where` read "Aisha Khan and 4 other mutual friends" as 4 (1002-M's `atLeast: 5` kept Jonas). | — (model) | None: the judge named it from the left-out row's tested value (R6 of 1002-M working) and round 2 fixed it. | — |
| M3 | No read after the loop (the accepted table). The C2 note fired; the judge's second call named it. | — (model) | None now; the next round would have added it had R13/R14 not ended the build. | — |
| G1 | **Record gap:** a test pass's step folder does not say which row it ran on; only a judged test's request does. Rounds 0 and 2 cannot be read per row. | Core `R/llm/step-log/tool-step.ts`, `scope.ts`, `R/llm/node-tools/replay-span.ts` | `meta.json` of each pass carries `pass`, `of`, `row` (screened label). | t195-w43 |
| U7 | Overlay "Couldn't fix your Flow" ends a creation build. | downstream `apps/extension/src/background/activity/headline.ts` | A failed build reads "Build failed"; only a run's failed recovery reads "Couldn't fix your Flow". | t195-w44 |
| U8 | Ending text names internals; "What is left" sentence unclear. | Core `runtime/conversations/commands/create-here.ts` (fixed); `unfinished-build/not-done.ts`, `not-finished.ts`, `tried.ts` (open) | create-here's three variants rewritten; the stop/not-finished words left to a follow-up (they share test files with R14's fix). | t195-w44 / open |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 4 | Which row each pass of the unjudged tests (0043-0052, 0114-0124) checked: `call.json` shows the template and `item` as field names only; `meta.json`/`result.json` name no row. Answered for round 1 only, from the judge's request. | Core `R/llm/step-log/tool-step.ts` (G1, fixed by t195-w43) |
