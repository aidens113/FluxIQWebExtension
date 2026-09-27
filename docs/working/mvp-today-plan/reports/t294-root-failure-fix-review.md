# t294 — Root failure fix review

Status: **Complete — GO to final root validation**

## Verdict

The final t290 and t293 test-only edits are consistent with the diagnosed product invariants and are well designed. Neither change weakens production permission, grant, retry, deadline, or provenance behavior.

- t290: **GO**. The stale mixed-consequence expectation is split into exact unauthorized-send and ungated-create proofs, while adjacent permission fixtures now use consequences consistent with the final risk-only boundary.
- t293: **GO**. The wall-clock race is replaced by a typed provider timeout injected only after endpoint entry, proving post-credential-release behavior deterministically without raising the deadline.

The two edits touch separate test files and have no semantic overlap. The remaining release gate is the complete Core root test suite that originally exposed both failures.

## t290 permission reconciliation review

Reviewed diff:

`packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/patches.test.ts`

The diff correctly implements the t286/t288 findings:

- The mixed `create_new` plus `send_or_publish` case retains both declared consequences while requiring only the unauthorized `send_or_publish` subset.
- The held attempt records `permissionOutcome:"required"`, no execution, failed preflight, `permission_required` verification, and no adaptation/proposal.
- The adjacent create-only case proves no request, permitted preflight, a real execution trace, and one adaptation despite the legacy broad side-effect policy flag.
- Existing permission-request fixtures no longer treat `modify_existing` as gated. They use `delete`/`move_money` where a missing request is intended, and the authorized case proves granted `delete` permits a mixed delete/modify declaration.
- The hidden-control and first-request-stop cases still exercise actual gated consequences.

These changes strengthen rather than dilute the binding rule: only move-money, delete, and send/publish require authority; create and ordinary modify remain ungated.

t290 evidence: **5/5 files, 81/81 tests passed**; scoped diff check passed.

## t293 deadline determinism review

Reviewed diff:

`packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`

The diff correctly implements the t291 diagnosis:

- The fake endpoint first records entry, which proves credential reveal/release and grant setup have completed.
- It then throws a typed retryable `AutomationStudioLlmProviderError` with code `llm.provider_timeout`.
- The evidence loop, rather than provider-retry, advances through iterations `[1,2,3]` on the same grant and produces a proposed Flow.
- Three reveals, one terminal revoke, and zero active grants pin the lifecycle behavior.
- The load-sensitive 3-second timeout override, hanging reply branch, and now-unused optional timeout seam are removed.
- The normal fixture grant deadline remains the existing literal 25 seconds; no product or production timeout changes.

This is a deterministic integration fixture for the post-entry timeout contract. Existing dedicated grant/provider/harness tests continue to own real deadline abort mechanics and pre-entry provenance.

t293 evidence: **4/4 files, 51/51 tests passed**; changed target passed in 3.444 seconds; scoped diff check passed.

## Remaining validation

Run from `F:\!FluxIQ` on the unchanged settled tree:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=8192'
pnpm test
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: final Core root test suite failed' }

git diff --check -- `
  packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/patches.test.ts `
  packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: final test-only diff check failed' }
```

The full root test is necessary because the prior failures appeared only in that gate. Repeating the already-green focused matrices is not a substitute. If repository protocol requires a final settled-tree root check after these test edits, run `pnpm check` after `pnpm test`; no production rebuild is required solely because test files changed.

## Scope

Read-only review. No Core/downstream source or shared document, generated output, run artifact, browser, provider, Lab, commit, or push action was changed or performed. This report is the only write.
