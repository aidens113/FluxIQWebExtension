# t253 — Post-repair grant test-gap audit

## Outcome

Core has strong coverage for strict grant binding, same-run reuse, terminal
revocation, and recursive result verification in isolation. It does not cover
the composition introduced by a grant-authorized Flow edit: the same held grant
authorizes the edit, the edit changes its bound execution state, and the run
then needs one final verification call against the repaired result.

The t246 failure is therefore a real missing lifecycle case, not a conflict
with the deterministic replay contract. The replay is zero-provider and now
succeeds. The later recursive verification separately attempts the fourth
provider call and is refused because the admitted grant still names the
pre-apply binding.

## Rules already covered

### Grant service

- A grant is bound to actor, session, project, Flow, purpose, key, execution
  digest, and settings revision.
- Ordinary dependency or settings drift makes a grant no longer valid; both a
  later call through an already resolved provider and a later resolve fail.
- A no-longer-valid grant is revoked rather than becoming reusable if the state
  later happens to match again.
- A held grant outlives its short issue/claim TTL but remains bounded by one run
  lease.
- The same run may resolve an unchanged claimed grant again. Re-resolving does
  not mint calls, reset its lease, or create a second budget; concurrent calls
  remain atomic.
- Wrong actor/session/project/Flow/purpose, cancellation, expiry, user revoke,
  and session revoke are refused and/or revoke the grant as appropriate.
- In-flight results are not committed after cancellation, expiry, or binding
  drift.

These are primarily covered by
`execution-grants.test.ts` and `execution-grant-hold.test.ts`.

### Service and result verification

- `llm-grants.test.ts` proves a runtime grant is revoked at the run boundary,
  including failure paths.
- `iterating-recovery.test.ts` proves several calls share one real grant and
  that the grant is released when the run ends.
- `run-outcome.test.ts` proves an applied refuted-result repair earns one
  replay, the replay is recursively judged, and a second negative verdict does
  not repair again.
- The same test proves provider-resolution throws are recorded closed as
  `core.result.verification_did_not_finish` without persisting the thrown
  message.
- Unattended repair/retry suites prove a repaired result can be judged through
  standing authorization after a repair mutates the Flow.
- The t240 composition test now proves the selected Subflow deterministic
  replay succeeds, that the replay itself causes no provider fetch, and that
  the real grant fails only when the later recursive verification resolves it.

## Exact missing success cases

1. **Trusted post-apply binding continuation at the grant layer.** A held,
   claimed `build_and_adapt` or `explore_and_adapt` grant that authorized a
   specific successfully applied adaptation must be able to continue under
   the resulting Flow binding. The continuation must preserve the same grant
   ID, actor/session, project/Flow, purpose, key revision, permitted
   consequences, remaining uses, committed tokens/cost, and original run
   lease.
2. **No free allowance.** Advancing the binding must consume zero provider
   calls and add no token/cost allowance. The next provider call must decrement
   the original remaining-use/budget state.
3. **Real service composition.** The t240 success path must observe exactly:
   two initial `loop_verification` calls, one `evidence_tool_decision`, a
   zero-provider deterministic replay, then one post-replay
   `loop_verification`. The final result must be confirmed, the run succeeded,
   the adaptation `extend`/`applied`, and the grant inactive after the run.
4. **Second negative answer remains bounded.** With the post-replay judge
   returning `no` twice, the run must fail after the one replay and must not
   author/apply a second adaptation; all calls must still charge the same
   grant.

The existing same-run re-resolve test is insufficient for case 1 because its
binding never changes. The existing recursive-verification unit is
insufficient for case 3 because its rerun/provider ports are mocks with no real
grant validation.

## Exact missing refusal cases

Any binding-continuation seam added for the success path needs focused negative
tests proving it cannot become a general “refresh my grant” escape hatch:

- refuse an absent, expired, revoked, or already exhausted grant;
- refuse another actor/session, project, Flow, or purpose;
- refuse a transition not tied to the adaptation that this same grant
  authorized and that Core actually applied;
- refuse an arbitrary requested digest or revision rather than re-reading the
  authoritative post-apply binding;
- continue refusing unrelated settings drift, key rotation/disablement,
  identity loss, and provider/model mismatch;
- refuse while a provider call is in flight, so binding cannot change under a
  request or commit;
- preserve final run-boundary revocation after a successful continuation;
- when continuation is refused, make no provider request, expose the typed
  grant refusal only through closed diagnostics, and persist no raw error or
  credential material.

The existing generic drift tests must remain unchanged: untrusted external
Flow/settings mutation is still `llm.execution_grant_no_longer_valid`. The fix
must create a narrow trusted transition, not weaken normal binding checks.

## Smallest focused command set

During implementation:

```text
pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-hold.test.ts src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grants.test.ts
pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts
pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts
pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/tests/service-adaptation/tests/llm-grants.test.ts
pnpm --filter fluxiq check
```

The t240 composition test is the decisive success gate. The grant suites are
the decisive security/refusal gates. `run-outcome.test.ts` protects the
one-replay/recursive-verification boundary, and `llm-grants.test.ts` protects
terminal revocation.

After those pass, run the repository-level check/build gates required by the
owning task and both repositories' diff checks. The deterministic replay should
not acquire a provider assertion or provider mock: its zero-provider nature is
best proven by the exact task-kind sequence in the real composition test.

## Scope

Read t246 and only the relevant grant, service, and result-verification tests.
No source, test, or shared-document edits were made. No live, provider,
browser, Lab, build, or commit action was performed.
