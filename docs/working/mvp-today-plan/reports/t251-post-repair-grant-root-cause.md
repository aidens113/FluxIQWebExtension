# t251 — Post-repair grant root cause

Status: **Complete (read-only root-cause analysis)**

## Closed evidence and conclusion

The t246 failure was caused by a stale execution binding, not by an observed
revocation. The repaired selected-Subflow replay completed successfully and
without a provider call. The next result-verification resolution then returned
`llm.execution_grant_no_longer_valid`, persisted
`core.result.verification_did_not_finish` with `unverified` / `performed:false`,
and made no fourth provider request. That refusal can only be emitted after the
grant has been found and claimed; a revoked or missing grant emits
`llm.execution_grant_unavailable` instead.

The source proves why the binding is stale. A grant stores the exact
`executionDigest` and `settingsRevision` present at issue. Every resolution and
provider call compares the current binding with those stored values. Applying
the reauthored adaptation changes the parent Flow/topology and therefore the
current execution binding. The recursive post-replay verifier resolves the same
grant against the changed Flow, so `validateClaimedGrant` rejects it before a
provider request.

There is also a second, integrated-tree lifecycle defect which must not be
hidden by fixing only the binding. The reauthor callback now correctly
preserves the admitted `build_and_adapt` purpose, while
`generateFlowBootstrapAdaptation` revokes every grant in `finally` except one
labelled `explore_and_adapt`. Therefore a nested build under a run-owned
`build_and_adapt` grant is nominally revoked before approve/apply/replay. If
that path executes as the current source says, the later refusal is
`unavailable`, not `no_longer_valid`.

The t246 observation that the grant remained present until the stale-binding
check is inconsistent with that current cleanup branch and the fixture's
configured `grants.revoke` callback. It proves stale binding was the immediate
failure in the captured t246 execution; it does not make the early-revocation
path safe. The next implementation must instrument and pin both lifecycle
events rather than choosing one based on the last refusal code.

In short: **stale digest/revision is the proved t246 cause; preserved-purpose
cleanup is a separate deterministic blocker in the integrated source. A sound
repair needs both run ownership and a narrowly authorized binding advance.**

## Control-flow proof

1. The runtime receives one admitted grant and reuses it for result
   verification (`verificationGrant = input.llmExecution`).
2. Initial verification resolves and claims that grant. Two
   `loop_verification` requests consume uses and accounting from the same stored
   record.
3. Refutation routes to reauthor. Immediately before generation, the service
   reads the current Flow binding and forwards the original grant id, actor,
   session, consequences, and exact admitted purpose with that binding.
4. Generation resolves the same claimed grant and makes the
   `evidence_tool_decision` request. No grant is minted and the existing
   remaining-use, token, and cost ledgers continue.
5. Generation's `finally` currently revokes this run-owned grant when its
   purpose is `build_and_adapt`. This cleanup belongs to a standalone build,
   not a nested operation inside a run that still owns the grant.
6. The reauthor route approves and applies the proposed adaptation. Application
   writes the corrected topology and parent metadata, producing a new execution
   digest/settings revision.
7. t246 proves the selected Subflow is replayed from the start and succeeds.
8. Recursive verification asks the resolver for the original grant. If it
   survived step 5, `validateClaimedGrant` compares the new live binding with
   the old stored binding, emits `llm.execution_grant_no_longer_valid`, and the
   grant service revokes it. If step 5 revoked it, resolution instead emits
   `llm.execution_grant_unavailable`. Neither path reaches the fourth provider
   request.
9. The outer `runRuntimeSession` `finally` is the correct terminal owner: it
   revokes the run grant once, regardless of success or failure.

## Smallest authority-preserving repair

Use an explicit internal run-owned lifecycle plus a compare-and-swap binding
advance. Do not mint a replacement grant, relabel its purpose, or weaken normal
binding validation.

1. In `runtime/service.ts`, split the generation implementation from its public
   standalone wrapper. The public entry point retains today's always-revoke
   behavior for `build_and_adapt`. The private reauthor call marks the already
   admitted grant as owned by the enclosing runtime session, so nested
   generation does not revoke it. This ownership control must be a private
   method argument/state local to the call, not a request field that an API
   caller can submit.
2. Add a narrowly named grant-service operation such as
   `advanceHeldRunBinding`. It must require the same grant id, actor, session,
   project, Flow, and purpose; require an already claimed, `heldForRun` grant;
   require no call in flight; compare the supplied previous binding with the
   stored binding; independently resolve and compare the new current binding;
   and revalidate the live actor session and key. Any mismatch fails closed.
3. Invoke that operation only after this reauthor route successfully applies
   the exact proposed adaptation and before repaired replay/result verification.
   Wire it as a host-owned callback beside resolve/revoke; do not expose an API
   endpoint.
4. Mutate only `executionDigest` and `settingsRevision`. Preserve grant id,
   purpose, actor/session, project/Flow, permitted consequences, provider/model,
   lease/expiry, reveal authorizations, remaining uses, committed tokens, and
   committed estimated cost. The post-replay judge therefore spends the next
   call from the same budget rather than receiving new authority.

This is narrower than accepting binding drift in `validateClaimedGrant`: all
ordinary Flow/settings changes remain invalidating, including changes during a
call. It is also narrower than minting a post-apply grant, which would reset
uses, token/cost accounting, reveal authorizations, and the run lease.

## Exact implementation surface

- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
  - private nested-generation ownership;
  - refresh callback type/storage/binding;
  - compare-and-swap call around successful reauthor apply;
  - outer run remains the terminal revocation owner.
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grants.ts`
  - held-run binding-advance operation that changes only the two binding fields.
- `packages/fluxiq/src/programs/_shared/runtime.ts`
  - wire the internal callback from `AutomationStudioService` to the grant
    service; no API handler or wire contract change.
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts`
  - decisive end-to-end service regression and lifecycle observations.
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grants.test.ts`
  - successful same-run compare-and-swap with accounting continuity.
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-failures.test.ts`
  - wrong scope/identity/purpose, unheld/unclaimed, in-flight, stale previous
    binding, session/key failure, and arbitrary external binding drift remain
    refused and revoked.
- Existing direct-generation revoke coverage in
  `runtime/tests/service-bootstrap/tests/accounting.test.ts` should remain
  unchanged and be rerun; edit it only if an additional assertion is needed.

If this cannot be implemented within that surface, stop and re-audit rather
than adding a public refresh endpoint or relaxing grant validation.

## Required test assertions

- The success composition observes exactly
  `loop_verification`, `loop_verification`, `evidence_tool_decision`,
  `loop_verification`; repaired selected-Subflow replay and final run succeed.
- Every resolver observation carries the same grant id, actor/session,
  project/Flow, and `build_and_adapt` purpose.
- The reauthor resolution sees the pre-apply binding; post-repair verification
  sees the post-apply binding; both match the grant service at their respective
  call boundaries.
- Nested generation does not revoke. The outer run boundary revokes exactly
  once and active grant count ends at zero.
- Remaining uses fall by the actual provider-call count; committed token/cost
  totals continue monotonically across the binding advance and are not reset.
- No new issue/mint or reveal-authorization batch occurs during refresh.
- A standalone `build_and_adapt` generation still revokes on success and every
  refusal/failure path.
- The existing structured reauthor-provider failure remains sanitized and does
  not apply or refresh a binding.
- Binding drift not caused by this exact successful apply remains
  `llm.execution_grant_no_longer_valid`; revoked grants remain `unavailable`.

Suggested validation after implementation:

```text
pnpm --filter fluxiq test -- packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grants.test.ts packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-failures.test.ts packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts
pnpm --filter fluxiq check
pnpm check
pnpm build
git diff --check
```

## Files inspected

- Downstream `docs/working/mvp-today-plan.md` (t251 brief/current state)
- Downstream `docs/working/mvp-today-plan/reports/t246-subflow-repair-replay.md`
- Core `runtime/service.ts`
- Core `runtime/llm/resolver-contract.ts`
- Core `runtime/llm/execution/grants.ts`
- Core `runtime/llm/execution/grant-refusal.ts`
- Core `runtime/tests/refuted-result/tests/reauthor-service.test.ts`
- Core `runtime/llm/tests/execution-grant/tests/execution-grants.test.ts`
- Core `runtime/llm/tests/execution-grant/tests/execution-grant-failures.test.ts`
- Core `runtime/llm/tests/execution-grant/tests/execution-grant-fixture.ts`
- Core `runtime/tests/service-bootstrap/tests/adaptation.test.ts`
- Core `runtime/tests/service-bootstrap/tests/accounting.test.ts`
- Core `programs/_shared/runtime.ts`

No source/shared document was edited. No test, build, provider, browser, Lab, or
commit action was run.
