# t282 Final Core Test-Gap Audit

Date: 2026-09-26
Repository reviewed: `F:\!FluxIQ` (read-only)
Outcome: **The minimum remaining settled-tree Core test gate is root `pnpm test`. It subsumes the entire t270 15-file matrix, including all seven files not present in t258's focused run.**

## Exact set comparison

T258's settled-tree focused invocation passed 135/135 across these 10 package-relative files:

1. `src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts` (14)
2. `src/programs/automation-studio/runtime/tests/service-bootstrap/tests/extend.test.ts` (6)
3. `src/programs/automation-studio/runtime/service/runtime-adaptation/tests/reauthor-continuation.test.ts` (3)
4. `src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts` (5)
5. `src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts` (43)
6. `src/programs/automation-studio/runtime/tests/service-adaptation/tests/unattended-repair-authority.test.ts` (11)
7. `src/programs/automation-studio/runtime/tests/service-adaptation/tests/unattended-retry-verification.test.ts` (8)
8. `src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-continuation.test.ts` (9)
9. `src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-hold.test.ts` (8)
10. `src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grants.test.ts` (28)

Eight of those are in t270's 15-file matrix. The two t258-only additions are the unattended repair-
authority and unattended retry-verification files.

The seven t270 files not executed by t258's final focused invocation are:

1. `src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`
2. `src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts`
3. `src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/provider-refusal.test.ts`
4. `src/programs/automation-studio/runtime/llm/harness/tests/run.test.ts`
5. `src/programs/automation-studio/runtime/llm/provider-retry/tests/call.test.ts`
6. `src/programs/automation-studio/runtime/recovery/refuted-result/tests/reauthor.test.ts`
7. `src/programs/automation-studio/runtime/tests/service-bootstrap/tests/generation.test.ts`

All seven files exist in the settled tree.

## Script expansion and subsumption

Core root `package.json` defines:

```text
pnpm test -> pnpm -r test
```

The `fluxiq` workspace package defines:

```text
pnpm --filter fluxiq test -> vitest run --passWithNoTests
```

Its `vitest.config.ts` changes only hook and test timeouts; it does not narrow `include` or add an
`exclude`. Therefore the FluxIQ package portion of root `pnpm test` discovers every settled-tree
`.test.ts` file in the package, including all 15 t270 paths, all 10 t258 paths, and specifically all
seven files missing from the final focused invocation. Root `pnpm test` also executes the other
workspace test scripts.

Consequently:

- Running only the seven-file delta and then root `pnpm test` is redundant; root test reruns the
  complete delta.
- Running the complete t270 15-file matrix and then root `pnpm test` is also behaviorally redundant;
  root test reruns all 15.
- T258's two extra focused files are not a gap in t270, and root test reruns them as well.

## Minimum remaining command

From `F:\!FluxIQ`, on the unchanged settled tree:

```powershell
$env:NODE_OPTIONS = '--max-old-space-size=8192'
pnpm test
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: Core root tests failed' }
```

Record the root exit status and confirm the FluxIQ Vitest output includes the seven missing paths.
This single command closes both the outstanding final-tree root-test requirement and the actual
focused coverage gap. The already-passing package/root checks and root build need not be repeated
unless the test exposes a defect that causes a source change.

There is one protocol distinction: t270 literally lists a dedicated 15-file invocation and root
test as two gates. If immutable compliance with that exact historical checklist is required, run
both despite the duplicate coverage. For the smallest evidence-complete settled-tree gate requested
by this audit, root `pnpm test` alone is sufficient and stronger.

## Scope

This audit read t258, t270, and t280; inspected only the exact root/package test scripts, FluxIQ
Vitest configuration, and named file existence; and wrote this report. It ran no tests or builds and
changed no Core source, shared document, generated output, run artifact, or live state.
