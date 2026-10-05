# Verification deadline accounting fix

## Current State

SOURCE FROZEN; nearest 53 tests/three owners passed, session 91548 exited zero in 12.64 seconds. Root notified immediately on test exit, before report completion. Root independently reproduced the tests-only failure before releasing this exact unit. No provider dispatch hook/source change was needed: unresolved bounded verification remains unknown, while each actual completed intervention is retained. No types/build/audit/full tests, live/provider credential, key/storage/user-state, shared-document, or git actions.

## Change and authority

The runtime creates a completed-check collector before its bounded verification. `verify.ts` emits a first actual completed harness intervention before deciding whether to ask again; the second is emitted after its existing unique-ID adjustment. The collector closes when the outer task settles and supplies a detached array of genuine completed receipts to timeout/abort/throw fallback. Late tasks cannot append to that closed collector or rewrite the saved detail. Ordinary completed reports keep their existing intervention arrays/verdict logic.

`zero-provider-run.ts` now requires affirmative completed verification scope in addition to no historical/current gate/interventions. The actual orchestrator supplies `bounded.settled`; omitted or unfinished scope stays unknown. Pending first-call timeout therefore saves the existing unverified/not-finished outcome without a fabricated gate or zero accounting and cannot qualify as `askedNoModel` replay. Paid first/pending second keeps the first actual `tokenUsage` without inventing the pending second's cost or a whole-run total.

This deliberately does not count provider invocations, replace provider identity, or alter request admission, internal retries, budgets, result-check schedule, permissions, status, key storage, or verification agreement. Unsent preflight remains an authored intervention with no provider/token usage. Completed no-model branch remains explicit zero. Existing recovery receipts remain authoritative and are never overwritten; missing historical accounting remains unknown.

## Owned source and validation

- `runtime/result-verification/run-outcome.ts`: collector lifetime, fallback and affirmative zero-proof forwarding.
- `runtime/result-verification/verify.ts`: optional per-completed-intervention callback.
- `runtime/result-verification/zero-provider-run.ts`: affirmative settled scope required; default omitted proof is unknown.
- `runtime/result-verification/completed-checks/{collector,index}.ts`: cohesive private collector, one exported class through owning barrel; no public result-verification barrel addition.
- Existing nearest `tests/run-outcome.test.ts` and `tests/zero-provider-run.test.ts`: regression assertions and affirmative proof cases. The negative ledger assertion now uses asymmetric equality, which correctly handles absent gate; its previous negative object matcher required an object and would have rejected the intended truthful absence.

Command through heavy wrapper, paired Core cwd:

```text
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts src/programs/automation-studio/runtime/result-verification/tests/zero-provider-run.test.ts src/programs/automation-studio/runtime/result-verification/tests/run-outcome-repair.test.ts
```

Independent supervisor gates and actual disabled public-service execution remain acceptance requirements. This unit does not claim browser/provider-free saved Flow execution was verified.

## Observed final outcome and limits

Actual pending first transport now reaches deadline without a zero gate or replay-recorder call. Paid first/pending second preserves the first real fake-provider receipt's 900/60/960 tokens and $0.001, while leaving second-call/whole-run accounting unknown. Both retain succeeded/unverified status, and released late responses produce no additional detail writes. Unsent-preflight and definite completed no-model controls pass. Unchanged nearest repair orchestration five tests also pass, preserving its existing result/failure routing.

The changed zero helper is already public through the existing result-verification barrel: its additive third boolean proof argument defaults to false, so external callers relying on the old two-argument absence inference now receive unknown rather than a synthetic zero. Existing orchestrator forwards actual bounded settlement; direct owning positive fixtures explicitly supply true. This compatibility change intentionally narrows zero certification and needs supervisor audit/public-contract review. No new public provider observer or runtime-wide accounting field was introduced.

Full changed-file inventory is the five production files listed above and the two existing nearest tests. Root owns independent narrow tests/types/structure/public build and actual public-service zero-provider execution against fresh outputs. No changes to framework, service, provider-retry, harness dispatcher, C4, or downstream source by this worker.
