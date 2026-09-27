# t246 — Subflow-preserving post-reauthor replay

Status: **Partial**

## Implemented

- Extended the result-verification `rerunRepairedFlow` port input with an
  optional `subflowId`.
- Forwarded the selected verification `subflowId` only when present.
- Forwarded that ID through the service callback into
  `rerunAfterRepair({ from: "start" })`.
- Preserved the old direct-parent behavior for omission, explicit `undefined`,
  and other absent/falsy values.
- Added unit assertions for both selected-Subflow forwarding and absent-ID
  behavior.
- Kept the t240 decisive fourth-call expectation unchanged.

Files changed:

- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts`

The t240 test also now selects the resolver observation carrying the refreshed
build/adapt execution digest rather than assuming one provider resolution per
provider call; result verification legitimately makes two judge calls through
one resolved provider.

## Decisive result

The selected Subflow replay now works. Inspection during the focused run
showed the persisted `repairedRerun` record as:

- `attempted: true`
- `status: succeeded`
- `attemptCount: 1`

The returned run and replay trace were both `succeeded`, with the closed trace
message `Repaired re-run succeeded.` The deterministic replay itself made no
provider call, as required.

The full t240 success case still fails at its unchanged fourth-call assertion.
After the replay succeeds, recursive result verification asks the real grant
service to resolve the original admitted grant a third time. Applying the
authorized adaptation changed the Flow execution binding, so grant resolution
refuses before a provider request is made:

- grant refusal code: `llm.execution_grant_no_longer_valid`
- persisted result-verification code:
  `core.result.verification_did_not_finish`
- persisted status: `unverified`
- persisted `performed`: `false`
- provider fetch task kinds observed: two `loop_verification`, then one
  `evidence_tool_decision`; the expected post-replay `loop_verification` is
  absent
- resolver was entered for the post-replay check, but the grant service closed
  it before provider invocation

No raw provider response, credential, grant value, or page data was recorded
in this report. The t240 structured provider-failure case passes and continues
to prove raw response text is not persisted.

This remaining issue is a grant binding/lifecycle problem, not a replay target
problem. Per supervisor direction, t246 did not broaden into that subsystem.

## Validation

- Result-verification plus nearest runtime-adaptation tests: **66/66 passed**
  (43 run-outcome, 8 repair-authority, 15 result-check).
- Focused t240 composition: **1/2 passed**. Structured failure passed; success
  failed only because the fourth provider task was absent after the closed
  grant refusal described above.
- `pnpm --filter fluxiq check`: **passed**.
- Core `git diff --check`: **passed** (line-ending warnings only).
- Downstream `git diff --check`: **passed** (line-ending warnings only).

Core root `pnpm check`/`pnpm build` and package/root build were not run because
the decisive focused regression remains red. This report makes no root-gate or
build-success claim. No live, browser, provider, Lab, or commit action was
performed.
