# Run debug — `run-muw6144a-e56f945d`

t275 lane D, slot 4, instance `t275-slot-4`, workspace `t275-d`: social-network-feed `confirm-requests`, built from
the extension chat on the tree synced to dev (downstream `efaf2034` + docs-only `ffd10491`, Core `a83b1471`).
Stage 1 below was copied from `mvp-final-month-plan/reports/live-d.md`, written before the dry run and before
any artifact of this run was read.

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

## Header

- Run id: `run-muw6144a-e56f945d`; no runtime run (no Flow proposed, so no playback and no replay).
- Command: `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t275-slot-4 pnpm.cmd lab:campaign social-network-feed-confirm-requests --max-attempts 1 -- --target persistent-isolated --workspace t275-d --llm-cost-ceiling-usd 0.10`
  (campaign row `test-runs/campaigns/2026-10-06T04-15-00-226Z`). Headed; live guard admitted (fingerprint
  `sha256:aad4522a...`); one launch, no retry.
- Date, provider, model: 2026-10-06 04:15:27-04:23:17Z (chat build 04:19:41-04:23:12, 211 s to the ending);
  DeepSeek `deepseek-flash`. Entry: the extension chat (`flow.createHere`, side panel verified open).
- Provider calls, cost (step logs by part/round): **44 calls, $0.053701**: chat $0.000166; round 0 explore 23
  decisions $0.031387; judges 6 $0.003452 (2 per round); round 1 repair 6 $0.007749; round 2 repair 8 $0.010947.
  `live-llm.json`: build 43 calls $0.053535 (ceiling $0.10, not over), chat 1. No balance failure.
- Verdict: `failed`, `lab.chat_build_failed`, Core `flow_bootstrap.build_not_finished` +
  `llm_evidence_loop.repeat_refused`. Campaign: "judgement not measured". Consequences `not recorded` (no
  proposal); no permission ask (`asks.permission 0`), as expected.
- **Stage reached: 6 inside the build** (three rounds, three whole tests, all judged); no Flow, no playback.

## Stage 2 — exploration and repairs

| # | Decided | Action | Core said | Cost |
| --- | --- | --- | --- | --- |
| 0002-0012 | start; decline cookies; navigate `/friends/` (guessed address); Not now; Friends `t12`; close chat | ok; the guess refused `address_not_shown` (correct) | | ~$0.0079 |
| 0013-0018 | detect on `t553` (an h2) x3 | 2 items each; third refused `already_answered` | | $0.0033 |
| 0019-0024 | See all `t542`; detect `t749`; read `{name, mutualFriends}` | `~/friends/requests/`; 8 rows | | $0.0036 |
| 0025-0029 | add + repeat on the read (refused `act_on_a_read`, `over_not_before`); **rerun listing with `where atLeast 5`** | **kept exactly Amara, Jonas, Lin, Freya; left out Tom, Priya, Diego, Marta** | | $0.0027 |
| 0030-0035 | keep/repeat on the listing again | `already_in_flow`, `over_not_before`, `changes_nothing`; `core.no_progress` | | $0.0055 |
| 0036-0039 | **press Amara's Confirm `t775`, `modify_existing`**; **repeat 14 over 13** | "Request accepted"; **row-general loop in the draft** | | $0.0029 |
| 0040-0047 | repeat again; rerun listing; read all 8 (`extract-after-1`, no where); keep 15 | `already_so`, `changes_nothing`; read added unfiltered | | $0.0058 |
| 0048 | complete | test (0049-0060): listing 4 rows; passes Amara `present`, Jonas/Lin/Freya `verified`; final read 8 rows | | $0.0015 |
| 0061-0062 | judge x2 | **no, correctly**: the final read returns all 8, not the accepted ones | | $0.0012 |
| 0063-0073 | round 1: look, detect, two refused repeats of the look; **rerun the final read with `where status equals "Request accepted"`** | applied | | $0.0077 |
| 0078 | complete | test (0079-0090): listing 4; passes Amara `present`, Jonas/Lin/Freya `verified` (checked, not pressed); **final read kept 1 row (Amara)** | | $0.0015 |
| 0091-0092 | judge x2 | **no, wrongly** (Cause C1): "the confirm step was withheld ... never actually confirmed, so the table is missing Jonas, Lin, Freya"; plus "the filter drops Jonas" (false: the test's own `leftOutOnlyByThis` for step 6 listed only Tom, Priya, Diego, Marta) | | $0.0012 |
| 0093-0115 | round 2 follows the judge: **reruns the correct listing with `matches "(^|[^0-9])([5-9]|[1-9][0-9]+) mutual friend"` + `is present`** | applied: **3 rows, Jonas now left out**; `changes_nothing` x2, `already_so`; a rerun of 7 on `t763` (Tom's Confirm, a left-out row, checked only) | | $0.0109 |
| 0116-0126 | round 2 test | listing 3; passes 3 x checked; final read Amara only | | — |
| 0127-0128 | judge x2 | no again, now also claiming Jonas should be left alone; build ends "no further than the one before" | | $0.0011 |

- Repeats the loop believed were progress: 0030-0035 (repeat on the read itself), 0068-0071 (the same look),
  0107-0115 (the same rerun). Each was refused with words; the repeat guard ended round 2.
- Refusals that did not say enough: none decisive. The decisive error is the judge's (Stage 6).

## Stage 3 — the proposed Flow

None proposed. **The round-1 draft (tested 0079-0090) was the right Flow**: 1 navigate `~/`; 2 Decline cookies;
3 Friends; 4 Close chat; 5 Friend requests; 6 listing `{name, mutualFriends}` `where mutualFriends atLeast 5`
(Amara, Jonas, Lin, Freya); 7 Confirm (template Amara's card, `modify_existing`) repeated over 6; 8 read
`{name, mutualFriends}` `where status equals "Request accepted"`. Its divergences from Stage 1: travel from `~/`
rather than starting at `~/friends/requests/`, dismissals not optional, and no step for the rate limit (never met:
one live press). The judge refused it, and the repair that followed the judge broke it.

## Stage 4 — replay (the build's tests)

| Test | Listing | Confirm passes | Final read |
| --- | --- | --- | --- |
| round 0 (0049-0060) | 4 rows | Amara `present`; Jonas, Lin, Freya `verified` | 8 rows (no where) |
| round 1 (0079-0090) | 4 rows | same | **1 row, Amara** (the only row whose act was not withheld) |
| round 2 (0116-0126) | 3 rows (Jonas out) | Amara `present`; Lin, Freya `verified` | 1 row, Amara |

- R12 (row-scoped checks) verified live: Amara's pass answers `present` (her Confirm is gone), the others
  `verified` on their own rows; no test pressed anything. Final scenario picture (13-failure-scenario): only Amara
  shows "Request accepted"; Tom, Priya, Jonas, Diego, Lin, Freya and Marta show Confirm/Delete; nothing shows
  "Request removed". **Excluded rows untouched: yes.**
- Provider calls during the tests: zero. State routing and playback: not exercised.

## Stage 5 — the answer

NO EVIDENCE: no Flow proposed. Records expected 4, returned 0. Oracle not measured.

## Stage 6 — judgement and repair

- Round 0's judges were right (unfiltered final read). Round 1's were wrong: a build test withholds every Confirm
  pass the build did not do (each changes something lasting), so a read after them cannot show those rows as
  accepted; the final read returning only Amara is exactly what a correct Flow gives in a build test. The judge
  took it as the Flow's answer ("the final table is missing Jonas Weber, Lin Zhao and Freya Holm"; "step 7 must
  actually run for each kept row rather than being withheld"). Nothing in its packet marked the read as run after
  withheld acts, and the build-test prose only says a withheld step's visible effect may be exploration's doing;
  it never says a read after a withheld act lacks what that act makes.
- The same judge invented a filter defect ("Jonas ... must be kept") against the test's own `leftOutOnlyByThis`;
  round 2 acted on it and dropped Jonas. Model error, invited by C1's refusal.
- Repair: automatic, two rounds; ended `not_finished` with $0.046 of $0.10 left.

### UI review (13 moments)

- Overlay present, visible and readable at every build moment (16/16 samples each), no presence toggles, no
  flicker. Failure moment: "Build failed / Build stopped: the Flow is not finished ..." (right for a creation build).
- The chat posts each step with its reason ("Clicking "Not now" — Dismissing the notifications dialog, then
  opening the Friends page ..."). Test cards: "Testing: Click · Confirm — Checked, not pressed" three times,
  identical: **U1 still open** (no card says whose row). "Testing: Read list · name a...tualFriends" (cut mid-word).
- **U9 (new):** the ending quotes the judge's raw words into the chat: "this time the judge found: "s8 kept only
  Amara Osei because its where requires the row text to equal ..."", "fix s13 so...": node ids, "where", "end
  view", cut mid-sentence (Core `flow-bootstrap/unfinished-build/not-finished.ts`, lines 77 and 153).
- **U10 (new, Lab-visible):** "Opening the start page — I'll open the Friends page ..." / "Open page · the start
  page — Didn't work": a navigate to a loopback `/friends/` address is named "the start page" (Core
  `activity/wording/action.ts` `pageName`: any loopback host reads "the start page", whatever the path).

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| C1 | **A build test's read after a withheld act is judged as if the act had run.** The test only checks a lasting act (`verified`), so a later read cannot show what it would make; the judge's packet marks nothing on such a read (`withheldBy` is set only on a step that did not replay after a withheld one, `llm/node-tools/replay-draft.ts:315`), and the build-test prose (`llm/diagnosis-instructions.ts`) does not say it. The judge refused the correct round-1 Flow. | Core `R/result-verification/build-test/summary.ts`, `R/result-verification/contracts.ts`, `R/llm/diagnosis-instructions.ts` | A read that ran after steps the test only checked carries `afterWithheld` (those steps' numbers); the judge is told such a read lacks what those acts make and is judged by whether its conditions would keep it. | t275 lane D: fixed in the lane Core worktree, uncommitted; failing test `R/result-verification/build-test/tests/after-withheld.test.ts` |
| M4 | The judge contradicted the test's own `leftOutOnlyByThis` (said the filter drops Jonas); the repair obeyed and broke the correct filter. | — (model) | None now; C1 removes the refusal that invited it. | — |
| U9 | Ending quotes judge internals (node ids, "where", "end view"). | Core `unfinished-build/not-finished.ts` | Plain sentences. | open |
| U10 | Any loopback navigate reads "the start page". | Core `activity/wording/action.ts` | Name the start page only for the start address. | open |
| U1 | Per-row test cards do not name the row. | activity cards | open since 1002-M | open |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 6 | Whether the judge was shown that step 8 ran after withheld passes: answerable only by reading the request by hand; the packet says nothing (C1). | Core `build-test/summary.ts` |
