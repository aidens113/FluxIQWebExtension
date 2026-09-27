# t237 — Minimal Core provenance fix file plan

## Decision

The minimal correctness fix is confined to Flow Bootstrap's harness projection and diagnostic
contract. No production edit is required at the DeepSeek, provider-contract, or provider-retry
layers: they already distinguish known pre-call failures, known transport calls, received
responses, and genuinely ambiguous deadline/cancellation outcomes. The defect is that Flow
Bootstrap discards that three-state fact and reconstructs every `provider_request` as
`attempted`.

`unknown` is necessary. The retry deadline can win its race with provider work without knowing
whether the adapter reached `fetchImpl`, and the harness intentionally reports `unknown` for that
case. A binary `not_attempted | attempted` diagnostic must invent one answer. Preserving
`unknown` is the smallest truthful contract change.

This plan does not add DeepSeek-local transport markers. They could refine some adapter-owned
timeout/abort cases later, but cannot remove the generic retry deadline's legitimate ambiguity and
are not needed to stop Flow Bootstrap's false `attempted` attribution.

## Files inspected

- `docs/working/mvp-today-plan/reports/t236-provider-invocation-provenance.md`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/provider.ts`
- `runtime/llm/provider-contract.ts`
- `runtime/llm/provider-retry/call.ts`
- `runtime/llm/provider-retry/account.ts`
- `runtime/flow-bootstrap/generation-failure/harness-failure.ts`
- `runtime/flow-bootstrap/generation-failure/diagnostic.ts`
- `runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts`
- `runtime/flow-bootstrap/generation-failure/failure-state.ts`
- directly corresponding tests under those owners

No source/shared-document edit, build, test run, live/provider/browser action, or commit was
performed.

## Exact production edit plan

### 1. Widen the durable Flow Bootstrap diagnostic

File:
`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/diagnostic.ts`

Change `AutomationStudioFlowBootstrapFailureDiagnostic.providerInvocation` from
`"not_attempted" | "attempted"` to
`"not_attempted" | "attempted" | "unknown"`.

Use `AutomationStudioLlmProviderInvocationState` if importing that type through the LLM barrel
preserves the existing dependency direction; otherwise retain the literal union locally and add a
compile-time synchronization assertion. Do not create a second runtime vocabulary.

### 2. Forward the harness fact at the projection boundary

File:
`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/harness-failure.ts`

Change `flowBootstrapHarnessFailure` to accept the harness result's
`providerInvocation: AutomationStudioLlmProviderInvocationState`. Thread it through the private
`harnessFailure` input and into failure-state selection.

Keep provider metadata for provider/model accounting and code projection only. Its presence must
not decide invocation. This preserves the existing distinctions:

- a resolved provider can still fail preflight or secret resolution without a request;
- a transport failure can prove `attempted` without proving a response;
- a deadline race can remain `unknown`.

Make the field required on this harness projection. Every `AutomationStudioLlmTaskResult` already
has it, and requiring it prevents a future caller from silently falling back to provider metadata.
Update direct unit-test literals accordingly.

### 3. Split canonical production state from accepted stored state

File:
`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/failure-state.ts`

Today `providerState` hardcodes `providerInvocation: "attempted"` for every
`provider_request` code. Replace that single rule with code-specific invocation semantics and an
explicit allowed-state set used by the parser.

The canonical state for producers that have no observed harness provenance should be:

| Failure family | Canonical invocation |
| --- | --- |
| pre-provider stages and provider preflight codes | `not_attempted` |
| provider secret unavailable | `not_attempted` |
| authentication, rate limit, redirect, HTTP, network, and response/output failures | `attempted` |
| timeout, abort, transport unknown, and unclassified provider-request throws | `unknown` |

For a harness-originated failure, select the supplied invocation only when it is allowed for that
code/response relationship. The state module should expose that acceptance rule rather than make
the parser duplicate it.

Keep compatibility explicit:

- accept historical `attempted` records for timeout, abort, and transport-unknown families;
- accept the newly preserved `unknown` form for genuinely ambiguous outcomes;
- do not let a received response pair with `unknown` or `not_attempted`;
- do not let `not_attempted` pair with `received` or an unknown response;
- keep pre-provider stages strictly `not_attempted / not_received`.

An implementation shape that preserves the one-table design is to add allowed invocation states
to `AutomationStudioFlowBootstrapFailureState` (or return them from a sibling function owned by
this file), while retaining one canonical `providerInvocation` for phase-failure producers. Do not
make the parser blindly echo any stored invocation.

### 4. Parse the widened state without erasing old records

File:
`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts`

Admit the `unknown` literal. Replace exact equality with the canonical
`state.providerInvocation` by membership in the state module's allowed invocation set. Continue
checking retryability, response state, accounting requirements, and every bounded optional field.

Add the relational guards described above. They are necessary because accepting an invocation set
must not make an impossible combination, such as `unknown / received`, parse as Core's own record.

## Files that should not change

### DeepSeek adapter

`runtime/llm/deepseek/provider.ts` already produces safe provenance:

- construction/setup and secret-unavailable errors are `not_attempted / not_received`;
- a fetch rejection becomes network error, `attempted / unknown`;
- response/status/body/envelope failures are `attempted / received`;
- timeout/abort remain conservatively `unknown / not_received` where the phase can race.

Adding `fetchStarted` or `responseReceived` flags is an optional precision improvement, not part of
the minimal fix. It would not settle a failure emitted first by the generic enforced deadline.

### Provider contract and retry call

`runtime/llm/provider-contract.ts` already exports the three-state
`AutomationStudioLlmProviderInvocationState`. `AutomationStudioLlmProviderError` carries explicit
provenance, `normalizedAutomationStudioLlmProviderFailure` preserves it, and an untyped throw is
conservatively `unknown / unknown`.

`runtime/llm/provider-retry/call.ts` returns the normalized final failure unchanged. No conversion
belongs at `provider.runTask`, because adapter-owned pre-fetch work happens below that call.

`runtime/llm/provider-retry/account.ts` records code, status, retryability, and timing for earlier
failed attempts but not provenance. Do not widen that record for this fix: the final failure
already carries the state Flow Bootstrap needs. Attempt-by-attempt invocation provenance remains
unmeasured; adding it would be a separate persisted-contract/instrumentation change with its own
compatibility review.

## Exact test edit plan

### Flow Bootstrap projection and parser

Update:

- `runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`
- `runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts`
- `runtime/flow-bootstrap/generation-failure/tests/provider-refusal.test.ts`

Cover these cases:

1. Harness `not_attempted` survives projection even when provider metadata exists.
2. Harness `unknown` timeout/transport failure survives projection and parses back.
3. Harness `attempted` network and response failures remain attempted.
4. A received response with `unknown` or `not_attempted` invocation is rejected.
5. A pre-provider failure with any invocation except `not_attempted` is rejected.
6. An older stored timeout/abort/transport diagnostic with `attempted` still parses.
7. A new canonical phase failure for an ambiguous provider-request throw uses `unknown`.
8. Provider-refusal and accounting fields remain unchanged and bounded.

Update every direct `flowBootstrapHarnessFailure` fixture to provide `providerInvocation`. Do not
weaken a fixture by making the new field optional.

### Existing lower-layer regressions

Rerun without production changes:

- `runtime/llm/harness/tests/run.test.ts` — already proves `not_attempted`, `attempted`, and
  `unknown` harness results;
- `runtime/llm/provider-retry/tests/call.test.ts` — confirms retry disposition and final failure
  remain unchanged.

No new DeepSeek test file is required for this minimal projection fix. If transport markers are
later added, create `runtime/llm/deepseek/tests/provider.test.ts` and separately test pre-fetch,
fetch-rejected, and response-received phases.

## Compatibility and public-contract impact

`AutomationStudioFlowBootstrapFailureDiagnostic` is a published Automation Studio type and a
persisted diagnostic shape. Adding `unknown` is a widening change for writers and a compatibility
event for readers:

- existing stored diagnostics remain readable when the parser accepts legacy `attempted` for the
  historically ambiguous families;
- older runtimes will reject a new diagnostic containing `unknown` and may degrade it to generic
  failure handling;
- TypeScript consumers with exhaustive two-state switches must add an `unknown` arm;
- downstream wire/schema mirrors and recovery result types that repeat the binary union must widen
  in the same release unit;
- no provider API, provider retry API, retry policy, request count, cost, grant, or success-flow
  behavior changes.

Because mixed-version readers can lose the richer failure, Core and the downstream Web Extension
must update their mirrored contracts together before the widened value is emitted in a released
path.

## Focused validation commands

From `F:/!FluxIQ`:

```powershell
pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/provider-refusal.test.ts `
  src/programs/automation-studio/runtime/llm/harness/tests/run.test.ts `
  src/programs/automation-studio/runtime/llm/provider-retry/tests/call.test.ts

pnpm --filter fluxiq check
```

After the focused checks pass, run Core's required repository gates before merge:

```powershell
pnpm check
pnpm test
pnpm build
```

Then run the downstream typecheck and its focused recovery/Flow Bootstrap tests in the paired task
before either repository is integrated.

## Smallest coherent implementation unit

The smallest coherent Core unit is four production files and three Flow Bootstrap test files:

1. widen the diagnostic type;
2. forward harness provenance;
3. centralize canonical and accepted invocation states;
4. parse the widened relation;
5. prove new truth, impossible combinations, and old-record compatibility.

DeepSeek, provider-contract, provider-retry, and retry-account source remain unchanged. This fixes
the false attribution at the exact layer that introduces it while preserving the lower layers'
existing structured failures and success behavior.
