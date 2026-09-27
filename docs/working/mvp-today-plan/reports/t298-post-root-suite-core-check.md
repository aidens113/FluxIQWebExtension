# t298 — Post-root-suite Core check

Status: **Complete — GO**

## Preconditions

The supervisor completed the final settled-tree Core root test after t290, t293, and t304 had settled. Result: **PASS, exit 0**.

Exact package results supplied by the supervisor:

- contracts: **53/53 passed**;
- client gateway: **3/3 passed**;
- FluxIQ: **413 files, 3,994 passed and 1 skipped**;
- web: **246 files, 1,346/1,346 passed**.

No t298 gate was started before that explicit pass notification.

## Core root check

Command run from `F:\!FluxIQ`:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=8192'
pnpm check
```

Result: **PASS, exit 0** in 22.20 seconds.

The command completed:

- structure rule tests;
- task/worktree tests;
- structure audit;
- recursive checks for contracts, client gateway, FluxIQ, and web.

The structure audit passed with 185 advisory warnings and 358 baselined findings. It noted that one baseline entry can be lowered; this was an improvement notice, not a failure, and t298 did not mutate the baseline.

All four participating workspace package checks completed successfully, including the web TypeScript check after the t304 test edit.

## Scoped diff check

Command:

```powershell
git diff --check -- `
  packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/patches.test.ts `
  packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts `
  apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx
```

Result: **PASS, exit 0**. Git emitted LF-to-CRLF working-copy warnings for the two FluxIQ package test files and no whitespace error. The web test file emitted no warning.

The scope includes all three final test-only reconciliations:

- t290 risk-only recovery permission expectations;
- t293 deterministic post-entry timeout fixture;
- t304 exact-missing web approval/grant expectations.

## Final validation verdict

The settled test-edit tree now has:

- complete Core root tests: PASS;
- Core root check: PASS;
- scoped final test diff check: PASS.

t298 finds no remaining Core test/check blocker from these edits. This verdict does not execute or authorize a downstream dry run or live/provider run; those remain supervisor-owned gates.

## Scope

Validation only. No authored Core/downstream source or shared document, run artifact, browser, provider, Lab, commit, or push action was changed or performed. This downstream report is t298's only authored write.
