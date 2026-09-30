# t189-wD validation report

## Outcome
Partial: 6 of 8 commands passed. `pnpm docs:check` (Core) and extension `pnpm check` failed.

## What changed and why
Nothing was edited apart from this report.

## Commands run and observed results
1. Core `heavy.sh "t189-wD core check" pnpm check`: exit 0. `structure-audit: passed (198 warning(s), 355 baselined).` Also printed `1 baseline entries can be lowered`. tsc passed for contracts, fluxiq, client-gateway-websocket and apps/web.
2. Core `node scripts/structure-audit.mjs`: exit 0. `structure-audit: passed (198 warning(s), 355 baselined).`
3. Core `pnpm docs:check`: exit 1. Error text:
   `Error: docs/reference/framework-reference.md is stale. Run `pnpm docs:reference` and commit the result.` (thrown at scripts/docs-reference.mjs:75:11)
4. vitest runtime/llm: exit 0. Test Files 74 passed (74); Tests 730 passed (730).
5. vitest runtime/flow-bootstrap: exit 0. Test Files 34 passed (34); Tests 691 passed (691).
6. vitest runtime/recovery: exit 0. Test Files 34 passed (34); Tests 456 passed (456).
7. vitest runtime/tests: exit 0. Test Files 76 passed (76); Tests 513 passed (513).
8. Extension `heavy.sh "t189-wD ext check" pnpm check`: exit 1. `structure-audit: 2 violation(s) across 1 rule(s).`
   - `FAIL [working-docs] docs/working/language-driven-flow-loop-plan.md: 1 Work Ledger entry does not record a validation result: "2026-09-30 — Checkpoint before a machine restart (pagefile fix); where every lane stands" (no "- Validation:" bullet).`
   - `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks. Run "pnpm structure:baseline" to regenerate it.`
   The audit stopped the check, so the steps after it (tsc and so on) did not run.

## Not verified
Extension type checks and later check steps, because the audit failure stopped the run. No Lab or browser runs, per the brief.

## Open questions or contradictions found
Both failures are in documentation or generated files, not code: Core's framework-reference.md needs regenerating, and the extension's ledger entry and README index need fixing, which the supervisor owns.
