# t176 — Auto-repair assertions

## Outcome

Done. The three stable failures were stale assertions left by the removal of
forced manual approval. No production change was required.

- Granted runs now assert that the configured `auto` adaptation mode is
  preserved instead of expecting the grant to force `manual`.
- The target-override proposal now asserts `mode: "auto"` and
  `status: "auto_approved"`.
- The target-override adaptation remains proposal-only and unexecuted, with
  `autoApply: false` and `requiresManualApproval: true` for its declared high
  risk/external-side-effect record.

The retained consequence boundary was not weakened. The existing unattended
repair case proving that a lasting consequence still needs the person's
permission passed unchanged, as did every other row in the three owned files.

## Files changed

- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/tests/service-adaptation/tests/unattended-repair-authority.test.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/tests/service-adaptation/tests/unattended-retry-verification.test.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/tests/service-adaptation/tests/runtime-patches.test.ts`
- This report.

## Validation

From `F:/!FluxIQ/packages/fluxiq`:

```text
pnpm exec vitest run \
  src/programs/automation-studio/runtime/tests/service-adaptation/tests/unattended-repair-authority.test.ts \
  src/programs/automation-studio/runtime/tests/service-adaptation/tests/unattended-retry-verification.test.ts \
  src/programs/automation-studio/runtime/tests/service-adaptation/tests/runtime-patches.test.ts \
  --testTimeout=180000
```

Result: **3 files passed, 22 tests passed, 0 failed**.

`git diff --check` on the three owned tests passed. Git emitted only the
repository's LF-to-CRLF working-copy warnings.

An earlier invocation from the repository root unexpectedly discovered copied
tests under `.tmp/core-web-build`; it was interrupted and is not counted as a
validation result. Re-running from the package root constrained discovery to
the three source files above.

## Not verified

- No broader Core check, test, or build was run; the brief requested one
  focused combined test and the shared integration tree is active.
- No browser, Lab, provider, or live scenario run was performed.
- No commit or push was made.

## Open questions

None for this brief.
