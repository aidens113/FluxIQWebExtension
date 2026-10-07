# Run debug — `run-muxky54f-fadb9d03`

t275 lane D round 4, slot 4, instance `t275-slot-4`, workspace `t275-d`: social-network-feed `confirm-requests`, built
from the extension chat on the tree synced to dev (downstream `5cad8286`, Core `ffbdea7e`: every fix-everything
workstream, read-list S1-S6, D3-1/D3-2/D3-5, round funding, t285 act claims, t287 refusal churn, t288 UI). Stage 1 is
the round-4 expectations in `mvp-final-month-plan/reports/live-d.md` (written 03:37 UTC, before the dry run and
launch); not repeated here.

## Header

- Run id `run-muxky54f-fadb9d03`; no runtime run (no Flow; no playback; no replay).
- Command: `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t275-slot-4 pnpm.cmd lab:campaign
  social-network-feed-confirm-requests --max-attempts 1 -- --target persistent-isolated --workspace t275-d
  --llm-cost-ceiling-usd 0.10`. Guard `admitted` 04:00:42 UTC (`sha256:5fd1e5e4...`), headed, chat build, one launch.
- Chat build 04:03:40-04:08:41 UTC, **off-peak**; `deepseek-flash`. A decision cost ~$0.0011-0.0027.
- Spend: **$0.064741** (build $0.064567 of the $0.10 ceiling). Calls: **49** = chat 1 + 40 decisions + 8 judge
  calls; the campaign printed 49 (D3-1 holds: counted = sent). The build's 48-call allowance ran out, not its money.
- Verdict: `failed`, "judgement not measured", `flowCreated: false`. Core: four judged tests, every pair **no, no**;
  round 3's second decision threw `flow_bootstrap.run_budget_calls_exhausted`.
- **Stage reached: 2** (exploration and repairs; no Flow proposed).

## Stage 2 — exploration and repairs (158 step folders)

| # | Decided | Core said | Cost to here |
| --- | --- | --- | --- |
| r0 0003-0017 | decline cookies; navigate `~/friends/` refused `address_not_shown`; Not now; Friends; detect x2; Friend requests; detect | ok | $0.013 |
| r0 0019-0023 | read `{name, mutual}` (8 rows); read `where atLeast 5` (step 11, 4 rows, Jonas kept); read again unfiltered "to capture every row's exact wording" (step 12) | ok | $0.017 |
| r0 0025-0037 | five amends `12 rerun +where atLeast 5`; `13 add a1` (no step 13); `12 keep`; `12 repeat over 12`; close chat (0031, no add, step 14); finally `14 add act a1` + `14 repeat over 12` | **D4-1**: every rerun refused `changes_nothing` unrun; 12 kept unfiltered; Core's `next` named step 14 (Close chat) as the act; **D4-2**: `14 add act a1` and the repeat **applied** | $0.031 |
| r0 test 0039-0053 | whole test: Close chat repeated over 8 rows, each `present` | judges 0054/0055 **no, no** ("never confirms"; "no mutual-friend filter") — right | $0.035 |
| r1 0057-0074 | detect; `6 rerun +where` (ran: 4 rows); `7 rerun` as Amara's Confirm (t775) | applied, but sent as a check of a done act (0067 `replay: "verify"`, "it was not run"): a1 was on the Close-chat step | |
| | `7 repeat over 6` `already_so`; **live read after the act, `add: true` (0072, D3-2's way)**; complete | the after-read has no `where` | $0.043 |
| r1 test 0075-0086 | listing 4 rows; Confirm passes `verified` x4; after-read 8 rows | judges 0087/0088 **no, no** ("stores all 8 requests") — right | $0.045 |
| r2 0090-0123 | snapshot; detect x2 (one `already_answered` snapshot between); after-read reruns: handle only (0098), `status equals "Confirm"`, `equals "Message"`, `is absent` (all applied); live press of Amara's Confirm (0112); `6 rerun` + `7 repeat` + `8 rerun` (one rerun per decision); `8 rerun is absent` x3 identical | `changes_nothing` x3 in a row ended the round (t287) | $0.059 |
| r2 test 0124-0135 | listing 4 rows; Confirm Amara `present`, others `verified`; after-read `is absent` keeps Amara (`afterWithheld: [7]`) | judges 0136/0137 **no, no**: both blame `atLeast 5` on text (it kept exactly the right four); 0136 calls `is absent` "wrong in principle"; 0137 blames the three withheld rows despite `afterWithheld` | $0.062 |
| r3 0139-0156 | `8 rerun where contains "Request accepted"` on the Confirm-button column; then calls exhausted | the read keeps none (Amara's value there is ""); judges 0157/0158 **no, no** (0157 again blames `atLeast 5`; 0158 reads the 8 rejected rows as returned) | $0.0646 |

Seen working on this source: D3-1 (49 = 49); D3-2 (the model added a live read after the act at 0072 instead of
rerunning the listing); D3-5 + round funding (no lone yes; round 3 opened with room for one decision and its pair);
t287 (three identical `changes_nothing` in a row ended round 2); `web-state.v4` (`already_answered` on repeated
snapshots 0095/0105); C1 `afterWithheld` was in every judge packet. **No wrong Flow accepted** (every pair no).
Not exercised: D2-1/D2-2, the rate limit (no playback), B's keep answer.

### Every read of the list (supervisor's question)

`web.output.dom-extract_list` ran **20 times**: 4 live reads (0020, 0022, 0024 in exploration; 0073 the read after the
act), 7 applied reruns (0062, 0100, 0103, 0108, 0111, 0117, 0144), 2 put-back replays for reruns (0066, 0142), and 7
in whole-Flow tests (0045, 0081, 0086, 0130, 0135, 0151, 0156). Beside them: 6 detects (0012, 0014, 0018, 0058, 0093,
0097), 4 snapshots run (0056, 0089, 0091, 0138) and 2 refused `already_answered` (0095, 0105), and 8 read reruns
refused `changes_nothing` unrun (0026, 0028, 0034, 0036, 0038 on the listing — D4-1; 0119, 0121, 0123 on the
after-read, true identical reruns).

| Run | Kind | Why (the model's words, or Core's) | Outcome |
| --- | --- | --- | --- |
| 0020 | live read | "see each request's mutual-friends text" | 8 rows |
| 0022 | live read | "keeping only 5+ mutual friends" | 4 rows, Jonas kept (`atLeast 5` reads "and 4 other" as 5) |
| 0024 | live read | "capture every row's exact wording" (the filtered read hid the other four) | 8 rows; became step 12, the kept listing |
| 0045 | test | r0 whole test | 8 rows (the unfiltered listing, D4-1) |
| 0062 | rerun | r1: put the where on the listing (the same request D4-1 refused five times in r0; it ran, inferred because the r0 test had reloaded the page and the guard keys on the page state, not checked) | 4 rows |
| 0066 | put-back | replay before rerunning step 7 as Confirm | 4 rows |
| 0073 | live read, add | "a post-act read of the requests list ... after confirming" (D3-2) | 8 rows, no where |
| 0081, 0086 | test | r1 whole test | 4 / 8 rows |
| 0100 | rerun | "keep only accepted requests" (sent only a new handle) | 8 rows |
| 0103, 0108, 0111 | rerun | three guesses at the accepted state on the Confirm-button column: equals "Confirm", equals "Message", is absent | the last keeps rows without a Confirm |
| 0117 | rerun | r2: re-sent the listing with the repeat and the after-read in one decision | 4 rows |
| 0130, 0135 | test | r2 whole test | 4 / 1 rows (Amara) |
| 0142 | put-back | replay before rerunning step 8 | 4 rows |
| 0144 | rerun | "keep rows shown as accepted": `contains "Request accepted"` on the Confirm-button column | keeps none |
| 0151, 0156 | test | r3 whole test | 4 / none |

Why the re-reads happened, by weight:
1. **D4-1** cost r0's listing: five decisions trying to put the `where` on the kept read, all refused unrun, so the
   r0 Flow read all 8 rows and the r0 test and judges were spent on it.
2. **D4-3**: the accepted state had no column. Every detect (0012-0097) ran before any Confirm was pressed live (r1's
   Confirm rerun was only a check, D4-2), so no detect ever offered the "Request accepted" element (fields: name link,
   mutual line, "2w", Confirm button, Delete button). After pressing Amara at 0112 the model never detected again, and
   spent five reruns (0100-0111, 0144) guessing a condition on the Confirm-button column.
3. The rest is design: each repair round's put-back replay and each whole-Flow test read both reads once.

## Stage 3 — the authored Flow (draft at the end; never proposed)

1 navigate `~/`; 2 decline cookies; 3 Not now; 4 Friends; 5 Friend requests; 6 listing `{name, mutualFriends}` `where
mutualFriends atLeast 5` (4 rows: Amara, Jonas, Lin, Freya); 7 Confirm (Amara's row control) repeated over 6; 8 read
`{name, mutualFriends, status}` `where status contains "Request accepted"` on the Confirm-button column (keeps none).
Round 2's version of step 8 (`is absent` on that column) would have kept exactly the accepted rows at playback, with
an extra `status` column the instruction did not ask for.

## Stage 4 — replay (the build's tests)

Four whole tests (0039-0053, 0075-0086, 0124-0135, 0145-0156). Provider calls during tests: zero. Excluded rows
untouched: yes (only Amara pressed live, at 0112; no Delete). Close chat "repeated" over 8 rows in r0 (`present` x8).

## Stage 5 — the answer

NO EVIDENCE: no playback; oracle not measured.

## Stage 6 — judgement and repair

Pairs r0 no/no (right), r1 no/no (right), r2 no/no (wrong reasons: `atLeast 5` blamed although it kept the right four;
0137 blamed the withheld presses despite `afterWithheld`), r3 no/no (right verdict, wrong reasons: 0157 again
`atLeast 5`; 0158 took the 8 rejected rows of an empty read as stored rows). The check card at the end said "12 rows
would be stored" (4 + those 8 rejected).

### UI review (18 moments; full table `mvp-final-month-plan/reports/r4-d-ui-review.md`)

- Overlay visible 284/288 samples (the 4 misses are moment 1 before the send); flickering at #10 and #11; 3 page
  loads, overlay never lost.
- Seen fixed: "Starting…" on the page overlay; build read cards "Done: 8 rows from 1 page"; "Judging the Flow — The
  test ran 7 of the Flow's 8 steps from its start; 1 was only checked, not run" (#15); repair heading without a step
  number; a failed check says what it objected to (#15); "Checked, not pressed" per row (#11, #17); the ending names
  the 48-call limit; no "ran, or could run"; no "Couldn't fix your Flow".
- Not fixed: the previous build's thread at the start (#1, lead-verified: "s8", "the confirm loop s11", "fix s13",
  "the judge found", "ran, or could run"); the two-field list name cut "name and mutual" (#4-#9); "Judging the Flow"
  without a count at #11; internal words ("a where", "confirm loop", "Step 6", "filtering status absent", "step filter").
- New: card labels cut mid-label ("Close ... · Tom Becker", "Close chat ... Kowalczyk", "Decline ... cookies");
  "Reading your instruction gave no answer for ..." (#5); "The build stopped before the Flow was finished" mid-build
  (#5); "Didn't work: the step wasn't accepted" with no reason (#3); overlay "Fixing your Flow" in a creation build;
  "12 rows would be stored" (#18, lead-verified, cause D4-5).

## Causes

| # | Cause, precisely | Repo and file | Fix | Status |
| --- | --- | --- | --- | --- |
| D4-1 | **A rerun that puts a `where` on the kept listing is refused as a repeat.** Step 11 (0021) read `where atLeast 5`; step 12 (0023) read without it and was kept. `12 rerun +where` merges to step 11's exact call on the same page; the repeat guard records every list read as `changed_nothing` (a read never moves its page), and `rerun-request.ts` refused each rerun `changes_nothing` unrun, five times, though it changes step 12. | Core `R/llm/evidence-loop/rerun-request.ts` (with `R/llm/repeat-guard/outcomes.ts`, `R/llm/decision-handlers/amendment.ts`) | The guard's outcome is passed instead of a boolean; a rerun of a read step (`effect: "observe"`) whose merged input differs from its own runs unless the identical call `failed`. The identical rerun, a failed call and any mutate step stay refused. | **fixed in tree, uncommitted** |
| D4-2 | **a1 claimed on a press that only closed a layer is applied, and Core named that press as the loop's act.** `rowAct` named the first mutating step after the listing (Close chat). The claim verdict saw `act_needs_repeat` (a1 is plural and the repeat came after the claim in the same decision) and never read what the step did, so `14 add act a1` stood; the checklist said `step_only_clears_the_way` only once the repeat was on. With a1 stuck there, r1's Confirm rerun of that step was a check (never pressed). | Core `R/flow-bootstrap/instructed-acts/claim-verdict.ts`; `R/llm/draft-amendment-feedback.ts` (`rowAct`) | For todos about the step's place (`act_needs_repeat`, `span_stops_short`, `step_is_optional`, `act_consequence_undeclared`) the verdict asks what the step did instead (`act-evidence.ts`) and refuses with the checklist's sentence. `rowAct` skips presses with `interruption: true`. | **fixed in tree, uncommitted** |
| D4-2b | `14 repeat over 12` in the same decision still lands on the Close-chat press even with the claim refused. | Core `R/flow-draft/amendment/apply.ts` | Refuse a `repeat` on a step with `interruption: true` (it acts on no row), naming the way out. | open |
| D4-3 | **No column for the accepted state.** A detect run before the act cannot offer the element the act creates; nothing tells the model to detect again after its first live press when the instruction reads rows by a state the act sets. | Core `R/llm/draft-amendment-feedback.ts` `readAfterAct` / the after-read guidance | After the act is done live, say: detect the list again there, so the column the act wrote ("Request accepted") is offered. | open |
| D4-4 | **Judges distrust a count condition on text.** All four r2/r3 judges said `atLeast 5` on "Aisha Khan and 4 other mutual friends" was wrong while the test showed it kept exactly the right four; 0137 ignored `afterWithheld`. | Core judge instructions (`R/llm/diagnosis-instructions.ts`) and the build-test step's condition evidence | Tell the judge how a count condition read each kept/rejected row (the number it took), and to judge a condition by the rows it kept. | open |
| D4-5 | **A read that keeps none returns its rejected rows as `readRows.rows`.** Judge 0158 and the check card ("12 rows would be stored" = 4 + 8 rejected) count them as stored. | downstream `domain/.../node-run` outcome (`readRows`), Core check-card count | Put rejected rows under their own key when nothing is kept; never count them as stored. | open |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Which earlier call a `changes_nothing` rerun refusal matched (0021 for 0025-0037 was inferred by comparing `call.json` inputs). | Core `R/llm/evidence-loop/rerun-request.ts` refusal record (no `callId` of the matching call) |
| 2 | Whether a draft step carried `interruption: true` is not in the decision request; inferred from the later checklist todo `step_only_clears_the_way` (`act-evidence.ts:140`). | Core draft entry shown to the model / step log |
