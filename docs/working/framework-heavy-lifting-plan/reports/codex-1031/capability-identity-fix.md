# Capability identity fix — 2026-10-31

Outcome: Done
Owned Core checkout: `C:/Users/osrs_/FluxStuff/fxwork/t822/!FluxIQ`.

Cause: Core inferred executable operations from unrestricted description/help and incidental node shape. The click help's instruction to choose a parameter consequently supplied selection after the actual selection nodes were removed.
Change: essential-operation matching now reads only node id, label, tags, fixed output id and allowed output ids. Instruction parsing and foundation reporting use the same algorithm; the offered catalog and all model-facing help are untouched.
Compatibility: a description, category, trait key, parameter id or data-port id alone no longer supplies an operation. Existing explicit operation identity routes remain supported without a schema change.

Fail-first validation: fresh ignored cwd, provider/FLUXIQ environment stripped, private Core `vitest run src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/required-terms.test.ts --maxWorkers=2 --minWorkers=1 --cache=false` against unchanged product -> exit 1; **9 failed / 7 passed (16)**. Every failure was the intended false capability match or catalog consequence, not collection/setup failure.
Evidence: ignored `test-runs/2026-10-31-capability-identity-fix/red/vitest.log` in MAIN downstream.

Passing validation: same isolated source runner, named `plan/tests/required-terms.test.ts`, `plan/tests/catalog.test.ts` and `plan/tests/catalog-names.test.ts`, `--maxWorkers=2 --minWorkers=1 --cache=false` -> exit 0; **3 files / 33 tests passed** in 5.98 seconds. Existing real web-catalog fixtures and full description/parameter text assertions passed unchanged.
Evidence: ignored `test-runs/2026-10-31-capability-identity-fix/green/vitest.log` in MAIN downstream.
Not verified: package type/build/structure checks and rebuilt downstream negative guard (lead coordinates); full suites remain prohibited today.
Changed: Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/required-terms.ts` and `tests/required-terms.test.ts`; this report.
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1031/capability-identity-fix.md
Notes: No downstream wording/negative-assertion changes, public schema changes, git operations, agents, or paid calls.
