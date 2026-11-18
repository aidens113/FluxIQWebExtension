# audit-outcome (t928, key-backend)

## Outcome
Done. Opt-in outcome row implemented and tested. Two unrelated generated-file drift tests fail (expected, supervisor regenerates).

## What changed and why
Registration option: `auditOutcome: true` on `GlobalProgramApiRegistry.register` params (also on `endpoints()` summaries). Absent/false behaves exactly as before.

- `platform/iam/types.ts`: new `IamAuditOutcome = {result:"succeeded"} | {result:"failed"; errorKind:string}`; `IamAuditRecord.outcome?` (only on the outcome row; decision row never has it).
- `platform/iam/authorize/record-decision.ts`: optional `outcome` param written to the row.
- `platform/iam/authorize/request-authorizer.ts`: `recordOutcome(decision, outcome)` records one more row under the same requestId, decides nothing.
- `platform/iam/audit/store.ts`: outcome persisted without a schema change, as a 4th segment of the existing origin dictionary string (`ok` / `fail:<kind>`); older rows decode unchanged.
- `programs/_shared/api.ts`: `CallGate` carries the decision; after the handler returns (after measured scope), opted-in endpoints call `recordOutcome`. errorKind = response `errorCode` if it matches `[a-z][a-z0-9_.]{0,99}`, else `"error"` (a thrown error's text is never used; thrown errors already map diagnostic code to errorCode). A sink failure while writing the outcome is swallowed so the handler's result is never turned into an error.
- Outcome row: same principal, action, resources, matched, origin, via, consent as the decision; category `allow`, decision `allow`, same `requestId` as the decision row.

Tests added: `programs/_shared/tests/api-audit-outcome.test.ts` (failed handler -> decision + failed outcome, no payload/error text, same requestId, never "succeeded"; thrown error -> kind `error`; success -> one succeeded row; no opt-in -> exactly one row, no `outcome` key), and a round-trip case in `platform/iam/audit/tests/store.test.ts`.

## Panel join for t925
Join key is `requestId` (shared by the decision row and the outcome row) plus `action`. For an opted-in action (e.g. the add-key action), the Activity shape should take the row with `outcome` present: `outcome.result === "succeeded"` -> "added a key", `"failed"` -> "tried to add a key and it failed" (errorKind available, e.g. `key.invalid`), and hide the decision row that has the same requestId and no `outcome` (otherwise "added a key" still shows). A decision row with no matching outcome row (non-opted action, or outcome not yet written) keeps its current wording. Note: I did not find where rows reach the panel wire (no non-test mapper outside the iam store in packages/fluxiq or contracts matched `ipPrefix`); if the panel's Activity reads rows through a contracts type or mapper that whitelists fields, it must add `outcome?` there. The supervisor adds `auditOutcome: true` in programs/secret-keys (not touched by me).

## Commands run and observed results
- `heavy-slot run audit-outcome -- npx vitest run src/programs/_shared src/platform/iam` (packages/fluxiq): 71 files passed, 2 failed; 586/588 tests pass. Failures: `platform/iam/catalog/tests/live-registry.test.ts` (generated action catalog drift) and `programs/_shared/assistant/tests/generated-module.test.ts` (assistant-tools.generated.json drift, secret-keys reason text). Both are generated-file drift from the in-progress secret-keys changes, not from this change; the new tests pass.
- `heavy-slot run audit-outcome -- pnpm --filter fluxiq check`: exit 0, but the build cache reported "reuse ... inputs and outputs match the stamp" (a run by another party after my edits had already stamped the same inputs), so this tsc result is cache-confirmed rather than freshly computed by me.
- `node scripts/structure-audit.mjs`: no errors in my paths; advisory warn `api.ts` 474 lines past the 400-line threshold (advisory only).

## Not verified
- Fresh (non-cached) typecheck run by me. Live panel behaviour. Whether a contracts/panel mapper needs `outcome?` added.
- The `allow` category rows are buffered by the sink, so the outcome row is flushed with the next batch like any allow row.

## Open questions
- Outcome rows are category `allow`; any existing reader that counts allow rows per call will see 2 rows for opted-in endpoints (decision unchanged, extra row carries `outcome`).
