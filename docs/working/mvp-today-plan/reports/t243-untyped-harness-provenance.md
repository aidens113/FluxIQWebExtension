# t243 — Untyped harness provenance implementation

## Outcome

Implemented the scoped post-t239 harness boundary in Core. Post-resolution setup continues to use
the outer `pre_provider_validation / not_attempted / not_received` fallback. Only exceptions
escaping the private Flow Bootstrap harness are converted at `provider_request`, where untyped
`Error`, `TypeError`, and `DOMException` failures now record
`providerInvocation: unknown` and `providerResponse: unknown`.

Existing structured `AutomationStudioFlowBootstrapGenerationError` diagnostics remain dominant and
round-trip unchanged. Returned harness results still use `flowBootstrapHarnessFailure`, so t239's
observed `not_attempted | attempted | unknown` provenance, accounting, and provider refusal fields
are not replaced by the scoped wrapper.

No retry, budget, provider-call, grant, capability, consequence-permission, approval, application,
or replay rule changed.

## Files changed

Core:

- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
  - added one local `runHarness` boundary inside `generateFlowBootstrapAdaptation`;
  - the boundary converts escaping values through
    `automationStudioFlowBootstrapFailureDiagnosticOf(error, "provider_request")` and rethrows a
    structured `AutomationStudioFlowBootstrapGenerationError`;
  - routed instruction-authority, evidence-decision, and direct Flow Bootstrap harness calls
    through the boundary;
  - kept the outer fallback at `pre_provider_validation`;
  - corrected the stale outer-catch comment;
  - kept the large service at its existing 4,568-line structure baseline by formatting this local
    boundary compactly.
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts`
  - retained the post-resolution setup test and its `not_attempted` assertion;
  - changed raw harness expectations to `provider_request / unknown / unknown` with distinct codes
    for `Error`, `TypeError`, and `DOMException`;
  - exercised both direct bootstrap and evidence-decision call shapes;
  - asserted one harness entry, no raw text, no fabricated accounting, grant revocation, and no
    topology;
  - added exact structured-diagnostic preservation coverage.

Downstream:

- `docs/working/mvp-today-plan/reports/t243-untyped-harness-provenance.md`

No other file was edited for this task.

## Behavioral boundary

The resulting service behavior is:

- a throw before the local wrapper is entered remains a pre-provider failure;
- a raw throw escaping the harness records uncertainty and does not claim a call;
- an existing structured failure is parsed first and preserved;
- a returned failed harness result remains owned by the t239 harness projection;
- successful provider work followed by output validation, post-validation, or persistence failure
  retains its later stage and received-provider accounting.

The wrapper does not set or leave behind mutable request-stage state, so an unrelated completion
check, permission operation, or tool operation cannot inherit the stage of the preceding provider
call.

## Validation

Focused service test passed after the evidence-guided fixture was given the evidence loop's real
minimum call allowance:

```text
pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts
1 file, 13 tests passed
```

The first two focused runs had one fixture-only failure: the evidence loop refused its
configuration before entering the harness because the fixture retained the direct path's
single-call allowance. No product code changed in response; the fixture was aligned with existing
evidence-loop tests by setting `maxCallsPerRun: 3`. The rerun passed all 13 tests.

Type and repository gates passed against the settled t239/t240 tree:

- `pnpm --filter fluxiq check`
- Core root `pnpm check` — structure audit passed with `service.ts` at the 4,568-line baseline;
- Core root `pnpm build` — all packages and the production web build completed successfully.

An earlier package-check attempt was temporarily blocked by three `TS18048` errors in the
concurrently edited t240 `reauthor-service.test.ts`; after t240 settled, the same command passed.
No t240 file or subflow repair behavior was changed by this task.

No live Lab, browser, or provider run was performed. No commit was made.
