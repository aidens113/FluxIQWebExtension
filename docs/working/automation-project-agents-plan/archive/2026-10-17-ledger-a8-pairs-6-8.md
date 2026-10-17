# Work Ledger, A8 frozen pairs 6-8 and the default flip (archived 2026-10-17)

Moved from [automation-project-agents-plan.md](../../automation-project-agents-plan.md) when the plan neared 800 lines.

### 2026-10-16 — A8 frozen pair 6 wave 32; stopped; clearing spares run-opened layers (t656); playback records routing (t657); Core t658-t661
- Agent: supervisor (wave 32, the stop, the peak-price finding); read-only debugs `reports/a8-bigbox-cart-run-mvac0ddx-debug.md`, `a8-towels-run-mvac0nmw-debug.md`, `a8-towels-run-mvac1av6-debug.md`; workers t656, t657 (three rounds: refused guards kept, unknown keys ignored); Core t658-t661 (Core ledger); supervisor verified and integrated
- Changed: t656 `apps/extension/src/content/action-runtime/interference/{run-opened,page-wall,clearable-layers}.ts`, `presence.ts`, `recovery/attempt.ts`, `content/actions/execute.ts`: layers a successful press opened are spared by clearing until they leave, a missing target clears only a page-blocking wall, a present-but-hidden target says `shown: false` (`domain/src/actions/types.ts`, `runtime/failure/codes.ts`); a headed content spec on bigbox-retail reproduces the closed store picker and passes. t657 `packages/test-runner/src/lab-runs/write-playback-steps.ts` and `playback-step/`: playback steps record cleared layers and the state-routing record (refused guards, `noMatchCause`); `flow-lane/state-routing-attempt.ts` keeps records with unknown keys, copying only known fields
- Why: wave 32 (2026-10-16 02:17 UTC, peak price): `project` bigbox cart passed $0.094; `candidate` cart failed $0.191 (playback closed the Flow's own store picker); `project` towels failed $0.190 (a judged-yes part dropped by an amend, then Core misreadings); `candidate` towels failed $0.242 with a correct Flow refuted after playback on a no-op filter claim. The same tokens cost twice wave 27's (23:46 UTC); failing builds also made two to three times the calls
- Validation: t656 after merging dev: extension `src/content/action-runtime src/content/actions` -> 530 pass; `check-extension.mjs` exit 0; domain `runtime/failure client` -> 91 pass; domain tsc exit 0; audit passed; content specs headed (worker) 19 + 1 passed; merged `061f2845`. t657 after merging dev: test-runner check and build exit 0; flow-lane, lab-runs, playback-step, playback-skips dist tests -> 285 pass; audit passed; merged `06e5f4b9`. Pushed
- Outcome: Accepted. Next: t662 (a saved Flow records its judged trial), then frozen pair 7

### 2026-10-16 — A8 frozen pair 7 wave 37; stopped on a false yes over kept rows; Core t662-t664
- Agent: supervisor (wave 37, the stop); read-only debug `reports/a8-towels-run-mvahlxuu-debug.md`; Core t662-t664 (Core ledger)
- Changed: the A8 Run Plan's frozen pair 7 table and stop note; the wave's debug notes and UI review
- Why: wave 37 (04:46 UTC; priced at the lower rate, about $0.11 per weighted million tokens, not peak as first noted): `project` bigbox cart passed $0.043 (two subflows), towels passed $0.033; `candidate` bigbox cart passed $0.033 (the t656 store-picker fix held), towels failed $0.123 on a false build yes over a kept row that is not the item asked for
- Validation: wave 37's verdicts as above; Core t663 and t664 each `pnpm check` -> passed; merged and pushed
- Outcome: Accepted. Frozen pair 8 next

### 2026-10-16 — A8 frozen pair 8: the flip rule is met; Core t665, t666 merged after it
- Agent: supervisor (waves 42-46 on one frozen pair, the decision to run on past wave 42's `candidate` towels failure, the flip); read-only debug `reports/a8-towels-run-mvam0lys-debug.md`; Core t665, t666 (Core ledger), built during the pair and merged after it
- Changed: the A8 Run Plan's frozen pair 8 table, run-on note and reading; every run's debug note; Core t667 (in flight) makes `project` the product default
- Why: `project` passed 10 of 10 on one frozen pair (two consecutive passes on each task); `candidate` passed 9 of 9 run with towels round 1 failed (round 2 skipped as a known failure); `candidate` has failed towels in every pair since pair 2
- Validation: frozen pair 8 (downstream `2d32847e`, Core `f7a0c4d1`): `project` cart $0.114, $0.137; towels $0.125, $0.106; crossborder $0.142, $0.081; everything-store $0.081, $0.105; social $0.084, $0.109 (total $1.084); `candidate` cart $0.072, $0.065; towels failed $0.125; crossborder $0.028, $0.029; everything-store $0.082, $0.127; social $0.042, $0.036 (total $0.606); all at the higher price rate
- Outcome: Accepted. The default flips to `project` (Core t667); next cost item: a one-part task run as several briefs (crossborder round 1: five briefs)

### 2026-10-16 — Handoff: A8 complete, `project` the default
- Agent: supervisor (handoff)
- Changed: Current State rewritten for the finished A8 and the default flip; header status
- Why: end of the A8 work unit
- Validation: `pnpm structure:check` -> "structure-audit: passed (201 warning(s), 639 baselined)."; Core `node scripts/structure-audit.mjs` -> "structure-audit: passed (389 warning(s), 1156 baselined)."; every merge this session ran its narrow checks and Core's `pnpm check` (ledgers)
- Outcome: Accepted. Next: the one-part cost gap

