# t367 — Downstream sanitizer correction

## Outcome

Corrected the t366 NO-GO. `draftChange.targetedStepIds` is now the only
nested-list seam in a published decision row and is accepted atomically: at
most 16 entries (Core's bound), all strings matching Core's evidence-step-id
grammar, no digest-shaped id, and no duplicates. Any invalid member, excess
member, or wrong scalar type drops the complete `draftChange` record; no list
is filtered or truncated into a different amendment claim.

The other three named progress records and `draftChange` itself now receive
closed-shape runtime validation before the narrower public downstream types are
asserted. Generic one-level records retain their scalar grammar and no longer
gain arbitrary nested scalar lists. Existing top-level scalar-list screening
is unchanged.

## Files changed

- `packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts`
- `packages/test-runner/src/existing-fluxiq-control/tests/publishable-step-value.test.ts`
- `packages/test-runner/src/existing-fluxiq-control/tests/adaptation-evidence-loop.test.ts`
- `packages/test-runner/src/live-llm/tests/build-usage.test.ts`
- `docs/architecture/testing-facility.md`
- this report

The existing `build-proposal.test.ts` proposed/refused test already sends the
same complete public progress row through both readers and requires exact
equality, so it needed no source edit and was included in the focused rerun.

## Regression evidence

- Exact valid proposed/refused progress parity remains pinned.
- Target arrays now cover the 16-entry pass boundary, 17-entry rejection,
  mixed number/boolean values, duplicates, prose, digest-shaped values,
  overlong ids, selector-shaped values, and nested arrays. Each malformed case
  rejects the entire nested record.
- An unrelated nested list is rejected while unrelated legacy scalars and
  top-level scalar lists retain their previous accepted/rejected behavior.
- Invalid named progress states, answerability issue codes, and false-only
  draft flags reject their complete named records.
- Adversarial code-shaped page/hostname/selector/UUID/non-hex-digest-like
  scalars document the syntax screen's limit. The architecture now assigns
  non-content-derived build-local identity provenance to Core and claims only
  bounded syntax downstream.
- The complete `LiveLlmObservedUsage` projection is deep-equal for identical
  decision rows with and without all four progress members. This covers call
  grouping and ids, input/output/total tokens, cost, `perCallRecords`,
  `unrecordedCalls`, totals, accounting, and gate state.

## Validation

- `pnpm --dir packages/test-runner check` — passed.
- `pnpm --dir packages/test-runner build` — passed.
- Focused compiled tests for publishable values, adaptation evidence, build
  proposal parity, and build usage — **49/49 passed**.
- Scoped `git diff --check` — passed.

The first focused run exposed two test/implementation mismatches while
iterating (nested array dispatch occurred before the nested guard, and the
valid fixture supplied optional false flags Core itself omits). Both were
corrected before the clean validation above.

No provider or live run, raw artifact access, commit, or push was performed.
