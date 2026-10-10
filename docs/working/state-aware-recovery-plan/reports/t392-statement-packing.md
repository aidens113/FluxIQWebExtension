# t392 unit P: statement-packing

## Outcome
Done.

## What changed and why
I split packed lines so each holds one statement. The logic and its order are unchanged.
- child-bounds.ts: every packed line is split (lines 11 and 17-20), so it now has none.
- call-subflow.test.ts: lines 15 and 123 are split.
- attempt.ts: all 6 packed lines are split (44, 47, 65, 117, 146, 250), so it is now below its baseline of 5.
- subflow-frame.test.ts: line 44 is split.
- runtime-stream-store.ts: the handler_execution and intervention branches are split, taking it from 21 packed lines to 19. The file is now 764 lines, under the 800 cap.

## Commands run and observed results
- `node scripts/structure-audit.mjs | grep statement-packing`: none of the five files is listed.
- vitest (the brief's command): 9 files passed, 51 tests passed.
- tsc (the brief's command, output filtered for errors and the five files): no lines printed.

## Not verified
- I did not run the full tsc output without the filter.
- The structure baseline was not regenerated.

## Open questions
None.
