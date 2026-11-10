# Waiting is not a failed save

## Outcome
Partial. The change is made and its tests pass. Two checks are red for causes outside my edits: `pnpm --filter fluxiq check` (the parallel worker's `answer-first/rows/row-sink.ts`) and `pnpm --filter @fluxiq/ui-components check` (`results.test.ts:19`, see below).

## What changed and why
Cause as in Fix 3: a row written at a wait has steps and no candidate, and `savedOf` read that as "notes only, could not save".

- `packages/contracts/src/task-attempts/saved-state.ts`: `notes_only` gains `why?: "still_waiting" | "not_assembled" | "not_saved"` (new exported `AUTOMATION_STUDIO_SAVED_NOTES_WHY`) and `earlierKept?: true` (valid only with `still_waiting`). Parser refuses other values (`saved_state.invalid_why`, `saved_state.invalid_earlier_kept`). Test added in `tests/saved-state.test.ts`. Version 0.18.0 -> 0.18.1.
- `packages/ui-components/src/chat/ports/results.ts`: `ChatSavedState.notes_only` restated with the same fields (a type test holds it equal to the contract).
- `packages/ui-components/src/chat/answer/words/saved-words.ts`: new `notesOnlyWords`.
  - `still_waiting`, `earlierKept`: "this attempt is not finished, and its steps are saved as a Flow when it ends. The steps saved by the earlier attempt are kept."
  - `still_waiting`, no earlier: "... No steps are saved yet."
  - `not_assembled`: "notes only. The steps I took did not fit together as a Flow, so next time I will start from what I learned."
  - `not_saved`: "notes only. Saving the steps failed this time, ..."
  - No `why` (old rows): today's sentence.
  - Test in `tests/left-out-words.test.ts`. Version 0.12.0 -> 0.12.1.
- `answer-first/attempt-store/outcome-of-record.ts`: new `notesWhyOf`. A record's own `draftKept` wins. Otherwise a row whose attempt is `working` or `waiting_for_person` is `still_waiting`, with `earlierKept` when `attempt.startedFrom` is set. An old ended row says nothing.
- To carry the ended reasons (the record did not know them): `attempt-store/record.ts` gains `draftKept`; `attempt-store/store.ts` reads it back (refusing other values); `attempt/ending.ts` passes `draft.why` into `storedEnding` when the draft was kept. These three are outside the named files but are the minimum to make "where the record knows the reason" true.
- `attempt/keep.ts` needed no edit: its row's status already says working or waiting.
- The `fluxiq` package uses `workspace:*` for contracts, so no dependency change.
- Tests: `attempt-store/tests/outcome-of-record.test.ts` has two new cases (waiting with steps reads `still_waiting`, with `earlierKept` when started from earlier steps, never as a failed save; ended `draftKept` reasons).

## Commands run and observed results
- `pnpm --filter @fluxiq/contracts test` -> 99 files, 854 tests passed, exit 0.
- `pnpm --filter @fluxiq/contracts build` -> exit 0 (needed so fluxiq sees the type).
- `npx vitest run src/chat/answer` in ui-components -> 8 files, 82 tests passed, exit 0.
- vitest over `answer-first/attempt` and `answer-first/attempt-store` -> 19 files, 88 tests passed, exit 0. After that I tightened my test types, then reran `outcome-of-record.test.ts` alone: 9 passed.
- Revert check: with `notesWhyOf` forced to return `{}`, the two new outcome tests failed (2 failed, 7 passed). Restored; passes again.
- `pnpm structure:check` -> "structure-audit: passed (526 warning(s), 969 baselined)", exit 0.
- `tsc --noEmit` in `packages/fluxiq` (4 GB heap): no errors in my files. Remaining errors are only in `answer-first/rows/row-sink.ts` (`meets`, `JsonValue` not found), the parallel worker's. So `pnpm --filter fluxiq check` exit 2 for that reason.
- `tsc --noEmit` in ui-components: one error, `src/chat/ports/tests/results.test.ts(19,51)`: `ChatTaskAttempt` vs the contract's attempt (`waitingFor` missing). I did not touch the attempt type; I could not run it at the original commit (no git state changes), so I did not prove it pre-existing. The `saved-words.ts` error I had caused was fixed.

## Not verified
- No end-to-end test that a real waiting attempt's chip reads this way through the service; the outcome-of-record and words tests are separate.
- The extension chat view of the new sentence; not built or run.
- `pnpm --filter fluxiq check` and `pnpm --filter @fluxiq/ui-components check` green: not achieved, see above.

## Open questions or contradictions found
- `results.test.ts:19` failure: likely the contract's wait reasons (they now include "interrupted"-style values) against `ChatTaskAttempt`; whoever owns that should confirm.
- `earlierKept` is true when the attempt started from an earlier attempt's steps (`startedFrom`); it does not check that the earlier steps are still in the task memory.
