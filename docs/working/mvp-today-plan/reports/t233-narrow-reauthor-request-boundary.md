# t233 — Narrow reauthor request boundary

## Outcome

Implemented the safe service-owned portion of t229 without claiming an observed provider
invocation. After provider resolution, unclassified setup and raw harness escapes now retain the
`pre_provider_validation` fallback, so they publish `not_attempted / not_received` rather than the
unsupported `provider_request / attempted` claim. Structured Flow Bootstrap and provider failures
remain dominant in the existing catch and are rethrown unchanged.

The reauthor callback also no longer relabels every run grant as `explore_and_adapt`. It presents
`build_and_adapt` and `explore_and_adapt` under their actual purpose and rejects every other purpose
before provider resolution. Those are exactly the two purposes accepted for extend mode by
`service/flow-bootstrap-commands/generation-request.ts`; create mode remains restricted to
`build_and_adapt`. This changes no task-kind capability, consequence permission, budget, retry,
approval, application, or replay rule.

This is a safe partial, not the complete provenance fix. Reviews t234, t236, and t237 establish that
the truthful three-state projection (`not_attempted | attempted | unknown`) belongs below the
service and needs a separate, compatibility-aware change.

## Files changed and exact hunks

- Core `runtime/service.ts`
  - resets the untyped fallback to `pre_provider_validation` immediately after provider resolution;
  - preserves the reauthor grant's `build_and_adapt` or `explore_and_adapt` purpose instead of
    rewriting it to `explore_and_adapt`;
  - retains the pre-existing binding refresh for `executionDigest` and `settingsRevision`.
- Core `runtime/tests/service-bootstrap/tests/accounting.test.ts`
  - adds a post-resolution setup throw and proves zero harness calls, no raw message, and
    `pre_provider_validation / not_attempted / not_received`;
  - covers raw `Error`, `TypeError`, and `DOMException` harness escapes and proves harness entry is
    not converted into a provider-attempt claim.
- Core `runtime/tests/service-bootstrap/tests/extend.test.ts`
  - captures resolver inputs and proves a `build_and_adapt` extend grant reaches the resolver with
    that same purpose.
- Downstream `docs/working/mvp-today-plan/reports/t233-narrow-reauthor-request-boundary.md`
  - this report only.

No retry, accounting, budget, grant issuance/revocation, permission, answerability, proposal,
approval, apply, or replay branch was changed. No raw exception message is recorded.

## Purpose and scope safety

The generation-request owner explicitly admits `build_and_adapt` and `explore_and_adapt` for
extend mode and rejects all other purposes; the callback's guard mirrors that boundary. Both
admitted purposes currently allow the same LLM task kinds, while lasting effects remain controlled
by `permittedConsequences` and the existing action-permission gate. The new test proves
`build_and_adapt` is no longer relabelled at resolver presentation; existing extend coverage uses
`explore_and_adapt` and continued to pass.

The change preserves all other grant fields, except that the callback continues its pre-existing
refresh of `executionDigest` and `settingsRevision` from the current Flow binding. Therefore this
task proves exact **purpose** preservation, not byte-for-byte identity of the originally issued
scope. A real-grant composition test is still needed to prove the refreshed binding equals the
issued binding throughout wrong-answer recovery.

The purpose rewrite could not by itself explain run 2's closed classification. If it had caused a
normal exact-scope refusal, the service would have recorded the typed
`flow_bootstrap.execution_grant_scope_mismatch` at `provider_resolution`; run 2 instead recorded an
untyped `flow_bootstrap.unexpected_error` under the overly broad request fallback. The rewrite was
a real correctness risk exposed by review, but remains an unproved run-2 hypothesis.

## Validation

Passed focused tests:

```text
pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts src/programs/automation-studio/runtime/tests/service-bootstrap/tests/extend.test.ts src/programs/automation-studio/runtime/recovery/refuted-result/tests/reauthor.test.ts
3 files, 33 tests passed
```

Also passed:

- `pnpm --filter fluxiq check`
- Core root `pnpm check` (structure audit and all workspace checks)
- Core root `pnpm build` (all packages and the web production build)

The first root check exposed one line of service growth above the structure baseline; formatting was
compressed without changing behavior, and the rerun passed. No live Lab, browser, or provider work
was performed. No commit was made.

## Remaining provenance work

Do not add a service- or harness-entry wrapper that asserts `attempted`. The smallest coherent
follow-up is the t237 four-file Flow Bootstrap projection unit:

1. Widen `flow-bootstrap/generation-failure/diagnostic.ts` to admit provider invocation `unknown`.
2. Make `harness-failure.ts` require and forward the harness's invocation state rather than infer it
   from provider metadata.
3. In `failure-state.ts`, separate canonical producer state from compatible accepted stored states,
   including legacy ambiguous `attempted` records.
4. In `diagnostic-parse.ts`, accept valid `unknown` states while rejecting impossible response /
   invocation pairs.
5. Update the focused diagnostics, round-trip, and provider-refusal tests, and rerun existing harness
   and provider-retry regressions.

DeepSeek already reports safe coarse provenance for known setup, transport, and response failures;
adapter-local fetch markers are optional precision work, not required for the minimal projection
fix. A separate real-grant service-adaptation test should drive `does_not_answer` through
reauthor → extend → approve → apply and assert complete grant scope, structured failure fidelity,
and success ordering.
