# t194-w26: crossborder-marketplace-spain-hubs fixture probe

## Outcome

Partial. The spec runs: 9 rows, 4 pass, 5 fail. Each failure is a product gap with a named cause. No Lab and no model calls were used.

Answer to the brief's question: **the first live run of `crossborder-marketplace-spain-hubs` cannot pass as the product stands. G1 blocks it.**

On the honest route (the site's own filters), the product's actions and reads get almost everything right. They walk the whole node chain and read the lazy tail without help. Ads stay out, the rating condition works, Best Match order holds, and #2/#5 stay as separate rows. Title, store and rating come back exactly equal to `spainHubRecords()`.

The **price** is the problem. No detected column holds "16,49 €". The one column labelled `(currency amount)` is the struck-through original price ("29,99 €"), so a model that takes it produces a wrong answer that looks right.

The `-list-layout` task is also blocked by G2.

With both proposed fixes emulated (the selectors the fixes would emit, written into a literal request), the read returns all thirteen four-column records exactly, on the grid **and** on the list layout. That row passes.

## What changed and why

- New: `apps/extension/e2e/content/tests/live-tasks/tests/crossborder-marketplace-spain-hubs.spec.ts`. Nothing else was edited.
- **Walk:** every page action is `harness.runAction`. Each target is the element the content script's own snapshot lists under the words a person would use. `page.*` is used only to wait and observe. The one exception is the traffic screen's "I'm not a robot", which the task declares a person hand-off.
- **Reads:** they go through `createWebAutomationLlmEvidenceRuntime` with scripted decisions, as `list-completeness.spec.ts` does. The steps are: detect, read every column, then keep detected keys and write `where` over them.
  - The model is shown hashed-path labels and no values (D3). So columns are chosen by the values a full read showed, which is what a model must do.
- **Expected rows:** taken from `spainHubRecords()`, imported.
- **Cross-document reads:** the gateway plays the worker for cross-document `extract_list`.
  - It catches each `fluxiq.extraction.checkpoint` through an exposed binding that wraps the harness stub's `sent.push`.
  - When the document is replaced, it lets the person pass the traffic screen, then re-delivers the read with `extraction: { token, resume }`.

## Rows and observed results

Final run: 4 passed, 5 failed (2.0 min).

| # | Row | Result | Cause |
|---|---|---|---|
| 1 | Walk + lazy tail (filtered) | **pass** | — |
| 2 | Detection made the moment the narrowed results load | **fail** | G3 |
| 3 | Conditions keep the 13 (title, store, rating), ads out, Best Match | **pass** | — |
| 4 | Four-column answer equals `spainHubRecords()` (price) | **fail** | G1 |
| 5 | Unfiltered page 1 by conditions alone keeps the 6 page-1 rows | **pass** | — |
| 6 | Detection proposes the numbered pager | **fail** | G4 |
| 7 | Pager named as a fixed detection would name it, read across 3 documents with the traffic screen | **fail** | G5 |
| 8 | Literal request saved on the grid, replayed on the list layout | **fail** | G2 |
| 9 | Fix proof G1+G2: class-anchored fields, grid and list layout | **pass** | — |

### What works

Rows 1, 3, 5 and 9 pass. Rows 7 and 8 also prove parts of this before they fail.

- **Arrival:** `wait_for_text "Welcome back, Mara!"` → click "No thanks" → click "Accept all". The clicked targets are styled divs bound by `addEventListener`.
- **Search:** `web.dom.type` then `web.dom.keypress Enter`. The keypress validation passed: "the form fired a submit event with no submitter".
- **Notification prompt:** `wait_for_text "Never miss a price drop"` → "Not now".
- **Sidebar filters:** clicks on "Spain", "Free shipping" and "4★ & up" each loaded the narrowed URL (`shipFrom=ES`, `freeShipping=y`, `minStar=4`).
- **Traffic screen:** it replaced the third load (`route.ts:65`) as declared.
- **Region-picker trap:** it does not trap a click aimed by name. The snapshot lists exactly one interactive "Spain", under `main > div > aside > …`. The header picker's Spain is an `<option>` in a hidden panel of a shadow root and is not listed.
- **Lazy tail:** before any scroll, 10 cards are drawn. The read revealed the tail by itself and returned 19 items (16 organic + 3 ads), and the page then held 19 cards.
- **Ads:** detection proposes the "Ad" span as a partial column (coverage 0.2). `where [{field: ad, is: "absent"}]` keeps the ads out, including the paid copy of #3 and the ad-only Castellan 7-in-1 and Keelson 6-in-1.
- **The "4★ & up" band:** it is 4.0. With only the ad condition the read keeps 16 rows (the 4.1/4.3/4.4 near-misses stay). `{field: "rating", atLeast: 4.5}` on the card's rating text (`(number)` column) keeps exactly 13. The star-fill width is never offered as a column (only `data-*` item attributes are), but it is not needed.
- **Order and duplicates:** Best Match order is preserved. #2 and #5 (same title, stores "Voltbay Official Store" / "VoltBay Store") stay two rows. The saved request carries both conditions resolved into `read` specs.
- **Unfiltered page 1 alone:** "Ships from Spain" badge equals, "Free shipping" equals, ad absent and rating ≥ 4.5 keep exactly the first 6 of the 13.
- **Locale:** prices stay in the DE format ("16,49 €") when read whole (row 9).
- **Cross-document continuation on the page side:** a checkpoint is sent before each pager link. The resume is accepted in the next document, including after the person passes the traffic screen. Repeats are read once (`itemsSeen 60`, `kept 18`, `recordCount 11`).

### Gaps

#### G1 (blocks the task): no detected column holds the price as the card writes it

- **Where the price is:** the card draws it in sibling spans: `<div class=price><span></span><span>16</span><span>,49</span><span> €</span></div>` (`markup/cards.ts:38`).
- **Cause:** `apps/extension/src/content/extraction/infer-fields.ts:385` offers a text source only for a text leaf (`isTextLeaf`, `:615`) or a shadow host. The proposal therefore has `span:2 (number)` "16", `span:3` ",49" and `span:4` "€".
- **Why it can't be worked around:** the one `(currency amount)` column is `div:2 > span.priceOriginal`, the struck-through original. Through a handle a plan can only name detected columns, and a selector is refused (`domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts:22-26,236-265`). Concatenation is not expressible.
- **Observed:** every row read the original price ("29,99 €" for "16,49 €", "25,99 €" for "12,49 €", …), with title, store and rating correct.
- **Smallest fix:** offer an element whose childless pieces together state a currency amount that none of them states alone.

```diff
--- /dev/null
+++ apps/extension/src/content/extraction/composed-value.ts
+// A value the page draws in pieces. A storefront styles a price's whole number,
+// decimals and currency as sibling spans, so no one leaf holds the price and the
+// leaves alone propose "16", ",49" and "€". The element holding them states the
+// value whole. It is offered when its pieces together have a shape none of them
+// has alone (`value-shape.ts`) -- a shape, never a reading of the words.
+import { textOutsideSensitiveControls } from "../sensitive-text";
+import { valueShape } from "./value-shape";
+
+export function composesValue(element: Element): boolean {
+  const pieces = Array.from(element.children);
+  if (pieces.length < 2 || pieces.some((piece) => piece.children.length > 0)) return false;
+  if (valueShape([textOutsideSensitiveControls(element)]) !== "currency amount") return false;
+  return pieces.every((piece) => valueShape([textOutsideSensitiveControls(piece)]) !== "currency amount");
+}
--- apps/extension/src/content/extraction/infer-fields.ts
+++ apps/extension/src/content/extraction/infer-fields.ts
@@
+import { composesValue } from "./composed-value";
@@ (line 385)
-      else if ((isTextLeaf(element) || drawsShadowText(item, element, selector, label, sensitive)) && !statedMoreTightly(item, element)) sources.push({ kind: "text", label, selector, sensitive, pathLabel });
+      else if ((isTextLeaf(element) || composesValue(element) || drawsShadowText(item, element, selector, label, sensitive)) && !statedMoreTightly(item, element)) sources.push({ kind: "text", label, selector, sensitive, pathLabel });
```

- **Why it is narrow:** the original-price row `<div><span>29,99 €</span><span>-45%</span></div>` is not offered, because its whole ("29,99 €-45%") is not a currency amount. The badges row is not offered either.
- **Reader side already proven:** row 9 reads `:scope div.<price>` and gets "16,49 €" for all 13. `field-reader.ts` needs no change.
- **Proving tests:**
  - This spec's row 4 turns green.
  - Add a T2 row to `e2e/content/tests/extraction/tests/inference.spec.ts`: a card whose price is four sibling spans proposes a `(currency amount)` column reading "16,49 €".
- **Residual (G1b):** after the fix there are two `(currency amount)` columns, the price and the struck original. A model must tell them apart by values: the lower one, beside "-45%". Optional follow-up: label an element drawn `text-decoration: line-through` (or inside `<s>`/`<del>`) `(struck through)` in `describedLabel` (`infer-fields.ts:246-253`).

#### G2 (blocks `-list-layout`): saved field paths name a card's children by their place under the card body

- **Cause:** `infer-fields.ts:486-566` (`selectorWithinItem` → `pathWithinItem` → `pathStep`) anchors every field at the item through each parent. The rating row shares `metaRow` with the original-price row, so its step is positional: `:scope > div.cardBody > div:nth-of-type(3) > span.ratingValue`.
- **What the variant changes:** the list layout (`markup/cards.ts:29-31`) moves price and store into `div.listAside` and the rating row to `div:nth-of-type(1)`.
- **Observed replay of the grid build's saved request:** `status failed`. "19 records from 1 page, but where kept none of the 19 items …; where[1] rejected every one; required fields missing from some records: rating, store". The item selector still matched all 19 cards; only titles were read.
- **Smallest fix:** try the element's own step anywhere in the item before the full path, when it names the element alone and is not positional.

```diff
--- apps/extension/src/content/extraction/infer-fields.ts
+++ apps/extension/src/content/extraction/infer-fields.ts
@@ function selectorWithinItem(item: Element, element: Element): ElementName | undefined {
   const testId = testIdName(element);
   if (testId && namesOnly(item, testId.selector, element)) return { ...testId, path: false };
+  // The element's own step anywhere in the item, when that names it alone: a
+  // layout that moves the store into an aside, or the rating row up a place,
+  // keeps the element's class and loses its path.
+  const own = pathStep(element);
+  if (own && !own.selector.includes(":nth-of-type(") && namesOnly(item, `:scope ${own.selector}`, element)) {
+    return { selector: `:scope ${own.selector}`, label: own.label, path: true };
+  }
   const path = pathWithinItem(item, element);
```

- **Proof:** row 9 passes with exactly these selector shapes (`:scope div.<cardTitle>`, `:scope div.<storeName>`, `:scope div.<price>`, `:scope span.<ratingValue>`, ad `read :scope span.<adTag>`). It returns `spainHubRecords()` on the grid and, after `set-mode list-layout` and a fresh walk, on the list layout.
- **Proving tests:**
  - This spec's row 8 turns green.
  - Add an `inference.spec.ts` row: two layouts of one card, one proposal, reads in both.
- **Risk:** labels and keys of proposed fields change shape (shorter). Any spec asserting a path label will need updating.

#### G3: detection made while the results are skeletons names the sidebar

- **Cause:** `apps/extension/src/content/extraction/detect-structure.ts:118-120`. `settled()` accepts any `ok` answer and waits only on `no_repeating_run` / `target_not_found`.
- **What that does here:** for 600 ms after load the grid is 19 empty skeletons (`client/search-script.ts:46-61`). The largest readable run is then the sidebar's 5 filter groups, which is answered at once.
- **Observed:** `itemCount 5`, fields `div.css-1ezpaua`, `div.css-1h3taby > input:1 (text control)`, …
- **Severity:** low for a live build, which usually spends seconds of model latency between the click and the detect. It is real when a detect follows a load closely. A Flow's playback is unaffected (it replays the saved literal).
- **Smallest fix:** treat an answer as unsettled while the page shows a larger run of empty sibling placeholders, bounded by the existing `STRUCTURE_WINDOW_MS`.

```diff
--- /dev/null
+++ apps/extension/src/content/extraction/placeholder-run.ts
+/** Tags a skeleton is drawn with; a void or replaced element (img, input, br) is never one. */
+const PLACEHOLDER_TAGS = new Set(["DIV", "LI", "SPAN", "SECTION", "ARTICLE"]);
+/** The most sibling placeholders the page shows: three or more elements of one tag and class list under one parent, each with no element and no words inside. */
+export function largestPlaceholderRun(root: ParentNode = document): number {
+  let largest = 0;
+  for (const parent of root.querySelectorAll("*")) {
+    const groups = new Map<string, number>();
+    for (const child of parent.children) {
+      if (!PLACEHOLDER_TAGS.has(child.tagName) || child.children.length > 0 || (child.textContent ?? "").trim() !== "") continue;
+      const key = `${child.tagName}.${[...child.classList].sort().join(".")}`;
+      groups.set(key, (groups.get(key) ?? 0) + 1);
+    }
+    for (const size of groups.values()) if (size >= 3 && size > largest) largest = size;
+  }
+  return largest;
+}
--- apps/extension/src/content/extraction/detect-structure.ts
+++ apps/extension/src/content/extraction/detect-structure.ts
@@
+import { largestPlaceholderRun } from "./placeholder-run";
@@ (line 118)
 function settled(answer: WebAutomationStructureDetection): boolean {
-  return answer.ok || !WORTH_WAITING_FOR.has(answer.refused);
+  // A run smaller than the skeletons beside it is the page still drawing its list.
+  if (answer.ok) return answer.proposal.itemCount >= largestPlaceholderRun();
+  return !WORTH_WAITING_FOR.has(answer.refused);
 }
```

- **How it behaves here:** after the first batch is drawn, 10 cards against 9 remaining skeletons is settled.
- **Proving tests:**
  - This spec's row 2 turns green.
  - Add a T2 row to `e2e/content/tests/extraction/tests/structure-detection.spec.ts`: inject 5 sidebar groups and 12 skeleton divs replaced by cards after 600 ms; detection without a selector answers the cards.

#### G4 (unfiltered route only): the numbered pager is not detected

There are three causes, all on page 1 of the unfiltered search:

- (a) `detect-pagination.ts:110-123` groups digit-labelled controls by full template signature. The current page "1" is `a.pagerItem.pagerCurrent`, so the run splits into {"1"} and {"2","3"}.
- (b) `detect-pagination.ts:98` generalizes against `selectorFor(level)`, giving `<level> > a…`. The links sit one level down, in the pager div beside the grid.
- (c) `item-selector.ts:90` passes `first.classList`, although `ItemSelectorParts.classes` is documented as "The classes the items share".

**Observed:** packet `pagination: "none"` with three pages present. A model that writes `paginate` is then refused, because nothing was detected (`slot.ts` header), so an unfiltered Flow reads page 1 only.

**Smallest fix:**

```diff
--- apps/extension/src/content/extraction/item-selector.ts
+++ apps/extension/src/content/extraction/item-selector.ts
@@ (line 90)
-    classes: first.classList
+    classes: [...first.classList].filter((name) => run.every((element) => element.classList.contains(name)))
--- apps/extension/src/content/extraction/detect-pagination.ts
+++ apps/extension/src/content/extraction/detect-pagination.ts
@@ (line 98)
-    const pages = numbered.length > 1 ? generalizedItemSelector(numbered, selectorFor(level)) : undefined;
-    if (pages) return { mode: "numbered", pages: pages.selector, maxPages: PROPOSED_MAX_PAGES };
+    const pages = numberedPagesSelector(controls, numbered, level);
+    if (pages) return { mode: "numbered", pages, maxPages: PROPOSED_MAX_PAGES };
@@
+/**
+ * The selector naming the pager's numbered controls: every digit-labelled
+ * control first (the current page is the same control drawn with one more
+ * class), then the largest same-template group, each tried under the controls'
+ * own parent -- the pager beside the list -- before the level the walk reached.
+ */
+function numberedPagesSelector(controls: readonly Element[], numbered: readonly Element[], level: Element): string | undefined {
+  for (const run of [controls.filter(isNumberLabelled), numbered]) {
+    if (run.length < 2) continue;
+    const parent = run[0]!.parentElement;
+    const containers = parent && run.every((control) => control.parentElement === parent) ? [selectorFor(parent), selectorFor(level)] : [selectorFor(level)];
+    for (const container of containers) {
+      const found = generalizedItemSelector(run, container);
+      if (found) return found.selector;
+    }
+  }
+  return undefined;
+}
```

- **Expected result:** on page 1 this gives `<pager> > a.<pagerItem>`, which is exactly "1","2","3" (Previous is a div on page 1).
- **Proving tests:**
  - This spec's row 6 turns green.
  - Add a T2 row to `structure-detection.spec.ts`: a pager whose current number carries an extra class, inside a div beside the list.

#### G5 (unfiltered route only): a numbered read with no `aria-current` re-reads page 2 as "page 3"

- **Cause:** `apps/extension/src/content/extraction/pagination.ts:525-527`. With nothing marked `aria-current`, `followingPageControl` returns `controls[pagesRead]`. From page 2 on, Previous is an `a.pagerItem` too, so `pages` is [Previous, 1, 2, 3], and `controls[2]` is the link to page 2 itself.
- **Observed (row 7, pager named `.pager > a.pagerItem`):**
  - checkpoints `{pagesRead 1, records 6}`, `{pagesRead 2, records 11}`;
  - final `pagesRead 3`, `recordCount 11`, `itemsSeen 60`, `paginationStop "page_limit"`, `truncated true`;
  - page ended on `…search?q=usb+c+hub&page=2`;
  - #12 and #13 (only on page 3) never read.
  - The read reported 3 pages and did not notice that the third was a repeat.
- **Smallest fix:**

```diff
--- apps/extension/src/content/extraction/pagination.ts
+++ apps/extension/src/content/extraction/pagination.ts
@@ (line 525)
 function followingPageControl(controls: readonly Element[], pagesRead: number): Element | undefined {
-  const current = controls.find(isCurrentPage);
-  if (!current) return controls[pagesRead];
+  // A pager that marks nothing aria-current still links its current page to the
+  // document showing it, and from page 2 on its Previous may share the numbers'
+  // template, so the positional fallback counts numbered controls only.
+  const current = controls.find(isCurrentPage) ?? controls.find((control) => control instanceof HTMLElement && leadsToThisPage(control));
+  if (!current) return controls.filter((control) => pageNumber(control) !== undefined)[pagesRead] ?? controls[pagesRead];
   const number = pageNumber(current);
```

- **How it behaves here:** page 1 came from a form submit (`?cat=&q=…`), so no link leads to it and the numbered fallback gives "2". Pages 2 and 3 are the "2"/"3" link addresses, so the current page is found and the following one is "3", then none.
- **Proving tests:**
  - This spec's row 7 turns green (it should end on `page=3` with the 13).
  - A T1 row in `src/content/extraction/tests/pagination.test.ts` with the `store-pager.ts` fake: a pager [Previous, 1, 2, 3] with no `aria-current` whose "2" is a link to the document follows "3".

## Commands run and observed results

All runs were from the tree root `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`.

1. Core build log: `tail -3 …/scratchpad/t194s5/core-libs.log` → ends with `rc=0`. Checked before anything imported `fluxiq`.
2. Spec runs: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w26 t2" pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/live-tasks/tests/crossborder-marketplace-spain-hubs.spec.ts --reporter=list --output=e2e/test-results/t194-w26`, run repeatedly while building the spec.
   - Final run: `4 passed`, `5 failed (2.0m)`.
   - Each failure's first error is its GAP assertion: G3 at line 340, G1 at 387, G4 at 449, G5 at 459, G2 at 487.
   - Passing rows: lines 318, 353, 439, 522.
3. `node scripts/structure-audit.mjs` → `structure-audit: passed (140 warning(s), 118 baselined)`. The only warning about this file is the advisory `file-lines` (564 lines), which the sibling live-task specs also draw (677, 438).
4. Type check: `heavy.sh "t194-w26 tsc" npx tsc -p tsconfig.test.json --noEmit` (in `apps/extension`) → exit 0, 0 `error TS`.

## Not verified

- **None of the proposed fixes were applied or run** (brief: do not apply source fixes).
  - G1+G2 are proven only on the reader side: row 9 feeds the selectors the fixes would emit.
  - Whether `composesValue` and the `:scope <own step>` anchoring produce exactly those selectors, and what else changes in other fixtures' proposals and key names, is unverified.
  - G3, G4 and G5 diffs are untested.
- **The worker's half of the cross-document read** (`runtime/extract-list-continuation.ts`) was played by the spec's gateway, not run. It is covered only by `src/runtime/tests/extract-list-continuation.test.ts`, which I did not run.
  - How the real worker delivers a resume into the traffic-screen document, which only a person clears, is unverified.
- **Playback of the walk on a fresh load:** each node was aimed by the selector from that load's snapshot. Notably the search box's selector was `#fb100euuu`, an id the site mints per page load (`scenario.ts:19`). Whether a saved Flow re-resolves it by fingerprint on playback was not tested here.
  - Also observed: `DomElementDescriptor.name` was absent for that input; `name="q"` appears only in `attributes`.
- The welcome modal, consent and notification-prompt timings were waited out with `wait_for_text`. Their behaviour under a slower or faster Flow was not exercised.
- I did not test whether a model would actually choose these columns and conditions. The decisions were scripted.

## Open questions or contradictions found

- **`ItemSelectorParts.classes` mismatch:** it is documented as "The classes the items share", but `generalizedItemSelector` passes the first item's classes (`item-selector.ts:90`). This matters beyond pagination wherever a run's items carry modifier classes.
- **A numbered read overstates what it read:** it reports `pagesRead: 3` and `truncated: true` when its third document was page 2 again, and it holds 0 new records. `page_repeated` is described for `next` (`pagination.ts:84-88`) but did not fire for a numbered link to the current page.
- **The w18 node chain is right that "4★ & up" is a 4.0 band** (observed: 16 rows without the rating condition). The `where` over the rating text expresses ≥ 4.5 correctly, so the band is not a gap.
- **The w18 note "Extract grid cards without `.adTag`":** the product expresses it as `is: "absent"` on the proposed "Ad" column, and that works.
