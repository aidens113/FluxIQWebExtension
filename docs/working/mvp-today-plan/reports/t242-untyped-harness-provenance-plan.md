# t242 — Untyped top-level harness provenance plan

## Outcome

After t239, the smallest correct change is a scoped harness-call wrapper inside
`generateFlowBootstrapAdaptation`. It should convert only exceptions escaping
`runFlowBootstrapLlmHarness` with
`automationStudioFlowBootstrapFailureDiagnosticOf(error, "provider_request")`, then throw an
`AutomationStudioFlowBootstrapGenerationError` carrying that diagnostic.

This produces `providerInvocation: "unknown"` for an untyped harness escape without claiming that
the provider was called. It leaves the outer mutable fallback at
`pre_provider_validation`, so routing, option construction, permission setup, evidence-runtime
access, and every other operation before entering the harness remain
`not_attempted / not_received`. Structured failures remain dominant because the conversion helper
returns an existing valid diagnostic unchanged and the outer catch still parses structured errors
before considering any fallback.

No additional diagnostic, parser, phase-state, provider, retry, or DeepSeek contract change is
needed after t239.

## Why t239 makes this possible

The current t239 state already provides all required semantics:

- `AutomationStudioFlowBootstrapFailureDiagnostic.providerInvocation` admits `unknown`;
- provider-request defaults and unclassified request codes canonically use `unknown`;
- `flow_bootstrap.aborted_or_timed_out`, `internal_error`, `unexpected_error`,
  `provider_request_failed`, and `provider_transport_unknown` accept the compatible historical
  `attempted` form while producing `unknown` when provenance is not observed;
- the parser admits `unknown`, rejects impossible response/invocation combinations, and preserves
  legacy compatible records;
- `automationStudioFlowBootstrapFailureDiagnosticOf` first parses an existing structured failure
  and only otherwise creates a phase failure;
- `flowBootstrapHarnessFailure` now forwards observed harness provenance for returned harness
  failures.

The remaining defect is solely the location at which `service.ts` invokes the constructor: its
outer catch still sees a raw harness rejection while the mutable fallback is deliberately held at
pre-provider setup.

## Exact source change

File:
`packages/fluxiq/src/programs/automation-studio/runtime/service.ts`

Inside `generateFlowBootstrapAdaptation`, immediately after provider resolution and before the
instruction-authority/evidence-loop setup, define one local function with the same input/output as
`runFlowBootstrapLlmHarness`:

```ts
const runHarness = async (request: AutomationStudioFlowBootstrapHarnessInput) => {
  try {
    return await this.runFlowBootstrapLlmHarness(request);
  } catch (error) {
    throw new AutomationStudioFlowBootstrapGenerationError(
      automationStudioFlowBootstrapFailureDiagnosticOf(error, "provider_request")
    );
  }
};
```

Use the actual existing request type rather than introducing the illustrative name above if that
type is inferred today. A generic local closure with an inferred parameter from the private method
is preferable to a new public type.

Route all three harness paths through this one closure:

1. `automationStudioFlowBootstrapInstructionAuthority({ run: ... })`;
2. the evidence-loop `decide` callback;
3. the direct non-evidence Flow Bootstrap request.

Do not move the outer `failureStage` to `provider_request`. Doing so would again classify unrelated
completion checks, tool execution, permission handling, or other post-call work by whatever stage
the last request left behind. The scoped wrapper owns only the exception crossing the harness
boundary.

Do not catch returned `ok: false` harness results in this wrapper. Existing call sites must continue
to pass those through `automationStudioLlmUnusableDecisionError` or
`flowBootstrapHarnessFailure`, which now preserve t239's observed provenance and complete
accounting.

## Resulting classification

| Failure location | Code/stage | Invocation/response |
| --- | --- | --- |
| post-resolution setup before `runHarness` | existing pre-provider code or fallback at `pre_provider_validation` | `not_attempted / not_received` |
| raw `Error` escaping `runHarness` | `flow_bootstrap.unexpected_error` at `provider_request` | `unknown / unknown` |
| raw `TypeError` or `RangeError` escaping `runHarness` | `flow_bootstrap.internal_error` at `provider_request` | `unknown / unknown` |
| raw `DOMException` escaping `runHarness` | `flow_bootstrap.aborted_or_timed_out` at `provider_request` | `unknown / unknown` |
| non-Error/hostile unclassified escape | `flow_bootstrap.provider_request_failed` at `provider_request` | `unknown / unknown` |
| existing structured Flow Bootstrap error | exact existing diagnostic | unchanged |
| returned failed harness result | mapped by `flowBootstrapHarnessFailure` | exact t239 harness provenance |
| successful provider result followed by validation/persistence failure | existing later stage | `attempted / received` with existing accounting |

No raw error message is stored in any of these paths.

## Exact test changes

### Service boundary

File:
`runtime/tests/service-bootstrap/tests/accounting.test.ts`

Keep the t233 test `does not claim a provider request when post-resolution build setup throws`
unchanged. It is the regression that proves the fallback outside the scoped harness remains
`pre_provider_validation / not_attempted / not_received`, the resolver ran, and the harness did
not.

Replace the t233 raw-harness parameter test's description, comment, and expected diagnostic:

- `Error` → `unexpected_error / provider_request / unknown / unknown`;
- `TypeError` → `internal_error / provider_request / unknown / unknown`;
- `DOMException` → `aborted_or_timed_out / provider_request / unknown / unknown`.

Continue asserting:

- the raw text is absent;
- the harness was entered exactly once;
- no accounting was fabricated;
- the grant was revoked under the existing rule;
- no topology/adaptation was created.

Exercise both harness call shapes: at least one direct non-evidence request and one
`evidenceGuided: true` decision request. This guards all local call-site replacements rather than
only the easiest direct branch.

Add one structured-dominance case in the same file: make the mocked private harness reject with a
valid `AutomationStudioFlowBootstrapGenerationError` containing a provider-request diagnostic and
bounded optional accounting, then assert exact diagnostic equality after
`generateFlowBootstrapAdaptation` rejects. This proves the new wrapper and the existing outer
catch do not double-wrap or strip structured fields.

### Constructor/state regression

File:
`runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts`

Strengthen the existing `automationStudioFlowBootstrapFailureDiagnosticOf` parameter cases to
assert the complete state for provider-request raw throws, not only code and stage:

- retryable `false`;
- invocation `unknown`;
- response `unknown`;
- no accounting;
- parser round-trip equality;
- no raw message.

Add or retain the hostile/non-Error case producing the provider-request default with
`unknown / unknown`.

No new test file is needed. The t239 diagnostics/projection tests should be rerun because this
service change depends on their accepted-state matrix, but they need no new production behavior.

## t233 comments and assertions that must change

Yes. The following t233 text becomes incorrect after the scoped wrapper:

- The accounting-test comment saying a raw harness throw “stays on the pre-request side” must say
  that the boundary cannot determine invocation and therefore records `unknown`.
- The test title `does not claim a provider attempt ... at the unobserved harness boundary` should
  be renamed to state the positive contract: it records unknown invocation.
- Its expected stage, code, invocation, and response must change as listed above.
- The service catch comment claiming the active stage default says “a request was attempted” is
  already stale after t233 and must be rewritten. It should explain that the outer fallback is for
  non-harness setup, while raw harness exceptions are converted at the scoped request boundary.
- The t233 report remains historically accurate as a partial implementation record; do not rewrite
  it as though t239/t242 had already existed.

## Validation

Focused commands after implementation:

```powershell
pnpm --filter fluxiq test -- `
  src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/provider-refusal.test.ts `
  src/programs/automation-studio/runtime/llm/harness/tests/run.test.ts

pnpm --filter fluxiq check
```

Then rerun Core's full `pnpm check`, `pnpm test`, and `pnpm build` gates. No live/provider run is
needed to validate this classification-only change.

## Smallest coherent unit

The smallest coherent post-t239 unit is one production file and two test files:

1. add one scoped local wrapper and route three harness call sites through it in `service.ts`;
2. update the t233 service-boundary expectations and add structured-dominance coverage in
   `accounting.test.ts`;
3. strengthen the existing raw-throw state assertions in `round-trip.test.ts`.

This records uncertainty without claiming a call, preserves exact `not_attempted` setup failures,
and leaves every structured provider/harness failure authoritative.
