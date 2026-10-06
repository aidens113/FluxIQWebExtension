# Live lane A — crossborder-marketplace-hub-to-cart

Lead: lane A live lead (Phase 1 live round, 2026-10-05/06). Instance
`t262-slot-2`, slot 2, workspace `t262-a`, tree `fxwork/t262` (extension
efaf2034, docs-only behind dev ffd10491; Core a83b1471 = Core dev).
Scope from the supervisor: one live run; on a pass, two zero-call replays;
then stop and return. No relaunch.

## Log

- Expectations written before launch:
  `docs/working/language-driven-flow-loop-plan/debugs/run-pending-t262-slot-2-a.md`
  (renamed to the run id after launch).
- Campaign dry-run: one task, the command recorded in the debug.
- Lab dry-run (`run-lab.mjs ... --dry-run`, `FLUXIQ_TEST_ENV_FILES=none`):
  status ready, providerCallCount 0, buildEntry chat, persistent-isolated,
  deepseek-flash, maxCalls 48, maxEstimatedCostUsd 0.1, permittedConsequences
  []. First attempt without `FLUXIQ_TEST_ENV_FILES=none` was refused before
  anything ran: `--target persistent-isolated conflicts with
  FLUXIQ_TEST_TARGET=isolated` (from `.env.local`); no spend.
- Live run `run-muw60unq-591e23bd` (2026-10-06 04:14-04:21Z, campaign
  `--max-attempts 1`, headed, side panel verified open, chat build): **failed**,
  `lab.chat_build_failed`, no Flow, oracle not measured. 36 calls,
  $0.045303 in total (build $0.045214 of the $0.10 ceiling). The no-progress
  guard ended the build after exploration plus two repairs; every judge
  said Ships From stayed China. Debug:
  `docs/working/language-driven-flow-loop-plan/debugs/run-muw60unq-591e23bd.md`.
- Cause: Core's instruction reader (`instructed-acts/instruction-choices.ts`)
  gives "shipped from Spain" no choice id, so the Spain press claimed the add
  act a1. It then competed with Add to cart for a1 (each round the model
  dropped one of them) and was withheld in the build test as a lasting act.
- Fix left uncommitted in the lane tree's Core (`fxwork/t262/!FluxIQ`,
  branch `task/t262-mvp-live-continuation`):
  `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/instruction-choices.ts`
  (new closed `ORIGIN` form, giving id `a1.origin`),
  `.../instructed-acts/tests/instruction-choices.test.ts` (failing first: 4 of
  28), `.../instructed-acts/tests/check.test.ts` (honest draft claims
  `a1.origin`). After the fix: 11 files, 298 tests passed; Core `tsc` exit 0.
  This is a Core edit in the tree lane B shares, so lane B's next run
  fingerprint includes it.
- UI findings: generic "Edit the Flow · Done" card hides a dropped step;
  ending paragraph shows raw handle "(t958)", a cut quote, a repeated
  sentence; overlay "Couldn't fix your Flow" on a creation build; start
  panel briefly shows an old thread with raw codes. Per-step cards, icons,
  overlay visibility and the robot-check card are good.
- Replays: not run (no accepted Flow). Stopped here, as briefed.

## Round 3 (2026-10-06, 21:17-21:58 UTC, off-peak)

Tree `fxwork/t262` (downstream f224b38a, docs-only behind dev 7880abda; Core e1551fa3 = Core dev), both trees
clean at start; slot 2, instance `t262-slot-2`, workspace `t262-a`. Source fingerprint `sha256:6475d56e...` for
both runs (no source edited by this lane).

- Dry-runs (21:18): campaign printed the one spawned command; Lab `--dry-run` `status ready`, `providerCallCount 0`,
  created-flow, buildEntry chat, persistent-isolated, deepseek-flash, maxCalls 48, maxEstimatedCostUsd 0.1,
  permittedConsequences [], same 219-character instruction.
- **Run 1 `run-mux6n7m4-8273e7a0`: passed.** 32 calls, $0.040481 (build $0.038386). All four oracle facts held:
  `Cart (3)`, `Orders to be shipped (0)`, Voltbay Official Store line with Space Grey, 7-in-1, Ships from Spain, × 3,
  and the store coupon collected; result check confirmed; 0 harness activations. The loop fix (N1) was seen working:
  no identical amend/rerun re-sent; refused rows carry their codes in the decision history. Debug:
  `docs/working/language-driven-flow-loop-plan/debugs/run-mux6n7m4-8273e7a0.md`.
- Replays of run 1's Flow: `replay-mux70ks8-42b807a0` and `replay-mux72fiq-dbf45610`, both passed with 0 calls,
  0 interventions, 0 harness activations, hash `cc95809e...` unchanged, goal held.
- **F1 (latent; the pass leans on it).** The kept Space Grey press (s11) is a toggle recorded while the colour was
  un-chosen. On a fresh page it would un-choose Space Grey, but its title-named target is never found after a reload,
  so the build test calls it `remembered` and playback routes past it. Read-only trace by a worker-high:
  `reports/live-a-r3-f1.md` (resolver: `element-finder.ts` name match only by aria-label/name,
  `candidates.ts:118-121`; build: Core `flow-draft/reversal.ts:62-63`). Fix proposals there; not applied.
- **Run 2 (the second independent live pass) `run-mux74k5q-1c3c2127`: failed** `runtime.behavior`, no Flow, 47
  calls, $0.071043 (build $0.070953), stopped at the 48-call allowance. Cause chain in its debug
  (`debugs/run-mux74k5q-1c3c2127.md`):
  C1, Core `flow-draft/amendment/apply.ts:225` + `llm/node-tools/draft-step.ts`: an `add` with
  `settings.target` retargeted the ran Spain press to the quantity field and claimed `a1.quantity` and `a1` on it;
  C2, `llm/node-tools/rerun-check.ts` `checked()` + `flow-draft/verify-only.ts`: every rerun of that step was a check
  that ran nothing, and a "taken" check kept `actionId` dom-click under a dom-type input, so `complete` was refused
  `bootstrap.unknown_parameter` twice; C3, `llm/repeat-guard/outcomes.ts`: the check that never ran was recorded
  as a failed attempt, so the model's direct quantity call was refused twice and part one ended
  `unusable_decisions`.
- **Not fixed in the tree:** lane B had uncommitted Core source edits in `fxwork/t262/!FluxIQ`
  (`flow-bootstrap/instructed-acts/{check,checklist,claim-doubt,contracts,standing}.ts`, a test,
  `unfinished-build/not-done.ts`) when run 2 failed, so by the brief this lane edited no source. Fixes and failing
  tests (C1a, C3, C2, C1b) are tabled in run 2's debug; C1b overlaps lane B's `claim-doubt.ts`.
- UI review against `reports/t277-r3-ui.md`. Seen fixed: per-step cards with outcomes, edit cards that say what
  changed, R2-U-7 fold ("Not done (2 times)"), plain words, a whole ending on a pass. Still open: R2-U-5 (no overlay
  until ~4.7 s after the send; panel "Sending your message"), "Couldn't fix your Flow" on the overlay at a creation
  build's end, the act quote cut mid-word ("shipped f..."), "no rows would be stored" on a cart task, a toggle that
  un-chose shown as "Done", a failed build's ending that overstates ("6 of the 6 things ... ran, or could run").
- Spend this round: $0.111524 over two live runs; replays $0.
