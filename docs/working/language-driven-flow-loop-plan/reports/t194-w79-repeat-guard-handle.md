# t194-w79: repeat guard and handles not yet shown

## Outcome

Done. The repeat guard no longer refuses a call whose earlier failure was only a handle that had not been shown yet, once a later call on the same page has shown something new. The run-musp39u8 shape (cause C-B1) is now allowed: extract fails with `handle_not_in_packet`, then a detect runs, then the same extract runs. Without the detect, the extract is still refused, and the refusal note now says the handle was never shown and which call shows it.

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`. R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `R/llm/repeat-guard/outcomes.ts`
  - Added `HANDLE_UNSHOWN`, which matches exactly these reasons: `handle_not_in_packet`, `handle_not_issued` and `unknown_handle`. These are the domain's reasons for "never shown or minted". `handle_no_longer_on_page` and `stale_handle` are deliberately left out, because those handles were shown and have since gone.
  - A failed call whose reason matches is recorded with `handleUnshown: true` and is also tracked in an `unshown` map, keyed by call and page.
  - `showed(state)` lifts those failures for that page only. A later call on that page triggers it when it was either:
    - a look that ran, was not refused, and answered differently from the identical look before it (a first look, a detect or a find), or
    - any non-look call that was not refused.
  - Nothing else is lifted: a covered press or any other failure is still refused while the page is unchanged, even after a look. Same-page failures stay refused when the later look was refused, answered the same as before, or ran on another page.
  - Added a header comment that records the run and the rule.
- `R/llm/repeat-guard/feedback.ts`
  - `then.handleUnshown` is now carried in the note.
  - New `HANDLE_UNSHOWN_INSTRUCTION`. It says the handle was never shown and the call itself may be right. It tells the model to look at the page (which lists control handles) or, for a list's extraction handle, to detect the list's repeating structure. After that the same call may be made again.
  - It keeps the phrase "on this exact page", which the existing evidence-loop test asserts.
- Tests (written first and watched fail):
  - `R/llm/repeat-guard/tests/outcomes.test.ts`: two new cases. One covers extract fails, detect, extract allowed; refused again after it fails again; and the `handle_not_issued` and `unknown_handle` family. The other covers a refused look, a same-answer look, a look on another page, and a non-handle failure staying refused after a look.
  - New `R/llm/repeat-guard/tests/feedback.test.ts`: the handle note versus the plain note.
- The guard's input did not need changing. `R/llm/evidence-loop.ts:462` already passes `resultReason: execution.resultReason` into `repeats.recorded`, and step 0025's meta shows `resultReason: "handle_not_in_packet"` reaching the loop. No file outside `repeat-guard/` was edited.

## Commands run and observed results

- After the tests were added and before the fix:
  - `npx vitest run src/programs/automation-studio/runtime/llm/repeat-guard`: 1 failed | 9 passed (missing `handleUnshown`).
  - The feedback test then failed 1 | 11 passed.
- After the fix: repeat-guard 12/12 passed.
- `npx vitest run src/programs/automation-studio/runtime/llm/repeat-guard src/programs/automation-studio/runtime/llm/evidence-loop src/programs/automation-studio/runtime/tests/deepseek-bootstrap` (in packages/fluxiq):
  - First run: 3 failed | 237 passed.
    - `evidence-loop/tests/repeat-guard.test.ts` expected "on this exact page" in the note, because its fixture fails with `handle_not_in_packet`. I fixed this by rewording the new note, not by editing that test.
    - Two `rerun-needs-input` failures passed on an immediate rerun with no change from me, so they were transient, from concurrent edits by other workers.
  - Final run: **Test Files 30 passed (30), Tests 240 passed (240)**.
- `npx tsc --noEmit -p tsconfig.json` (packages/fluxiq): exit 0, no errors.

## Not verified

- No live Lab run.
- The structure audit was not run.
- Not checked: whether a detect result on the real page reports `stateDigests` equal before and after. The lift needs the detect to be keyed on the same page state as the failed read. The fixture assumes this, and the run's detect was a read-only look on the same page.

## Open questions or contradictions found

- A non-look call that ran without refusal also lifts handle failures on its page. That is broader than "a look, a detect, a find", but such a call ran and was answered, so it may have shown handles.
- The note names "detect the list's repeating structure" in words, not by tool id, because Core should not hardcode web tool ids.
