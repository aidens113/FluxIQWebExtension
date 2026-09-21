# w2-permission-post-preflight-revalidation

Status: passed. The final rereview blocker is closed with a minimal ordering correction and deferred-preflight regression coverage.

## Fix

`BlankFlowAuthoringPanel.tsx` now revalidates a permission continuation against the latest project, Flow, and normalized instruction context immediately after the awaited preflight succeeds. That check runs before the preflight's high-token limits may populate or open the confirmation modal and before grant issuance.

If the bound context changed during the await, the old continuation clears, the consequence dialog remains closed, no high-token dialog opens, no grant is issued, and the panel instructs the operator to start a new exploration.

## Proof

The focused component test uses a deliberately deferred continuation preflight and crosses that await independently with:

- a project change while retaining the same Flow ID;
- a Flow-ID change in the same project.

In both cases the deferred response resolves with high-token limits, yet the assertions prove zero stale high-token modals, zero grants, no reopenable pending approval, and the visible restart message. Existing ordinary, previously confirmed high-token, and newly-high continuation tests continue to pass.

## Validation

- Focused panel test: `25/25` passed.
- Core web TypeScript check: passed (`tsc --noEmit`).
- `git diff --check` for the two owned Core files: passed; output contained only the checkout's LF-to-CRLF advisory.
- No live panel/store, provider, browser, other product file, public export, test runner, git history, commit, or push was touched.

Owned Core files:

- `apps/web/src/features/automation-studio/authoring/BlankFlowAuthoringPanel.tsx`
- `apps/web/src/features/automation-studio/authoring/tests/blank-flow-authoring.test.tsx`
