# t265 — Post-extraction runtime review

Status: **Complete read-only snapshot review; t258 final report was absent**

## Verdict

**NO-GO on the current tree for a live run.** The extraction is cohesive and the happy-path
composition is internally consistent, but two final-intent invariants are not closed in the
snapshot reviewed: retention is selectable through an exported service method, and an exception
while reading the authoritative post-apply binding can leave a durable adaptation applied without
recording `applied: true` / `replayReady: false`.

This is a point-in-time source verdict, not a verdict on a completed t258 handoff. No t258 report
existed under `docs/working/mvp-today-plan/reports/` when this review was written. T259 was present,
but its statement that a public wrapper always selects `retainRunOwnedGrant = false` does not match
the current method signature.

## Findings

### 1. High — grant retention is not confined to a private runtime operation

Core `runtime/service.ts:1480-1482` exposes
`generateFlowBootstrapAdaptation(input, retainRunOwnedGrant = false)` as a public method, and
`service.ts:1723` suppresses ordinary revocation whenever that caller-controlled second argument is
true. The intended runtime reauthor call at `service.ts:2648` is presently the only repository call
site passing true, but the class itself is exported through `runtime/index.ts` and the program
barrels. Therefore source-level callers can select the retention behavior; it is not structurally
limited to the enclosing runtime operation.

This is narrower than minting or widening a grant—the same grant is still resolved by the grant
store—but it contradicts the required operation-scoped ownership boundary and t259's stated
public-wrapper/private-implementation shape.

Required correction: keep the existing public one-argument method, and move the retention choice
behind a private runtime-owned method or private implementation that only the wrong-answer reauthor
path can call. A boolean capability parameter must not remain on the exported service method.

### 2. High — one post-durable-apply failure is not converted to the closed applied-state record

The extracted helper applies first, then calls `readAppliedBinding()` at
`runtime-adaptation/reauthor-continuation.ts:38-39`. Only the subsequent `continueGrant` call is
inside the catch at lines 41-46. If the authoritative binding read throws after
`input.apply(adaptation)` has durably succeeded, the helper rejects. The surrounding
`automationStudioReauthorRefutedResult` contract treats a rejecting apply callback as not applied,
so the returned run marker can omit `applied: true` even though the adaptation is already durable.
That path also misses the intended closed `grant_continuation`, `providerInvocation:
not_attempted`, and `replayReady: false` projection.

The missing-hook path and a typed/refused continuation are handled closed, but an authoritative
post-apply read failure is part of the same boundary and must not erase the durable fact.

Required correction: after `apply` returns an application, convert every binding-read or
continuation failure into the helper's closed replay refusal result, allowing the caller to record
`applied: true` and `replayReady: false`. Errors before or during durable apply may still reject as
not applied. Add a focused fault-injection case in which apply succeeds and
`readAppliedBinding()` rejects; assert the persisted adaptation is applied, replay and fourth judge
are skipped, closed provenance is recorded, and the outer grant is revoked.

## Invariant review

| Invariant | Snapshot verdict | Evidence |
| --- | --- | --- |
| Operation-scoped retention | **NO-GO** | Runtime is the only current true call site, but the exported service method accepts the retention boolean. |
| Durable apply before continuation | **GO on normal path** | The helper validates the adaptation's base binding under the Flow lock, awaits apply, reads the resulting authoritative binding, then invokes continuation. |
| Closed failure after durable apply | **NO-GO** | Missing hook and continuation refusal close safely; an exception from the post-apply binding read escapes and can lose the truthful applied marker. |
| Zero-provider selected-Subflow replay | **GO by source/test intent** | `run-outcome.ts:300-303` blocks replay on `replayReady:false` and forwards `subflowId`; the current composition test pins three calls on refusal and four calls on success, with replay between calls three and four. No test was run by t265. |
| Terminal grant revocation | **GO by source** | `runRuntimeSession` retains its unconditional outer `finally` revocation at `service.ts:2861-2863`; the composition assertions require zero active grants. |
| File-structure ownership | **GO** | `reauthor-continuation.ts` is a focused 74-line runtime-adaptation module, is present in its directory barrel, and removes specialized apply/continuation mechanics from the already-large service. The helper is not re-exported by `service.ts`; only the needed type is imported there. |

## Minimum final-tree proof

After the two corrections, the final t258 evidence should include:

1. a test proving ordinary/public Flow Bootstrap generation cannot request retention;
2. the existing success, continuation-refusal, and provider-privacy composition cases;
3. a new post-apply binding-read failure case proving truthful `applied: true`, closed
   `replayReady: false`, no replay/fourth judge, and terminal revocation;
4. the declared focused suites plus package/root check and build on the settled tree.

No Core or downstream source/shared document, generated output, run artifact, provider/browser/Lab
state, commit, or push was changed by this review. Only this report was added.
