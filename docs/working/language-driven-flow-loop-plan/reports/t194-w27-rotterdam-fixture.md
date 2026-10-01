# t194-w27: professional-network-rotterdam-data-engineers, fixture probe

Brief: t194-w27. Tree `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`, branch `task/t194-live-judge-answer`. No Lab, no model calls.

## Outcome

Done. The content script's own verbs walk the whole Stage 1 chain from the feed and the recorded read returns exactly `peopleRecords(ROTTERDAM_ENGINEERS)` (23 rows). The premium-upsell variant and the 429 security check work too.

A read built only from what `detectStructure` proposes does **not** return the 23. There are two product gaps, G1 and G2. Each has its own spec row, marked `test.fail` with its cause. A row flips to "unexpectedly passed" once its gap is fixed.

- **G1.** Asking the proposal for every page returns **20 rows**, with `paginationStop: page_repeated` and `truncated: false`. The read never reaches page 3, and it reports a short answer as a complete one.
- **G2.** A plan that names the numbered pager it can see has its `maxPages` silently dropped to 1. That read returns **10 rows**, truncated.

## What changed and why

- New spec, `apps/extension/e2e/content/tests/live-tasks/tests/professional-network-rotterdam-data-engineers.spec.ts` (438 lines).
  - Every press, keystroke, check and read is a `harness.runAction`. Its target is the `selector` that the content script's own `captureSnapshot().interactiveElements` gives for that element.
  - `page.*` is used only to wait or observe, with two exceptions:
    - the 429 row primes the site's limiter with three `fetch`es of the page's own results endpoint;
    - the variant rows arm `premium-upsell` through the Lab's `set-mode` API.
  - Both exceptions arrange the fixture. Neither acts for the product.
- There are seven rows:
  1. **Whole chain → recorded read.** Steps:
     - feed arrivals: "Not now" (a div with no role), the conversation close, cookie Accept;
     - type "data engineer" into the global combobox, then Enter (this loads a new document);
     - "See all people results" (new document);
     - Connections ▾ → `web.dom.check` on 2nd → Show results (new document);
     - Locations ▾ → type "Rotterdam" → click "Rotterdam, South Holland, Netherlands";
     - assert the dropdown closed and the place's checkbox was added checked;
     - reopen Locations ▾ → Show results (new document; the URL carries `geoUrn=["106169143"]` and `network=["S"]`);
     - `web.dom.extract_list` with the manifest's SEARCH_SCRIPT request. Asserts 23 rows equal to EXPECTED, `pagesRead: 3`.
  2. **The proposal.** Facts about the page's own proposal.
  3. **G1 (`test.fail`).** A read from the proposal through the domain evidence runtime, with scripted decisions and `paginate: {maxPages: 5}`. Expects the 23.
  4. **G2 (`test.fail`).** The same, with `paginate: {mode: "numbered", maxPages: 5}`. Expects the resolved `maxPages` to be 5.
  5. **429.** The read's page-2 request is answered with the security check, the read waits it out, and returns the 23.
  6. **Upsell.** "No thanks" (a div with no role) is clicked through the snapshot, the arrivals are answered, and the read returns the 23.
  7. **Upsell left open.** The read returns the 23 while the offer stays open (observation, asserted).
- When a step loads a new document, `actAndLoad` waits for `fluxiq.contentReady` in it. The harness's init script re-injects the content script into every document, so the harness never had to be reopened.
- No reply was lost to a document load. The keypress, the link click ("navigation … was initiated") and both Show results clicks all answered `succeeded` before their document died. That is observed, not guaranteed.

### What works (part 1)

- **Arrivals.** All three are listed by the snapshot and clicked: `succeeded`, with the validation reporting that the point landed on the target.
- **Global search.** Type passed and the field holds "data engineer". The keypress navigated to `/search/results/all/`.
  - Minor: its validation says "the field belongs to no form, so Enter submits nothing" while the page's own keydown handler navigated. The wording is misleading but the outcome was right.
- **Filter pills and Show results.** These are styled divs. The snapshot lists them and the clicks land.
- **2nd checkbox.** The `web.dom.check` validation passed. The visible panel's checkbox is the only rendered one; the All filters copy is hidden.
- **Recorded read.** `23 records from 3 pages`, `itemsSeen: 24` (the page-3 repeat was read once), `paginationStop: no_following_page`, `listWait.waitedMs: 0`. The skeletons were waited out.

### Typeahead (part 3): proven drivable

`web.dom.type` "Rotterdam" into `input[placeholder="Add a location"]` passed. After the 300 ms debounce the snapshot lists both suggestions as rendered `div`s:

- "Rotterdam, South Holland, Netherlands"
- "Rotterdam, New York, United States"

Their text tells them apart exactly. A `web.dom.click` on the Netherlands row `succeeded`. As the site intends, the dropdown closed and `input[value="106169143"]` was added checked. Reopening and pressing Show results applied it.

Caveat: result cards on the page also carry location lines with the same words, so the snapshot holds more than one element reading "Rotterdam, South Holland, Netherlands". The spec picks the row inside the typeahead by its selector prefix. A model has to tell them apart by position or context.

### Proposal (part 2), observed

- **Item.** `body > div:nth-of-type(1) > div:nth-of-type(1) > section > ul > li.css-043cgos`, `itemCount: 12` on page 1.
  - It matches the 10 organic results, the promoted Sanne de Wit (`data-ad-slot="srp-1"`) and the "Guildline Recruiter" product ad (`urn:gl:sponsored:88121`).
  - On page 2 it also matches the "people also searched" module.
  - It is one template, so it is one run. Telling them apart is left to `where`.
- **Fields.** Twenty columns, labelled only by structure. Three of them read the expected fields exactly:
  - `…div.css-17lgdj4 > a > span > span:1` is the name (coverage 0.92);
  - `div.css-16akq03 > div.css-1h153gb` is the headline (1.0);
  - `div.css-16akq03 > div.css-1npw4lr` is the location (1.0).
  - `data-ad-slot` is an attribute column with coverage 0.08.
  - The ad has **no** `data-ad-slot`. Its "Promoted" line falls in the *location* column and its name is null. A plan that only writes `data-ad-slot absent` keeps a row `{name: null, headline: "Find data engineers who are open to work…", location: "Promoted"}`. This was observed in an earlier iteration: 11 rows on page 1.
  - The spec's scripted plan therefore adds `{field: "name", is: "present"}`, which also drops the module on page 2.
  - **This is a judgement load on the model, not a product gap.** The vocabulary is offered; the packet shows no values, so the model has to infer it from the page.
- **Pagination.** `{mode: "next", next: "… section > div:nth-of-type(2) > button:nth-of-type(2)" (the "Next" button), maxPages: 1}`. The packet shows `pagination: "next_link"`.
  - The numbered buttons (`li > button`, with `aria-current` on the current page) were not proposed, because detection prefers Next (`detect-pagination.ts:94-99`).
  - `maxPages: 1` is deliberate (`detect-pagination.ts:84`).
- **429.** In no row did the read meet the check on its own: `challenges` was 0 after rows 1, 3 and 4. Row 5 primes the limiter, and then the read's page-2 request was challenged (`challenges` +1). The read waited out the self-clearing check and returned 23 from 3 pages.
  - `extract-list-continuation.spec.ts`'s header says its people-search row meets the check. In these runs, reads paced like that one did not. That claim is unverified.
- **Page-3 repeat and 0.7 s skeletons.** Both are absorbed by the reader in every mode that reached page 3.

## Gaps, causes, and the smallest fixes (not applied)

### G1: a script-driven Next that goes back to its own page stops a `next` read on page 2, and the read reports itself complete

Observed in row 3: `recordCount 20, pagesRead 3, truncated false, paginationStop page_repeated`. The rows are Mara Okafor … Lars Hoekstra; Matteo Ricci, Ewa Kowalczyk and Yara Haddad are missing. This is the "20 rows: stopped on page 2" wrong answer from w18.

Cause:

- `apps/extension/src/content/extraction/pagination.ts:376`: `const control = leadsToThisPage(named) ? pagerSuccessor(named) ?? named : named;`
  - The swap to the pager's following number only happens for a Next that is a *link* to this very document (`leadsToThisPage`, `:481-484`, which needs `linkAddress`).
  - Guildline's Next is a `<button>` whose script loads `initialPage + 1` (`people-client.ts:83`). From page 2 it reloads page 2.
  - The list changes (skeleton, then a redraw), so the advance counts, and `list-reader.ts:629-635` then ends on `page_repeated`.
- Contributing: `apps/extension/src/content/extraction/detect-pagination.ts:94-95` proposes `next` whenever a Next exists, even beside a numbered run with `aria-current`. That run is the control that would have worked: row 1's numbered read gets 23.

Smallest fix (pagination.ts). This extends the existing swap to Nexts that carry no address of their own:

```diff
@@ async function followNext(paginate: NextPagination, progress: PaginationProgress): Promise<PageAdvance> {
   const named = clickable(next, paginate.next);
-  const control = leadsToThisPage(named) ? pagerSuccessor(named) ?? named : named;
+  // A Next with an address is checked against this page before it is pressed.
+  // A script's Next has none, and Guildline's goes from page 2 to page 2
+  // forever (t194-w27), so where the pager beside it marks the current page
+  // and shows the one after it, that control -- where a working Next goes --
+  // is followed instead.
+  const control = leadsToThisPage(named) || linkAddress(named) === undefined ? pagerSuccessor(named) ?? named : named;
```

How it plays out on Guildline: `pagerSuccessor` walks up from Next to `div.pager` and finds the `aria-current` button and the one numbered after it. Page 1 goes to 2 and page 2 goes to 3. On page 3 there is no 4, so the read falls back to Next, which loads page 2. That page is all repeats, so the read ends on `page_repeated` with 23 rows.

The header comment at `pagination.ts:81-87` should be widened to match. A follow-up would make `pagerSuccessor` able to say "current is the last page", so that this ends as `no_following_page` instead.

Alternative (detection, `detect-pagination.ts:93-99`): when the level offers a numbered run with an `aria-current` page, propose `numbered` before `next`. That changes every proposal on pagers that have both, so it carries a wider blast radius than the fix above.

Proving tests:

- This spec's row 3 (`test.fail` "G1 …"), which flips to passing. Remove the `test.fail` line once fixed.
- A unit row for `src/content/extraction/tests/pagination.test.ts`, modelled on the store-pager rows at `:174-178`: a pager whose Previous, 1, 2, 3 and Next are `<button>`s, with 2 `aria-current` and Next's handler recording "2". `advanceFrom(2, <Next selector>)` should follow `[3]`. `store-pager.ts` draws links, so it needs a `buttons` option.

### G2: a plan's page bound is dropped when its `paginate.mode` is not the detected mode

Observed in row 4: the resolved request's `paginate` is `{next: "<Next>", maxPages: 1}`, and the read returns 10 rows, truncated (`page_limit`).

Cause: `domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts:216-217`

```ts
const sameMode = paginate.mode === undefined || paginate.mode === (detected.mode ?? "next");
if (!sameMode) return bounded;
```

This was written while detection proposed every page. Since 2026-09-24 the detected bound is always 1 (`apps/extension/src/content/extraction/detect-pagination.ts:84`, `PROPOSED_MAX_PAGES`).

So a model that sees the numbered pager on this page and writes `{mode: "numbered", maxPages: 5}` gets one page. The only signal is `truncated: true`. It is pinned by `domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/slot.test.ts:200` (`[{ mode: "numbered", pages: "button.page", maxPages: 2 }, NEXT]`).

Smallest fix (slot.ts, plus that test row). The detected control is still the one read, but the bound the model asked for is kept:

```diff
   const bounded = structuredClone(detected);
-  const sameMode = paginate.mode === undefined || paginate.mode === (detected.mode ?? "next");
-  if (!sameMode) return bounded;
-  const bound = bounded.mode === "scroll" ? paginate.maxScrolls : paginate.maxPages;
+  // A mode the plan names is a control it was never shown, so the detected one
+  // is read; how much of the list it asked for still holds (t194-w27).
+  const bound = bounded.mode === "scroll" ? paginate.maxScrolls ?? paginate.maxPages : paginate.maxPages ?? paginate.maxScrolls;
   if (bound === undefined) return bounded;
```

```diff
-    [{ mode: "numbered", pages: "button.page", maxPages: 2 }, NEXT]
+    [{ mode: "numbered", pages: "button.page", maxPages: 2 }, { ...NEXT, maxPages: 2 }]
```

Proving tests: that `slot.test.ts` row, and this spec's row 4 (`test.fail` "G2 …"). With G2 fixed but G1 not, row 4's read would still stop at 20 rows (G1); its assertion only checks the resolved `maxPages`.

Related, not a gap by design: `paginate: true`, or no `paginate` at all, reads the detected bound of 1 page (`slot.ts:213`). A model that writes `true` meaning "all pages" gets page 1, truncated. The packet does not say how many pages the list has.

### Not a dataset gap, but worth knowing: the upsell variant

Row 7: with the aria-modal Premium offer still open over the results, `web.dom.extract_list` reads all three pages (23 rows) and the offer stays open. The read presses pager buttons with `element.click()` (`pagination.ts`, `afterListChange` via `clickable`), which no scrim intercepts.

A Flow built on the unarmed site therefore passes the `-upsell` task's dataset without ever closing the offer. A person could not page behind it. This is a fidelity question for the lead; I propose no change here.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w27 t2" pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/live-tasks/tests/professional-network-rotterdam-data-engineers.spec.ts --reporter=list --output=e2e/test-results/w27`, run from the tree root after `core-libs.log` ended `rc=0`.
  - Final two runs: rc=0, `7 passed (57.2s)` and `7 passed (1.8m)`. Rows 3 and 4 are listed as `x` (expected failures).
  - In both runs row 3 failed with 20 rows and `page_repeated`, and row 4 with `maxPages` 1 and 10 rows truncated.
  - Earlier iterations failed on the spec's own target matchers (a button and its inner span; a card's "Accept"; card location lines) and on one strict-mode wait. All were fixed in the spec; none was a product failure.
- `node node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit` in `apps/extension`: no errors in this spec.
  - It still reports errors in the sibling specs `auction-marketplace-kestrel-auctions.spec.ts:514,554` and `local-classifieds-bike-search.spec.ts:23`. Those are not mine and I left them untouched.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (140 warning(s), 118 baselined)`. It includes an advisory `[file-lines]` warning for this spec (438 lines, past 400).

## Not verified

- Neither fix diff was applied or run; source edits were outside the brief.
- G1's fix behaviour on page 3 (falling back to Next, which goes to page 2 and ends `page_repeated`) is reasoned from the code, not run.
- Delivery between extension contexts is not covered by the harness: background worker, tab routing, and the extraction continuation across a document load. None of the reads here crossed a document.
- Firefox was not run.
- The model's real decisions were not run. The column mapping, the two `where` conditions and the `paginate` values are scripted.
- I did not measure whether the snapshot's compact view, as the domain serializes it for a model, shows the typeahead rows and "Not now". The raw `interactiveElements` does.

## Open questions or contradictions found

- `extract-list-continuation.spec.ts`'s professional-network row says reading three pages inside three seconds "is answered with a security check". In these runs, reads paced the same way met none (`challenges` 0). Only the primed row met one.
- Should G1 be fixed in the reader (my proposal, narrow) or in detection (prefer numbered beside `aria-current`)? Both are listed above; the lead decides.

```text
Outcome: Done
Changed: apps/extension/e2e/content/tests/live-tasks/tests/professional-network-rotterdam-data-engineers.spec.ts (new); docs/working/language-driven-flow-loop-plan/reports/t194-w27-rotterdam-fixture.md
Validation: `bash .../heavy.sh "t194-w27 t2" pnpm --filter @fluxiq-web-extension/extension test:content -- <spec> --reporter=list --output=e2e/test-results/w27` -> 7 passed twice (rows 3 and 4 are expected failures G1/G2); structure-audit passed
Not verified: proposed fixes not applied or run; Firefox; worker-side continuation; real model decisions
Report: docs/working/language-driven-flow-loop-plan/reports/t194-w27-rotterdam-fixture.md
Notes: G1 pagination.ts:376 (script Next page 2->2: 20 rows, truncated false); G2 slot.ts:216-217 (plan maxPages dropped on mode mismatch -> 1 page)
```
