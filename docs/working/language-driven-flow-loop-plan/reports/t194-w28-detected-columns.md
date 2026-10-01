# t194-w28: detected columns (a title alone, a price drawn in pieces, field paths that survive a layout change)

## Outcome

**Partial.** All three gaps are fixed in the product, generally, and covered by unit tests:

- spain-hubs G1 is fixed. The rows "the four-column answer equals spainHubRecords()" (`:390`) and the reworked fix-proof row pass.
- spain-hubs G2 is fixed. The row "the literal request the grid build saved reads the thirteen on the list layout" (`:492`) now carries all four columns, price included, and passes.
- kestrel G1 is fixed in the product. "grid-view, G1" passes unexpectedly, as the brief predicted.

Two results are not clean:

1. **Kestrel's "filter route, G1" (`:506`) still fails as expected.** The spec picks its title column by the label regex `/> a\.[\w-]+$/`, which is the title *link's* own words. The link's words are still "New listingKestrel 35 Kamera…". The new column `… > a.<cls> > div > span` reads every title alone. The spec does not pick it.
2. **One previously passing live-tasks row now fails: bike-search "once the failed batch is retried…" (`local-classifieds-bike-search.spec.ts:288`).** The cause is the G2 fix itself; see "Open questions". That spec is not mine.

The extraction specs (the blast radius) are row-for-row identical to the baseline.

## What changed and why

**`apps/extension/src/content/extraction/infer-fields.ts`**

- **kestrel G1, in `pathStep`.** An element with no `class` attribute now gets the step `tag:not([class])`. Its label is still `tag`, as before. It is tried after the test id and `itemprop` and before tag+classes and the bare tag.
  - The old bare `span` step taken from an unbadged card resolved to the classed badge on a badged card, because coverage counts only presence.
  - The new step names the title span on both cards. So the badged card no longer adds a separate partial `span:2` column.
- **spain-hubs G1, in `elementSources`.** An element whose childless children together state a value is now a text source (`composesValue`).
  - Its pieces (`isComposedPiece`) are no longer offered on their own. So "16" `(number)`, ",49" and "€" leave the proposal.
  - The struck-through original price row ("29,99 €" + "-45%") is not composed, so it stays its own column.
- **spain-hubs G2, in `selectorWithinItem`.** A new step, `ownName`, sits between the test id and the path. It names the element by its `itemprop` or its tag+classes as one step anywhere in the item: `:scope span.<rating>`.
  - It is taken only when that step names this element alone in the item, and at most one element in every scanned item of the run (`namesAtMostOne`).
  - A bare tag, an unclassed element or a position never qualifies.
- **The label stays the path.** For an own-name source, the label is the element's path, so the label the model sees, and its key, are unchanged where they can be.
- **Labels when items disagree, in `fieldSources`.** One own-name source can now be offered by items whose paths differ, for example an advert with an extra "Sponsored" row. Its label is the path most of the scanned items give it (`mostGiven`), not whichever item came first.
  - `peers` no longer walks the named item twice, so the tally is not skewed. It is the same set of distinct items as before.
- **Supporting edits.** `peers` is threaded through `elementSources`, `badgeSource` and `selectorWithinItem`. The module header and the `pathStep` and `selectorWithinItem` docs say what changed and why.

**New `apps/extension/src/content/extraction/composed-value/`**

- `composed-value.ts` holds `composesValue` and `isComposedPiece`.
  - `composesValue` asks for at least two children with no children of their own, and a whole whose `valueShape` no single piece has. That is a shape, never a reading of the words.
- `index.ts` is the barrel.
- `tests/composed-value.test.ts` holds its unit tests.
- **Why a directory and not `extraction/composed-value.ts`:** `extraction/` already held exactly 25 source files at HEAD, which is the audit's limit.

**`apps/extension/src/content/extraction/tests/fake-shadow-dom.ts`** (test support; additive only)

- `matchesStep` understands `:not([class])`.
- `querySelectorAll` understands a `:scope <step>` descendant query.
- Existing selectors behave as before.

**`apps/extension/src/content/extraction/tests/infer-fields.test.ts`**

- Two existing shadow-host rows matched `selector.endsWith("gl-time-ago")`, which the new `gl-time-ago:not([class])` step breaks. One of them, the absence row, would have passed vacuously. Both now use `TIME_AGO_STEP`, which accepts either form.
- Five new rows:
  - an unclassed title with or without a classed badge before it;
  - a price drawn in sibling spans, beside the original price, with its pieces not offered;
  - grid-detected fields read on a list layout, with labels still paths;
  - a guard: a class two elements share in another item is not used;
  - the majority-path label.

**`apps/extension/e2e/content/tests/live-tasks/tests/crossborder-marketplace-spain-hubs.spec.ts`**

- The `test.fail` markers came off G1 (`:390`) and G2 (`:492`).
- The G2 row now builds and replays all four columns, price included, and expects `EXPECTED`. Before, it expected `expectedWithout("price")`, so the price on the list layout keeps the coverage the old fix-proof row gave it.
- The old fix-proof row read hand-written selectors, so it proved nothing once detection emits them. It is now "the detection names the price by the element that draws it whole, and every column by its own class anywhere in the card (G1+G2)".
  - It asserts that the detected title, store, price, rating and ad columns use exactly `:scope div.<cardTitle>`, `:scope div.<storeName>`, `:scope div.<price>`, `:scope span.<ratingValue>` and `:scope span.<adTag>`.
  - It also asserts that the price label ends ` > div.<cls> (currency amount)`.

**What changes for a saved Flow**

- **Flows already saved:** nothing changes. A saved request carries literal selectors, and `field-reader.ts` is unchanged.
- **Flows built from now on:**
  - **Selectors:** they read classed or `itemprop` fields as `:scope tag.cls` / `:scope tag[itemprop=…]` wherever that names one element per card. Unclassed steps read `tag:not([class])`. Nothing else changes in the reader.
  - **Labels and keys:** they are unchanged for every source that existed before.
  - **Duplicate columns merge:** where the same element used to appear as two columns because items differed in path, it is now one column. The minority path's column, and its key, are gone. On the bike feed, the advert's `div:4 > span.<title>` column at 0.17 is gone, and the main title column keeps its `div:3` label and key at coverage 1.
  - **Price pieces:** a composed price adds one column, labelled with its path plus `(currency amount)`. Its piece columns (`…price > span:2 (number)`, `span:3`, `span:4`) and their keys are gone.

## Commands run and observed results

All were run from `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`, through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w28 <what>" …`.

- **Main typecheck:** `npx tsc -p apps/extension/tsconfig.json --noEmit` → exit 0 (final run).
- **Test typecheck:** `npx tsc -p apps/extension/tsconfig.test.json --noEmit` → exit 2. It prints exactly three errors, all `TS2610 'ownerDocument' is defined as an accessor in class 'FakeElement'…`:
  - `src/panel/extraction/tests/dialog-dom.ts(16,37)`
  - `src/panel/recording/review/tests/recording-review.test.ts(20,16)`
  - `src/panel/settings/tests/forget-confirmation.test.ts(17,16)`

  None of these files, nor `panel/chat/tests/fake-dom`, is modified in the tree (`git status`), so the errors predate this work. No error is in a file I touched.
- **Extraction unit tests only:** run with scratch runner `w28-unit.mjs`, kept in my session scratchpad and not in the repo. It bundles every `src/content/extraction/tests/*.test.ts` plus `composed-value/tests/*.test.ts` with esbuild exactly as `scripts/test-extension.mjs` does (`fluxiq` external), into `apps/extension/.test-build-scratch/t194-w28`, then runs them with node. Final run: `# tests 196 # pass 196 # fail 0`. The total moved between runs (174/186/200/196) as other workers added and removed test files in the same directory.
- **New tests fail on the old source:** the same runner with `W28_OLD=<git show HEAD:…/infer-fields.ts>`. An esbuild `onLoad` plugin substitutes HEAD's `infer-fields.ts` in the bundle; the working tree is never touched, and the plugin logs `[w28] old infer-fields loaded for …\infer-fields.ts`. Result: `# tests 12 # pass 8 # fail 4`.
  - Failing: "a heading's unclassed title…", "a price drawn in sibling spans…", "fields detected on the grid read the same columns on the list layout…", and "a field read by its own class is labelled with the path most cards give it…".
  - Their old-source messages match the fixture reports:
    - the title column `… > div > span` reads the badge;
    - the only price columns are `div.price > span:2 (number)`, `span:3` and `span:4`;
    - `store on the list layout via :scope > div.body > div.store` reads `[null, null, null]`.
  - **Exceptions to "every new test fails on the old source":**
    - The guard row "a class two elements of some item share is not a field's name" passes on HEAD by design. It pins that `ownName` does not over-apply.
    - The five `composed-value.test.ts` rows test a module that does not exist at HEAD, so on the old source they fail only by not bundling.
- **Structure audit:** `node scripts/structure-audit.mjs`.
  - With `composed-value.ts` first placed flat in `extraction/`, it failed `[directory-files] extraction/: 27` and `tests/: 29`, and also `list-reader.ts: 807 lines`, which belongs to another worker.
  - After moving my module into `composed-value/`: exit 0, `structure-audit: passed (145 warning(s), 118 baselined)`. By then the other workers' overflow was gone too. `infer-fields.ts` is 762 lines, which only triggers the 400-line advisory warning.
- **T2 baseline, before any edit:** `pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/extraction/tests e2e/content/tests/live-tasks/tests --reporter=list --output=e2e/test-results/t194-w28-base` → `4 failed, 101 passed (6.6m)`. The 4:
  - `job-board-listing:90` fails with "Execution context was destroyed".
  - Three `test.fail` rows already pass unexpectedly: kestrel G3 `:612`, bike `:227` and rotterdam `:354`.
- **T2 final:** same command with `--output=e2e/test-results/t194-w28` → `9 failed, 96 passed (5.1m)`.
  - **Extraction specs:** all 73 rows identical to the baseline (`diff` of the sorted ok/x lists: "extraction rows identical"). The one `x` is `job-board-listing:90`, the same "Execution context was destroyed" as the baseline.
  - **spain-hubs:** all 9 rows `ok`. Mine are `:390` G1, `:492` G2 and `:531` detection names. These three pass unexpectedly (Expected to fail, but passed):
    - `:342` G3
    - `:452` G4
    - `:463` G5

    Those gaps are owned by other workers' files (`detect-structure.ts`, `detect-pagination.ts`, `pagination.ts`). I did not remove their markers.
  - **kestrel:**
    - `:669` "grid-view, G1" passes unexpectedly, as predicted. I did not edit that spec.
    - `:506` "filter route, G1" is still an expected failure. Its runtime request chose `title: ":scope a.css-16ijmrv"`, the link text, and row m9 read "New listingKestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut", the same as the baseline.
    - `:618` G3 passes unexpectedly, as in the baseline. That is not mine.
  - **bike `:288` "once the failed batch is retried…"** fails. It passed in the baseline. The full message is in "Open questions".
  - **Rows passing unexpectedly that are not mine to judge:**
    - bike `:228`, as in the baseline;
    - rotterdam `:338`, which was an expected failure at baseline. I cannot say whether my change or another worker's caused it.

## Not verified

- **On the kestrel filter route** I did not read the new span column directly, because the kestrel spec only reads the link column. That the span column reads every title alone there is shown only indirectly:
  - the gallery equivalent passes ("grid-view, G1");
  - the spec's own `TITLE_WITHOUT_BADGE` read, `a span:not([class])`, passes in "filter route: the detection keeps the ads apart…";
  - the unit row passes.
- **The majority-label rule was not tested in isolation.** The unit row proves the final label. I reasoned, but did not run, that without the tally the label would be the advert's `div:3` path.
- **The tree was being edited concurrently.** These files changed under me during the runs: kestrel, bike and rotterdam specs, `detect-*`, `pagination`, `item-selector`, `list-*`, `load-retry`, and domain `condition-match`. So both T2 runs bundled other workers' in-progress source as well. Unexpected passes outside my gaps cannot be attributed.
- **No live browser or extension build.** None was run, per the brief.

## Open questions or contradictions found

1. **The bike-search row `:288` (and its `readFromProposal` helper, also used by expected-failing `:273`) depends on the defect G2 fixes.**
   - The helper's comment says the read leaves out sponsored posts "as a condition the sponsored cards fail -- they carry no title in the listing's place". It picks the title column by `/ > div:3 > span\./` with `coverage < 1 && > 0.5`.
   - A sponsored card has the same `span.<cardTitle>` one row lower (`apps/scenario-lab/src/scenarios/local-classifieds/view/card.ts:31-38`). Read by its own class, the title column now covers every card, coverage 1, under its old label `a.<card> > div:3 > span.<cardTitle>`.
   - Observed message: `the detection proposes a title column: … | a.x15di07y.x1ymot9v > div:3 > span.x15xh7lw.x16hgezu.x16rg0ot (1) | a.x15di07y.x1ymot9v > div:4 > span.x153ieiz.x19b50hr.x1ap30ym (1)`.
   - Even if the picker accepted it, `where title is present` would no longer leave the two adverts out.
   - **Suggested spec change, for its owner:**
     - pick the title at coverage 1;
     - leave the adverts out with the sponsor row, `… > div.<cardSponsor> > span:1` (coverage 0.17), `is: "absent"`, the way spain-hubs and kestrel do.

   I did not edit it; it is outside my brief.
2. **Kestrel's filter-route G1 row picks the link text, not the title column.**
   - To pass, its `taskColumns.title` should pick `/> a\.[\w-]+ > div > span$/` at coverage 1.
   - The underlying trap remains: a link whose words are a badge and a title glued together is offered as a column. That is because the text reader joins inline siblings without a space, and `offersOwnText` keeps a link whose words no single leaf states.
   - I did not withhold the link column. The kestrel keyword-route row (`:542`, passing) picks its title by the same `> a.<cls>` label and would regress.
3. **The kestrel and spain-hubs `test.fail` rows G3/G4/G5 now pass unexpectedly** in this tree. Their owners should take the markers off once their own changes are confirmed.
