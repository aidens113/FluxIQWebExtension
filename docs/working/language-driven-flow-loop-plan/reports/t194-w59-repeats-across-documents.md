# t194-w59 repeats across documents: report

## Outcome

Done. A `next` or numbered read that continues in a new document now carries `earlierPageRepeats` in its checkpoint. Each document adds its own repeats to the count it was handed, and the continued read reports the whole read's count. Before this change, a continued read reported nothing.

The count follows the same absence rule as `itemsSeen`. If the predecessor's checkpoint has no count, the continued read reports none and hands none on.

To make room, `list-reader.ts` was split, not compressed. It went from 800 to 772 lines, and the checkpoint and resume handling moved into a new subdirectory, `content/extraction/continued-read/`. The test was written failing first and observed to fail before the fix and pass after it.

## What changed and why

- `apps/extension/src/shared/extraction-continuation.ts`
  - `ExtractionCheckpoint` gains `earlierPageRepeats?: number`, with a doc comment.
  - `readExtractionCheckpoint` admits it as a count. A value that is sent but is not a count refuses the whole checkpoint, the same rule `itemsSeen` follows. An absent value stays absent.
  - The worker relay (`runtime/extract-list-continuation.ts`) and the content side (`content/action-runtime/extraction-continuation.ts`) both pass the checkpoint through this reader and otherwise hand it on whole, so neither needed a change.
- `apps/extension/src/content/extraction/continued-read/` (new; the parent directory was at its 25-file cap). Shape:
  - `carried-condition-counts.ts`: `carriedConditionCounts`, moved verbatim from `list-reader.ts`, with its return type named `CarriedConditionCounts`. The `run-munnhi5q` rationale moved with it.
  - `carried-count.ts`: `carriedCount(resume, "itemsSeen" | "earlierPageRepeats")` returns 0 for a read that began in this document, the predecessor's count for a continued read, and `undefined` when the predecessor's checkpoint carried none. This file now holds the absent-stays-absent rationale that used to sit inline in the reader for `itemsSeen`.
  - `read-checkpoint.ts`: `readCheckpoint(ReadSoFar)` builds the checkpoint from the reader's state. It copies every array and record, sorts the missing fields, and leaves out what is unknown or unused: `itemsSeen`/`earlierPageRepeats` when `undefined`, conditions when none were named, samples when not asked for, and refusals while zero. This is the checkpoint literal that used to be `progress.beforeFollow` in the reader, with identical output.
  - `index.ts`: the barrel, with three values and three types.
  - `tests/carried-count.test.ts`, `tests/carried-condition-counts.test.ts`, `tests/read-checkpoint.test.ts`: unit tests.
- `apps/extension/src/content/extraction/list-reader.ts`
  - It imports the three functions from `./continued-read`.
  - `repeatsBefore = carriedCount(resume, "earlierPageRepeats")`.
  - `repeatsSoFar()` returns `repeatsBefore + this document's count` when `pageByPage` and the start is known, and `undefined` otherwise.
  - The checkpoint (via `readCheckpoint`) and the outcome both use `repeatsSoFar()`. The outcome used to send the count only when `resume === undefined`.
  - `itemsSeenBefore` now uses `carriedCount`.
  - The header and the outcome doc were updated.
  - Other behaviour is unchanged. On a read that began in this document the count is identical, because `carriedCount` returns 0. The refused-page reload, `checkpoint({ ...resume, refusals })`, already spreads the resume, so the count survives a reload too.
- Tests:
  - `content/extraction/tests/list-reader.test.ts` (import of `PAGE_ITEM` and `readExtractionCheckpoint`), two new tests:
    - **Two-document read.** Document 1 is `storePage(1, {current: "self-link", shifted: true})`, read numbered with `maxPages: 3` and a checkpoint callback. Its checkpoints carry `[0, 1]`. The second one goes through `readExtractionCheckpoint`, as the worker does, and is handed to document 2 (`storePage(3, …)`, `resume`, `pageHost: SERVED`). Document 2 reports `pagesRead: 3`, every card of pages 1 to 3 once, and `earlierPageRepeats: 2`.
    - **Absent stays absent.** A resume without a count, with `itemsSeen`, gives neither the checkpoint nor the outcome any `earlierPageRepeats`.
  - `shared/tests/extraction-continuation.test.ts`:
    - four malformed counts are refused (-1, 0.5, "2", null);
    - a new test checks that the count crosses, that an absent count stays absent, and that 0 is kept.

## Commands run and observed results

Heavy commands went through `heavy.sh`. NT = `node C:/Users/osrs_/AppData/Local/Temp/claude/.../scratchpad/t194/narrow-tests.mjs <tree>/apps/extension`.

- **Red** (tests written, source unchanged): `heavy.sh "t194-w59 red" NT t194-w59 content/extraction shared` -> rc 1, `narrow: 34 test files`, `# tests 286 / # pass 283 / # fail 3`.
  - `not ok 132 - a read continued in a new document adds its own repeats …`, with message "page two's repeat of 1-1 is in the checkpoint taken before page three", actual `[undefined, undefined]`.
  - `not ok 257 - anything that is not a checkpoint is refused rather than partly read`.
  - `not ok 259 - the count of rows left out as repeats of an earlier page crosses the document boundary …`.
- **Green**: `heavy.sh "t194-w59 tests" NT t194-w59 content/extraction content/actions background shared` -> rc 0, `narrow: 108 test files`, `# tests 898 / # pass 898 / # fail 0`. The new tests are `ok 744`, `ok 745`, `ok 871`, and `ok 613` onward.
- **Relay tests**: the relay lives in `runtime/`, not `background/`. `heavy.sh "t194-w59 runtime tests" NT t194-w59r runtime content/action-runtime` -> rc 0, `narrow: 45 test files`, `# tests 492 / # pass 492 / # fail 0`.
- **Type checks**:
  - `npx tsc --noEmit -p apps/extension/tsconfig.json` -> rc 0.
  - `npx tsc --noEmit -p apps/extension/tsconfig.test.json` -> rc 0.
- **Structure audit**: `node scripts/structure-audit.mjs` -> rc 0, `structure-audit: passed (159 warning(s), 118 baselined).`
  - That is the same 159 total that w54 recorded.
  - The only warnings on files I touched were already there: `content/extraction/` at 25 files (unchanged), `list-reader.ts` at 772 lines (was 800), and `tests/list-reader.test.ts` at 564 lines (was 511 and already warned).
  - There are no warnings on `continued-read/**`.

## Not verified

- No live run, no browser or e2e test, and no full suites, per the brief.
- The domain and Core sides were not exercised against a continued read. They already accept the count (w54), so they should now see a number where they used to fall back to "an unreported number of such rows".

## Open questions or contradictions found

1. **Stale domain doc.** `domain/src/actions/extraction/summary.ts:95-98` still says the count is absent "from a read continued in another document, whose predecessor's count does not travel with its checkpoint". That is no longer true: it is now absent only when the continued read's checkpoint came from a page build that did not carry it. `domain/**` is outside this brief, so I left it for the supervisor.
2. The brief named `background/` for the relay. The relay is `apps/extension/src/runtime/extract-list-continuation.ts`. It needed no change because it hands on what `readExtractionCheckpoint` returns. Its tests pass, as listed above.

## Commit message

`Extraction: carry earlierPageRepeats across documents in the read's checkpoint, so a read whose Next loads a new document reports the whole read's repeats; split the checkpoint and resume handling out of list-reader into content/extraction/continued-read (t194 w59)`
