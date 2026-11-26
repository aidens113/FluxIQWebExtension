# scripted-reorder (t1037 W3)

## Outcome
Done. The scripted model for `local-classifieds-save-dining-tables` no longer sends `reorder`; every form is kept.

## What changed and why
Files: `packages/test-runner/src/attempt-lane/scripted-model/scripts/local-classifieds-save-dining-tables.ts` and `scripts/tests/local-classifieds-save-dining-tables.test.ts`.
- `reshape`: the Flow's own read (`write-read`) now runs right after `read-tables` and before `open-first`, so it stands before the open in run order. The repeat `over` it holds without a reorder.
- `open-save-back` / `again-check`: the loop's way back used to be the hand back moved after the check. Now a new call `back-loop` (a navigate to the list, after `write-save`) runs after the check, so it is the step after it in run order; the repeat goes `through` it. The earlier hand way back (the first navigate after the first stray press) is `drop`ped with the stray presses.
- Framework-drafting assumption: `proposedSteps` took `kept | added | written`; `added` no longer exists, now `kept | written`. In the plain / reshape / again-press / run-again forms the hand way back to the list was left unadded so it was `taken`; now it is `kept`, so those forms `drop` it before the repeat (`saveSpan.back`). Row-link keeps its back as a step on purpose.
- Tests updated to the new order and amendments (drop of the back, `back-loop`, reshape write-read order).
- Not changed: tool_call `add: true` flags in the script (and test asserts on them). Core's draft entry no longer lists `add` as an edit, and I did not verify whether the tool_call decision parser still accepts the `add` key; if it drops or refuses it, `toolCall(..., add)` in the shared `scripts/evidence.ts` needs changing (not mine to edit).

## Commands run and observed results
- `node scripts/check/core-build.mjs` -> current (after waiting for the supervisor's rebuild).
- Heavy-slot `pnpm --filter @fluxiq-web-extension/test-runner test` -> 2975 pass, 35 fail on first run (one mine: the run-again test, fixed). Then `node --test dist/attempt-lane/scripted-model/scripts/tests/local-classifieds-save-dining-tables.test.js` -> 23 pass, 0 fail.
- Heavy-slot `node --test "dist/**/*.test.js"` after rebuild -> 2976 pass, 34 fail; none in scripted-model. Failures are in week1/smoke resolve, launcher/readiness command tests (demo, adaptation), oracle tests (product-catalog, confirm-requests, pickup-order), W17 upload, authenticated reset helper. Unrelated to these files; I did not check them against a clean baseline.
- `pnpm --filter @fluxiq-web-extension/test-runner check` -> built and stored a stamp, exit 0 (the tail masked the code, but no errors printed).
- `node scripts/structure-audit.mjs` -> passed (264 warnings, 550 baselined).
- `node scripts/check/model-text.mjs` -> ok.

## Not verified
- The 34 unrelated failures are not shown pre-existing on a clean tree.
- Behaviour against real Core drafting (no Lab or provider run); the draft shapes in the tests are hand-built.
- Whether the tool_call `add` key is still accepted (see above).

## Open questions
- `back-loop` adds one extra navigate call to the open-save-back / again-check run; if Core's framework draft leaves out a repeated list navigate as a "repeat", the loop's `through` step may need re-checking in a live run.
