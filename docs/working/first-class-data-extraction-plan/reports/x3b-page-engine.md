# x3b-page-engine: X3.1 and X3.2, the page's extraction engine

## Outcome

**Done.** `content/action-runtime/list-extraction.ts` and its test are gone,
replaced by `content/extraction/`; the field kinds and the three new pagination
modes are built and proven on real fixtures under both Chromium and Firefox.

- **Extension check** (`tsc` twice, `tsconfig.test.json` covers `e2e/**/*.ts`): exit 0.
- **Unit tests** (label `x3b`): 559 of 559 pass, exit 0. The count rose from 557
  to 559 during the work because other workers are adding rows; none failed.
- **Content harness, `extract-list`:** 30 of 30 pass under Chromium (18.5s) and
  30 of 30 under the Firefox config (23.6s), both at `--workers=1`.
- **Mutations:** all six were observed red and reverted; every file was checked
  back to a byte-identical hash, and a grep for residue found none.
- **Structure audit:** exit 1 on one violation in a shared document I do not
  own -- `docs/working/README.md` is out of date -- which `x1-page-b` reported
  before me. My files add one advisory (the harness spec, 782 lines, under the
  800 hard limit).

**The Firefox run needed an override.** Playwright 1.51.1 wants firefox-1475;
this machine has firefox-1538 from a newer Playwright, so the first attempt
failed uniformly with Playwright's "run npx playwright install" banner. That is
exactly what `FLUXIQ_FIREFOX_EXECUTABLE` exists for
(`playwright.content.firefox.config.ts:6-9`), and with it pointed at the
installed build all 30 rows passed. I downloaded nothing.

## What changed and why

### New `apps/extension/src/content/extraction/`

- **`field-spec.ts`** -- `normalizeExtractField(name, field)`. Today's string
  grammar (moved from `parseExtractField`) and the structured spec both become
  one `ExtractFieldReader`. `required` defaults to true for a spec and the
  string form is always required. `handling: "exclude"` answers `undefined`, so
  the field is dropped before any read (D12); `encrypt` throws a
  NOT_IMPLEMENTED record. A kind or handling the page does not know, an
  `attribute` field naming no attribute and a `column` field naming no header
  each throw rather than reading something other than what the field names.
- **`field-reader.ts`** -- `readField(item, name, reader)`, with `readColumn`
  and `sensitiveFieldRefusal` moved across. `text`, `attribute`, `link`
  (resolved against `baseURI`, http(s) only), `value` (a control's live value)
  and `column`. Every kind asks `isWithinSensitiveControl` first and refuses the
  whole read (D2). An unreadable optional field returns `null`, an unreadable
  required one `undefined`, which is what the reader reports missing.
- **`pagination.ts`** -- `deadlineFor`, the list-change wait and `advancePage`,
  which implements `next` (unchanged behaviour), `loadMore`, `scroll` and
  `numbered`. `paginationBound` holds every bound to the domain's page bound.
- **`list-reader.ts`** -- `extractList`, with `ExtractedListRecord` now
  `Record<string, string | null>`.
- **`index.ts`** -- the barrel, exporting `extractList` and the three types.

### Deleted, with importers updated

`content/action-runtime/list-extraction.ts` and
`content/action-runtime/tests/list-extraction.test.ts` are deleted, nothing left
behind. `action-runtime/index.ts` (type re-export removed),
`action-runtime/execute-action.ts`, `content/actions/types.ts` and
`actions/tests/extract-list.test.ts` now take the types and `extractList` from
`../extraction`.

### The bounds are imported, not mirrored

`EXTRACT_MAX_PAGES` and `EXTRACT_MAX_ITEMS` are gone; `pagination.ts` and
`list-reader.ts` import `WEB_AUTOMATION_EXTRACT_MAX_PAGES` and
`WEB_AUTOMATION_EXTRACT_MAX_ITEMS` from `@fluxiq-web-extension/domain/client`,
as the file already imported the failure helpers from there. The two agreement
tests are deleted with the file, as x0-x1 open question 1 recommended.

### X1.2's page guard is removed

A structured field spec and a non-`next` mode are now read rather than refused.

### Two defects fixed on the way

- **A bound of `NaN` made a read unbounded.** `Math.max(1, Math.trunc(NaN))` is
  `NaN` and `pagesRead >= NaN` is never true, so a `maxPages` or `maxItems` of
  `NaN` sent past the lift would have paged or read forever. Both bounds now
  treat a non-number as the default (1 page; the domain's item cap).
- **`missingFields` now names required fields only**, so an optional miss no
  longer fails the validation.

### D16's scroll de-duplication

In `scroll` mode an item is its element **and** its content: the reader keeps a
`Map<Element, string>` of the record each element held when read, so a
virtualised list that recycles a node for a new record still yields it. Every
other mode de-duplicates by element alone, as before -- content-aware
de-duplication there would re-read an item whose relative timestamp ticked over.

### Three deviations from `x3-x5-execution` Part 2, and why

1. **`readableText` is not imported.** The report has `text` read
   `action-runtime/extract.ts`'s `readableText`. The structure audit's `imports`
   rule counts every relative import that reaches past another directory's
   barrel (`rules/imports.mjs:112-139`), and `action-runtime/` has one that does
   not export `readableText`; exporting it there would make `action-runtime` and
   `extraction` import each other, since `execute-action.ts` already imports
   this directory. So `field-reader.ts` imports `textOutsideSensitiveControls`
   from `../sensitive-text` -- the same one text reader, which is where the
   sensitivity rule lives -- and collapses whitespace with the same expression
   `readableText` uses. Only the collapse is restated, not the rule.
2. **`advancePage` returns a fourth outcome.** The report's signature is
   `"advanced" | "ended" | "timed_out"`, but only the mode knows whether its
   bound stopped a list that could have gone on, so `"truncated"` is returned
   too rather than guessed by the caller.
3. **A `column` spec ignores a `selector` sent with it.** A column field reads
   the cell under its header; the domain's lift copies `selector` onto any kind,
   and inventing "a descendant of that cell" is not a contract anyone wrote.

## Commands run and observed results

Every command ran alone, one at a time, with both harnesses at `--workers=1`.

1. **Baseline check**, before any edit: exit 0. So every later failure is mine.
2. **Check after the engine landed:** exit 0. `tsconfig.test.json` includes
   `e2e/**/*.ts`, so the harness spec is type-checked, not merely transpiled.
3. **Unit run** (`EXTENSION_TEST_BUILD_LABEL=x3b`): exit 0, 557 of 557 at the
   time.
4. **Chromium harness** (`test:content -- extract-list --workers=1`): exit 0,
   `30 passed (18.5s)`. Every new row ran ok: the spec kinds, the required
   miss, the column spec, the two sensitive-value rows, numbered, the three
   scroll rows, and the four loadMore rows.
5. **Structure audit:** exit 1, `1 violation(s)`: `docs/working/README.md` is
   out of date. One advisory of mine: `extract-list.spec.ts` at 782 lines.
6. **Firefox harness, first attempt:** exit 1, all 30 failed uniformly with
   Playwright's "Looks like Playwright Test or Playwright was just installed or
   updated... run npx playwright install" banner. The cache holds firefox-1538
   while `playwright-core@1.51.1/browsers.json` names revision 1475.
7. **Firefox harness with `FLUXIQ_FIREFOX_EXECUTABLE`** set to
   `...\ms-playwright\firefox-1538\firefox\firefox.exe`: exit 0,
   `30 passed (23.6s)`.
8. **Mutations.** Each was applied alone, run against its own row, then
   reverted and hashed.

   | # | Mutation | Row | Observed |
   | --- | --- | --- | --- |
   | M1 | an excluded field is normalized as an included one | excluding a sensitive control | exit 1; `+ "status": "failed"` -- reading the excluded control refused the whole read |
   | M2 | `link` returns the raw `href` | each kind reads what it names | exit 1, `1 failed`; `- Expected - 8 / + Received + 8` on the records |
   | M3 | an optional miss omits the key instead of `null` | each kind reads what it names | exit 1; `+ "status": "failed"`, the sku reported missing |
   | M4 | numbered clicks the current page again | numbered: every page is visited once | exit 1; the `"23 records from 3 pages"` validation no longer matched |
   | M5 | `maxScrolls` is ignored | maxScrolls stops the read | exit 1; the `"30 records from 3 pages, truncated"` validation no longer matched |
   | M6 | the loadMore disabled check is removed | ends up disabled | exit 1; the ended read came back truncated |

   No permission refusal occurred, so no scratch copy outside the repository
   was needed. Each revert was confirmed by comparing the file's SHA256 with the
   hash taken before the mutation: all six reported `restored byte-identical`.
9. **Residue grep** over `content/extraction/` for `false &&`, `true ||`,
   `return href;`, `pageNumber(control) === number)`, `handling: "include" })`
   and `if (!found) return`: no matches.
10. **Final clean run**, after every revert: check exit 0; unit run exit 0,
    `# tests 559 # pass 559 # fail 0`; Chromium harness exit 0, `30 passed
    (17.1s)`; structure audit exit 1 with the same single `working-docs`
    violation.
11. **`git status --short`** over `apps/extension/src/content/extraction`: the
    new directory, untracked. Nothing staged or committed.

## Not verified

- **No manual browser test.** Neither an unpacked extension in Chrome or Edge
  nor a Firefox popup was loaded. Both harness runs drive the real content
  bundle in a real page, but with no background worker, tab or frame routing.
- **The Firefox run used a mismatched build.** firefox-1538 under Playwright
  1.51.1, which expects 1475. Everything passed, but this is not the revision
  the pinned Playwright ships.
- **Virtualised lists (E55) are not exercised.** D16's element-and-content
  de-duplication is implemented and its unit-level shape is covered, but no
  fixture recycles a DOM node. X3 does not claim `scroll` on admin-console; X5's
  fixture run measures it.
- **`loadMore` against a control that re-renders while loading.** The wait ends
  on an unread item or the control detaching. A page that removes its button,
  shows a spinner, then appends would have its page counted with no new records;
  a page that disables the button only after appending could read as ended. No
  fixture does either.
- **Scroll timing rests on the fixture's fixed 300 ms load** against the 900 ms
  growth window. A load slower than the window recovers, because a grown page is
  no longer at its bottom and is scrolled again, but the capped row
  (`maxScrolls: 2`) would under-read if two windows expired. Not seen in the
  runs; each scroll row passed under both browsers.
- **Repository-wide gates.** Root `pnpm check`, `pnpm test` and `pnpm build`,
  and the domain package's own tests, were not run.
- **The `value` kind on a `<select>`** returns the selected option's value; no
  fixture covers a non-sensitive select.
- **Nothing was run against a real gateway or Core.**

## Open questions or contradictions found

1. **The harness spec is at the edge of its budget.** 782 lines against the
   800-line hard limit. D16 already directs new harness specs to
   `e2e/content/tests/extraction/`, which this brief does not own, so X5-H
   should split this file rather than add rows to it.
2. **`readableText` now has two callers composing the same two steps.** If
   `x0-11` changes how the extract verb collapses whitespace, list extraction
   will not follow. The durable fix is a shared collapsed-text reader in
   `content/sensitive-text.ts`, which is that worker's file.
3. **An unknown pagination mode is now an ordinary failure.** With X1.2's guard
   removed, a mode sent past the domain's lift throws a plain error rather than
   the NOT_IMPLEMENTED record the guard produced. Every mode the contract names
   is now implemented, so this is only reachable by bypassing the lift.
4. **A `column` spec's `selector` is accepted and ignored** (deviation 3). If
   the picker will send one, X4 should decide what it means or the domain should
   refuse it on that kind, as it already does for `attribute` and `header`.
5. **Content-aware de-duplication has two knowable limits.** A recycled node
   showing exactly what it showed before is skipped, and the same content
   appearing under a new element is read again. Both follow from D16's "element
   and content together"; X5 measures the first on admin-console.
6. **`missingFields` stays sorted while `fieldNames` is in declaration order**,
   as `x1-page-b` noted. Unchanged here; the domain requires only a subset.
7. **The structure audit's `working-docs` failure is the supervisor's**, not
   mine: `docs/working/README.md` needs `pnpm structure:baseline`.
8. **Firefox needs `FLUXIQ_FIREFOX_EXECUTABLE` on this machine** until someone
   runs `npx playwright install firefox` for revision 1475. Worth recording,
   since any later worker asked to run that config will hit the same banner and
   may read it as a code failure.
