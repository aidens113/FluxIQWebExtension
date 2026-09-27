# t236 — Provider invocation provenance boundary

## Outcome

The lowest boundary that can truthfully distinguish an entered provider adapter from an invoked
transport is inside the DeepSeek adapter, immediately around `input.fetchImpl(...)` in
`runtime/llm/deepseek/provider.ts`. The generic retry seam can prove only that
`provider.runTask(...)` was entered. It cannot prove that the HTTP transport was invoked because
DeepSeek request validation, body construction, token estimation, secret resolution, and a
credential screen all happen inside `runTask` before `fetchImpl`.

Core already has the required three-state provider provenance in the LLM provider contract:
`not_attempted`, `attempted`, and `unknown`, together with response states `not_received`,
`received`, and `unknown`. Provider retry and the LLM harness preserve this provenance. The
information is lost later when `flowBootstrapHarnessFailure` reconstructs invocation state from a
Flow Bootstrap code/stage instead of accepting the harness result's provenance. The Flow Bootstrap
diagnostic contract also cannot currently represent invocation `unknown`.

The minimal truthful owner for transport-level conversion is therefore the DeepSeek adapter. It is
the first layer that knows whether `fetchImpl` has started and whether a response was obtained. The
Flow Bootstrap projection should separately preserve that result instead of re-inferring it. A
service-level or harness-entry wrapper is too high to assert `attempted`.

## Scope inspected

- `docs/working/mvp-today-plan/reports/t234-reauthor-boundary-review.md`
- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
- `runtime/llm/harness/run.ts` and its provenance tests
- `runtime/llm/provider-retry/call.ts` and its focused tests
- `runtime/llm/provider-contract.ts`
- `runtime/llm/deepseek/provider.ts` and directly relevant DeepSeek tests
- `runtime/flow-bootstrap/generation-failure/harness-failure.ts`
- `runtime/flow-bootstrap/generation-failure/diagnostic.ts`
- `runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts`
- `runtime/flow-bootstrap/generation-failure/failure-state.ts` and round-trip tests
- directly relevant service-bootstrap accounting tests

No run artifact, provider content, source/shared-document edit, build, test run, browser/live action,
or commit was performed.

## Call-chain boundaries

The observed chain is:

`runFlowBootstrapLlmHarness` → `runAutomationStudioLlmHarness` →
`automationStudioLlmProviderCall` → `provider.runTask` → DeepSeek `runDeepSeekTask` →
`input.fetchImpl`.

Each boundary proves a different fact:

| Boundary entered | What it proves | What it does not prove |
| --- | --- | --- |
| `runFlowBootstrapLlmHarness` | Flow Bootstrap handed work to the generic harness. | That request packing succeeded or any provider code ran. |
| `runAutomationStudioLlmHarness` | Harness processing began. | That preflight, budget reservation, or provider invocation completed. |
| `automationStudioLlmProviderCall` | Retry/accounting orchestration began. | That a retry attempt entered the adapter. |
| `provider.runTask` | The provider adapter was entered. | That DeepSeek request construction, secret resolution, and the pre-fetch screen succeeded. |
| `input.fetchImpl` | The HTTP transport invocation was attempted. | That a response was received. |
| resolved `fetchImpl` | A response object was received. | That status, content, JSON, envelope, or usage was valid. |

The retry seam's deadline race wraps `provider.runTask`; it cannot safely translate every throw
there to transport `attempted`. An adapter may throw before reaching its transport, as DeepSeek
does for several valid preflight failures.

## Error phase map

### Before provider resolution or adapter creation

Provider selection, grant/resolver checks, invalid secret-reference configuration, invalid model,
and invalid response-size configuration occur before a callable provider is available. These are
preflight conditions and must remain `not_attempted` / `not_received`.

### Harness work before `provider.runTask`

Request packing and validation, unsupported stage/context, dry or unconfigured execution,
per-request budget rejection, and run-budget reservation refusal happen before the provider retry
call. The harness already reports these as `not_attempted`; this is exact provenance.

### DeepSeek adapter work before `fetchImpl`

Inside `runDeepSeekTask`, request validation, timeout validation, request-body construction, token
estimation, budget validation, secret resolution, secret validation, and the credential-in-body
screen occur before the transport call. Failures here are not provider invocations.

Typed construction and setup failures already default to `not_attempted` / `not_received`.
Secret-unavailable failures do as well. A timeout or abort during secret resolution currently uses
the provider contract's conservative `unknown` / `not_received`, because the adapter does not
record whether `fetchImpl` had begun. That classification is safe but less precise than the adapter
could provide.

The public DeepSeek `runTask` wrapper converts an otherwise unclassified escape to
`llm.provider_request_setup_failed`. Normal transport and response failures are caught inside
`runDeepSeekTask`, so this outer fallback describes adapter setup, not evidence of a fetch.

### At transport invocation

The actual invocation boundary is the evaluation of `input.fetchImpl(...)`. Once this call starts,
`providerInvocation: attempted` is justified even if the promise rejects before a response exists.
A transport rejection maps to a network failure, currently `attempted` / `unknown` by contract.

Timeout and abort are subtler because the same codes can arise before or after this line. Their
contract default is therefore `unknown` / `not_received`. A local `fetchStarted` marker is the
smallest mechanism that can safely refine only post-invocation timeout/abort cases to `attempted`
without falsely labelling secret-resolution timeouts.

### After a response exists

Once `fetchImpl` resolves, provider invocation is `attempted` and provider response is `received`.
Redirect refusal, non-success HTTP status, authentication/rate-limit classification, content-type
rejection, bounded-body read failures after receipt, malformed JSON, invalid response-envelope
shape, missing output, and invalid usage all occur after a response object exists. Their exact
provenance is `attempted` / `received` even when no usable model output exists.

The adapter currently assigns these values by provider error-code defaults. The classification is
correct for its known typed cases, but it is code-derived rather than carried by explicit local
`fetchStarted` / `responseReceived` observations.

### Harness output parsing

After the adapter returns successfully, the harness parses and validates the provider result.
Malformed provider output at this layer is still after provider invocation and response and is
reported as `attempted` / `received`. This phase must not be confused with request construction or
transport setup.

## Existing provenance and where it is lost

`provider-contract.ts` already defines and normalizes full provenance. In particular:

- preflight, secret-unavailable, construction, and setup codes default to
  `not_attempted` / `not_received`;
- network failures default to `attempted` / `unknown`;
- timeout and abort default to `unknown` / `not_received`;
- response, output, usage, redirect, authentication, rate-limit, and HTTP failures default to
  `attempted` / `received`;
- an untyped provider throw normalizes conservatively to `unknown` / `unknown`.

`automationStudioLlmProviderCall` preserves a typed provider error's provenance and applies retry
policy without replacing it. `runAutomationStudioLlmHarness` copies that provenance into failed
harness results. Existing harness tests explicitly distinguish `not_attempted`, `attempted`, and
`unknown`, including timeout and refusal-before-send cases.

The loss is in `flowBootstrapHarnessFailure`:

1. Its input type does not accept the harness result's `providerInvocation`.
2. It chooses between pre-provider and resolved-provider mappings based on provider metadata.
3. It derives a new state from the mapped Flow Bootstrap code/stage.
4. The Flow Bootstrap diagnostic type and parser allow only `not_attempted` or `attempted`.

Consequently, a provider result carrying exact or conservative LLM provenance can be relabelled at
the Flow Bootstrap boundary. For example, provider metadata can exist even when a typed adapter
failure says `not_attempted`, and an LLM timeout can carry `unknown` while the Flow Bootstrap
provider-request state says `attempted`.

## Minimal safe ownership and conversion

Two narrowly owned changes would be needed to preserve truth end to end:

1. **DeepSeek transport observation:** in `runtime/llm/deepseek/provider.ts`, record whether fetch
   was started and whether a response was received, or attach explicit provenance when constructing
   each typed failure. This adapter owns the last pre-fetch operation and the transport itself, so
   no higher layer can make the distinction more accurately.
2. **Flow Bootstrap projection:** make `flowBootstrapHarnessFailure` accept and forward the harness
   provenance instead of deriving it from provider presence. The Flow Bootstrap diagnostic contract,
   parser, state validation, and downstream recovery shape must admit `unknown` if conservative
   uncertainty is to survive intact.

The first change improves the precision of DeepSeek failures. The second prevents already-correct
provenance from being discarded. Neither belongs in `service.ts`, and neither should change retry
policy, request behavior, grant lifecycle, or success results.

A raw exception escaping the generic harness does not contain trustworthy transport provenance.
It should remain an internal/setup failure or carry invocation `unknown`; entering the harness must
not be converted to `attempted`.

## Must-pass invariants

- No failure before `fetchImpl` claims provider invocation.
- Once `fetchImpl` starts, a transport rejection may claim `attempted` but not `received`.
- Once a response object exists, later status/body/JSON/envelope/usage failures retain
  `attempted` / `received`.
- Timeout and abort stay conservative unless a local transport marker proves their phase.
- Typed provider error code, retryability, status/refusal metadata, accounting, and retry history
  remain unchanged.
- Provider retry remains the only retry owner; provenance conversion does not add or suppress an
  attempt.
- Harness dry-run, unconfigured, request-validation, and budget refusals remain `not_attempted`.
- Harness result parsing failures remain `attempted` / `received`.
- Flow Bootstrap never infers invocation from the mere presence of provider metadata.
- A structured failure survives service projection without double wrapping or loss of optional
  diagnostic fields.
- Initial build and extend-mode reauthor use the same provenance semantics and keep identical
  success behavior.

## Focused test gaps

The harness suite already covers the three invocation states, and provider-retry tests cover retry
outcomes. The missing direct proof is at the adapter and projection seams:

- DeepSeek tests should count `fetchImpl` calls and assert provenance for request-construction
  failure, secret failure, transport rejection, response-status/content/parse failure, timeout
  before fetch, and timeout or abort after fetch starts.
- A DeepSeek test should distinguish `fetchImpl` entered from response obtained; these are separate
  provenance transitions.
- Flow Bootstrap generation-failure tests should prove that harness provenance is forwarded for
  `not_attempted`, `attempted`, and `unknown`, especially secret-unavailable and timeout cases.
- Flow Bootstrap diagnostic round-trip tests must accept and validate `unknown` if its public
  diagnostic shape is expanded.
- Initial-build and extend-mode service tests should confirm the structured diagnostic reaches the
  stored failure unchanged, while successful proposal/application behavior remains unchanged.

## Conclusion

`fetchImpl` is the first boundary that proves an external transport invocation; `provider.runTask`
only proves entry into provider-owned setup. Core's LLM layers already model this distinction and
preserve provenance through retry and harness execution. Precision should be added where DeepSeek
observes transport state, and the existing provenance should be forwarded—not reconstructed—when
Flow Bootstrap turns a harness failure into its durable diagnostic.
