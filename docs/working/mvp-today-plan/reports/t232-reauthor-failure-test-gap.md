# t232 — Wrong-answer reauthor failure test-gap audit

## Outcome

Run 2 exposed a composition gap, not an uncovered leaf behavior. Core has focused tests for refuted-result routing, creation of a synthetic failed attempt, recovery context, reauthor ordering, successful service-level extend, evidence-loop failures, and generation-failure classification. It does **not** have a test that starts with a model-backed refutation carrying two provider calls and then crosses the real service boundary into an extend-mode reauthor.

That missing case is the smallest regression that matches the run-2 boundary:

> Given an existing applied Flow and a model-backed `does_not_answer` outcome with `calls: 2`, the automatic refuted-result repair must route once into the actual service-backed `mode: "extend"` Flow Bootstrap path using the run's grant/context. The next provider decision must either produce an adaptation that is approved/applied, or return its exact parseable closed failure diagnostic. It must not disappear into a generic/fallback failure, silently skip the provider, or claim an adaptation/persistence/replay that did not occur.

t229 was not available at audit time. The bounded reports and tests do not expose the raw thrown value from run 2, so this audit does not assert why the provider-request stage produced `flow_bootstrap.unexpected_error`.

## What run 2 establishes

- The run reached a model-backed refutation after two verification/diagnosis provider calls.
- Wrong-answer repair and reauthor routing were entered.
- Reauthor reached `provider_request`, recorded provider invocation as attempted and response as unknown, then ended non-retryably as `flow_bootstrap.unexpected_error`.
- No adaptation id, applied change, persistence result, repair-lane record, or replay followed.
- The accepted evidence proves the route was attempted; it does not prove whether the underlying throw came from provider transport, the harness, grant/accounting state, extend composition, or another internal boundary.

## Existing focused coverage

| Test area | What is already covered | What it does not cover |
| --- | --- | --- |
| `runtime/recovery/refuted-result/tests/attempt.test.ts` | A two-call `does_not_answer` verification becomes a failed attempt on the extraction node; non-refutations and missing-node runs do not enter. | No repair callback, service, grant, provider, extend, or reauthor call. |
| `runtime/tests/refuted-result/tests/repair-context.test.ts` | A refuted result automatically enters recovery once; the recovery receives the synthetic failed attempt and bounded context. Its fixture explicitly carries `calls: 2`. | The `repair` callback is a stub returning `undefined`; the test stops immediately before the real reauthor/service boundary. |
| `runtime/recovery/refuted-result/tests/reauthor.test.ts` | Wrong answers route regardless of grant purpose; no-Flow cases refuse; generate → approve → apply ordering is enforced; build failures preserve a supplied closed diagnostic; `applied` is true only after apply. | `generate`, `approve`, `apply`, and `failureCode` are stubs. No real service extend follows a two-call refutation. |
| `runtime/tests/service-bootstrap/tests/extend.test.ts` | A real non-blank Flow can be extended under an exploring grant; existing ids are retained; a missing node can be added; approve/apply changes the existing Flow in place. | All cases start directly at a fresh successful extend. They do not originate in result verification, pre-account two verification calls, or exercise the reauthor failure path. |
| `runtime/tests/service-bootstrap/tests/accounting.test.ts` | Resolver/pre-provider failures, provider/output failures, persistence failures, and raw `Error`/`TypeError`/abort throws are converted into parseable, bounded diagnostics. In particular, a provider-request `Error` becomes `flow_bootstrap.unexpected_error` with attempted/unknown state and no fabricated accounting. | The harness throw is forced on create-mode generation before any previous calls. No existing Flow, refutation, two-call state, extend mode, or automatic reauthor is involved. |
| `runtime/llm/tests/evidence-loop-tool-failure.test.ts` | Tool failures can be observed/retried, are sanitized, and stop under the configured policy/guard. | No result-verification or reauthor service composition. |
| `runtime/llm/tests/unusable-decision.test.ts` | Retriable unusable decisions continue; streaks stop through the caller's error; final unusable-at-`maxIterations` invokes the stalled callback; cancellation and ordinary errors retain their behavior. | Unusable build decisions are unrelated to the later wrong-answer reauthor failure. |
| `flow-bootstrap/generation-failure/tests/diagnostics.test.ts` | Evidence-loop failures, unusable-decision diagnostics, provider/preflight states, bounded accounting, and parser strictness are covered. | No orchestration from result verification into service extend. |
| `flow-bootstrap/generation-failure/tests/round-trip.test.ts` | Every producer phase code round-trips through the parser; arbitrary thrown values receive a closed diagnostic; `unexpected_error` is parseable at `provider_request`. | Round-trip correctness does not establish that the real reauthor invokes the right service path after two calls. |
| `flow-bootstrap/generation-failure/tests/provider-refusal.test.ts` | Provider refusal details are screened, bounded, stored, and parsed; pre-provider refusals do not claim a provider call. | Run 2 published response `unknown`, not a typed refusal, and this test never enters reauthor. |

## Exact missing regression

The missing test must join the seam that every current test stops on one side of:

1. Build an existing, applied Flow.
2. Create a model-backed refutation with `verdict: "does_not_answer"`, code `core.result.does_not_answer_request`, and `calls: 2`.
3. Enter `repairAutomationStudioRefutedRunResult` and allow its real reauthor callback to continue, rather than returning `undefined` from a stub.
4. Assert the reauthor decision routes the existing Flow into `generateFlowBootstrapAdaptation` with `mode: "extend"`, `evidenceGuided: true`, and the intended run grant/context.
5. Assert a provider decision is attempted after the two verification calls. A pre-provider refusal, duplicate/reservation collision, revoked/stale grant, or skipped call must fail the test with its exact diagnostic.
6. For the success branch, return a minimal valid amended plan and assert generate → approve → apply, a non-null adaptation id, `applied: true`, and the existing Flow changed in place.
7. For the failure branch that guards run 2's observed ending, make the provider/harness throw after invocation and assert the reauthor metadata retains the exact parseable diagnostic (`flow_bootstrap.unexpected_error`, stage `provider_request`, non-retryable, invocation `attempted`, response `unknown`), with no adaptation id and no raw error text.

The success branch is the product regression: two earlier verifier calls must not prevent the reauthor from producing and applying an edit. The failure branch protects truthful diagnosis if the provider/harness genuinely fails. Both can share one service fixture and one sequential provider stub; they should not be replaced by another isolated parser assertion.

## Smallest test placement

Preferred minimum: add one service-composition test file:

`packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts`

This directory already owns the junction between result verification and runtime recovery. A dedicated file avoids turning the large context-projection test into a service fixture and keeps the test's subject explicit. Reuse the applied-Flow/service setup pattern from `tests/service-bootstrap/tests/extend.test.ts`; do not duplicate parser-only cases already present in `accounting.test.ts` and `generation-failure/tests/round-trip.test.ts`.

If introducing a new file is undesirable, the next-smallest placement is a single new describe block in `tests/service-bootstrap/tests/extend.test.ts`, but it must invoke the refuted-result repair/reauthor composition rather than merely call extend directly. Adding only another case to `reauthor.test.ts` would leave the service seam untested.

No existing test needs deletion. The localized failure taxonomy/round-trip tests remain necessary because the composition test should assert the public diagnostic, not re-test every code-table row.

## Focused command

From the Core repository, the smallest first run after adding the dedicated regression is:

```text
pnpm exec vitest run packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts
```

The focused seam set before broader Core validation is:

```text
pnpm exec vitest run packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/tests/reauthor.test.ts packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/extend.test.ts packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts
```

These commands are recommendations only; no test, build, browser, provider, or live run was executed for this audit.

## t217 nuance

The unit regression for t217 already exists in `runtime/llm/tests/unusable-decision.test.ts`: a final unusable decision on the last allowed iteration invokes the caller's stalled callback instead of returning generic iteration-limit. Run 2 emitted two unusable decisions but later completed a proposal, so it exercised unusable classification/continuation, **not** the terminal exhaustion case. The t217 final-exhaustion behavior therefore remains unmeasured live and is independent of the Stage-6 reauthor failure audited here.

## Evidence boundary

Read only t226–t228 (t229 was absent) and the named Core focused-test areas. No run artifact, raw provider material, source implementation, shared document, build output, or live system was inspected or changed.
