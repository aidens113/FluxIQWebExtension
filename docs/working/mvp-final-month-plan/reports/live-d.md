# Live lane D — `social-network-feed-confirm-requests` (t275)

Lead: lane D live lead. Slot 4, instance `t275-slot-4`, tree `fxwork/t275/!FluxIQWebExtension` on
`task/t275-live-lane-d` at `efaf2034` (dev `ffd10491` differs by docs only), Core `../!FluxIQ` at `a83b1471`
(contains Core `dev`). Workspace `t275-d` (persistent-isolated, needed for the zero-call replays).
Supervisor's order for this dispatch: one live run; on a pass the two zero-call replays; then stop and return.

## Expectations (written 2026-10-05, before the dry run and before any launch)

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

Launch plan: `pnpm.cmd lab:campaign social-network-feed-confirm-requests --max-attempts 1 -- --target
persistent-isolated --workspace t275-d --llm-cost-ceiling-usd 0.10` with `FLUXIQ_TEST_ENV_FILES=none
FLUXIQ_LAB_INSTANCE=t275-slot-4`; dry run first. DeepSeek flash (campaign default), 48 logical build calls
(campaign default), $0.10 Lab ceiling, headed (the launcher is always headed).

## Ledger

### 2026-10-05 — dry runs

- `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t275-slot-4 pnpm.cmd lab:campaign social-network-feed-confirm-requests --max-attempts 1 --dry-run -- --target persistent-isolated --workspace t275-d --llm-cost-ceiling-usd 0.10`
  printed: `pnpm lab run social-network-feed --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task social-network-feed-confirm-requests --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t275-d --llm-cost-ceiling-usd 0.10`.
- The same command through `node scripts/lab/run-lab.mjs ... --dry-run`: `status ready`, `providerCallCount 0`,
  `buildEntry chat`, `target persistent-isolated`, workflow `confirm-requests`, judged by `expected-dataset` step
  `extract-confirmed`; live plan `deepseek-flash` (Core default the same), `build_and_adapt`, 48 calls, 25 s per
  call, `maxEstimatedCostUsd 0.1`, **`permittedConsequences []`** (no `--llm-permit`; confirming rests on the
  instruction's authority), key `DEEPSEEK_API_KEY` from `.env.local` by name. Prelude rebuilt the slot's
  scenario-lab and extension builds; Core web build not cached (built at launch).

### 2026-10-05 — live run `run-muw6144a-e56f945d`: FAILED (build not finished); debug written

- One launch, guard admitted, headed, chat build. 44 calls, $0.053701 (build $0.053535 of the $0.10 ceiling).
  Core `flow_bootstrap.build_not_finished` + `llm_evidence_loop.repeat_refused`; Lab `lab.chat_build_failed`.
- Oracle not measured (no Flow). Excluded rows untouched (final page: only Amara accepted, explored live; no
  "Request removed"). No permission ask. No replay possible.
- Cause C1 (Core): the round-1 draft was the right Flow (listing `atLeast 5` = Amara, Jonas, Lin, Freya; Confirm
  repeated over it; read `where status equals "Request accepted"`), but its build test only checked the three
  Confirm passes the build had not done, so the final read returned Amara alone, and the judge took that as the
  Flow's answer ("missing Jonas, Lin, Freya"; "step 7 must actually run"). The repair that followed the judge broke
  the filter (Jonas out). Full debug: `docs/working/language-driven-flow-loop-plan/debugs/run-muw6144a-e56f945d.md`.

### Brief: t275-d-c1-after-withheld (worker-high, Core, lane D tree; dispatched 2026-10-05)

- Task: a build test's read that ran after acts the test only checked must say so to the judge, and the judge
  must be told how to read it (debug above, Cause C1).
- Core root: `C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQ`; `R` = `packages/fluxiq/src/programs/automation-studio/runtime`.
- Implement: (1) `R/result-verification/build-test/summary.ts`: a step that does not change anything (a read)
  and comes after one or more steps with `withheld: true` whose outcome or any pass is `verified` (act not done
  in this test; `present` means already in place and does not count) carries `afterWithheld: number[]`, those
  steps' positions in order. (2) `R/result-verification/contracts.ts`: `AutomationStudioBuildTestStep.afterWithheld?`
  with a doc comment. (3) `R/llm/diagnosis-instructions.ts`: after the withheld sentences of the build-test
  instruction, say that a read with afterWithheld ran on a page without what those acts make (a status they set,
  a row they add, a count they change), so rows missing for that reason are the test's, not the Flow's; judge it by
  whether its conditions would keep what those acts make on the rows their passes name (explored says what the
  act changed when the build did it), and never answer no, or ask for a withheld step to be run, for their absence.
  Header comment names the run. (4) Re-pin `loop_verification_build_test` in
  `R/llm/deepseek/tests/system-prompt-pins.json` from the source, not by hand. (5) If any request/evidence
  validator (e.g. `R/llm/harness/request-evidence-check.ts`) refuses unknown build-test step keys, admit
  `afterWithheld` there.
- Failing test first, in `R/result-verification/build-test/tests/`: the round-1 shape (6 listing, 7 Confirm
  repeated over 6 with passes present/verified/verified/verified, 8 read replayed) gives step 8
  `afterWithheld: [7]`; a read after only `present` passes, or before the withheld step, gets none.
- Validate (Core root): `pnpm.cmd --filter fluxiq exec vitest run` on `result-verification` and
  `llm/deepseek/tests` (and the validator's tests if touched); `pnpm.cmd --filter fluxiq run check`;
  `node scripts/structure-audit.mjs`.
- Owns: the files above and the new test only. Must not: commit, run full suites, start any live run.
- Report: `docs/working/mvp-final-month-plan/reports/t275-d-c1-worker.md` in the downstream lane tree.

### 2026-10-05 — C1 fix in the lane's Core worktree, verified by the lead (uncommitted)

- Worker `t275-d-c1-after-withheld` (worker-high) report: `reports/t275-d-c1-worker.md`. Changed, Core
  `R` = `fxwork/t275/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`:
  `R/result-verification/build-test/summary.ts` (`afterWithheld` on a read after checked steps left `verified`),
  `R/result-verification/contracts.ts` (the field), `R/llm/diagnosis-instructions.ts` (one sentence in the
  build-test instruction), `R/llm/deepseek/tests/system-prompt-pins.json` (`loop_verification_build_test` re-pinned),
  new `R/result-verification/build-test/tests/after-withheld.test.ts`.
- Lead's own validation (Core root): with `summary.ts` reset to HEAD, `pnpm.cmd --filter fluxiq exec vitest run
  .../build-test/tests/after-withheld.test.ts` -> 2 failed | 2 passed (4); fix restored -> the run below.
  `vitest run` on `runtime/result-verification` + `runtime/llm/deepseek/tests` -> 40 files, 443 passed.
  The nine other tests that assert build-test packets (request-evidence-check, replay-parity, diagnosis-channel,
  build-judge, stored-flow, repair-replay-chain, judged-reauthor, confirm-requests-build, judged-build) -> 9 files,
  56 passed. `pnpm.cmd --filter fluxiq run check` exit 0; `node scripts/structure-audit.mjs` exit 0.
- Not verified: the judge's live behaviour on such a read (needs the next live run); the playback rate limit
  (4th Confirm inside 15 s) is still unexercised, since no build has reached playback.
- Stopped here per the supervisor's order: no relaunch.

## Round 2 (supervisor dispatch after the C1 merge)

Tree `task/t275-live-lane-d` at `624c7a70` (contains dev), Core at `9fd634d3` (contains dev and `eb672178`, the
merged `afterWithheld` fix with lanes B and C's judge sentences and t276's UI fixes). Round-1 debug committed
(`ca1a5c26`), source fingerprint changed, so the `debug` and `unchanged` guards admit one run.

### Expectations for round 2 (written 2026-10-05, before the dry run and any launch)

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

### 2026-10-05 — round 2 dry runs

- Campaign dry run printed the same command as round 1. Lab `--dry-run`: `ready`, 0 calls, `buildEntry chat`,
  `persistent-isolated`, workflow `confirm-requests` judged by `extract-confirmed`; `deepseek-flash` (Core default the
  same), 48 calls, 25 s per call, `maxEstimatedCostUsd 0.1`, `permittedConsequences []`, key by name from
  `.env.local`; Core web build `a0841f6b...` not cached (built at launch).

### 2026-10-06 — round 2 live run `run-muwao5n4-44977b2a`: FAILED (budget exhausted); debug written; stopped

- One launch, guard admitted, headed, chat build. 31 calls, $0.086463 (build $0.086282 of the $0.10 ceiling),
  in DeepSeek's weekday peak window (06:00-10:00 UTC), so each call cost twice round 1's for the same tokens.
  Core `flow_bootstrap.evidence_budget_exhausted` after four failed tests; never judged; no Flow, no playback,
  no replay; oracle not measured. Excluded rows untouched (only Amara pressed live, a qualifying row). No
  permission ask.
- Causes (debug `docs/working/language-driven-flow-loop-plan/debugs/run-muwao5n4-44977b2a.md`):
  D2-1 (Core `R/flow-draft/amendment/apply.ts`): amend decisions put the listing at step 2, after `navigate ~/`,
  and then dropped both navigations to the requests page. Both were applied with no word, so every test ran
  the listing on the home feed. D2-2 (downstream `domain/src/runtime/llm-evidence/node-run/replay.ts`): a list
  read whose list never appeared, on a page other than the one it read, is answered `failed` instead of
  `unreproducible`, so the model was told to fix its argument rather than the steps before it.
- The C1 fix (`afterWithheld`) and the B/C judge sentences were not exercised (nothing judged). U9 and U10
  verified fixed in the UI; U11 new ("Skipped: it only runs sometimes" on a repeat over an unreached list).
- Stopped on the supervisor's order (user wrapping up): no fix started, no failing test written for D2-1/D2-2,
  nothing changed in either repository's source this round. No relaunch.

## Round 3 (lead dispatch 2026-10-06 21:16 UTC, off-peak)

Tree `task/t275-live-lane-d` downstream `f224b38a` (dev `7880abda` differs by docs only), Core `e1551fa3` (= Core
dev). Synced and rebuilt by the supervisor at 21:16 UTC. Slot 4, instance `t275-slot-4`, workspace `t275-d`.

### Expectations for round 3 (written 2026-10-06 21:18 UTC, before the dry run and any launch)

Unchanged from rounds 1-2 (instruction, fixture facts, correct chain, exact oracle of four records in list order:
`{Amara Osei, "23 mutual friends"}`, `{Jonas Weber, "Aisha Khan and 4 other mutual friends"}`, `{Lin Zhao, "11 mutual
friends"}`, `{Freya Holm, "5 mutual friends"}`; Tom, Priya, Diego, Marta untouched with Confirm/Delete and no "Request
removed"; no permission ask; `modify_existing` on the instruction's authority; no `--llm-permit`). Launch is off-peak
(~21:30 UTC), so the $0.10 ceiling should buy roughly twice round 2's 30 decisions.

New on this source, each checked in the debug:
- **D2-1 (`strands_a_step`)**: an amend decision that drops the navigation(s) reaching `~/friends/requests/` while the
  listing stays kept is put back and refused `strands_a_step`, naming the stranded step; a step newly added or moved
  after a step that does not reach its page gets an `unreached` note (`llm_evidence_loop.draft_step_unreached`, "left
  unreached", not a refusal). **Must be seen fixed: no accepted edit leaves the listing on the home feed.** If the
  model still places the listing early (0025 shape), the answer names the step before it and the reorder to make.
- **D2-2**: a list read whose list never appeared, on a page other than the one it read, answers
  `core.replay.unreproducible` (so the test's way-line names the steps that no longer reach the page); on its own page
  it still fails.
- Lane A loop fix: an identical amendment re-sent after its rerun changed nothing is refused unrun (`same_amendment`)
  and counts toward the refused-in-a-row stop; history rows say "unchanged"/"refused", never "applied" for refused
  work. B: a keep-only decision is told keep adds nothing. `web-state.v4`: the same page after a reload digests the
  same. t278 (`checked` rows reach a node repair); `judgement.whereToFix` in a repair instruction.
- Build: a draft reaching the full requests list (navigation kept or start there), the listing `where >= 5` keeping
  exactly the four (Jonas via "and 4 other"), Confirm repeated over it and re-found per row, then a read of rows
  showing "Request accepted" with `afterWithheld: [<Confirm step>]`, judged **yes** (C1 first exercised). A no that
  blames the withheld presses is C1 again.
- Playback (first time for D, if reached): fixture reset, four presses; the 4th inside 15 s meets "You're going too
  fast". **Predicted main risk**: Freya's press refused, three rows read, oracle 3 of 4, unless recovery waits and
  presses Try again. Pressing OK and moving on, or reporting success on three rows, is a defect.
- On a pass: two `lab replay` runs with zero model calls, each 4 records, same SHA-256; then a second live pass.
- UI (t277 landed items, `t277-r3-ui.md`): per-row test cards "Confirm · <name> — checked, not pressed"; an unreached
  repeat reads "Skipped: the test reached no rows for it to repeat over" (U11), never "it only runs sometimes"; a check
  card says the count and why ("Didn't pass: N rows would be stored, but ..."), never bare; no internal words
  ("extraction", "the judge", "Step N", "next call") in thoughts/cards; "Starting…" from the send; a refusal is never
  "it wasn't on the page" when it was; repeated refusals fold into one card with a count; one list name across cards
  and overlay; overlay visible throughout, no flicker. Not landed, expected unchanged: R2-U-2 ending dollar words,
  R2-U-9 detect card "the repeating list on the page".

### 2026-10-06 — round 3 dry runs (21:20 UTC)

- `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t275-slot-4 pnpm.cmd lab:campaign social-network-feed-confirm-requests
  --dry-run --max-attempts 1 -- --target persistent-isolated --workspace t275-d --llm-cost-ceiling-usd 0.10` printed the
  same `pnpm lab run social-network-feed --live-llm ... --llm-max-calls 48 ...` command as round 2.
- Lab `--dry-run` with that command: `status ready`, `providerCallCount 0`, `buildEntry chat`, `persistent-isolated`,
  workflow `confirm-requests` judged by `extract-confirmed`; `deepseek-flash` (= `coreDefaultModel`), 48 calls, 25 s
  per call, `maxEstimatedCostUsd 0.1`, `permittedConsequences []`, key by name from `.env.local`. Prelude rebuilt
  `domain:host-build` and `extension:build` for the instance (inputs from the 21:16 rebuild).

### 2026-10-06 — round 3 live run `run-mux6nxst-c9bca37c`: FAILED (Lab call count); Flow proposed inside Core; fix in tree; stopped

- One launch 21:20 UTC (off-peak), guard admitted, headed, chat build. Sent 49 calls (chat 1, 41 decisions, 7 judges),
  **$0.060085** (build $0.059994 of $0.10). Lab verdict `failed`, `performance.budget`: "49 provider call(s) against
  an authorized 48". Inside Core the build **succeeded**: round-3 reserve judgement yes, outcome `proposed`, chat "is
  ready". No playback, no oracle, no replay. Excluded rows untouched (only Amara pressed live, no Delete).
  No permission ask.
- Cause D3-1 (Core `R/service/instruction-authority.ts`): the instruction reading counted itself a provider call when
  the build's purse refused it unsent. Nothing triggered the reading during the build (`modify_existing` is not
  destructive), so it first ran in the post-build cross-check with 48/48 calls spent. Core published
  `totalProviderCallCount` 49 for 48 sent, and the Lab's `budget.ts` failed the run. The same phantom call made
  `run-spend.ts` `creationBuildSplit` count the 7 judge calls twice (campaign "57 calls").
  **Fixed in the tree (uncommitted)**: count a call and its tokens only when `providerInvocation !== "not_attempted"`.
- The Flow it proposed was still not right: it confirms the right four (after two `where` repairs for Jonas), but its
  table is the listing read before the presses (no read after the confirms). Judge pair r2 split yes/no on that Flow.
  Round 3 could make no decision (47/48 calls spent) and accepted the identical Flow on one unpaired yes (D3-5,
  `result-verification/agreement.ts` takes a lone first verdict as final). The model asked in 19 decisions for a read
  after the confirms. It only ever tried rerunning the listing in place, and `changes_nothing`'s `next` points it
  at the loop, never at adding a new read (D3-2). It could not name the "Request accepted" column (hashed detect
  labels, D3-3), and it wrote a regex instead of the count condition (D3-4). D3-3/D3-4 are the supervisor's in-flight fixes.
- Seen on this source: lane A's fix (identical reruns refused unsent, "Not done (2 times)" cards, the refused-in-a-row
  stop ended round 1 instead of looping); `already_answered` on repeated detects/snapshots (`web-state.v4`); C1
  `afterWithheld` (no judge blamed withheld presses). Not exercised: D2-1 `strands_a_step` (the model reached the
  requests page by clicks), D2-2, B's keep answer, U11. UI: R2-U-6/7 fixed; R2-U-1 partly (count plus a clause that
  says what was kept, not why); R2-U-8 not (test card title "name and..." cut); R2-U-10 (old thread with "s8", "s13",
  "the judge" at moment 1) as expected.
- Read node count (supervisor's question): `dom-extract_list` ran 11 times (3 live, 4 applied reruns, 4 tests); 6
  detect and 3 snapshot decisions; 9 listing reruns refused `changes_nothing`. Per-read reasons:
  debug "Every read of the list".
- Fix validation (Core tree `fxwork/t275/!FluxIQ`): fail-first `npx vitest run
  .../service/tests/instruction-authority.test.ts` -> `1 failed | 21 passed` (refused read counted `calls: 1`,
  `estimatedInputTokens: 10`; the purse refusal was `llm_budget.run_call_limit`); after the fix 22/22, twice. With the
  13 other files that assert call counts or the authority (generation-catch, with-total-provider-calls, build-judge,
  evidence-trace, deepseek-bootstrap answerability/exploration, service-authoring build-call-admission,
  confirm-requests-build, quantity-arrival-build, retained-rerun-feedback, service-bootstrap accounting, generation,
  judged-build): `Test Files 14 passed (14)`, `Tests 111 passed (111)`. `fluxiq:check` exit 0; Core
  `structure-audit:check` -> `passed (264 warning(s), 349 baselined)`; Core `pnpm.cmd build` exit 0 (21:43 UTC).
- Stopped on the supervisor's order: no second launch. Debug
  `docs/working/language-driven-flow-loop-plan/debugs/run-mux6nxst-c9bca37c.md`.

### 2026-10-06 — round 3 fixes D3-5 and D3-2 (supervisor follow-up; no paid run)

D3-1 was verified and merged by the supervisor (Core `5ef566ac`, evidence `b544215e`); both t275 trees were at dev.
Two workers in parallel, disjoint files (reports `reports/r3-d3-5-judge-pair.md`, `reports/r3-d3-2-read-after-act.md`).

- **D3-5** (worker-high). Core `R/result-verification/agreement.ts`: with `confirmAnswer`, a first yes whose second
  call never came back usable (`basis: "model_unavailable"`, which covers refused by the purse, not sent, or failed)
  is `model_unconfirmed`, not a pass. A second `unknown` or silent reply still leaves the yes standing (measured
  flips). `R/llm/build-purse/purse.ts` `judgingFits()` (+ `call-allowance.ts` `canHoldAll`): whether the whole
  kept-back judging still fits on calls and cost. `R/flow-bootstrap/unfinished-build/reserve-judging.ts`: under a purse
  where it does not fit, nothing is judged (`not_judged`, neither `accept` nor the judge asked), so a reserve-stopped
  round ends at its budget unjudged. Fallout outside the named files: `build-test/judge.ts` comments only (its logic
  already maps a refused, unconfirmed yes to `not_judged` with the spend returned); `build-test/tests/judge.test.ts`
  and `tests/agreement.test.ts` cases that pinned the old rule were rewritten.
- **D3-2** (worker). Core `R/llm/draft-amendment-feedback.ts`: a `changes_nothing` rerun of a listing that a later
  act already repeats over now gets this `next`: "Step N already repeats over step L, so the loop is in place:
  rerunning step L only replaces it and never adds a step after step N. A read of the rows after the act is a new
  step: with the act done on the page, run the read there as a new call ("core.run_node" with add true) so it is
  added after step N, with a where keeping the rows the instruction asks for -- or write it with write true."
  Downstream `node-run/outcome.ts`: a node that ran says `addable` (a kind of step a Flow can hold, in it only once
  added); only a written step says `inFlow: true`. Writers `node-run/run.ts` (two lines) and `written-step.ts`
  (`addable: undefined`, required by `present<>`) updated.
- Lead verification (both trees `fxwork/t275`):
  - Fail-first, re-run by the lead with only the fixed sources set back to HEAD (copies, no git stash):
    - Core, the 5 changed test files: `Test Files 5 failed (5)`, `Tests 7 failed | 116 passed (123)`, every failure
      a new or rewritten test.
    - Downstream `node-run/tests/run.test.ts`: `not ok 10 - a node run's result says it is addable, never that it is
      in the Flow; a written step says it is`, `# pass 15 # fail 1`.
    - Fixed files restored byte-identical (`cmp`).
  - After: Core `npx vitest run` over `result-verification/tests`, `result-verification/build-test/tests`,
    `llm/build-purse/tests`, `flow-bootstrap/unfinished-build/tests`, `llm/tests/draft-amendment-feedback.test.ts`,
    `llm/decision-handlers/tests` and `service/tests/instruction-authority.test.ts` gave `Test Files 67 passed (67)`,
    `Tests 638 passed (638)`.
  - Core gates: `fluxiq:check` exit 0; Core `structure-audit:check` `passed (265 warning(s), 349 baselined)` (the new
    advisory is `judge.test.ts` at 405 lines); Core `pnpm.cmd build` exit 0.
  - Downstream: `run-subset` + `node --test` on `node-run/tests/run.test.ts`, `unwritten-consequences.test.ts` and
    `observed-state/tests/observed-state-keys.test.ts` gave `# tests 26 # pass 26 # fail 0`;
    `pnpm.cmd --filter @fluxiq-web-extension/domain check` exit 0; `node scripts/structure-audit.mjs`
    `passed (171 warning(s), 118 baselined)`.
- Open, outside these owned files: `unfinished-build/phases.ts` still announces "judging it with what was kept back
  for judging" (and runs the free test) when `judgingFits()` is false, and opens a round whose judging pair no longer
  fits. Better: have `round-funding.ts` `nextRound()` require `judgingFits()` plus one decision call, so the round is
  not opened. The unsettled "build" card words ("Since neither confirmed it") read slightly off for "yes, then no
  answer" (`result-verification/unsettled/unsettled-words.ts`).
- Uncommitted. No Lab, browser or provider call.
