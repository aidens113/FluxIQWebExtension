# L stored list

Outcome: Done.

Changed (Core, packages/fluxiq/src/programs/automation-studio/runtime/result-verification):
- stored-list/stored-list-items.ts (new, exports automationStudioStoredListItems), stored-list/index.ts, stored-list/tests/stored-list-items.test.ts.
- located-defects/condition-equals.ts: private reader removed, shared one used (same behaviour).
- request-rows/kept-without-asked-column.ts: columns read with the shared reader; full {count, items} narrows, lossy falls back.
- request-rows/tests/kept-without-asked-column.test.ts: two new cases.

Why a new directory: importing from value-readings/index.ts created a 208-module import cycle; a deep import broke the barrel rule; result-verification/ already has 46 files.

Commands: result-verification tests: 159 files / 1275 tests pass, real-sql 3 pass. pnpm check exit 0. pnpm structure:check passed. docs:reference then docs:check: current (reference regenerated, 4225 declarations; unrelated tree edits also touch it).

Not verified: whole-package suites (not run, per repo rule).
