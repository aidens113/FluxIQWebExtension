# t245: the 2026-10-02 Core sweep's four failures

Tree: `fxwork/t245/!FluxIQ`, branch `task/t245-sweep-1002-core-failures`, at Core dev `2bc0baac`. Nothing committed.

## Outcome

Done. Each of the four tests now passes, and each change is a test change with the reason written in the test. No product source was edited. I had no sweep log, so the load failures were reproduced here.

| # | Test | Cause | Fix |
| --- | --- | --- | --- |
| 1-2 | `runtime-adaptation/tests/repair-rerun.test.ts`, "follows the press's failed route..." and "numbers the re-run's attempts..." | Deterministic; fails alone too. The expectation is stale: t174's F38 (`71cb8bfb`, merged `ab1a3bcd`) skips an absent sometimes-present step. The optional press, a `failed` edge into a Merge whose target is `target_not_found`, is now tried once and recorded `status: succeeded, route: skipped, skipped: {reason: target_absent, code: web.target.not_found}`. Then it routes on through the `failed` edge with no ladder. The old expectation had three check attempts and a ladder `deterministic_path` decision. | The expectations follow the reference rule. The re-run's node ids are `search, check, join, read`, and its attempt ids are `search.attempt.5, check.attempt.6, join.attempt.7, read.attempt.8`. The check attempt is asserted skipped with no `recoveryDecision`. The stored detail's `check.attempt.6` is asserted `succeeded`/`skipped`/`target_absent`, where it used to be asserted `failed`. The header comment explains the change. |
| 3 | `tests/service-adaptation/tests/modes.test.ts`, "resolves stable and continuous adaptive modes plus budget exhaustion" | A timeout under parallel load, not a behaviour change. It takes 2.8 s alone but 13.1 s and 18.1 s across two parallel runs, against the suite's 15 s default. In the 18.1 s run the file's first two cases also timed out, at 15.5 s and 15.1 s (8.6 s and 5.1 s alone). t240 and t239 do not touch this path: t240 changed `flow-bootstrap/unfinished-build/**`, the judge, and one build-phase argument in `service.ts`; t239 changed the judge's token limits. The test only calls `runRuntimeSession`. | A describe-level `{ timeout: 60_000 }`, with the measured durations in a comment. This follows the existing convention: the sibling service-adaptation tests use `60_000`. |
| 4 | `programs/tests/global-docs.test.ts`, "generates a TypeDoc-backed framework reference" | A timeout. The 60 s limit was set on 2026-09-21 from 12.4-13.7 s alone. The public API now has 23,653 reflections. Measured alone: 42.2 s, of which conversion took 23.8 s, HTML 15.9 s and JSON 2.6 s. With 106 test files in parallel it took 58.97 s, 1 s under the limit, and in a second parallel run 75.9 s, which fails the old limit. | Timeout raised to `180_000`, with the measurements in the comment. |

## What changed and why

- `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/tests/repair-rerun.test.ts`: expectations now follow F38's intended behaviour (skipped, never failed, routed on), with comments.
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-adaptation/tests/modes.test.ts`: a 60 s suite timeout with the measured durations.
- `packages/fluxiq/src/programs/tests/global-docs.test.ts`: a 180 s timeout with the measured durations.

Considered and rejected: building TypeDoc's program from `src/index.ts` alone instead of the tsconfig's `src/**`, which currently includes 665 test files. I tried it in a scratch probe that I have since deleted. Conversion fell from 27.3 s to 21.9 s and the reflection count stayed 23,653. The output is not identical, though: the JSON differs (16,668,005 vs 16,699,364 bytes) and so do 11 HTML files, for example `hierarchy.js` and several Error classes' pages. With everything in the program, TypeDoc includes subclasses that only test files declare. That would change the generated framework reference, and it saves about 5 s, so `_shared/docs-generators.ts` is untouched. It is a possible follow-up if the reference should not mention test-only subclasses.

## Commands run and observed results

All from `fxwork/t245/!FluxIQ/packages/fluxiq` unless noted.

- `npx vitest run .../repair-rerun.test.ts .../modes.test.ts` before any change: repair-rerun had 2 failures (received `['search','check','join','read']` and `[... 'join.attempt.7','read.attempt.8']`). modes passed 4/4, the target in 2,790 ms.
- `npx vitest run src/programs/tests/global-docs.test.ts -t "TypeDoc-backed"` before any change: passed in 42,230 ms. CPU was 63% average over 8 logical processors, with other lanes holding build slots.
- TypeDoc phase probe (scratch test, deleted): full program `{conv 23756, html 15900, json 2607}` ms on the first run. A second run: full `{conv 27269, html 16066, json 2305}`, entry-only `{conv 21907, html 14400, json 2560}`. Both had 23,653 reflections. `cmp` on the two JSON outputs: they differ. `diff -rq` on the HTML: 11 files differ.
- Load reproduction, before the timeout changes, via heavy.sh: `npx vitest run src/programs/automation-studio/runtime/tests src/programs/tests` (106 files). 13 files failed out of 106. TypeDoc passed in 58,967 ms and modes/budget exhaustion passed in 13,131 ms. 20 other service tests failed with `Test timed out in 15000ms` (15.0-16.2 s).
- Second load run, after the repair-rerun edits and the TypeDoc timeout, but before the modes suite timeout (that file then had only a per-test 60 s on the budget case): `npx vitest run .../service-adaptation/tests src/programs/tests .../runtime-adaptation/tests` (37 files). 166 passed and 23 failed, all `Test timed out in 15000ms`. Among them were modes' first two cases (15,549 and 15,142 ms). The targets passed: TypeDoc in 75,884 ms, budget exhaustion in 18,141 ms, repair-rerun 7/7 and global-docs 6/6.
- `npx vitest run src/programs/automation-studio/runtime/service/runtime-adaptation/tests`: 7 files, 65 tests passed.
- Final run of the 3 changed files, via heavy.sh: 3 files passed. repair-rerun 7/7. modes 4/4 (10,049, 12,919, 4,013 and 6,494 ms). global-docs 6/6, TypeDoc in 45,882 ms.
- `pnpm --filter fluxiq check`, run in Core: exit 0, twice (before and after the last edits).
- `node scripts/structure-audit.mjs`, run in Core: `structure-audit: passed (218 warning(s), 349 baselined).`

## Not verified

- I did not see the sweep's own failure messages, because I could not find its log. Causes 3 and 4 are inferred from reproduced timing: each passes alone and was measured over its limit under parallel load. Cause 1-2 reproduces exactly.
- The whole `service-adaptation/tests` directory does not pass under the load present today. Twenty-odd service tests in files I do not own timed out at 15.0-17.0 s. The sweep failed only 4 tests, so their time is load-dependent and close to the 15 s default. I did not touch them.
- No full suite was run.

## Open questions or contradictions found

- The service-adaptation and service-flows/recordings tests sit at about 15 s under shared-machine load (two runs here, 20 and 23 timeouts). The next sweep run alongside lane work may fail any of them. Either raise the Core vitest `testTimeout` for service tests, or find out why one `AutomationStudioService` case costs 5-9 s alone (the first case in a file pays the most).
- Should the TypeDoc program exclude test files? It would make the run faster and the reference cleaner (no test-only subclasses in `extendedBy`), but it changes the regenerated `framework-reference.md`.
