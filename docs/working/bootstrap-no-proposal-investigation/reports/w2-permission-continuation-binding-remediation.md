# w2-permission-continuation-binding-remediation

Status: passed provider-free focused validation. The integration-review blocking findings are remediated in the bounded Core panel state machine.

## Changes

- `BlankFlowAuthoringPanel.tsx` now retains a parsed permission request only as a continuation bound to the producing project ID, Flow ID, and normalized website-task body.
- Task-body changes and project/Flow identity changes clear the pending request. Equivalent prop revalidation with the same bound identity leaves it available.
- The binding is revalidated again immediately before grant issuance, after asynchronous save/preflight work, so a stale continuation cannot issue a grant.
- Consequence approval no longer supplies `highTokenConfirmation` by itself. The continuation records whether the request actually followed an explicit high-token confirmation and sends the flag only in that truthful case.
- If a continuation's new preflight newly requires high-token confirmation, the high-token modal opens while the bound consequence request remains retained; explicit confirmation then resumes with exactly the parsed `missing` consequences.
- Cancel remains non-mutating: it issues no grant, opens no proposal, and retains the exact request for deliberate reopen.

## Focused state-machine coverage

The directly owned component test now pins:

- malformed permission-request refusal;
- Cancel with no new grant/proposal callback;
- reopen and exact `missing` consequence issuance;
- task, project, and Flow invalidation;
- equivalent Flow/readiness revalidation retention;
- a normal continuation with no manufactured high-token flag;
- a previously confirmed high-token continuation with the truthful flag;
- a continuation that newly requires explicit high-token confirmation while retaining its pending request.

## Validation

- Focused web test: `23/23` passed.
- Core web TypeScript check: passed (`tsc --noEmit`).
- `git diff --check` for the two owned Core files: passed (Git emitted only the checkout's existing LF-to-CRLF advisory).
- No live panel/store process, provider, browser, public export, response observer, test runner, user data, commit, or push was touched.

Owned product files only:

- `apps/web/src/features/automation-studio/authoring/BlankFlowAuthoringPanel.tsx`
- `apps/web/src/features/automation-studio/authoring/tests/blank-flow-authoring.test.tsx`

The provider-triggered permission journey remains a later live acceptance gap; this brief intentionally proves the deterministic UI state machine without another provider call.
