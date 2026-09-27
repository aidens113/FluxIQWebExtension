# t290 — Permission-test reconciliation

Status: **Complete**

## Outcome

Reconciled the stale recovery permission expectation without changing production behavior. The
mixed `create_new` + `send_or_publish` case now proves an uninstructed, ungranted send is held as an
answerable permission request, while the adjacent `create_new`-only case proves ordinary creation
still runs despite the legacy broad side-effect policy flag being false.

Only this Core test file changed:

`packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/patches.test.ts`

## Assertions added

The mixed case now proves:

- exact request id `permission-request:repair`;
- exact Flow-step action and shown control identity;
- complete declared consequences `[send_or_publish, create_new]`;
- missing gated subset `[send_or_publish]`;
- recovery stage with no instruction ids;
- empty granted and instructed authority;
- `permissionOutcome: required`, no execution, failed preflight, and
  `permission_required` verification;
- no adaptation or change proposal.

The adjacent create-only case proves:

- no request is raised;
- `permissionOutcome: permitted` with `[create_new]`;
- clean preflight and no issues;
- a real trial trace rather than `not-run`;
- one promoted adaptation.

The surrounding comment now states the final boundary: ordinary creation/editing is ungated;
sending/publishing requires instruction or grant authority. Production permission, patch, and
runtime code were not changed.

## Validation

Final narrow matrix from `F:\!FluxIQ`:

```powershell
pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/recovery/annotation/tests/patches.test.ts `
  src/programs/automation-studio/runtime/recovery/annotation/tests/recovery-permissions.test.ts `
  src/programs/automation-studio/runtime/action-permissions/tests/destructive.test.ts `
  src/programs/automation-studio/runtime/action-permissions/tests/declared.test.ts `
  src/programs/automation-studio/runtime/action-permissions/tests/gate.test.ts
```

Result: **5/5 files and 81/81 tests passed** in 4.31 seconds.

An interim attempt asserted `executed: true` on the successful receipt and correctly failed: this
receipt contract records a successful execution through its real trace and resulting adaptation,
while the `executed` metadata flag is used on refusal/proposal paths. The final assertion therefore
uses the established success evidence (`traceStatus !== "not-run"` and one adaptation) and the full
matrix passes.

Scoped `git diff --check` passed; only the existing LF-to-CRLF working-copy warning was emitted.
The complete Core root suite was not rerun by t290, so the separate deadline-retry failure remains
outside this result.

No production source, other test, shared document, generated output, run artifact,
provider/browser/Lab state, commit, or push was changed. This test file and this downstream report
are t290's only writes.
