# t241 — Review of the t233 Core change

## Verdict

t233 correctly fixes the post-resolution **setup** fallback and preserves the ordered handling of
structured Flow Bootstrap and provider failures. Its purpose guard is narrower than the old
rewrite and does not widen capability, consequence permission, budget, retry, approval, apply, or
replay authority.

Two test/semantic limitations remain:

1. A raw rejection from the top-level harness is classified `not_attempted`, although that boundary
   cannot prove whether the provider was invoked. This is the known partial provenance gap from
   t234/t236, not a structured-failure regression. The three-state t239 work is needed before that
   claim is exact.
2. The new extend test does not exercise the wrong-answer reauthor callback or a real issued grant.
   It changes a fixture's purpose by object spread and uses a resolver that does not validate the
   grant. It proves only that a direct extend input's purpose reaches that fake resolver unchanged.

No source/shared document was edited, no live/provider/browser work was performed, and no commit
was made. I did not rerun tests because t239/t240 are changing the shared provenance contract in
the same checkout; a post-integration rerun is the meaningful result.

## Findings

### Medium — raw harness fallback still overstates what is known

`generateFlowBootstrapAdaptation` now leaves the mutable fallback at
`pre_provider_validation / pre_provider_validation_failed` after provider resolution. That is
correct for routing, harness-option construction, limit construction, permission construction,
evidence-runtime access, and every other operation before the harness call. The new setup-getter
test establishes this well: resolver called once, harness never called, no raw text, grant revoked.

The same fallback remains in force while awaiting `runFlowBootstrapLlmHarness`. The added parameter
test injects raw `Error`, `TypeError`, and `DOMException` values directly at that method and expects
`not_attempted / not_received`. Entering the harness does not prove an attempt, but neither does a
raw rejection prove no attempt: packing, provider invocation, response handling, and unexpected
internal throws all lie below the method boundary.

Expected disposition: keep t233 as the safe service-owned partial, but do not treat the raw-harness
test as final provenance. After t239, structured harness results must forward
`not_attempted | attempted | unknown`; any genuinely unclassified harness escape should remain
`unknown` unless a lower boundary proves otherwise.

### Medium — purpose test does not cover the changed reauthor path

The production hunk in the wrong-answer reauthor callback preserves an existing
`build_and_adapt` or `explore_and_adapt` purpose, rejects every other purpose before calling
generation, and refreshes only the pre-existing binding fields. That implementation is correctly
narrow.

The new test in `extend.test.ts` does not reach that callback. `exploringGrant` constructs a plain
fixture with `explore_and_adapt`; the test then passes `{ ...issued, purpose: "build_and_adapt" }`
directly to `generateFlowBootstrapAdaptation`, and the fake resolver accepts it without performing
real grant lookup or scope validation. The assertion therefore proves pass-through at the direct
generation entry point, not preservation of an exactly issued purpose through:

`does_not_answer` → reauthor decision → extend generation → resolver.

It also does not establish actor/session identity, permitted consequences, execution digest,
settings revision, grant consumption, approval/application ordering, or replay gating. The test
title should not be read as proof of exact issued scope.

Required follow-up: the real-grant composition test already called for by t233/t234, with both
admitted purposes if practical, plus a refusal case for a non-admitted purpose.

### Low — the fallback comment is stale

The catch comment above `flowBootstrapPhaseFailure(...)` still says the stage default claims that a
request was attempted. With the t233 fallback reset, that is no longer true for post-resolution
setup or raw harness escapes; the active default there is pre-provider validation. Updating the
comment alongside the provenance follow-up would prevent a future maintainer from restoring the
old broad stage for the wrong reason.

## Structured provider-failure fidelity

No structured-provider regression is visible in the changed service control flow:

1. `parseAutomationStudioFlowBootstrapGenerationError(error)` still runs first in the catch.
2. A parsed diagnostic is reconstructed without changing code, stage, retryability, invocation,
   response, accounting, issue codes, evidence-loop detail, or permission request.
3. Typed execution-grant refusals still take the dedicated `provider_resolution` mapping next.
4. Only the final unclassified fallback uses the changed mutable stage/code.
5. Returned harness failures still become `flowBootstrapHarnessFailure(...)` before reaching the
   outer catch.
6. Successful output, post-validation, and persistence failures still move to their existing
   later stages and retain accounting.

The added t233 tests do not directly inject a structured provider failure with all optional fields
and assert byte-for-byte diagnostic preservation. Existing lower-layer projection tests reduce the
risk, but the t239/t240 regression set should include this exact service-boundary case.

## Authority and scope review

- **Purpose:** narrowed to two values already admitted for extend generation. No arbitrary purpose
  is upgraded to `explore_and_adapt` anymore.
- **Capabilities/task kinds:** unchanged by these hunks. The callback does not add a task kind or
  synthesize a broader grant.
- **Consequences and permissions:** `permittedConsequences` remains part of the spread grant;
  existing plan/action permission gates are unchanged.
- **Binding:** `executionDigest` and `settingsRevision` are refreshed exactly as before. This is not
  byte-for-byte issued-scope preservation and needs the real-grant test.
- **Budgets and retry:** provider resolution, token limits, call limits, cost limits, timeouts, and
  provider retry ownership are untouched.
- **Lifecycle:** proposal review, approval, application, rerun, and grant revocation branches are
  unchanged by the reviewed t233 hunks.

## Test adequacy

The accounting additions adequately prove:

- post-resolution setup stays pre-request;
- the harness is not called for that setup failure;
- raw text is not persisted;
- the grant is revoked;
- a failed raw-harness path creates no topology.

They do not prove:

- exact provenance for a raw failure after an actual provider call;
- fidelity of a complete structured provider diagnostic through the service catch;
- wrong-answer reauthor composition with a real grant;
- full grant-scope preservation and consumption;
- proposal → approve → apply → replay ordering after a successful reauthor.

The extend addition adequately proves only direct resolver-input purpose pass-through. It is not a
substitute for the missing composition test.

## Rerun recommendation after t239/t240

A rerun is justified and should be mandatory after both changes settle, because they affect the
diagnostic/harness shapes consumed by these service paths. Run at minimum:

```powershell
pnpm --filter fluxiq test -- `
  src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts `
  src/programs/automation-studio/runtime/tests/service-bootstrap/tests/extend.test.ts `
  src/programs/automation-studio/runtime/recovery/refuted-result/tests/reauthor.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/provider-refusal.test.ts `
  src/programs/automation-studio/runtime/llm/harness/tests/run.test.ts

pnpm --filter fluxiq check
```

Then run Core's full `pnpm check`, `pnpm test`, and `pnpm build` gates. A new live/provider run is
not justified by t233 alone; it becomes useful only after the provenance integration and real-grant
composition tests pass, so a rerun measures the completed path rather than another known partial.
