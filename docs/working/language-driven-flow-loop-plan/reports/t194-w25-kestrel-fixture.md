# t194-w25: auction-marketplace-kestrel-auctions — fixture probe

## Outcome

Done. With no Lab and no model, the product's own content-script verbs walk the whole filter route on the real Hammerline fixture. The manifest's own read then returns the 10 owed rows exactly. Every site trap on the way is handled by the product.

A Flow built the way the live loop builds one will still fail the first live run, because of **G1**. That Flow reads columns from the structure detection's handle. On the badged listing m9, the title reads `New listingKestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut` (or `New listing` alone). All other cells (39 of 40) are right. **G2** sinks the keyword route on its own: the read stops at page 1 with 6 rows and `truncated: false`. G3 and G4 are secondary.

## What changed and why

- New: `apps/extension/e2e/content/tests/live-tasks/tests/auction-marketplace-kestrel-auctions.spec.ts` (T2 content harness, 10 rows).
  - The owed rows are imported from the scenario: `auctionMarketplaceManifest` workflow `expected.extracted`. So are the manifest's extract step and the live task's id and variants. The keyword search's listing count (50) comes from the catalog's own `searchListings`.
  - Every step is a `harness.runAction` verb: `wait_for_selector`, `click`, `type`, `keypress`, `capture_snapshot{detectStructure}` and `extract_list`. `page.*` is used only to wait for a document, to observe, and to tap the runtime stub's outbox so a checkpoint sent just before a navigation survives it.
  - Cross-document reads use `readAcrossDocuments`, which re-enacts the worker's half (`src/runtime/extract-list-continuation.ts`): a token, the last `fluxiq.extraction.checkpoint`, and a re-send with `resume` after the document goes, allowing 3 stalled documents. The content script's half runs for real in every document. The worker's own code does not run here; its unit test `src/runtime/tests/extract-list-continuation.test.ts` covers it.
  - The evidence-runtime rows build `createWebAutomationLlmEvidenceRuntime` over the harness exactly as `list-completeness.spec.ts` does: scripted decisions and no provider.
  - Gap rows assert the correct answer and are marked `test.fail(...)` with the cause. When a fix lands, Playwright reports "expected to fail, but passed", and the lead removes the marker.

## What works (proven by passing rows)

| Trap | Product behaviour observed |
|---|---|
| Arrival overlays: promotion, then greeting, then cookies | `wait_for_selector{visible}` and clicks all succeed in that order |
| Search: Enter in `_nkw` | keypress validation: "the form fired a submit event with the "Search" button as the submitter" |
| Condition click resets the format | Format tab reads `All listings` after Pre-owned + Seller refurbished; the Auction tab after them sticks |
| Bot check on the 4th results view | Lands on `/splashui/challenge`; Continue (or its 5 s self-clear) returns to the results |
| Max price: Enter submits nothing | keypress validation: "the form has no submit button and more than one field, so Enter does not submit it"; the address is unchanged after 1.5 s; the round-arrow div then submits `_udhi=150` |
| Sort ignores its first press | One click verb; validation actual: "…; the page ignored the first press, so it was pressed once more"; the menu opens; `_sop=1` |
| Skeleton hydration | `wait_for_selector ul[aria-busy="false"]` succeeds; the read's own list wait reports `stoppedOn: list_present` |
| Ads (`data-adid`) | Detection item `main > div > div > ul > li.<hash>` takes the 12 cards (10 + ads m4, n2). A `data-adid` column (coverage 0.17) is proposed, and `where {data-adid is absent}` leaves exactly the 10 |
| Price slot vs "or Buy it now" vs "approx. £" | Separate detected columns: price `div:3 > span.<price>` (coverage 1), estimate `div:3 > span.<muted>` (0.25, null for GBP), BIN line `div:4 > span.<muted>` (0.17). Price, bids and postage equal the owed values row for row |
| `where` vocabulary for the instruction | Expressible over detected columns, and resolved into `read`s, so the table keeps exactly title/price/bids/postage (asserted). The conditions are: ads `is absent`; condition line `equals "For parts or not working", not`; bids `matches \bbids?$`; estimate `atLeast 150, not`; `price startsWith "£", atLeast 150, not` (the GBP half; `startsWith` keeps it off foreign prices). See the model caveat below |
| Page overlap of 2 and the twin title | The numbered read across p1 → p2 → challenge → p3 returns 10 rows equal to OWED. m1 and m3 ("Kestrel 35 Rangefinder Camera") are both kept; the overlap rows are read once |
| Broken Next (not a gap) | A `next` read on the arrow went p1 → p2 → challenge → p3 and returned all 50 listings (`paginationStop: control_absent`). On p2 the arrow leads to its own page, and `content/extraction/pagination.ts` `pagerSuccessor` takes page 3 instead |
| feedback-survey variant | A click under the survey: "the execution recovered on attempt 2 after absorbing blocking_dialog, closing 1 dialog the page had put in the way". The survey is gone, and the manifest read is again equal to OWED |
| grid-view variant | Price, bids and postage are each a detected column equal to the owed values. G1's selector shape (`h3 a span:not([class])`) reads all 10 owed titles |

**On the "original 35 model only" condition:** it can only be written as a title regex that lists this page's lookalike spellings (`35\s*-?\s*s\b`, `\bm(?:ar)?k\s*(?:ii|2)\b`, `\b350\b`, `lens (?:only|cap|hood)`, `case only`, `box only`, `strap`, `filter`, `self-timer`, `instruction manual`, `flashgun`) plus `contains "kestrel 35"`. On the keyword route that worked across all three pages. A model can only write it after seeing every title, though. The robust route is the site's Model + Type filters, which the filter route uses and which need no `where` beyond the ad mark. I do not count this as a product gap: the vocabulary deliberately refuses product-inferred word lists (`request.ts:316-323`).

## Gaps, causes and smallest fixes (not applied)

### G1 — no detected column is the title alone (blocks the first live run)

- **Evidence:** filtered proposal columns `…> a.<title>` reads `New listingKestrel 35 Kamera…` (the badge and title glued, coverage 1). `…> a.<title> > div > span` reads `New listing` on m9 (coverage 1). On the keyword page there are also `> div > span.<badge>` (0.12) and `> div > span:nth-of-type(2)` (0.12). The runtime read (row "filter route, G1") returns the 10 rows with only m9's title wrong; the grid gallery behaves the same.
- **Cause:** `apps/extension/src/content/extraction/infer-fields.ts:559` (`pathStep`). On an unbadged card the title span is the heading div's only `span`, so the bare-tag step `span` is chosen. `resolvesIn` (`:649-659`) counts presence only, so on a badged card that same selector silently resolves to the badge, which is the first span, and the source keeps coverage 1. The badged card's title becomes a separate partial column (`span:nth-of-type(2)`).
- **Fix** (keeps labels and keys unchanged):
  ```diff
  @@ function pathStep(element: Element): FieldName | undefined {
     const testId = testIdName(element);
     const property = itemProperty(element);
  -  for (const candidate of [testId, property, named(`${tag}${stepClasses(element)}`), named(tag)]) {
  +  // An element the page gave no class is named as such, so a card's title span
  +  // is one step whether or not a classed badge ("New listing") sits before it.
  +  const classless = element.hasAttribute("class") ? undefined : { selector: `${tag}:not([class])`, label: tag };
  +  for (const candidate of [testId, property, classless, named(`${tag}${stepClasses(element)}`), named(tag)]) {
  ```
- **Proof:** rows "filter route, G1: …" and "grid-view, G1: …" flip to passing. The literal `span:not([class])` read already returns all 10 owed titles in list and gallery (rows "filter route: the detection…" and "grid-view: …").
- **Risk:** every classless path step's selector changes; labels and keys do not. Coverage can drop where some items put a classed element at the same position. Also, the link-text column still reads `New listingKestrel…`, so a model that keeps it instead of the span column will still miss m9. The text reader glues inline siblings without a space; see the open questions.

### G2 — numbered pager not detected on the keyword results (blocks the keyword route)

- **Evidence:** keyword proposal `pagination: null` (row "keyword route, G2"). Through the runtime the handle read sent no `paginate`: 6 rows from 1 page, `itemsSeen: 26`, `truncated: false`, so nothing says the list went on. `domain/.../plan-resolution/extraction/slot.ts:210-214` refuses a model-written pagination when none was detected.
- **Cause:** `apps/extension/src/content/extraction/detect-pagination.ts:98` names the numbered run with `generalizedItemSelector(numbered, selectorFor(level))`. Its candidates are `${container} > tag.classes` (`item-selector.ts:70`), so they only name the level's own children. Hammerline's page links sit one level further down, in `nav[aria-label="Results pagination"]`. The run also leaves out the current page, which carries an extra class (`:123` groups by class signature), and `followingPageControl` needs that current page to find the next one. The arrow's label "Go to next search page" is not a `NEXT_LABEL` (`:43`), so `next` mode is not reached either. That is fine: do not widen `NEXT_LABEL` for this.
- **Fix:**
  ```diff
  -    const pages = numbered.length > 1 ? generalizedItemSelector(numbered, selectorFor(level)) : undefined;
  -    if (pages) return { mode: "numbered", pages: pages.selector, maxPages: PROPOSED_MAX_PAGES };
  +    const pages = numbered.length > 1 ? generalizedItemSelector(numbered, selectorFor(level))?.selector ?? pagerControls(numbered) : undefined;
  +    if (pages) return { mode: "numbered", pages, maxPages: PROPOSED_MAX_PAGES };
  @@
  +/**
  + * A pager drawn in an element of its own below the level the search reached --
  + * a `nav` beside the list: every control of the run's tag directly under the
  + * run's parent, the current page included, which the pager styles apart and the
  + * read needs to find the page after it (`pagination.ts` `followingPageControl`).
  + */
  +function pagerControls(numbered: readonly Element[]): string | undefined {
  +  const parent = numbered[0]?.parentElement;
  +  if (!parent || numbered.some((control) => control.parentElement !== parent)) return undefined;
  +  return `${selectorFor(parent)} > ${numbered[0]!.tagName.toLowerCase()}`;
  +}
  ```
- **Proof:** row "keyword route, G2" flips to passing. The literal `nav[aria-label="Results pagination"] > a` numbered read across documents already returns exactly OWED (row "keyword route: …"). When G2 lands, that row's G2-footprint assertions (`request.paginate` undefined, fewer than 10 rows, `truncated: false`) will fail. Rewrite it to read through the handle across documents, without the supplied `paginate`.

### G3 — continental decimal comma misread in `where` bounds and number sorts (latent)

- **Evidence:** `webAutomationExtractConditionNumber("EUR 169,00")` is 16900 and `("EUR 1.165,00")` is 1.165 (row "G3").
- **Cause:** `domain/src/actions/extraction/condition-match.ts:98` (`NUMBER = /-?\d[\d,]*(?:\.\d+)?/u`) and `:205`.
- **Effect here:** the correct condition is on the pound estimate, so this task is not affected. A model that bounds the price column would drop m2 (EUR 109,00 read as 10900) and keep x7 (EUR 1.165,00 read as 1.165).
- **Fix:**
  ```diff
   const NUMBER = /-?\d[\d,]*(?:\.\d+)?/u;
  +/** A decimal comma: `169,00`, `1.165,00`. At most two decimals, so `1,000` stays a thousand. */
  +const DECIMAL_COMMA = /-?\d{1,3}(?:\.\d{3})+,\d{1,2}(?![\d.,])|-?\d+,\d{1,2}(?![\d.,])/u;
  @@ webAutomationExtractConditionNumber
  -  const found = NUMBER.exec(value);
  +  const comma = DECIMAL_COMMA.exec(value);
  +  const found = NUMBER.exec(value);
  +  if (comma !== null && found !== null && comma.index <= found.index) {
  +    const number = Number(comma[0].replaceAll(".", "").replace(",", "."));
  +    if (Number.isFinite(number)) return number;
  +  }
     if (found === null) return undefined;
  ```
- **Proof:** row "G3" flips, plus cases in `domain/src/actions/extraction/tests/condition-match.test.ts`: `EUR 169,00`→169, `EUR 1.165,00`→1165, `$1,299.00`→1299, `12,345`→12345, `+EUR 14,50 postage`→14.5.

### G4 — a read whose every record is empty passes (grid-view row; needs a policy decision)

- **Evidence:** on the gallery, the list layout's read gives `recordCount 10, emptyRecords 10`, `status: succeeded`, `validation.status: passed`, with actual "…every returned record is empty, so the fields were read off the wrong element".
- **Cause:** `apps/extension/src/content/actions/extract-list.ts:164` (`validationFor` passes whenever `missingFields` is empty, and string-grammar fields are optional, D16).
- **Fix** (if the lead agrees that an all-empty read is never an answer):
  ```diff
  +  const allEmpty = outcome.records.length > 0 && (outcome.emptyRecords ?? 0) === outcome.records.length;
  -  if (outcome.records.length >= minItems && outcome.missingFields.length === 0) {
  +  if (outcome.records.length >= minItems && outcome.missingFields.length === 0 && !allEmpty) {
  ```
- **Proof:** the grid-view row's `validation.status` assertion flips to `failed`.
- **Not verified:** whether the domain's playback or repair already treats `emptyRecords === recordCount` as failure. If it does, G4 is moot.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w25 t2" pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/live-tasks/tests/auction-marketplace-kestrel-auctions.spec.ts --reporter=list --output=e2e/test-results/t194-w25`. This was run from the tree root after the core-libs log ended `rc=0`. It ran five times while I iterated; the final run gave **10 passed (1.7m), rc=0**. `ok`: the two filter-route rows, the keyword cross-document row, the Next-arrow row, grid-view and feedback-survey. `x` (expected failures): G1 filtered, G1 grid, G2 and G3. Run 2's two genuine failures were spec bugs, both fixed: a `where` naming a field the read did not take, and a probe click on a navigating link under the survey.
- `npx tsc -p <scratch tsconfig extending apps/extension/tsconfig.test.json, files: [the spec]> --noEmit` gave **rc=0**. The whole-project `tsc -p tsconfig.test.json` stopped on syntax errors in another worker's in-progress `crossborder-marketplace-spain-hubs.spec.ts` (TS1002 at 286:83), not in this spec.
- `node scripts/structure-audit.mjs` gave **"structure-audit: passed (140 warning(s), 118 baselined)", rc=0**. Its only warning on this file: `[file-lines] … auction-marketplace-kestrel-auctions.spec.ts: 672 lines is past the 400-line advisory threshold` (advisory, same as the sibling live-task specs).

## Not verified

- The worker's own continuation code in a real extension; it is re-enacted here. The worker's handling of a click whose reply is lost to navigation: the round-arrow div and the challenge's Continue answered "document replaced" in the harness. Chrome or Edge with the real extension was not run.
- What a live model picks from the packet. In particular, whether it would keep the span column or the link-text column for the title after G1's fix.
- None of the four fixes was applied or run against the suites. The G1 and G2 blast radius on other fixtures' detection specs is unmeasured.
- G4's interaction with domain playback and repair.

## Open questions or contradictions found

- The text reader glues inline siblings (`New listingKestrel…`). Should a link-text column that contains a deeper text column be dropped, or read with separators? That is a second line of defence for G1 that I did not trace.
- The Stage 1 report says "numbered links only, since Next reloads page 2 forever". The product actually recovers from that Next (`pagination.ts` `pagerSuccessor`), so either mode reaches page 3.
- The Stage 1 report says the bot check comes "from the 4th results view". Confirmed: on the keyword route it comes between page 2 and page 3, inside the read, and it clears itself. The cross-document read survives it as a stalled document.
