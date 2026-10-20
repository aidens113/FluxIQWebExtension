# t741 b3-excerpt report

## Outcome

Done. A build or repair brief's `recordingExcerpt` now reaches the builder at its opening look.

## What changed and why

Core `packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/run-brief.ts`:

- The cause: the contract (`contracts/subflow-brief.ts`) parses `recordingExcerpt` and the supervisor
  counts it, but `run()` built the opening look's `shown` object only from `repairOf`/`startsFrom` and
  `earlierAttempt`. Nothing ever passed the excerpt to the builder.
- The fix: when `brief.recordingExcerpt` is defined, `shown` also gets
  `recordingNotes: { excerpt, note }`. It sits beside `repairOf`/`startsFrom` and `earlierAttempt` and
  travels through the existing `shownAtOpening` wrapper. `NOTES_NOTE` uses generic wording: the
  excerpt is the supervisor's notes from the person's recording, evidence to weigh rather than
  instructions, and what the page shows now and the brief's parts decide what gets built.
- A brief without an excerpt adds nothing to `shown`. When `shown` is empty, the loop is not wrapped,
  exactly as before. So that brief's opening is unchanged.
- I added a header paragraph (t741 B3) and updated the `shownAtOpening` doc comment. The file grew
  from 542 to 556 lines, well under the 800-line budget, and I added no new source file.

New test: `project-agents/dispatch/tests/recording-notes.test.ts`. It runs the real builder loop on a
scripted model with two briefs, one plain and one with an excerpt. It checks that:

- the plain brief's opening has no `recordingNotes`;
- the noted brief's `recordingNotes.excerpt` equals the excerpt;
- the note contains the framing words;
- the noted opening minus `recordingNotes` matches the plain opening byte for byte (`JSON.stringify`).

## Commands run and observed results

- Test first, before the fix:
  `cd C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ/packages/fluxiq && pnpm exec vitest run src/programs/automation-studio/runtime/project-agents/dispatch/tests/recording-notes.test.ts`
  -> 1 failed: `Cannot read properties of undefined (reading 'excerpt')` (no `recordingNotes` shown).
- After the fix:
  `pnpm exec vitest run src/programs/automation-studio/runtime/project-agents/dispatch/tests/`
  -> Test Files 19 passed (19), Tests 111 passed (111). Counts per file: brief-return-reason 20,
  brief-loops 7, whole-trial-port 6, standing-no-across-briefs 2, carried-opening 5,
  repair-opening 12, dispatcher 21, reset-done 4, receipts 3, call-order 3, scope 4, brief-ending 5,
  stopped-repeating 5, start-allowance 3, recording-notes 1 (new), standing-nos 2,
  brief-thrown-after-yes 3, trial-port-check-rows 2, dependencies 3.

## Not verified

- No typecheck, structure audit or wider vitest run (the lead runs these, as the shared rules say).
- No live or replayed run, so it is unproven that the excerpt shows up in a real provider
  `request.txt`. The test checks the opening-look evidence the model is handed, not the serialised
  provider request.
- No repair-brief test with an excerpt. The same `shown` path covers repairs, but no test exercises
  it.

## Open questions or contradictions found

- The brief says "opening words". I took that to mean the opening look's evidence, which is where
  `repairOf`'s `said` is shown. The excerpt does not go into the system prompt, so
  `system-prompt-pins.json` does not move.
