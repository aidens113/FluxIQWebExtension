# t234 — Independent review of the reauthor request boundary

## Outcome

Narrowing `generateFlowBootstrapAdaptation`'s current request-stage window is safe and useful,
because structured Flow Bootstrap failures carry their own stage and state and are parsed before
the outer catch consults its mutable fallback state. Moving the fallback stage therefore need not
change any typed provider, budget, permission, output-validation, or persistence failure.

Narrowing the mutable stage alone is not sufficient to prove that a provider request was attempted.
It fixes false request attribution for errors in routing and request setup, but a raw throw from the
top-level harness call can still occur before the harness invokes the provider. The current Flow
Bootstrap diagnostic contract cannot state provider invocation `unknown`; it allows only
`not_attempted` or `attempted`. A wrapper placed merely around
`runAutomationStudioLlmHarness(...)` would therefore retain one inference: that entering the
harness equals attempting the provider.

The narrowest safe first change is diagnostic, not behavioral: shrink the broad stage window,
preserve every typed failure unchanged, and make the untyped boundary distinguish setup from an
actual provider-call boundary. Do not add a retry or a provider-specific exception.

## Files inspected

- `docs/working/mvp-today-plan/reports/t229-run2-reauthor-root-cause.md`
- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
- `runtime/flow-bootstrap/generation-failure/phase-failure.ts`
- `runtime/flow-bootstrap/generation-failure/failure-state.ts`
- `runtime/flow-bootstrap/generation-failure/harness-failure.ts`
- `runtime/flow-bootstrap/generation-failure/harness-vocabulary.ts`
- `runtime/flow-bootstrap/generation-failure/diagnostic.ts`
- `runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts`
- `runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts`
- `runtime/llm/provider-contract.ts`
- `runtime/llm/harness/run.ts`
- `runtime/llm/provider-retry/call.ts`
- `runtime/tests/service-bootstrap/tests/accounting.test.ts`
- `runtime/tests/service-bootstrap/tests/extend.test.ts`
- `runtime/tests/service-bootstrap/tests/fixtures.ts`
- `runtime/tests/service-adaptation/tests/iterating-recovery.test.ts`
- `runtime/recovery/refuted-result/reauthor.ts`
- `runtime/recovery/refuted-result/tests/reauthor.test.ts`

No run artifact, provider content, source/shared-document edit, build, test run, browser/live action,
or commit was performed.

## Why typed failures survive a narrower boundary

The outer catch in `generateFlowBootstrapAdaptation` has three ordered paths:

1. Parse and rethrow an existing `AutomationStudioFlowBootstrapGenerationError` unchanged.
2. Map a typed execution-grant refusal to its dedicated `provider_resolution` code.
3. Only for an unclassified value, construct a failure from the mutable fallback stage/code.

Consequently, these already-structured outcomes do not depend on where the fallback stage variable
currently points:

- provider preflight and request-construction refusals;
- run-budget refusals made before a provider call;
- authentication, rate-limit, timeout, abort, redirect, HTTP, network, and secret failures;
- malformed/invalid/oversized/truncated output and usage failures;
- evidence-loop terminal failures, including final unusable-decision exhaustion;
- permission-required outcomes;
- provider-output validation, post-validation, and persistence failures;
- grant-unavailable, scope-mismatch, no-longer-valid, and invalid-purpose refusals.

`flowBootstrapHarnessFailure` constructs those typed failures from the harness result. Provider retry
also happens below this seam and returns a structured account; narrowing the service's fallback
window must not move or reinterpret it.

## Where the current boundary is too broad

After provider resolution succeeds, `service.ts` immediately sets the fallback stage to
`provider_request`. Before the first evidence-decision harness call, it still performs build routing,
harness-option construction, limit resolution, instruction-authority construction, permission
construction, evidence-runtime checks, draft seeding, and evidence-loop setup. A plain `Error` from
any of these is currently published as:

- `flow_bootstrap.unexpected_error`;
- stage `provider_request`;
- provider invocation `attempted`;
- provider response `unknown`;
- non-retryable.

Only the last and response-unknown facts are conservative. The stage and attempted-invocation claim
are not established by merely having resolved a provider.

Moving the fallback back to `pre_provider_validation` after provider resolution would correctly
classify these setup errors as `not_attempted` / `not_received`. It should use the stage's existing
default rather than adding a new broad taxonomy unless a repeatable setup owner is identified.

## Limit of a harness-level wrapper

Wrapping each call to `runAutomationStudioLlmHarness` with
`automationStudioFlowBootstrapFailureDiagnosticOf(error, "provider_request")` is valuable because
it prevents a later fallback-stage change from relabelling an actual request-path throw. It also
preserves an already-typed failure exactly.

It does **not**, by itself, prove `providerInvocation: attempted`. The harness packs and validates
the request, checks stage and budgets, and reserves run budget before calling
`automationStudioLlmProviderCall`; any raw throw in those operations can precede provider
invocation. Normal expected refusals return a typed result, but an unclassified Core defect can
still escape. The provider contract already has an `unknown` invocation state, while the Flow
Bootstrap diagnostic contract does not.

Therefore either:

1. place the raw-error conversion at the lower provider-call seam where invocation provenance is
   observed; or
2. extend the Flow Bootstrap diagnostic contract to carry invocation `unknown` for a raw harness
   throw and keep `attempted` only for observed request execution.

Option 1 is narrower in published-contract impact. Option 2 is more explicit but expands the
diagnostic parser/state table and every consumer. A service-only wrapper that always says
`attempted` is an improvement over today's broad setup window, but it does not fully close the
false-attribution defect.

## Recommended implementation shape

Avoid growing the already oversized `runtime/service.ts`. Put the request-boundary conversion in a
focused generation-failure module with one export, expose it through the existing barrels, and keep
the service change mechanical:

1. After provider resolution, reset the untyped fallback to pre-request setup rather than
   `provider_request`.
2. Route the actual harness/provider request through the focused boundary. Preserve any parsed
   generation diagnostic unchanged.
3. Do not catch or relabel returned harness failures; continue passing them to
   `flowBootstrapHarnessFailure`.
4. Set `provider_output_validation` only when a provider result is actually in hand, as the direct
   generation path already does. If completion checking inside the evidence loop may throw, give
   that callback its own focused output-validation boundary rather than leaving a request-stage
   marker set for the whole loop.
5. Leave retry, budgets, permissions, grant consumption/revocation, proposal creation, approval,
   application, and replay conditions unchanged.

The exact helper should be small enough that success is a transparent pass-through. A typed failure
must be rethrown with the same complete diagnostic object, including accounting, evidence-loop,
issue-code, and permission-request members.

## Must-pass invariants

### Failure fidelity

- Every structured provider failure retains its exact code, stage, retryability, invocation state,
  response state, provider status/refusal record, accounting, and issue codes.
- Preflight and run-budget refusals remain `not_attempted` / `not_received`.
- Typed provider timeouts, rate limits, HTTP/server faults, and network faults retain their current
  retryability and retry account.
- Provider-output failures remain output-validation failures and keep received-response accounting.
- Grant refusals remain `provider_resolution` failures and retain their dedicated codes.
- Permission-required failures keep their bounded permission request.
- A setup throw before the request does not claim provider invocation or response.
- A raw error whose actual request provenance is unknown is not upgraded to `attempted` merely
  because the harness entry point was called.
- No raw exception message is persisted.

### Success and behavior

- A successful create-mode build produces the same proposal and accounting.
- A successful extend-mode build seeds the existing topology, preserves existing ids, and produces
  the same proposal.
- Wrong-answer reauthor still generates, approves, and applies in that order.
- The Flow is considered reauthored only with `applied: true`; no proposal means no apply or replay.
- Provider-call count, token/cost gates, retry policy, consequence gates, and permission policy do
  not change.
- Grant revocation/retention remains identical on success and each refusal.

## Initial-build and extend-mode risk

`generateFlowBootstrapAdaptation` is shared by initial creation and extend-mode recovery. A change
at its harness seam affects both modes. That is desirable for diagnostic parity but makes a
reauthor-only special case unsafe.

Risks to guard:

- Initial builds must not lose their specific structured provider failures or accounting.
- Extend mode must not change its draft seeding, existing-id preservation, or permission behavior.
- A runtime grant must be presented to the real grant resolver under its exact issued scope. Tests
  must not silently replace its purpose with a convenient fake shape.
- A diagnostic wrapper must not double-wrap typed errors and strip optional fields.
- Resetting fallback stage must not leave successful output validation or persistence under a stale
  pre-request stage.
- The helper must not perform retries; the provider-retry owner remains the only retry seam.

## Focused test approach

Keep the existing service-bootstrap accounting tests for initial-build regression coverage, and add
a dedicated service-adaptation test file for wrong-answer reauthoring rather than expanding the
large service or unrelated test files.

Use `AutomationStudioLlmExecutionGrantService` as production does and wire
`llmProviderResolver` to `grants.resolve(...)`. Drive a successful runtime result into a model
`does_not_answer` verification, then through `repairRefutedResult` into extend mode. Cover:

1. **Pre-request setup throw:** zero provider invocation for the extend, pre-request failure state,
   no adaptation, apply, or replay.
2. **Structured provider failure:** exact provider code, retryability, response/provenance,
   accounting, and retry record survive unchanged.
3. **Raw request-path throw:** stored classification matches the provenance the lower boundary can
   actually prove; no raw text is retained.
4. **Success:** proposal created, automatically approved/applied, `resultReauthor.applied: true`,
   and only then rerun.
5. **Real grant scope:** issued purpose and all scope fields remain exact through verification and
   reauthor provider resolution; the active grant is released once.

Also retain the existing direct extend tests for topology/id behavior and the unit reauthor tests
for generate/approve/apply ordering. The new test should prove only the missing composition: real
grant → refuted result → service callback → extend generation → recorded result.

## Conclusion

The boundary should be narrowed, and structured failures can be preserved exactly. The review does
not endorse treating entry into the harness as proof that the provider was attempted. The safe
change separates pre-request setup from observed request execution, keeps typed outcomes dominant,
and validates both create and real-grant extend paths before any behavioral repair is considered.
