# Run debug — `run-muogweml-0190212c` (lane A run 35)

Written by the t174 lead from the bundle `test-runs/instances/t174-slot-1/run-muogweml-0190212c`, the kept run state
`.work/run-muogweml-0190212c` (first run with `FLUXIQ_LAB_KEEP_RUN_STATE=1`), its `logs/core.log` build trace and
the 9 UI-review moments. Judged against the build lifecycle the user set (supervisor, 2026-09-30): explore and
author the Flow live, with no replay from the start; once ready, test the Flow and judge it; then repair, finish, or
declare it not doable only when no way remains.

## Header

- Run id: `run-muogweml-0190212c`
- Scenario / variant / task: crossborder-marketplace / none / crossborder-marketplace-hub-to-cart
- Command: `scratchpad/t174-live-run-a.sh crossborder-marketplace crossborder-marketplace-hub-to-cart` (lane report, Session 3), instance t174-slot-1, headed, with `FLUXIQ_LAB_KEEP_RUN_STATE=1`
- Date, provider, model: 2026-09-30 18:57-19:01 UTC, deepseek, deepseek-flash, production profile
- Provider calls, tokens, cost: 49 calls, 741,050 in / 5,510 out, $0.0802
- Verdict as reported: `failed`, `runtime.behavior`, `flow_bootstrap.evidence_unusable_decision`; `flowCreated: false`
- **Stage reached:** 2, exploration. No Flow was proposed.
- Code under test: P1 A and P1 B on crossborder, whose open cause (runs 15-19) was a build that only navigated to model-written addresses.

## Stage 1 — the instruction and the expected chain

Written by the lane lead before the run.

- The instruction, verbatim: "On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything."
- The node chain a correct Flow must have:
  1. Navigate to the start location (Farbazaar home). A robot check is never pressed: a self-clearing one is waited out, any other is handed to the person.
  2. Type "Voltbay USB-C hub" in the search box and submit.
  3. Press the Voltbay USB-C hub listing sold by Voltbay Official Store (not the same hub from another seller).
  4. On the item page, choose colour Space Grey.
  5. Choose the 7-in-1 version.
  6. Choose ship-from Spain (the catalog's Poland origin of Space Grey 7-in-1 is sold out; China is another option).
  7. Set the quantity to 3.
  8. Press the store's coupon control (collect).
  9. Press "Add to cart". No "Buy now", no checkout.
- What a wrong answer that looks right would look like: the hub in the cart from the other seller; the default colour, version or origin (China) instead of Space Grey / 7-in-1 / Spain; quantity 1; the coupon not collected; a navigation-only Flow (runs 13, 15) accepted; a robot check pressed.
- Note on P1 B: the reader asks for `a1.quantity` (three), `a1.colour` (Space Grey) and `a1.version` (7-in-1). It does not read "shipped from Spain" as a choice, so the completion check will not demand the origin step; the goal check will.

## Stage 2 — exploration

Loop 18:58:16 to 19:00:14: 49 decisions. From `flow-lane.json` steps and the build trace. The kept Core store holds
only the Flow, its instruction and settings: **a build that proposes nothing persists no decision, draft or packet**,
so what each decision was asked and each call's parameters are NO EVIDENCE (gap G1, fixed for the next run).

| # | Decided | Node | Result | Reason / note |
| --- | --- | --- | --- | --- |
| 0 | (Core's free look) | capture | `not_at_start_location` | expected |
| 1 | tool | navigate | succeeded | start location |
| 2 | tool | navigate | **`address_not_shown`** | P1 A: a model-written address refused before it went out |
| 3 | tool | type | succeeded | the search box ("Voltbay USB-C hub", moment 4) |
| 4 | tool | keypress | succeeded | the search ran: moment 4 (18:58:40) is `/search` with the Voltbay Official Store card fourth in the first row |
| 5, 6 | tool | detect_repeating_structure x2 | `structure.detected` | |
| 7 | tool | detect_repeating_structure | `target_unobserved` | `handle_not_in_packet` |
| 8 | tool | (the same) | `already_answered` | |
| 9 | tool | click | `target_not_found` | |
| 10 | tool | click | succeeded | changed |
| 11 | tool | click | `target_unobserved` | `handle_not_in_packet` |
| 12-14 | tool | click x3 | `target_unobserved` | `answered_the_same_again` x3: the same press sent again |
| 15 | amend: drop 3, 10, 12-15 | - | `draft_unchanged` | |
| 16, 17 | tool | click x2 | `target_unobserved` | `answered_the_same_again` x2 |
| 18 | complete `->d11, ->d11` | - | refused | the three hub choices `no_step_named`; a2 (the coupon) `step_claimed_twice` |
| 19 | complete, every claim `>d5` | - | refused | a1 `no_step_named`; choices `step_claimed_twice` |
| 20 | amend `11:drop` | - | amended | |
| 21 | tool | click | `target_unobserved` | `handle_not_in_packet` |
| 22, 23 | complete, every claim `>d5` | - | refused x2 | `choice_is_the_act_step` for all three choices |
| 24 | tool | navigate | **`address_not_shown`** | |
| 25 | complete, every claim `>d5` | - | refused | as 23 |
| 26 | tool | click | (no result code) | changed |
| 27 | amend `11:keep` | - | amended | draft guidance cut from 803 to 177 bytes |
| 28 | amend `11:drop, 18:rerun` | click (rerun) | succeeded | |
| 29 | tool | click | (no result code) | changed |
| 30 | amend `21:drop` | - | amended | |
| 31 | tool | click | succeeded | changed |
| 32 | tool | click | `target_unobserved` | `handle_not_in_packet` |
| 33 | amend | - | amended | 2 steps now shown without input |
| 34, 35 | complete x2 | - | refused | |
| 36, 37 | amend `2:keep,4:keep,5:keep` x2 | - | `draft_unchanged` x2 | |
| 38 | complete, choices `>d5` | - | refused | a1 `no_step_named`; choices `step_claimed_twice` |
| 39 | tool | click | `target_unobserved` | `answered_the_same_again` |
| 40 | complete `a1>d5` | - | refused | all three choices and a2 `no_step_named` |
| 41 | tool | capture | inspect succeeded | |
| 42-49 | complete x7 (all 7 claim every act and choice `>d2`, the start navigation), one amend `2:keep,4:keep,5:keep` at 43 | - | refused x7 | every claim `step_only_arrives`; the build ends `evidence_unusable_decision` at 49 |

- Repeats, and what the loop believed was progress: the same press on a handle not in the packet was sent 8 times
  (11-17, 21, 32, 39), 6 of them answered `answered_the_same_again`. 13 of the last 16 decisions were refused
  completions or no-op amendments; the last 7 completions claimed the start navigation for every act.
- Rejections and whether each said enough: `handle_not_in_packet` did not lead the model to look again for the card's
  handle; it re-sent the press. Whether the Voltbay card's link was in any packet it was shown is NO EVIDENCE (G1).
  The search results page is dense (filters sidebar, 4 cards a row, a notification prompt and the cookie banner still
  open), which is exactly what an element cap would cut (t200).
- Where the context was truncated: the draft entry was near its 4,000-byte cap from iteration 15 (3,824 B); the
  draft's guidance was cut from 803 to 177 bytes at iteration 27.

## Stage 3 — the proposed Flow

- Node list as authored: none; no completion was accepted.
- Divergences from the stage 1 chain: chain steps 3-9 are absent. The build never stood on the Voltbay item page in
  any moment (every moment is `/` or `/search`), so no colour, version, origin, quantity, coupon or add press existed
  to claim.
- For each divergence: NO EVIDENCE whether the card was missing from the packet (a cap) or the model misread the
  handle (G1).

## Stage 4 — replay

Not reached. Dry runs ran on the completion attempts. Moment 5 (18:59:00) shows one at the home page with "Voltbay
USB-C hub" retyped in the search box: **the build restarted from the beginning mid-build**, which the user's lifecycle
forbids.

## Stage 5 — the answer

Not reached. The header cart read 0 at every moment: nothing was added.

## Stage 6 — judgement and repair

- Judged its own result: there was none; the build ended at its 49th decision, `evidence_unusable_decision`.
- Repair: none could trigger, because no Flow was created. Against the lifecycle's third phase, the build did not
  declare the task not doable with a reason; it stopped on refused completions while a way remained (the card was on
  the page). That is a defect: causes 1 and 2 are why it could not find the way.
- Repair context: not applicable.

## UI review (9 moments, `run-muogweml-0190212c.ui-review.local/`)

- Page overlay: bottom-left, visible, with plain phase text this run ("Deciding the next step", "Checking the proposed
  result") at moments 4 and 8, and "Using core.run_node" elsewhere (U1). It sits over the cookie banner's text but not
  its buttons (U3 recurring in part).
- The page's own layers stayed open all build: the "Never miss a price drop" notification prompt (Not now / Allow) and
  the cookie banner (Reject non-essential / Accept all). Neither was declined, although t195's F1 declines cookie
  walls during playback; during the build they cover the filter column and the lower result rows.
- Side panel: the old UI (Simple/Advanced, status cards, "Add an AI model key: To do", "Page | Full | Small | Off");
  "Worked for 33s · 17 steps · 12 failed" for a build that ran about 118 s (U12). Two hand-offs read "FluxIQ needs you:
  complete the check on this page, then press Continue. You chose 'Continue'." (the Lab playing the person at a robot
  check; t197). All of these are t191's round-2 items.

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | The press on the Voltbay Official Store result was refused `handle_not_in_packet` 8 times: the model named a handle that was not in the packet it was shown, on a dense results page whose card is fourth in its row. Whether the card was cut by the element cap is NO EVIDENCE (G1); it is the likeliest reading. | extension capture / domain packet (`llm-evidence` packet bounds) | Remove the element caps | **t200** (candidate; confirm with the next run's dump) |
| 2 | The draft entry cap (4,000 B) and the guidance cut to 177 B, as in run 34. | Core `flow-draft/entry.ts`, `llm/evidence-loop/draft-shown.ts` | Remove the cap | **t200** |
| 3 | A dry run replayed the draft from the start location mid-build (moment 5), which the user's lifecycle forbids. | Core `llm/node-tools/dry-run-gate.ts`, `flow-draft/dry-run.ts` | Remove replays from the build | **t196** |
| 4 | The draft is a transcript of the steps taken: failed presses, re-sent presses and re-typed searches were appended one by one (draft near its cap by iteration 15), not authored as the Flow. | Core `flow-draft/*` accrual | Author the draft as the Flow | **t196** |
| 5 | The last 7 completions claimed the start navigation (d2) for every act and choice, each refused `step_only_arrives`; the build then ended rather than trying another way. | Core `llm/evidence-loop` no-progress handling | Recorded with run 34 cause 5 | t193 C / t189's area |
| 6 | P1 A worked: 2 model-written addresses were refused before they went out, and the search was typed and run instead. | - | - | - |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2, 3 (G1) | Every decision's window, answer and parameters, and every tool result: a build that proposes nothing persists none of them, even with the run state kept | Core `llm/evidence-loop` (no record on failure). **Fixed** by the decision dump (`llm/evidence-loop/decision-dump.ts`, `FLUXIQ_BUILD_DECISION_DUMP`), which the lane launcher now sets to `test-runs/instances/t174-slot-1/decision-dumps/` |
| 2 | Two click steps (26, 29) carry no result code in `flow-lane.json` | test-runner `flow-lane` step projection |
