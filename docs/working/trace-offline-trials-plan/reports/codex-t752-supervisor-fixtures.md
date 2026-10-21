# Supervisor fixture migration, t752

## Current state (2026-10-21)

Owned Core files: `result-verification/tests/run-outcome-harness.ts`, `run-outcome.test.ts`, `run-outcome-repair.test.ts`.
Worker recover_t752 excludes these files until this partition is declared stable.

## Changes

- Thread an explicit structured negative-defect list through the shared test provider, without auto-inventing defects for other fixtures.
- Add a member fixture with a written admin-only request and an actually stored member-role row; retry/refutation/repair tests use its measurable exclusion.
- Empty results with no observed missing row, and action-only complaints without a measured unmet requirement, remain judged but unverified. These intentional expectation changes implement the new uncertainty contract.
- Keep empty-result repair routing covered with Core's independent all-rows-invalid refutation.
- Isolate the test of forwarding a previously established refutation's prose into repair by injecting that internal report, rather than pretending an unsupported current provider reply proves the result wrong.

## Validation

Initial grouped owning command over `run-outcome.test.ts` and `run-outcome-repair.test.ts`: 47 passed, 2 failed; all six repair tests passed. The two failures were an injected report missing its `performed` flag and a fixture quoting a different instruction. Both were corrected without changing those assertions.

Final `pnpm.cmd test src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts`
from Core `packages/fluxiq`: `Test Files 1 passed (1)`, `Tests 43 passed (43)`; real-SQL selected no files, exited 0; `all groups passed: parallel, real-sql`, native exit 0. Repair file and shared helper were unchanged after their six passing tests.

All three files are stable for worker integration. Final package typecheck and combined owning-folder gate remain required.
All validation output stays in tool sessions, outside package inputs.
