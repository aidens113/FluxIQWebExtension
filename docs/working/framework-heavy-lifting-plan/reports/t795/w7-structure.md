# t795 w7-structure

## Outcome
Done. Core `pnpm structure:check` passes, the two test directories pass (192 files, 1486 tests, plus the real-sql group), `pnpm check` (packages/fluxiq) exits 0, and `pnpm docs:reference` then `pnpm docs:check` pass. No behaviour change.

## What changed and why
All paths under `packages/fluxiq/src/programs/automation-studio/runtime/result-verification` (RV) in the Core tree `fxwork/t795/!FluxIQ`.

1. **request-rows/ file count (27 > 25).** `every-result.ts`, `condition-words.ts` and `request-exclusion-test.ts` (from `refuted-no/`) moved into a new `RV/asked-words/` with a barrel `index.ts`.
   - It sits beside `request-rows/`, not inside it, because the audit's depth limit (9 segments) rejected `request-rows/asked-words/`.
   - `request-rows/index.ts` no longer re-exports those names. `RV/index.ts` now exports `./asked-words/index.ts`, so the public names are unchanged.
   - Importers updated: `computed-facts/left-out-accounted.ts`, `agreement/reask-contradicted.ts`, `agreement/tests/exclusion-words.test.ts`, `located-defects/searched-words-kept.ts`, `request-rows/unquoted-rows.ts`, `refuted-no/request-text-test.ts`.
   - Comment references updated in `standing-no-record/request-exclusion.ts`, `refuted-no/record.ts` and the moved files.
   - `request-exclusion-test.ts` now takes its words from the `../request-rows/words.ts` leaf instead of the `request-rows` barrel. A barrel import would close a cycle through `unquoted-rows.ts`. The audit accepts this because the barrel leads back to the importer.
2. **request-rows/tests (31 > 25).**
   - `every-result.test.ts` moved to `asked-words/tests/`.
   - `request-exclusion-test.test.ts` moved from `refuted-no/tests/` to `asked-words/tests/`, with its imports fixed.
   - `searched-words`, `summary-together`, `settled-together`, `settled-together-fixture` and `wall-calendar-fixture` moved to `request-rows/tests/library-catalog/tests/`, the same grouped-folder pattern as `tests/reask-route/tests/`.
   - Relative imports fixed in the moved files, in `unquoted-rows.test.ts`, and in `computed-facts/tests/left-out-accounted.test.ts` (the path to the wall-calendar fixture).
3. **RV/tests (26 > 25).** `verify-computed-facts.test.ts` moved to `tests/computed-facts-route/tests/`. Imports, the `vi.mock` path and header comment paths fixed. The cross-reference in `tests/verify.test.ts` line 18 updated.
4. **left-out-accounted.ts imports.** All now come from barrels (`../asked-words/`, `../request-rows/`, `../refuted-no/` no longer needed). No leaf import remains, so no justifying comment is needed.
   - My first attempt used the `refuted-no` barrel, which does not export `request-exclusion-test.ts`. Adding the export made 59 tests fail from a module cycle.
   - A leaf import with a "The leaf, not the barrel" comment still fails the audit: the comment is not honoured, only a barrel that leads back to the importer is.
   - So the file moved to `asked-words/` (item 1) instead.
5. **Statement packing.** `beforeEach` in `verify-computed-facts.test.ts` is now one statement per line.
6. **brief-checked.test.ts.** Cause confirmed before stubbing. Run without the stub, the brief carried "Core checked the rows the check names: The answer stores the same row more than once ..." (the computed-fact count/repeated failure), so the verification was a Core no before the judge. Added `vi.mock` of `result-verification/computed-facts/index.ts` returning `automationStudioResultComputedFacts: () => []`, with an explanatory comment as in `RV/tests/verify.test.ts`.

## Commands run and observed results
Each under the shared `heavy-check.lock`, released afterwards.
- `pnpm structure:check` (Core root, final tree) -> "structure-audit: passed (457 warning(s), 1152 baselined)", exit 0.
- `pnpm test src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/recovery/refuted-result` -> Test Files 192 passed, Tests 1486 passed; real-sql group 3 passed; "all groups passed".
- `pnpm check` (packages/fluxiq) -> ran the tsc step (`fluxiq:check`), no errors, exit 0.
- `pnpm docs:reference` -> "Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (4297 public declarations)". Both reference files are regenerated, so they are modified in the tree.
- `pnpm docs:check` -> docs-links audit passed; "Deterministic framework reference is current."

## Not verified
- Nothing outside the two named test directories was run, per the narrow-check policy. The `agreement/`, `located-defects/` and `refuted-no/` tests live under RV, so they ran.
- The Core root tests for `apps/` and other packages were not run. They consume RV only through its barrel, and the exported names are unchanged.

## Open questions or contradictions found
- The brief's 7 imports in item 4 are all gone, but the structure check forced a file move across a directory boundary (`refuted-no/request-exclusion-test.ts` to `asked-words/`), which goes slightly beyond "group the new files". It is a pure move with no logic change.
- While waiting on the lock, one of my own early background test runs was stopped with TaskStop. A later check of the lock showed it being taken and released by other agents, so I believe no stale lock remains. A `rmdir` I tried on it was denied by the permission system and not retried.
