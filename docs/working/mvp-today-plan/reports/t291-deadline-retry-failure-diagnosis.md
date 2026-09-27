# t291 Deadline-Retry Failure Diagnosis

Date: 2026-09-26
Repository reviewed: `F:\!FluxIQ` (read-only)
Outcome: **Flaky wall-clock test, not a product provenance/retry defect.**

## Exact failure

The failing test is `runtime/tests/deepseek-bootstrap-exploration.test.ts`, **"asks again after a
decision that runs past its deadline"**. It runs a real grant and adapter with `timeoutMs: 3_000`;
the first endpoint response hangs, and later decisions should look and complete.

The loaded root-suite run took 11.265 seconds and failed at the first assertion expecting
`run.failure` to be undefined. The received diagnostic was:

```text
code: flow_bootstrap.provider_transport_unknown
stage: provider_request
retryable: false
providerInvocation: unknown
providerResponse: unknown
provider/model: deepseek/deepseek-flash
estimatedInputTokens: 3229
```

The intended result was a proposed Flow after endpoint iterations `[1, 2, 3]`.

## Timing and control-flow cause

The test's 3-second clock starts outside the grant's provider wrapper, before all of the following
finish for that call:

1. claimed-grant revalidation;
2. reveal-authorization freshness/exchange;
3. secret reveal and post-reveal grant validation;
4. setting `call.credentialReleased = true`;
5. entering the fake DeepSeek endpoint.

When the enforced deadline fires, the grant wrapper distinguishes two security states:

- after credential release, `abandonTimedOutCall` settles and charges the spent call, preserves the
  grant, and lets the evidence loop ask the next decision;
- before credential release, authorization did not complete, so it revokes the grant rather than
  pretending a provider-side call was spent safely.

That distinction is intentional and independently tested. On an unloaded focused run, the first
call reaches the hanging endpoint well inside three seconds, so the timeout occurs after credential
release and the test passes. In the loaded root suite, one of the call-setup phases can lose the
three-second race. The deadline then revokes the grant; the evidence loop's next decision attempt
meets an unavailable grant/raw transport boundary and finishes as
`flow_bootstrap.provider_transport_unknown`.

The test's own comment acknowledges this scheduling dependency (the deadline must not fall before
credential release), but increasing it from an earlier value to three seconds made the assumption
less likely to fail, not deterministic.

## Provenance and retry classification

T233/t239/t243 behavior is correct here:

- an adapter timeout whose request-side position cannot be proved carries invocation `unknown`;
- an untyped failure escaping the harness/request boundary is reduced to fixed
  `provider_transport_unknown / unknown / unknown` provenance;
- no raw authorization or transport text is persisted;
- provider retry does not resend `llm.provider_timeout` inside the same harness call, because the
  evidence loop owns the next decision iteration.

Changing that projection to report `attempted`, or keeping a grant whose authorization was cut off
before credential release, would weaken the safety/provenance invariants. The failure is therefore
not evidence for a product change.

## Smallest deterministic fix

Make this test inject a typed provider-timeout **after the fake endpoint has been entered**, instead
of depending on three seconds of wall-clock scheduling:

1. add a test-only reply variant such as `"timeout_after_send"`;
2. in `endpoint`, after recording the iteration, throw
   `AutomationStudioLlmProviderError("llm.provider_timeout", <fixed test text>, true)` for that
   variant;
3. use it for the first decision, then return `look(2)` and `complete()`;
4. rename the case to say it asks again after a provider deadline failure, and remove its real
   3-second wait.

Entering `endpoint` proves secret resolution completed and the grant set `credentialReleased=true`.
The typed timeout then exercises exactly the contract this integration test owns: the real grant
settles a spent provider call, the provider-retry layer does not duplicate it, the evidence loop
asks again, and the same grant produces a proposed Flow. It completes without a scheduler race.

Do not merely raise the timeout. A larger real timer remains load-dependent, slows the suite, and
can fail again on a sufficiently busy machine. Fake timers plus an endpoint-reached barrier could
also be deterministic, but they are a larger and more fragile change in this filesystem/service
integration fixture.

## Existing deterministic deadline coverage

The wall-clock mechanics do not become untested when this case switches to a typed post-send
timeout:

- `llm/tests/execution-grant/tests/execution-grant-failures.test.ts` explicitly aborts a call at its
  deadline and proves a post-credential timeout settles immediately so the next call proceeds;
- the same file proves a pre-credential deadline revokes the grant;
- `llm/provider-retry/tests/policy.test.ts` proves `llm.provider_timeout` is not retried inside the
  call;
- `llm/harness/tests/run.test.ts` proves timeout provenance remains `unknown`;
- DeepSeek provider tests prove a timed-out parent signal maps to `llm.provider_timeout`.

## Focused deterministic validation

After the fixture-only change, run:

```powershell
pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts `
  src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-failures.test.ts `
  src/programs/automation-studio/runtime/llm/provider-retry/tests/policy.test.ts `
  src/programs/automation-studio/runtime/llm/harness/tests/run.test.ts
```

Then rerun root `pnpm test`, which is the gate that exposed the scheduling race. No production file
needs to change.

No test, build, source/shared-document edit, generated-output command, or live action was performed.
This report is the only file written.
