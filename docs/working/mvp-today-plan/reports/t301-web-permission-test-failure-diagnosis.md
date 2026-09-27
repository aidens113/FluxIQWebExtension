# t301 — Web permission-test failure diagnosis

Status: **Complete — four stale test expectations**

## Verdict

All four final root web-suite failures are stale expectations caused by the accepted risk-only permission boundary. Production Core and web behavior are correct.

The shared fixture declares `send_or_publish`, `create_new`, and `modify_existing`. Under the current contract:

- `send_or_publish` is gated and is the only missing class;
- `create_new` is ungated and must not be requested or added to a continuation grant;
- `modify_existing` is also ungated; the fixture additionally carries it in the prior grant authority, so the UI may show it as already allowed.

Core therefore builds a request with full declared `consequences` but `missing:["send_or_publish"]`. `RunPermissionRequest` renders only `request.missing`, and `FlowRunView` forwards exactly `request.missing` through preflight, grant issuance, high-token confirmation, and rerun. Widening any of those paths to include `create_new` would violate the exact-missing continuation contract.

## Shared fixture truth

`coreRequest()` uses Core's real `AutomationStudioActionPermissionGate` with:

```text
declared: [send_or_publish, create_new, modify_existing]
prior permitted authority: [modify_existing]
instructed authority: []
```

The resulting request is truthfully:

```text
consequences: [send_or_publish, create_new, modify_existing]
missing: [send_or_publish]
authority.granted: [modify_existing]
authority.instructed: []
```

The request sentence is built from `missing`, so it names sending/publishing only. The strict parser preserves the complete declared consequence list while refusing malformed or authority-conflicting missing lists.

## Four failed assertions

### 1. Permission request rendering

Test: `shows the request Core built: its sentence, what is missing, and what was already allowed`

Stale expectations:

- rendered output contains the create-new phrase;
- the approval list has two entries;
- the `onAllow` request has missing `[send_or_publish, create_new]`.

Correct expectations:

- the approval list contains only the send/publish phrase and has length 1;
- it does not render create-new as requiring approval;
- `onAllow` receives `missing:[send_or_publish]`;
- `request.consequences` still retains all three declared classes;
- the existing already-allowed `modify_existing` text remains present.

This is stale-test behavior, not a rendering bug. The component maps the authoritative `missing` array directly.

### 2. Ordinary allow-and-rerun continuation

Test: `allows exactly the missing classes, for the same run intent, and nothing more`

The second preflight and issued grant now correctly carry:

```text
permittedConsequences: [send_or_publish]
```

The expectations for `[send_or_publish, create_new]` are stale. The existing assertion excluding `modify_existing` remains useful; add an equivalent exclusion for `create_new` or assert the exact singleton array at both preflight and grant issuance.

### 3. High-token confirmation continuation

Test: `keeps the allowed classes through a high-token confirmation`

The high-token confirmation correctly retains the same singleton permission set:

```text
highTokenConfirmation: true
purpose: explore_and_adapt
permittedConsequences: [send_or_publish]
```

The expected create-new entry is stale. No production high-token state is lost: `llmAuthorizationPermitted` stores and reuses the exact `request.missing` array.

### 4. Explicit timed-out run continuation

Test: `names an explicit run and reads it back by that name, so its request still reaches the person`

After the request is recovered from the explicit run detail, the new grant correctly carries only:

```text
permittedConsequences: [send_or_publish]
```

The expectation that also includes create-new is stale. Run identity/new-run behavior is unaffected.

## Product/UI contract review

- `RunPermissionRequest` strictly parses Core's request and shows only `request.missing` under “Consequences requiring approval.”
- Its allow callback returns the parsed request unchanged.
- `FlowRunView.allowRunPermission` passes `request.missing` to `authorizeLlm` only if project, Flow, inputs, and step limit still match the requesting run.
- `authorizeLlm` copies that exact array into preflight and grant issuance.
- High-token confirmation preserves the same array in component state and reuses it without widening.
- The rerun receives only the new grant id; permitted classes do not leak into execution inputs.

These are the intended least-authority and continuation behaviors. No UI or Core production change is warranted.

## Smallest safe fix

Edit only:

`apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx`

Update the shared fixture comment and the four affected test expectations:

1. Assert full request `consequences` still includes send, create, and modify.
2. Assert only send/publish is rendered in the approval list; assert create-new is absent from that list and list length is 1.
3. Expect `onAllow(...).missing` to equal `["send_or_publish"]`.
4. Expect normal preflight, normal grant, high-token grant, and timeout-recovery grant `permittedConsequences` to equal `["send_or_publish"]`.

Do not change the fixture declaration to remove create-new: keeping it proves the UI distinguishes full declared context from the gated missing subset. Do not add create-new to production UI/grant continuation code.

## Focused validation

From `F:\!FluxIQ` after the test-only edit:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=8192'
pnpm --filter @fluxiq/web exec vitest run `
  src/features/automation-studio/runtime/tests/run-permission-request.test.tsx
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: focused web permission tests failed' }

pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/action-permissions/tests/destructive.test.ts `
  src/programs/automation-studio/runtime/action-permissions/tests/gate.test.ts
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: Core permission contract tests failed' }

pnpm test
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: final Core root test suite failed' }
```

The root suite remains decisive because it exposed these web expectations only after the two earlier Core test failures were reconciled.

## Scope

Read-only diagnosis. No Core/downstream source or shared document, generated output, run artifact, browser, provider, Lab, commit, or push action was changed or performed. This report is the only write.
