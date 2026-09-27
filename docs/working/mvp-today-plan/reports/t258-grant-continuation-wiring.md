# t258 — Grant continuation wiring

Status: Complete

## Outcome

The refuted-result reauthor path now retains the exact run-owned LLM grant only for its private nested generation invocation, durably applies the approved Flow adaptation, verifies the authoritative applied binding, continues that same held grant, releases the adaptation lock, deterministically reruns the selected subflow without a provider call, and recursively verifies the replay with the fourth provider call. The outer run remains responsible for the terminal revoke.

The public Flow-bootstrap generation entry point cannot opt into retention. It always invokes the private implementation with retention disabled. The reauthor-only callback invokes the same implementation with an invocation-local private `retainRunOwnedGrant=true` argument; no purpose-wide exception, `Set`, `AsyncLocalStorage`, or other ambient/shared retention state remains.

Production provider-call defaults are unchanged. The decisive composition fixture alone raises `maxCalls` to 4 so it can observe the recursive post-replay judge call.

## Core changes

- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
  - Added the private host continuation hook and exact binding capture.
  - Split public one-argument generation from the private invocation-local retention implementation.
  - Routed only the runtime-owned reauthor callback through retention.
  - Runs approved adaptation apply/continuation under the existing per-Flow adaptation lock.
  - Persists sanitized success or fail-closed reauthor provenance.
- `packages/fluxiq/src/programs/_shared/runtime.ts`
  - Binds the internal host hook directly to `continueAfterAppliedFlowAdaptation`.
- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts`
  - Preserves selected `subflowId` for the deterministic repaired-flow rerun and refuses an explicit `replayReady:false` result.
- `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/reauthor-continuation.ts`
  - Verifies adaptation base digest and settings revision against the captured grant binding before durable apply.
  - After apply, obtains the authoritative applied binding and continues the exact grant.
  - Reduces binding-read and continuation failures after durable apply to `applied:true`, `replayReady:false`, typed closed provenance, with no rollback or replay.
- `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/index.ts`
  - Exposes the coordinator only through the internal runtime-adaptation barrel.
- `packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/bootstrap-target.ts`
  - Owns the bootstrap-target assertion in the internal service command layer.
- `packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/index.ts`
  - Exports that assertion only from the internal service barrel. The former public Flow-bootstrap export/file is absent.

## Focused regression coverage

- `runtime/service/runtime-adaptation/tests/reauthor-continuation.test.ts`
  - Durable apply followed by authoritative binding-read rejection returns closed applied/not-replay-ready provenance.
  - An arbitrary secret-bearing continuation exception reduces to fixed typed provenance without preserving the secret.
  - A base binding mismatch refuses before apply.
- `runtime/tests/refuted-result/tests/reauthor-service.test.ts`
  - Successful real service composition observes four task kinds: two initial verification calls, reauthor generation, and recursive post-replay verification.
  - The same admitted grant reaches continuation and is terminally revoked by the outer run.
  - Binding-read and typed continuation failures after durable apply preserve `applied:true`, skip replay/fourth verification, expose no raw error, and leave zero active grants.
  - A deterministic barrier pauses private reauthor generation while a public same-grant-ID call on a distinct Flow completes. Before releasing the barrier the public invocation alone has revoked exactly that grant; after release the private failure performs no replay/fourth call, exposes privacy-safe detail, and leaves zero active grants. The barrier release is in `finally`.
- `runtime/tests/service-bootstrap/tests/accounting.test.ts`
  - A direct public explore generation failure revokes the grant.
- `runtime/tests/service-bootstrap/tests/extend.test.ts`
  - A valid public explore-and-extend success explicitly observes exactly one revoke of the exact grant ID.
- Existing run-outcome coverage continues to prove selected-subflow rerun and failure behavior.

## Validation

All validation was run against the settled tree after moving the target helper into the internal service directory.

- Focused Vitest set covering accounting, extend, the continuation coordinator, real reauthor composition, run outcome, unattended repair authority, retry verification, grant continuation, grant hold, and grant lifecycle: **135/135 passed across 10 files**.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter @fluxiq/fluxiq check`: passed.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm check`: passed, including the Core structure audit and all workspace type checks.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm build`: passed, including the production Next.js build.
- `git diff --check` in Core: exit 0; only existing LF-to-CRLF working-copy warnings were emitted.

No live browser, provider, or Lab work was run. No commit or push was made.

## Copy-ready ledger delta

`t258 | Complete | Wired exact held-grant continuation through durable approved Flow reauthor apply, authoritative applied-binding read, zero-provider selected-subflow replay, recursive fourth verification, and outer terminal revoke. Public generation cannot retain grants; invocation-local private retention has deterministic public-success and same-ID concurrent isolation regressions. Post-apply binding/continuation failures persist applied:true/replayReady:false closed provenance and skip replay. Focused 135/135, package check, Core root check/build, and diff check passed. Production maxCalls unchanged; 4-call allowance is fixture-only. No live measurement; t217 remains unmeasured.`
