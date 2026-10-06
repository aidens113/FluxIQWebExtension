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
