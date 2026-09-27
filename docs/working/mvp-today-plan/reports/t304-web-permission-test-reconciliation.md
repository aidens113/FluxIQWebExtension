# t304 — Web permission-test reconciliation

Status: **Complete**

## Outcome

Reconciled the one stale Runtime Debug permission test file with the risk-only, exact-missing continuation contract. Production Core and web code were unchanged.

Changed only:

`apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx`

The shared fixture still declares all three relevant consequences, so the test continues to prove full audit context. Its assertions now distinguish:

```text
declared:        [send_or_publish, modify_existing, create_new]
missing:         [send_or_publish]
already granted: [modify_existing]
policy-allowed:  [create_new]
```

## Assertions reconciled

- Added direct fixture assertions for the complete ordered `request.consequences`, exact singleton `request.missing`, and prior `authority.granted`.
- The approval UI must render send/publish, must not render create-new as requiring approval, and must contain exactly one approval-list item.
- The allow callback must return `missing:[send_or_publish]`.
- Ordinary rerun preflight and grant issuance must carry exactly `permittedConsequences:[send_or_publish]`.
- The replacement grant is explicitly asserted not to contain either prior `modify_existing` authority or ungated `create_new`.
- High-token confirmation must preserve the same exact singleton permission set.
- The cut-short explicit-run continuation must issue the new grant with the same singleton permission set.
- The fixture comment now states why creation and ordinary modification are not in the missing set.

The declaration was intentionally not narrowed. That keeps regression coverage for the boundary between what an action declared and what a person must separately approve.

## Validation

From `F:\!FluxIQ` with `NODE_OPTIONS=--max-old-space-size=8192`:

```powershell
pnpm --filter @fluxiq/web exec vitest run `
  src/features/automation-studio/runtime/tests/run-permission-request.test.tsx
```

Result: **1/1 file, 11/11 tests passed**. Vitest duration was 13.01 seconds; the tests themselves took 4.78 seconds. Existing `react-test-renderer` deprecation warnings were emitted and did not affect the result.

Nearest Core permission contract matrix:

```powershell
pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/action-permissions/tests/gate.test.ts `
  src/programs/automation-studio/runtime/action-permissions/tests/destructive.test.ts
```

Result: **2/2 files, 30/30 tests passed** in 536 ms.

Scoped `git diff --check` passed with no output.

The full Core root suite was not run by t304. It remains the decisive validation because it exposed the four stale web expectations after the earlier Core test fixes.

## Scope

No production source, other test, shared document, generated output, run artifact, browser, provider, Lab, commit, or push action was changed or performed. This test file and this report are t304's only writes.
