# `ac-active-recording-test-split` — completion report

## Result

Split the oversized active-recording facade test by behavior without changing
product code. The original file retains the pre-existing start, refusal,
acknowledgement, and core facade behavior. The new lifecycle file owns the
coherent Stop, navigation, and start-crossing suite added across reports `p`
through `w`. Shared deterministic setup lives in one test-only harness beside
both suites.

## Files changed

- `apps/extension/src/background/connection/tests/active-recording.test.ts`
- `apps/extension/src/background/connection/tests/active-recording-stop-lifecycle.test.ts`
- `apps/extension/src/background/connection/tests/active-recording-test-harness.ts`

No product or generated build file changed.

## Preservation and size checks

- Before: one 1,067-line file with 33 tests and 209 `assert.*` calls.
- After: 354-line pre-existing-behavior suite (14 tests), 533-line lifecycle
  suite (19 tests), and 198-line shared harness.
- Total after: 33 tests and 209 `assert.*` calls.
- Reconstructing the original behavioral order (six leading core tests, the
  19 lifecycle tests, then eight remaining core tests) produced the same
  SHA-256 digest of test declarations before and after the split:
  `738dfda9f8873514ff446707525b9084384cc81a61ed7d1417e4f7d5a90c0091`.
- All three files are below the hard 800-line structure budget and remain in
  the owning subject's `tests/` directory.

## Validation

- `pnpm --filter @fluxiq-web-extension/extension check` — passed.
- `pnpm --filter @fluxiq-web-extension/extension test` — passed: smoke test
  and 513/513 unit tests.
- `pnpm structure:check` — the changed files passed their placement and hard
  line-budget rules. The repository command exited 1 only because the shared
  `docs/working/README.md` index is currently stale; per the brief I did not
  run `structure:baseline`. Existing advisory warnings were unchanged in kind.
- Diff checks — `git diff --check` passed for the tracked test file; both new
  files were separately scanned with zero trailing-whitespace findings.
- Preservation scan — passed: test count, assertion-call count, and ordered
  test-declaration digest match the pre-split source.

I did not edit shared working documents, run a structure baseline, commit, or
push.
