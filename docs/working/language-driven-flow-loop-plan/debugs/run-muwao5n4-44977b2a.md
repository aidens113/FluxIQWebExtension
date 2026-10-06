# Run debug — `run-muwao5n4-44977b2a`

t275 lane D round 2, slot 4, instance `t275-slot-4`, workspace `t275-d`: social-network-feed `confirm-requests`, built
from the extension chat on the tree synced to dev (downstream `624c7a70`, Core `9fd634d3` with the `afterWithheld`
judge fix `eb672178`, lanes B/C judge sentences and t276 UI fixes). Stage 1 was copied from
`mvp-final-month-plan/reports/live-d.md` (round 1 expectations and the round 2 additions), written before the dry
run and before any artifact of this run was read.

## Stage 1 — the instruction and the expected chain (written before the run)


Instruction (from `apps/scenario-lab/src/scenarios/social-network-feed/live-tasks.ts`): "Go through my friend
requests and confirm everyone I have at least five mutual friends with, and leave every other request as it is.
Then give me a table of every request the list now shows as accepted, in the order the list shows them, with
columns name and mutualFriends, where mutualFriends is written exactly as their request shows it."

Fixture facts (`content/requests.ts`, page order): Tom Becker "1 mutual friend"; **Amara Osei "23 mutual
friends"**; Priya Nair "4 mutual friends"; **Jonas Weber "Aisha Khan and 4 other mutual friends" (= 5)**; Diego
Alvarez (no line, 0); **Lin Zhao "11 mutual friends"**; **Freya Holm "5 mutual friends"**; Marta Kowalczyk "3 mutual
friends". The Friends home previews 4 cards; "See all" reaches `~/friends/requests/` with all 8. The badge says 4
(stale). Confirm is rate-limited client-side: at most 3 presses in any 15 s window per page load; the 4th shows
an alertdialog "You're going too fast" with a countdown, OK confirms nothing, and "Try again" appears at zero
and confirms the refused row.

Actions a correct Flow takes:
1. Start at the site (or straight at `~/friends/requests/` if the build keeps the start rule); dismiss the
   cookie consent and the notifications prompt if they show (optional steps); close chat if it covers (optional).
2. Reach the full requests list (`~/friends/requests/`), not the 4-card preview.
3. A listing of the 8 cards with a `where` keeping >= 5 mutual friends, reading all three ways of writing it
   (plain count, "X and N other" = N+1, no line = 0): keeps exactly Amara, Jonas, Lin, Freya.
4. One Confirm press repeated over that listing, re-found inside each kept row (row-general; never a fixed
   card's Confirm). Build tests check, not press; the live build presses at most the kept row it explored.
5. Playback (after the Lab's fixture reset, so all four are pending again): four Confirm presses. With a fast
   playback the 4th press meets the rate limit; a correct run must wait it out (Try again) or pace the presses,
   and must not press OK and move on. **Predicted main risk of this run**: nothing in the build meets the rate
   limit (one live press), so the authored Flow has no step for it; playback may confirm only 3.
6. After the loop, a separate read of the cards that now show "Request accepted", in list order, with `name`
   and `mutualFriends` verbatim.

Exact oracle (dataset `extract-confirmed`, `manifest.ts`): exactly 4 records, in this order —
`{Amara Osei, "23 mutual friends"}`, `{Jonas Weber, "Aisha Khan and 4 other mutual friends"}`,
`{Lin Zhao, "11 mutual friends"}`, `{Freya Holm, "5 mutual friends"}`. And untouched: Tom, Priya, Diego and
Marta still show Confirm/Delete (no "Request accepted", no "Request removed"), checked from the final page /
final-state, not from the dataset alone (a deleted row would not show in an "accepted" table).

Wrong answers that look right: 3 records (Jonas dropped by a numeric regex on "4 other"; or Freya refused by
the rate limit); Priya or another excluded row confirmed (shows up as a 5th record); table read before the
confirms (empty or Amara only); a row deleted.

Consequence permission: the task declares no `permits` and no `permissionPoint`; it is listed in
`ASKS_NOTHING` ("confirms friend requests, which neither pays, deletes nor publishes"). Confirming is
`modify_existing`, which Core permits on the instruction's own authority (`gate.ts`); it is not one of the
classes that ask every time (move_money, delete, send_or_publish). Expected `consequences.answeredBy:
instruction`; no permission ask; no `--llm-permit` passed. A `delete` declared anywhere is a defect.

UI checkpoints: the build starts from the extension chat (typed instruction); the chat posts each step with
its reasoning; the page overlay is visible and readable through the build, no flicker; per-row test cards say
whose row (U1, open since 1002-M); the ending in plain words (no internals: no codes, "decisions", "1 thing you
asked"); on success the chat reports the Flow and its table, and the overlay ends "done", not "Couldn't fix".

### Round 2 additions


Unchanged from round 1 above (instruction, fixture facts, the correct chain, the exact oracle of four records
`{Amara Osei, "23 mutual friends"}`, `{Jonas Weber, "Aisha Khan and 4 other mutual friends"}`,
`{Lin Zhao, "11 mutual friends"}`, `{Freya Holm, "5 mutual friends"}` in that order, Tom, Priya, Diego and Marta
untouched with Confirm/Delete and no "Request removed", no permission ask, `modify_existing` on the instruction's
authority). What changes in what to expect:

- Build: a draft like round 1's (listing `atLeast 5` keeping the four; Confirm repeated over it; a read of rows
  showing "Request accepted") should now be judged **yes**: its final read carries `afterWithheld: [<Confirm
  step>]`, and the judge must not refuse it for the three rows whose presses the test withheld. A no that blames
  the withheld presses or claims Jonas is left out (against `leftOutOnlyByThis`) is C1 or M4 again.
- Playback (first time for D): the Lab resets the fixture, so all four Confirms are pending and the Flow presses
  four in a row. The site allows three per 15 s per page load; the 4th press (Freya, list order) shows "You're
  going too fast" with a countdown, and only "Try again" at zero confirms it. **Predicted main risk**: playback
  presses all four within 15 s, Freya's press is refused, the after-loop read returns three rows, oracle fails
  (3 of 4) unless the run's recovery waits and presses Try again. A run that presses OK and moves on, or reports
  success with three rows, is a defect; so is any excluded row confirmed.
- On a pass: two `lab replay` runs with zero model calls, each matching the 4 records and storing identical rows
  (same SHA-256).
- UI checkpoints: per-row test cards now name the row and say checked, not pressed (t276); a navigate to a
  loopback address is not called "the start page" (t276, U10); the ending in plain sentences with no node ids
  or judge quotes (U9); overlay visible through build and playback, no flicker; on success the chat reports the
  Flow and its table.

## Header

- Run id: `run-muwao5n4-44977b2a`; no runtime run (no Flow proposed; no playback, no replay).
- Command: `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t275-slot-4 pnpm.cmd lab:campaign social-network-feed-confirm-requests --max-attempts 1 -- --target persistent-isolated --workspace t275-d --llm-cost-ceiling-usd 0.10`.
  Headed; live guard admitted (fingerprint `sha256:488a5d04...`); one launch, no retry.
- Date, provider, model: 2026-10-06 06:25:21-06:31:56Z (chat build 06:28:18-06:31:02); DeepSeek `deepseek-flash`.
  **Inside DeepSeek's weekday peak window (06:00-10:00 UTC, Core `llm/deepseek/pricing.ts`)**: every call cost
  twice round 1's rate for the same tokens (decision 0003: 13,880 input tokens, $0.003848 here against $0.001931
  in round 1, which ran off-peak), so the same $0.10 bought about half the decisions.
- Provider calls, cost: **31 calls, $0.086463**: chat $0.000181; round 0 explore 29 decisions $0.084015; round 1
  repair 1 decision $0.002268; no judge call. `live-llm.json`: build 30 calls $0.086282 (ceiling $0.10, not over).
- Verdict: `failed`, `lab.chat_build_failed`; Core `flow_bootstrap.evidence_budget_exhausted`,
  `llm_evidence_loop.dry_run_refused`, `core.replay.failed`, `core.replay.unreproducible`. No permission ask.
- **Stage reached: 4 inside the build** (draft tested four times, never passed its test, never judged).

## Stage 2 — exploration and repairs

| # | Decided | Action | Core said | Cost |
| --- | --- | --- | --- | --- |
| 0003-0006 | decline cookies; **navigate straight to `~/friends/`** (address seen in evidence) | ok | | $0.0067 |
| 0007-0014 | detect `t540`; dismiss notifications (stale `t476` refused `target_unobserved`, then `t670`); detect again | ok | | $0.0103 |
| 0015-0024 | **navigate to `~/friends/requests/`**; detect; close chat; detect; read `{name, mutual}`, 8 rows | ok | | $0.0129 |
| 0025-0027 | keep 12; rerun 12 with `where atLeast 5`; **add 12 `to: 2`** | rerun applied (4 rows: Amara, Jonas, Lin, Freya); **the listing placed at step 2, after `navigate ~/` and before every step that reaches the requests page** | | $0.0031 |
| 0030-0031 | keep 2; optional 3; **drop 4 (navigate `~/friends/`), drop 9 (navigate `~/friends/requests/`), drop 11 (close chat)**; reorder 2->1, 3->2, 1->3 | **"applied 7"** (one `already_in_flow`): the Flow now has no step that reaches the requests page, and nothing said so (Cause D2-1) | | $0.0023 |
| 0032-0041 | reruns/repeats of the listing | `already_in_flow`, `changes_nothing`, `over_not_before` | | $0.0077 |
| 0036-0039 | press Amara's Confirm `t769` (`modify_existing`); repeat 15 over 3 through 15 | "Request accepted"; repeat applied | | $0.0057 |
| 0042-0057 | recall the read twice; find "mutual"; rerun the listing with the `mutualFriends` column; repeat again | applied / `changes_nothing` / `already_so` | | $0.0182 |
| 0058 | complete | test (0059-0064): 1 navigate `~/` replayed; 2 cookies remembered; **3 listing `failed` (`list_never_appeared`) on `~/`, though it acted on `~/friends/requests/`**; 15 Confirm unreproducible, excused (repeat) -> `dry_run_refused` | | $0.0026 |
| 0065-0068 | "the listing ran on the feed page; rerun it with the requests-page navigation restored" | `changes_nothing`; a reorder 3->9 (no navigation left to put it after) | | $0.0104 |
| 0069 | complete | test 2: same, refused | | $0.0016 |
| — | round 0 stops short; its whole test (0076-0080) fails the same way | | | — |
| 0082 | round 1 repair: one decision, complete unchanged | test (0083-0088) fails the same; spent $0.086 + $0.008 judge reserve + up to $0.006 next call -> `evidence_budget_exhausted` | | $0.0023 |

- The model named the cause itself at 0065/0067 ("it ran on the feed page"), but the test told it step 3
  `failed` ("rerun it with a corrected argument") rather than `unreproducible` ("the steps before it no longer
  reach that page"; Cause D2-2), and it believed the dropped navigation was still in the draft.
- No read of the accepted rows was ever added (0082 says it is missing): never reached.

## Stage 3 — the proposed Flow

None proposed. The last draft (tested 0083-0088): 1 navigate `~/`; 2 Decline cookies; 3 listing `{name,
mutualFriends}` `where atLeast 5` (acted on `~/friends/requests/`); 4 Confirm repeated over 3. No step reaches the
requests page and no read of the accepted rows. The listing's filter was right (4 rows, Jonas kept).

## Stage 4 — replay (the build's tests)

| Test | 1 navigate | 2 cookies | listing | Confirm |
| --- | --- | --- | --- | --- |
| 0059-0063, 0070-0074, 0076-0080, 0083-0087 | replayed | remembered | **failed**, `list_never_appeared`, on `~/` | unreproducible, excused (repeat) |

- The test was on `~/` when the listing ran; the listing recorded `from ~/friends/requests/`. The domain answers
  a missing *control* elsewhere `unreproducible` (`domain/src/runtime/llm-evidence/node-run/missing-target.ts`),
  but a list read whose list never appeared goes to `failedOnPage` without comparing locations
  (`node-run/replay.ts`, the `result.status !== "succeeded"` branch: only `TARGET_NOT_FOUND` is routed to
  `webNodeReplayMissingTarget`), so it reads `failed`. Core's `notInFlow` way-line (`R/flow-draft/dry-run.ts`)
  only fires on `unreproducible`, and its walk also stops at a step the model dropped (`R/flow-draft/path-to-step.ts`).
- Final scenario picture (13-failure-scenario): the home feed. Amara was confirmed live at 0037 (a qualifying
  row); no test pressed anything (every Confirm pass unreached). Excluded rows untouched: yes, by the step logs
  (no press but 0037's on Amara; no Delete anywhere).
- Provider calls during tests: zero.

## Stage 5 — the answer

NO EVIDENCE: no Flow proposed. Records expected 4, returned 0. Oracle not measured.

## Stage 6 — judgement and repair

- Nothing judged: the draft never passed its test, so C1's `afterWithheld` and lanes B/C's judge sentences were
  not exercised.
- Repair: one round, one decision (complete without change), then the judge reserve ended the build.

### UI review (13 moments)

- Overlay visible 16/16 at every moment but #1 (12/16, one presence toggle as it first appeared, as in earlier
  runs) and #6 (15/16). #6 and #10 read `flickering`: three text changes in a 3 s window while the build's tests
  ran steps back to back (text only, no presence toggles). Failure moment: "Build failed / Build stopped: a budget
  ran out".
- U9 verified fixed: the ending is plain sentences, no node ids or judge quotes. Left: "step 3, 4 did not work"
  (should read "steps 3 and 4"); "($0.000 of it by earlier builds of this Flow)" is noise on a first build.
- U10 verified fixed: the first navigate card reads "Open page" with no false "the start page".
- **U11 (new):** the repeated Confirm's test card reads "Skipped: it only runs sometimes" (10-mid-build-panel); it
  runs once per kept row, and here the list it repeats over never appeared.
- Per-row "checked, not pressed" cards (t276): not exercised, no pass ran.

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| D2-1 | **An amend decision may leave a kept step on a page no kept step before it reaches, and is applied silently.** 0025 put the listing (acted on `~/friends/requests/`) at step 2 after `navigate ~/`; 0030 dropped the two navigations that reached the requests page ("applied 7"). Every later test failed at the listing. | Core `R/flow-draft/amendment/apply.ts` (beside `repeat-revalidation.ts`), `R/flow-draft/amendment/types.ts`, `R/llm/draft-amendment-feedback.ts` | After a decision, a kept step that the kept step before it no longer brings to the page it acted on (where it was so brought before, or newly kept there) refuses the decision, naming the step, its page and the page the step before leaves. Newly stranded only, so existing drafts never start refusing. | open: not started (supervisor stop) |
| D2-2 | **A list read that never found its list, on another page, is reported `failed`, not `unreproducible`.** The model was told to correct its argument; the way-line never fired. | downstream `domain/src/runtime/llm-evidence/node-run/replay.ts` | A read whose list never appeared, on a page other than the one it read, answers `unreproducible` as a missing control does; on its own page it still fails. Test beside it in `node-run/tests/`. | open: not started (supervisor stop) |
| P1 | Launched in DeepSeek's weekday peak window: half the decisions for the same ceiling. | — (operations) | Launch live D outside 01:00-04:00 and 06:00-10:00 UTC on weekdays. | supervisor |
| U11 | A repeated step's unreached passes are worded "it only runs sometimes". | Core `R/flow-draft/excused.ts` words | Say it repeats over a list the test did not reach. | open |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Which page each kept step would run on after an amend decision: only by replaying the draft by hand from `replay.from` of each step. The amendment answer says "applied 7" and nothing about reach. | Core `R/flow-draft/amendment/apply.ts` (D2-1) |
