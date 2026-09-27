# t396 — Structure move re-review

## Verdict

**GO.** The current Core test move is semantically correct, matches t393's prescribed content-only
move, leaves no duplicate at the old path, and restores the affected directory to the enforced
25-file ceiling.

## Review evidence

- The only matching test path in Core is
  `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/progress.test.ts`.
  The old `runtime/llm/tests/evidence-loop-progress.test.ts` path is absent.
- The moved test's asserted contract is evidence-loop progress: exact draft revisions and state,
  page-state digest transitions, and answerability-state transitions. Core declares that contract in
  `evidence-loop/progress.ts`, attaches it to trace rows in `evidence-loop/trace.ts`, and constructs it
  in the evidence-loop coordinator. Therefore `evidence-loop/tests/progress.test.ts` is the nearest
  semantic owner under the repository's test-placement rule.
- The import `../../index.ts` correctly resolves from `evidence-loop/tests/` to the public
  `runtime/llm/index.ts` barrel, which exports the coordinator through `./evidence-loop.ts`. The
  focused test and the `imports` audit both pass with this path.
- Replacing only `../../index.ts` with the former `../index.ts` in memory yields SHA-256
  `0D9F7307A0E77F2878FD7663A60380EF37D31B1EA296326FC2A3254C10AA25B4`, exactly the pre-move hash
  recorded by t393. This verifies that the import-depth correction is the only content change.
- Direct TypeScript file counts are 25 in `runtime/llm/tests/` and 4 in
  `runtime/llm/evidence-loop/tests/`. The former is at, not over, the 25-file enforced limit.

## Validation observed

From `F:\!FluxIQ`:

- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/evidence-loop/tests/progress.test.ts`
  — **PASS**, 1 file / 7 tests.
- `pnpm structure:check --rule directory-files` — **PASS**, with the affected
  `runtime/llm/tests/` directory reported at 25 files (28 advisory warnings and 2 unrelated
  baselined findings overall).
- `pnpm structure:check --rule test-placement` — **PASS**, 0 warnings / 0 baselined.
- `pnpm structure:check --rule imports` — **PASS**, 0 warnings / 152 existing baselined findings.

This verdict is limited to the requested move and focused structure validation. I did not edit Core,
stage, commit, push, invoke a provider, or run live validation. The only authored change is this
worker report.
