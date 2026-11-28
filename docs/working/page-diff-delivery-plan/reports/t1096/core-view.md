# t1096 core-view report

## Outcome
Partial. Code and tests are written; the final vitest run, the type check and the structure audit did not run, because the heavy-slot queue held the job for a long time.

## What changed and why (Core, task/t1096-manual-run-loop-fixes)
- `view-channel/binding.ts`: an unavailable full-page capture is now `{ok:false, code:"core.full_page.unavailable", message}`. The loop then un-registers it, so the identical retry really captures. The message names the newest page key any result carried, or says no page is held. The old "still current" claim is gone. Capture timing is unchanged.
- `view-channel/projection.ts`: a `core.full_page` capture is delivered with the non-extra lines first and the extra lines after, each in page order, so part 1 is the visible page. Base reset and diffs are unchanged. The projection also returns `split` (callId to `{parts, shown}`), which counts parts the model asked for.
- `evidence-loop/answered-request.ts`: the note takes optional `splitPage` and, when parts remain, appends the parts not yet shown and "call core.full_page with part N".
- `decision-handlers/answered-request.ts` (outside the owned list, not on the must-not-touch list): a small edit that computes `splitPage` from the projection and passes it to the note. This is needed to wire the note. Please accept or reassign.
- Tests added: `view-channel/tests/binding.test.ts` (unavailable refusal; evidence-loop level, the second identical call runs and captures), `view-channel/tests/projection.test.ts` (visible-first split), `evidence-loop/tests/answered-split-page.test.ts`.

## Commands run and observed results
- First vitest run of view-channel, decision-handlers and the new note test: 27 files passed, 124 tests passed. `projection.test.ts` failed to transform because I had written a broken string literal; that is fixed. This run was before the later test additions (the loop-level binding test and the split-page test in projection) were executed.
- Real-data measurement (scratch script `scratchpad/measure-t1096.mjs`, step 0049, 2262 lines of which 2033 are extra, budget 20000):
  - Today's order: 10 parts, part 1 is 19920 chars with 204 extra lines, and "Next page" is not in part 1.
  - Visible-first order: 10 parts, part 1 is 19988 chars with 15 extra lines, and "Next page" is in part 1.
- Re-run of the view-channel tests and a tsc type check are queued as `t1096-view-b` and `t1096-view-c`. Output goes to `scratchpad/v4.out` and `scratchpad/tsc4.out`, with a marker file `v4.done`.

## Not verified
Whether the edited projection and binding tests pass. The type check. The Core structure audit. The last vitest re-run could not start while queued.

## Open questions
- The edit to `decision-handlers/answered-request.ts` is outside the owned list.
- The loop-level test passes `pageChannel` and `pageView` through `runAutomationStudioLlmEvidenceLoop`. Its exact input shape is unconfirmed until the type check runs.
