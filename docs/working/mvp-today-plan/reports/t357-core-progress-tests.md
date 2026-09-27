# t357 — Core progress tests

## Result

Complete. The loop-level progress contract now has deterministic coverage for draft
revision transitions, stable step identity, bounded amendment counts, page-state
digests (including iteration zero), answerability transitions, failed/refused visible
actions, and the draft measurement shown to each decision.

## Files changed

- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop-progress.test.ts`
  - Added a real loop sequence covering action append, refused edit, reorder, drop,
    accepted rerun withdrawal, rerun replacement, and completion.
  - Pins exact draft revision transitions and `draftState` values.
  - Pins stable `d1`/`d2` identities across reorder and withdrawal, new replacement id
    `d3`, targeted ids, applied/refused/kept counts, and `rerunStepId`.
  - Pins equal/different/missing digest pairs to
    `unchanged`/`changed`/`unobserved` for both ordinary calls and the
    iteration-zero initial observation.
  - Pins first/repeated/changed answerability snapshots and content-free publication.
  - Pins the per-row draft measurement actually shown before each transition.
  - Pins a refused model-visible action as one structural revision despite
    `effectApplied: false`.
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop.test.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop-tool-failure.test.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/unusable-decision.test.ts`
  - Reconciled exact legacy row assertions with the new mandatory `progress` member.

No production file, provider/live artifact, shared plan, commit, or push was changed by
this worker.

## Production defect found

The first regression run showed that `draft: false` still incremented draft revisions:
the loop accrued returned steps and treated their proposability as model-visible draft
progress even though it published no draft. This contradicted the content-free contract.
The supervisor corrected production so steps still accrue but `draftRecord` reports a
revision change only while drafting. The regression assertion then passed.

The t358 integration review then found two further production mismatches. The supervisor
changed draft visibility to use `automationStudioFlowDraftStepIsAction`, so failed and
refused actions shown to the next decision increment the revision, and bracketed the
iteration-zero observation with the digest hook. Tests now pin both corrections. No
additional production defect was found in the post-review run.

T358 also requested strict rejection of duplicate `targetedStepIds` in the stored-step
parser. That parser and its projection tests live under `runtime/flow-bootstrap/`, outside
this worker's allowed `runtime/llm/` test partition, so this report routes that assertion
to the projection-test owner rather than editing it here.

## Validation

Final post-fix command:

```text
pnpm --filter fluxiq exec vitest run \
  src/programs/automation-studio/runtime/llm/tests \
  src/programs/automation-studio/runtime/llm/evidence-loop/tests
```

Post-t358-review result: 35 test files passed, 394 tests passed, 0 failed.

`git diff --check` passed for the four owned test files. No repository-wide validation
was run, per brief.
