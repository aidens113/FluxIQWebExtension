# Verification deadline accounting regression

## Current State

TESTS FROZEN; production unchanged. Final named owner run session 69820 exited one: 47 tests, 45 passed, two meaningful failing cases with four independently observed failing assertions. Supervisor notified immediately after exit; independent reproduction is supervisor-owned. No type/build/audit/full tests, live/provider credentials, user state/key operations, shared-document edits, or git operations.

## Fixture and expectations

Both fixtures run `verifyAutomationStudioRuntimeSessionResult` through the existing authored fake run-detail/dataset/session ports and the real verification/harness/provider-retry orchestration. The fresh observer is the fake transport's actual `provider.runTask`, after harness preflight, not a harness-call counter. Fake timers bound the whole verification while the fake transport remains pending. No network request occurs.

One fixture observes one dispatched pending question, then its actual saved detail; zero accounting and replay qualification must be absent. The other completes a first refutation with the existing scripted provider's real returned usage, reaches its actual confirmation transport, then times out; the first paid intervention must remain and definitive zero accounting must not appear. Both preserve succeeded/unverified status and release their fake pending transport in cleanup. Existing no-provider positive owner cases remain part of the same narrow run.

Command through heavy wrapper, paired Core cwd:

```text
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts src/programs/automation-studio/runtime/result-verification/tests/zero-provider-run.test.ts
```

Production remains read-only pending observed failure and a separate written release.

## Observed outcomes

First run, session 15859: 46 tests/44 passed/two meaningful failures, exit one, 14.95 seconds. The paid-first fixture initially named the retained usage field `accounting`; an approved read of the real intervention projection confirmed the correct public field is `tokenUsage`. The observed empty intervention list was already a genuine failure, but the usage assertion was corrected before final freeze.

Final run, session 69820: 47 tests/45 passed/two failures, exit one, 12.36 seconds. Exact observations:

- Fresh first-question transport observer called once before the clock reached the verification deadline. Saved result remains succeeded/unverified with `core.result.verification_did_not_finish`; its `llmGate` exactly equals the complete zero gate, including calls and pending zero. Adaptation replay recorder was actually called once. Both forbidden claims independently failed via soft assertions.
- Fresh second-question transport observer called twice; the first scripted refutation already returned 900 input tokens, 60 output tokens, 960 total tokens, and $0.001. The second actual transport remained pending. Saved detail has `interventions: []`, rather than the completed first check's `tokenUsage`, and complete zero calls/pending accounting. Both assertions independently failed. These amounts are authored fake usage, not real spend.
- Unsent preflight control passed: the provider's declared measured input exceeds the unchanged context limit, harness refuses before `runTask`, observer and request list remain zero, stored intervention has no provider/token usage, and no provider-call gate is invented. A prepared verification intervention is distinct from an actual provider dispatch; result-verification attempt arithmetic remains unchanged.
- Existing definite no-provider positive cases passed, including explicit zero gate and replay-recorder behavior.
- Both fixtures release their fake pending response after the outer result settles; the saved-detail count remains unchanged. Late verification does not write another verdict/detail. No pending fake timer or real network operation is left behind.

Only changed Core files:

```text
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/zero-provider-run.test.ts
```

No test-support edits. Both tests drive the ordinary existing result-verification orchestration against authored fake ports, inspect its actual `saveFlowRunDetail` output, and observe the underlying fake provider `runTask`. They do not synthesize a gate, inject provider-call records, or execute a full browser/public-service Flow. That broader disabled-constructor public-service execution regression remains a separate acceptance requirement.

## Smallest true capture partition for a separate production release

The loss has two parts: the outer fallback discards completed first-check evidence, and the zero helper treats missing returned interventions as proof no dispatch happened. Repair both together; changing only the fallback list fixes neither a pending first call nor false replay qualification.

1. `result-verification/verify.ts`: emit each completed check's actual intervention to a scoped collector as soon as its harness result returns, before asking confirmation. Preserve returned reports and verdict arithmetic. This retains real `tokenUsage` if a later check hangs.
2. `result-verification/run-outcome.ts`: create that collector and a fresh dispatch observation scope before the bounded task, freeze their snapshot at settlement, and use it in timeout/abort/throw publication. Late completions must not change the saved snapshot or write another result. Preserve succeeded/unverified status and schedule/policy semantics.
3. `result-verification/zero-provider-run.ts`: accept affirmative current observation rather than relying only on empty returned arrays. Pending/attempted/unknown dispatch prohibits definitive zero and `askedNoModel` replay qualification. A finished scope with no actual dispatch keeps the existing positive zero behavior. Existing historical gate/interventions still prohibit overwriting prior accounting.
4. Actual dispatch capture belongs at `llm/provider-retry/call.ts` around `provider.runTask`, reached through `llm/harness/run.ts`. If no existing hook can carry the observer, narrowly add the typed optional observer input through the owning harness input (`llm/harness/task-request.ts`, not yet released/read for this unit). Use a focused scoped observation owner/barrel/tests, not a new coordinator collection. This is an implementation proposal requiring separate exact release.

Track invocation/pending/settled provenance and real paid usage independently of a final verdict. Preflight refusal before this boundary does not count; adapter `not_attempted` must remain unsent. Group internal retry attempts by the existing logical request identity rather than charging them as new questions. If transport outcome remains unknown at outer deadline, publish that unknown/pending fact and known paid first usage; never manufacture missing tokens/cost or definitive zero. Do not replace/decorate a provider in a way that loses existing build-purse/provider identity or permissions. Preserve original generic admission and cost limits.

A verification-local collector must not be advertised as an all-role historical run total: prior recovery accounting remains separately authoritative, and absence of its evidence remains unknown. The concrete fix can first prevent false zero/replay and preserve completed paid evidence without introducing fabricated whole-run totals. Supervisor must independently reproduce the frozen fail-first, release the exact coherent source partition, and verify the final narrow tests/types/public runtime behavior before any live/reuse claim.
