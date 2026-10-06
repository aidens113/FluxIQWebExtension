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
