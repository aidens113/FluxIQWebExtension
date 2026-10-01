# t194-w29: the numbered pager, and a detection made while results are skeletons

## Outcome

Done. Detection now finds kestrel G2 and spain-hubs G4: on both fixtures the numbered pager is proposed as `numbered`, with a `pages` selector that names exactly the page numbers, the current page included. Spain-hubs G3 is also fixed: a detection made while a larger run of skeleton cards is still being drawn is not treated as final. It waits within the existing 5 s window, and the results then outrank the sidebar. On the fixtures, kestrel's G2 row passes with its `test.fail` removed, and the rewritten keyword-route row passes: it reads the ten owed rows across documents through the detected handle. Spain-hubs rows G3 and G4 report "Expected to fail, but passed". Row G5 does too, together with the other worker's `pagination.ts` change.

## What changed and why

- `apps/extension/src/content/extraction/item-selector.ts`: `generalizedItemSelector` used to pass `first.classList` as `classes`, but the type documents that field as "the classes the items share". It now passes `sharedClasses(run)`, which keeps only the classes every item carries. Before, a run whose first item carried one extra class (`a.pageLink.pageCurrent`) produced a candidate that named only that item, so it never matched the run.
- `apps/extension/src/content/extraction/detect-pagination.ts`:
  - `numberedControls` now groups digit-labelled controls by pager slot rather than by full template signature. The slot key is the element holding them (through a per-item wrapper such as `ul > li > a` when each sits alone in one), plus tag and role. So the current page joins the run whatever its extra class.
  - The `pages` selector is now generalized under that holder (`${selectorFor(holder)}${via}`) rather than under the level the outward walk reached. Pager links sit in their own `nav` or `div`, below that level.
  - When a page has two pagers, the first of the largest runs wins. A pager above the list and one below it is therefore named by the one above, never by both. The old code merged them into one template group that matched neither.
  - The unused `webAutomationItemSignature` and `testIdFor` imports were removed.
- Precedence: Next stays first. Where a page offers a labelled Next as well as numbers, Next is proposed, because Next is what reads every page:
  - A pager draws a window of numbers, and a numbered read can only go as far as the numbers drawn.
  - A Next that leads back to its own page is already read through the pager's following number (`pagination.ts` `pagerSuccessor`/`readPager`). With the other worker's change, a script Next is too.
  - The evidence is professional-network G1, which proposes Next for a script button that goes from page 2 to page 2. It now reads all 23 people ("Expected to fail, but passed", row 11 below).
  - Numbered pages are proposed only when nothing is labelled Next: kestrel's arrow "Go to next search page" (I did not widen `NEXT_LABEL`, as w25 advised), and spain-hubs' Next, which is a plain `div`.
  - The module header records this choice and the reason.
- `apps/extension/src/content/extraction/placeholder-run/` is new: `placeholder-run.ts`, the `index.ts` barrel, and `tests/placeholder-run.test.ts`.
  - It exports `largestPlaceholderRunApartFrom(items, root)`: the size of the largest run of 3 or more sibling placeholders. A placeholder is an empty `div`, `li`, `section` or `article` (no element and no text inside), and a run is placeholders of one tag and class list under one parent. Placeholders inside the detected items, or beside them under one of the items' parents, are not counted: those are the items' own decorations, or the detected list filling in.
  - It is a directory, not a flat file, because `extraction/` was already at the 25-file limit. Another worker did the same for `composed-value/`.
- `apps/extension/src/content/extraction/detect-structure.ts`: `settled()` now treats an `ok` answer as unsettled while `itemCount < largestPlaceholderRunApartFrom(items, document.body)`. Waiting still uses `STRUCTURE_WINDOW_MS`, and when the window closes the last answer stands. I also added a header paragraph explaining this.
- `apps/extension/src/content/extraction/tests/selector-page.ts` is new test support. It is a small fake document with a real selector matcher: type, `*`, `#id`, `.class`, `[a]`, `[a="v"]`, `[a^="v"]`, `:nth-of-type`, `:root`, the descendant and child combinators, and comma lists. Any selector it cannot read throws. `detectPagination`, `selectorFor` and the exact-match check can therefore run in Node.
- `tests/detect-pagination.test.ts` has 5 new rows:
  - the kestrel-shaped nav;
  - the spain-hubs-shaped `div.pager` with a div Next and no `aria-current`;
  - the `ul > li > a` wrapped pager;
  - top and bottom pagers;
  - the Next-precedence guard.
- `tests/item-selector.test.ts` has 2 new rows: the classes all items share, and a run with no shared class.
- `placeholder-run/tests/placeholder-run.test.ts` has 5 rows:
  - skeletons beside the sidebar;
  - a grid filling in;
  - stars inside cards;
  - non-placeholders (text, an `img` child, empty spans, a pair of 2);
  - templates counted apart.
- `apps/extension/e2e/content/tests/live-tasks/tests/auction-marketplace-kestrel-auctions.spec.ts`:
  - The G2 row no longer has `test.fail`. It now also asserts that the detected `pages` selector names exactly "1", "2" and "3".
  - The keyword-route row is rewritten. The runtime read now carries the detected `paginate` (`mode: "numbered"`, `maxPages: 1`), page one comes back with `pagesRead: 1, truncated: true`, and the cross-document read uses the detected `pages` selector with `maxPages: 5`. The old literal `${PAGER} > a` is gone. G1's title is still supplied because G1 is open. The row expects `OWED` and `pagesRead: 3`.
  - I updated the header's G2 bullet.

## Commands run and observed results

Every command was run from the tree root through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w29 <what>" …`.

- `npx tsc -p apps/extension/tsconfig.json --noEmit` printed nothing, exit 0. This is the final run, after the directory move. An earlier run caught `placeholder-run.ts(36,25) TS2345`, which I fixed.
- `npx tsc -p apps/extension/tsconfig.test.json --noEmit` exits 2, with only these 3 errors, all in files I did not touch (`git diff HEAD -- apps/extension/src/panel` is empty):
  - `src/panel/extraction/tests/dialog-dom.ts(16,37)`, `src/panel/recording/review/tests/recording-review.test.ts(20,16)` and `src/panel/settings/tests/forget-confirmation.test.ts(17,16)`;
  - each is `TS2610: 'ownerDocument' is defined as an accessor in class 'FakeElement', but is overridden here … as an instance property`.
  - One error in my spec (a union spread of `paginate`) was caught and fixed. It is not in the final run.
- Extraction unit tests: `node apps/extension/.test-build-scratch/t194-w29-runner/run.mjs`.
  - The runner is ignored scratch. Like `scripts/test-extension.mjs`, it bundles `src/content/extraction/tests/*.test.ts` and `placeholder-run/tests/*.test.ts` with esbuild, `fluxiq` external, into `.test-build-scratch/t194-w29`, and runs them under node:test.
  - Final run: `# tests 195 / # pass 195 / # fail 0`, including all 12 new rows.
  - The very first run printed `# tests 186 / # pass 185 / # fail 1`. I captured only the tail of that output, so I don't know which test failed. Three later full runs (186, 195 and 195 tests) all had 0 failures. Other workers were editing extraction files and tests in the same tree at the time.
- The new tests fail on the old source. I checked with `node apps/extension/.test-build-scratch/t194-w29-runner/run-old.mjs detect-pagination.test.ts item-selector.test.ts`, which uses an esbuild `onLoad` plugin to load `detect-pagination.ts` and `item-selector.ts` from `git show HEAD:` (it printed `[old source] … <- HEAD` for both). No file was touched. Result: `# pass 19 / # fail 6`:
  - `not ok 11–14` (the four numbered-pager rows: `expected: 'numbered'`, actual undefined);
  - `not ok 24` (`main > nav > a.pageLink` expected, undefined);
  - `not ok 25` (`expected: 'main > ul > li'`).
  - Row 15, the Next-precedence guard, passes on HEAD by design: it guards the choice, which already held.
- T2 specs, full run: `pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/extraction/tests e2e/content/tests/live-tasks/tests --reporter=list --output=e2e/test-results/t194-w29` printed `94 passed (6.6m)` and `11 failed`, exit 1.
  - Passed, among others:
    - kestrel `keyword route, G2` (ok 77) and the rewritten keyword-route row (ok 78);
    - every `pagination-stop`, `extract-list-pagination`, `everything-store-extraction`, `structure-detection` and `inference` row.
  - "Expected to fail, but passed" (9):
    - spain-hubs `:342` G3 and `:452` G4, both fixed here;
    - spain-hubs `:463` G5, from the `pagination.ts` worker plus this detection;
    - kestrel `:618` G3 and `:669` grid-view G1, from other workers;
    - local-classifieds `:227`, `:248` and `:259`, from other workers;
    - professional-network `:338` G1, from the `pagination.ts` worker's script-Next change.
  - Real failures (2), neither caused by this change:
    - `extraction/tests/job-board-listing.spec.ts:90` "a read whose next control names nothing stops on page one and says so" fails with `page.evaluate: Execution context was destroyed`. The read's `next: "[data-no-such-next]"` names nothing, so `nextControlOnPage` finds the job board's own labelled Next and follows it to page 2. `nextControlOnPage` arrived with WIP commit 518e38fe (2026-09-30, "unvalidated"), after this row was written (e7e48db9, 2026-09-28). My diff does not touch `nextControlOnPage`, `kindOf` or anything on that path (`git diff -U0` hunks end at line 154; `nextControlOnPage` is further down).
    - `live-tasks/tests/local-classifieds-bike-search.spec.ts:289` "once the failed batch is retried…" fails with `the detection proposes a title column: … div.x19b50hr.x1ap30ym.x1az2mnl > span:1 (0.17) …`. The row finds title and location with `/ > div:3 > span\./`. The `infer-fields.ts` change by another worker now names a card's children by class (`div.<class> > span:1`) instead of by position.
- T2 narrow re-run after moving `placeholder-run` into its directory: `… test:content -- e2e/content/tests/live-tasks/tests/crossborder-marketplace-spain-hubs.spec.ts e2e/content/tests/extraction/tests/structure-detection.spec.ts --reporter=list --output=e2e/test-results/t194-w29b` printed `14 passed (1.9m)` and `3 failed`. All three failures are "Expected to fail, but passed": spain-hubs `:342` (G3), `:452` (G4) and `:463` (G5). All 8 `structure-detection` rows pass.
- `node scripts/structure-audit.mjs`, final run: exit 0, no FAIL. `content/extraction/` has 25 source files and `content/extraction/tests/` has 25. Before the move it failed with `directory-files` on both directories (26 each). At that point the other worker had already moved `composed-value` into a subdirectory, so my flat files were the only overflow.

## Not verified

- No live Lab run and no manual browser run. The live run in this tree was left alone, as the brief required.
- The G3 rule has no unit test that fails on the old source, because `settled()` is private and `detectStructureWhenPresent` needs the whole inference stack. The placeholder tests exercise a new module, which on HEAD does not exist and so cannot be bundled. The behavioural proof of G3 is spain-hubs row `:342` flipping, in both T2 runs.
- I attributed the two real T2 failures to other workers by reading the code paths and history, not by re-running with their changes reverted. Reverting was not allowed in a shared tree.
- I could not identify the single unit failure in the first run (see above).
- The G3 wait costs up to 5 s on pages that keep 3 or more empty `div`/`li` siblings of one class outside the detected list, more of them than the list has items: for example, carousel dots on a page with a two-item list. The answer is unchanged in that case, only delayed. I did not measure how common this is on real sites.

## Open questions or contradictions found

- A spain-hubs spec edit is needed (I did not make it, per the brief). Rows `:342` (G3), `:452` (G4) and `:463` (G5) need their `test.fail` markers removed.
- `job-board-listing.spec.ts:90` contradicts the `nextControlOnPage` fallback from 518e38fe, which looks for the pager's own Next when the authored selector names nothing. The row expects `control_absent`; the product now follows the pager's labelled Next. Someone needs to decide which is the intended contract and fix the other. It is not in my ownership.
- `local-classifieds-bike-search.spec.ts:289` pins positional labels (`div:3`, `div:4`) that the new `infer-fields.ts` paths no longer produce. Its owner needs to update the matchers.
- Precedence is kept as Next first. If the supervisor wants numbered pages preferred where both exist, change the order in `detectPagination` and the header paragraph. Professional-network G1 now passes with Next.
- The unit runner and the old-source runner are left at `apps/extension/.test-build-scratch/t194-w29-runner/` (`run.mjs`, `run-old.mjs` and the two `old-*.ts` HEAD copies). The directory is gitignored, and they are there for re-checking.
