# t790 unstated-unconfirmed report

## Outcome
Partial. `unsettled.ts` now screens an unsure-plus-no for unstated exclusions, tested and passing. The fix does not reach the builder yet, because `agree.ts` does not pass `wording` on the unconfirmed branch (see Open questions).

## What changed and why
- `agreement/unsettled.ts`: `unstatedExclusion` now runs for both `model_disagreed` and `model_unconfirmed`. Header paragraph added (t790, run-mvswh11y-9d462629, F2).
- `markedAdvice`'s `reasked` argument means "the no's call was asked again and advised the same" (it adds "; asked once more with this named, it advised the same"). It is now `basis === "model_disagreed" && weigh.reasked === unstated.call`, so an unsure-plus-no never claims a re-ask. `exclusion-words.ts` is unchanged; its wording fits.
- New `agreement/tests/unstated-unconfirmed.test.ts` (a hall's events list, made up) with 6 tests:
  - unsure plus a no with an invented exclusion is marked (no "asked once more"), for the no as call 2 and as call 1;
  - advice restating the request's own exclusion is unmarked;
  - no wording means unmarked;
  - the split still marks, and still says "asked once more" when `reasked` is given;
  - a split's restated exclusion is unmarked.
- Tests call `unsettled` directly with a real `automationStudioRequestWording`, and use no casts.

## Commands run and observed results
- `pnpm --filter fluxiq exec vitest run src/.../agreement/tests/unstated-unconfirmed.test.ts` -> 1 file, 6 tests passed.
- Under the heavy-check lock: `pnpm --filter fluxiq exec vitest run $RV/agreement/tests $RV/tests/reask-route/tests` -> 15 files, 89 tests passed. (A first background attempt lost its output file, so I re-ran it and read this result.) The lock was removed afterwards.

## Not verified
- End-to-end through `agree`/`automationStudioResultVerificationAgreement` for an unsure plus no. This is not wired (below).
- Whole-package tsc and the structure audit.

## Open questions or contradictions found
`agree.ts` (not owned) calls `unsettled` for the unsure-plus-no at its last return (line ~92) with `{ refuted }` only. It passes no `wording` or `record`, so `unstatedExclusion` returns undefined there and the mark never fires in a real run. Needed change in `agree.ts`: pass `{ wording: input.wording, record: noRecordOf(input), refuted }` on that call. `reasked` is deliberately not passed. Without that edit, F2 is only fixed at the `unsettled` level.
