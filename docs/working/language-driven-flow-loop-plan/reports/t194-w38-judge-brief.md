# t194-w38: the judge's brief (no false "always empty" column, no "raise maxPages" for a list that ended)

## Outcome

Done. Both defects from run 12 (`run-muq66ff9-cb3767a1`, causes 3 and 4) are fixed in the Core tree
`C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`, branch `task/t194-live-judge-answer`. Nothing was committed. No
refusal or gate was added; both changes only change what the judge and re-author are told.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/`.

(a) A column that a read's own condition keeps empty is no longer reported as always empty.
- New `read-account/emptied-columns.ts`: `automationStudioResultReadEmptiedColumns(reads, columns)`. It returns the
  columns some read's condition requires to be empty. It works from the condition wording `condition.ts` already
  produces, which names a condition's value by the column key when the condition uses `field`, or uses a `read`
  identical to the column's own declaration (compared on the raw authored node, so selectors are compared exactly). The
  emptying phrases are `<col> is absent`, `<col> not is present`, `<col> equals ""` and `<col> equals [""]`.
  - A condition that uses its own read says `attribute ...` or `the item's ...`. Both contain a space, which no column
    key can, so the two forms cannot collide.
  - If a condition's wording was withheld, its column keeps the finding.
- `repair-directive.ts`: `alwaysEmptyColumns` now gets the summary and leaves out those columns, the same way it already
  leaves out required-missing columns. A column that is empty for no stated reason still gets
  `result.column_always_empty`.
- Why the read accounts and not `flowShape` parameters: in the screened `flowShape`, every selector is `null`, so a
  `where` read could not be matched exactly to a column's read. The read accounts are built from the raw nodes.

(b) A read that stopped because the list ended is now said as "read every page (N) and the list ended".
- New `read-account/stop.ts`: `automationStudioResultReadStop(read)` sorts each read into one of three cases.
  - `list_ended`: the stop word is `control_disabled`, `no_following_page`, `control_absent` or `scrolled_to_end`; or
    there is no stop word and `pagesRead < pageLimit` and the read is not truncated.
  - `page_bound`: the stop word is `page_limit`; or there is no stop word, `pagesRead >= pageLimit` and the read is
    truncated.
  - `other`: everything else.
- `read-account/sentence.ts`, for `list_ended` reads:
  - The sentence now reads "read every page (5) and the list ended: its next control was disabled on page 5". There is
    a matching phrase for each list-ended word.
  - For `control_absent` on page 1, the sentence also says that a next control which names nothing on the page would
    look the same. This follows the domain's own note in `summary.ts`.
  - "of at most N" is dropped.
  - The full sentence says: "It already follows pages and read to the end of the list, so a higher page bound would read
    nothing more".
- For `page_bound` reads:
  - The head is unchanged. This keeps `recovery/refuted-result/tests/brief.test.ts:71`, which I do not own, passing.
  - The full sentence adds: "Its page bound stopped it at N, not the list, so the list may go on: raise its maxPages
    (maxScrolls for a read that scrolls) if the request needs rows past page N."
- For other stop words such as `rate_limited` or `deadline`, the sentence names the word and adds "before its page bound
  of M" when fewer pages were read than the bound. It never says "list ended" or "raise".
- `read-account/index.ts`: the barrel now exports `emptied-columns.ts` and `stop.ts`.

Tests:
- `read-account/tests/sentence.test.ts` (new, 5 tests).
- `read-account/tests/emptied-columns.test.ts` (new, 3 tests). These go through `accounts.ts`, so they pin the real
  wording the parser depends on.
- `tests/repair-directive.test.ts`: 1 test added.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/result-verification`, run from `packages/fluxiq`: **15 files,
  156 tests passed.**
- `npx vitest run src/programs/automation-studio/runtime/recovery/refuted-result/tests/brief.test.ts` (read-only check
  of a test I do not own that pins the page_limit sentence): **5 passed.**
- Old-source failure check, done without touching the tree:
  - I copied the pre-change `sentence.ts` and `repair-directive.ts` into the scratchpad, as `w38-old/old-*.ts`. In the
    old directive copy, the one value import (`../llm/index.ts`) was rewritten to an absolute path.
  - I then ran vitest with a scratch config, `w38-old/w38-old.vitest.config.mjs`, whose `resolve.alias` sends
    `../repair-directive.ts`, `../sentence.ts` and `./sentence.ts` to those copies, using `--root .`.
  - Result: **6 failed, 33 passed.** Every new sentence test and the new directive test failed. For example, the old
    directive gave "expected [ 'role', 'ad' ] to deeply equal [ 'role' ]", and the old sentence gave "read 5 pages of at
    most 5, paging stopped on control_disabled". All pre-existing tests in the same files passed under that config, so
    the alias took effect.
  - `emptied-columns.test.ts` cannot run on the old source because the module it tests is new.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w38 core check" pnpm check`, run from `packages/fluxiq`:
  **exit 2.** The only errors are 2 TS2353 errors in `runtime/llm/evidence-loop/tests/rerun-input.test.ts` (lines 139
  and 149: `'is'` / `'contains'` do not exist in type `{ read: JsonObject; }`). That file is modified in the tree and
  belongs to lane B's in-flight work. tsc reported no error in any file I touched.
- `node scripts/structure-audit.mjs`, run from the Core root: **passed (211 warnings, 349 baselined).** No warning names
  a file I added or changed. It also printed "1 baseline entries can be lowered". I did not remove any violation, so
  that entry is probably from other changes in the tree. I did not run `structure:baseline`.

## Not verified

- No live run or Lab run. Whether the judge and re-author actually stop chasing `ad` and `maxPages` is unproven until
  the next live run.
- I did not get a clean typecheck, because of lane B's errors. A clean `pnpm check` needs lane B's `rerun-input` fix
  first.
- I did not run the whole Core vitest suite. Other consumers of the sentence wording outside `result-verification`
  (beyond `refuted-result/tests/brief.test.ts`) were grepped for but not run.

## Open questions or contradictions found

- The brief counts `pagesRead < maxPages` as the list ending. I applied that only when there is no stop word. A read
  that reported `rate_limited`, `deadline`, `list_unchanged` or a similar word before its bound is not "list ended";
  it is said as its word plus "before its page bound of M". Saying "the list ended" there would be false.
- The emptied-column check does not tie a read to a specific record set, because the read account carries no dataset
  id. Any read requiring `<col>` empty exempts that column name in every set. With one read, as in run 12, this is
  exact.
- The page-bound advice says "maxPages (maxScrolls for a read that scrolls)". The account keeps only the bound's value,
  not its key name, and it lives in `contracts.ts`, which I do not own.
- Possibly relevant to lane B's area, which I left untouched: `llm/diagnosis-instructions.ts` still says reads carry
  "the most it may read" and "name the condition, page limit or key that has to change".
