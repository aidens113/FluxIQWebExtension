# H2 node timing report

## Outcome
Partial. Behaviour and tests done and passing; `pnpm structure:check` fails on an import rule I cannot fix inside my owned files (see Open questions).

## What changed (Core, packages/fluxiq/src/engine/automation/)
- `pacing/human-pause.ts` (new): `automationStudioHumanPauseMs(level, seed, nodeId, ordinal)`; exported from `pacing/index.ts` (1 line).
  Formula: b = normalizeHumanness(level)/100; draws from `humannessRandom(humannessSeedOf(`${seed}:${nodeId}:${ordinal}`))`;
  ms = round(1000*b*(0.8*E + (u2 < 0.2*b ? 2*(0.5+u3) : 0))), E = -ln(1-u1) (exponential, mean 1).
  Mean = 1000*b*(0.8+0.4*b): ~8 ms at 1, ~1.2 s at 100; reading-pause chance 0.2%..20% (mean 2 s at 100). 0 at level 0.
- `step-loop/arrival.ts`: 1 new line before the pace line (guard `ctx.arrival.attempts === 1 && normalizeHumanness(options.humanness) > 0`, then `automationStudioRunWait(options, pause)`), plus the import lines (2 changed). Level 0: no await added.
- `graph-run.ts`: 4 lines (over the 2-line allowance: the import, the `executionOptions` line fills `humannessSeed` = `humannessSeedOf("run:"+startedAt)` when level > 0 and none given (resume keeps startedAt so same seed), a new `const humanness` line, and the `defended` line adds `humanness: { level, seed }` only when level > 0).
- `contracts/graph-execution-options.ts`: `humannessSeed?: number` added, `humanness` doc updated.
- `contracts.ts`: trace field `humanness?: { level: number; seed: number }` (the trace type lives here).
- Child frames: `composite/boundary.ts` line 72 spreads `...childBase` of the parent options, so `humanness` and `humannessSeed` are inherited; not edited.
- Tests: `pacing/tests/human-pause.test.ts` (6), `pacing/tests/human-pause-run.test.ts` (3: level 0 same delays as absent and no `humanness` key; level 50 pauses once per node first arrival with a retried s2, trace `{level:50, seed}`; same seed replays same delays and caller seed honoured).

## Commands
- `pnpm --filter fluxiq exec vitest run src/engine/automation/pacing src/engine/automation/step-loop src/engine/automation/tests/graph-run.test.ts` -> 11 files, 86 tests passed (158 s).
- `pnpm structure:check` -> FAIL, 4 violations: three `[imports]` (graph-run.ts:1, pacing/human-pause.ts:1, step-loop/arrival.ts:4: "imports @fluxiq/contracts/automation. Graph execution uses neutral runtime and record contracts, without a Studio dependency", rule in scripts/structure-audit/config.mjs:35) and one `[statement-packing]` in `framework/automation-service/tests/io-policy.test.ts:460` (another worker's file, not mine).

## Not verified
Package typecheck and library build (not run, per brief). No live browser.

## Open questions
The engine/automation import rule forbids `@fluxiq/contracts/automation`. Fix needed from the supervisor: either re-export `normalizeHumanness`, `humannessRandom`, `humannessSeedOf` from the neutral `@fluxiq/contracts/runtime` (then change my 3 imports, a trivial edit I can do on request), or allow the humanness path in scripts/structure-audit/config.mjs (mirrored from Core's rules; I did not touch it).
