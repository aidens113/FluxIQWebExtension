# H1 Core: humanness plumbing (t898)

## Outcome
Done, except the fluxiq package typecheck (not run: 1274 MB free, below the 2.5 GB floor).

## What changed and why
Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t898/!FluxIQ`. Pure plumbing; nothing reads the value.
- New `packages/contracts/src/humanness/`: `bounds.ts` (`HUMANNESS_MIN` 0, `HUMANNESS_MAX` 100, `HUMANNESS_DEFAULT` 0, doc comment per brief), `humanness.ts` (`type Humanness = number`), `schema.ts` (`humannessSchema`, zod int 0..100), `normalize.ts` (`normalizeHumanness(value: unknown): Humanness`), `index.ts` barrel; tests in `humanness/tests/{bounds,schema,normalize}.test.ts`.
- `packages/contracts/src/automation.ts`: one export line for `./humanness/index.ts` (so `@fluxiq/contracts/automation` and the root export it; build succeeded).
- `fluxnode/spec/options.ts`: `fluxNodeOptionsSchema.humanness`, `FluxNodeResolvedOptions.humanness?`, set by `resolveFluxNodeOptions` only when override/declaration sets it (override wins). Per-run overrides reuse `fluxNodeOptionsSchema` (it is the schema the resolver's `overrides: FluxNodeOptions` is typed by); I did not trace the run-request parser beyond that. New case in `fluxnode/spec/tests/options.test.ts`.
- `answer-first/caller/options.ts`: `humanness` in FIELDS, integer 0-100 check with the exact message; test case added in `caller/tests/options.test.ts`.
- `flow-bootstrap-commands/contracts.ts`: `AutomationStudioAnswerFirstCallerOptions.humanness?: number` with doc line.
- `engine/automation/contracts/graph-execution-options.ts`: `AutomationStudioGraphExecutionOptions.humanness?: number`, documented.
Note: `AutomationStudioAnswerFirstKeptCallerOptions` (a Pick) was left alone, as not in the brief.

## Commands run and observed results
- `pnpm --filter @fluxiq/contracts exec vitest run src/humanness src/fluxnode/spec` -> 8 files, 32 tests passed.
- `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/answer-first/caller` -> 5 files, 23 tests passed (252 s).
- `pnpm --filter @fluxiq/contracts check` -> succeeded (tsc, 47 s).
- `pnpm --filter @fluxiq/contracts build` -> succeeded (1101 files stored).
- `pnpm structure:check` -> "structure-audit: passed (529 warning(s), 969 baselined)".

## Not verified
- fluxiq package typecheck: not run: 1274 MB free (needs 2.5 GB). The fluxiq edits are optional fields only and its vitest files passed.

## Open questions
None.
