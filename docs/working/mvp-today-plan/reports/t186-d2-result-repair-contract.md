# t186-D2: resultRepair phase/outcome in test-contracts

## Outcome

Done.

## What changed and why

Core source read (read only): `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/repair.ts`.
Core writes on the run's `metadata.resultRepair` marker:
- `phase`: `reauthoring` | `rerunning` | `settled` (inline literals, no exported type).
- `outcome`: `AutomationStudioResultRepairOutcome` = `answered` | `unverified` | `stopped` | `not_rerun` | `rerun_failed`, written only together with `phase: "settled"` (lines 142, 174-175, 191, 203).

Changes:
- `packages/test-contracts/src/harness-recovery.ts`: `RunHarnessResultRepair` gains optional `phase` and `outcome`; new exported vocabularies `harnessResultRepairPhases` / `HarnessResultRepairPhase` and `harnessResultRepairOutcomes` / `HarnessResultRepairOutcome`.
- `packages/test-contracts/src/harness-recovery-validation.ts`: `resultRepairKeys` admits both; `checkResultRepair` checks `phase` and `outcome` by `enumeration` against the closed lists. Cross-field rules: `outcome` present only when `phase === "settled"`; `phase: "settled"` requires an `outcome`; `phase` refused on an `attempted: false` marker. Both absent stays valid (records written before Core reported them).
- New test `packages/test-contracts/tests/harness-recovery-result-repair-phase.test.mjs` (tests live in `tests/`, outside `src/**`; added because the brief requires a new test).

No test-runner file changed: it compiles unchanged.

## Commands run and observed results

- `pnpm run check` in packages/test-contracts -> tsc --noEmit, exit 0, no output.
- `npx tsc -p tsconfig.json` (build dist) then `node --test tests/harness-recovery-result-repair-phase.test.mjs tests/harness-recovery-result-route.test.mjs` -> tests 11, pass 11, fail 0.
- `node --test tests/*.test.mjs` (whole test-contracts suite) -> tests 151, pass 151, fail 0.
- `pnpm run check` in packages/test-runner -> domain:dist present, tsc --noEmit exit 0.

## Not verified

- test-runner tests not run (its parser was not changed).
- `pnpm check` / structure audit not run repository-wide.

## Open questions or contradictions found

- The test-runner parser `packages/test-runner/src/flow-lane/harness-recovery.ts` `resultRepair()` (around line 201) still projects Core's marker to `{ attempted, nodeId, code }` only, so `phase`/`outcome` never reach a bundle yet. Threading them was outside this brief (only if needed to compile). Suggested follow-up: add `...(isPhase(record.phase) ? { phase } : {})` and outcome only when phase is `settled` and the word is in `harnessResultRepairOutcomes`, dropping an unknown word rather than failing the read (the parser's existing style), plus a case in `flow-lane/tests/harness-recovery.test.ts`.
- Unknown phase/outcome words are refused by the contract (brief asked for strict); this differs from `resultReauthor.refusal`, which is checked by shape so new Core words travel. If Core adds a sixth outcome, the parser must drop it or the contract must be updated first.
