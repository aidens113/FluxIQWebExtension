# t174-w21: why the everything-store build's search found nothing and never reached the product

Worker t174-w21, 2026-09-30. Evidence: live run 21, `run-muntufao-7b7bc04a` (everything-store-kettle-to-cart),
its debug (`debugs/run-muntufao-7b7bc04a.md`), bundle, UI review PNGs and window JPGs under
`test-runs/instances/t174-slot-1/`. Privacy: search terms, product and store names are described by kind
only.

## Outcome

Done. The owning cause is in the evidence, not the press nodes: **the page said "No results", and the
packet the model read never carried that line.** The extension's snapshot ranks all text behind every
control (footer links included), and the packet keeps the first 40 elements (about 30 once the 6,000-byte
budget bites), so on a results page the page's own statement of its result is never in it. Fixed at the
owning line (`apps/extension/src/content/dom-snapshot.ts`, `snapshotElementBucket`) with a new rule
(`content/evidence/lead-statements.ts`): up to three short lines that are the `main` region's own text rank
with the page-state controls. Failing-first test, then the extension suite, `tsc` and the structure audit
all pass. Live behaviour is not verified (no browser runs allowed to this worker).

## What happened, step by step

**How the search was made** (Core log call ids read by kind, step records, PNGs 04/09/10/15, JPG 00025):
typed and pressed. d3 dismissed a prompt, d4 `dom-type` into the header search box, d5 `dom-click` on the
search button (934-byte result: the store's first-search soft check), d6 `dom-click` passed the soft check
and landed on the results page (5,116 bytes, `pageState: changed`). Later loads of the same search were
`browser-navigate` to the search address the model wrote itself (d16, d35, d48, d49; the address bar in
JPG 00025 carries the same query, the last one plus a brand filter).

**Why it returned nothing.** The query held the brand, the product, the colour and the capacity with the
unit spelled out as a word. The store matches a listing only when every query word is one of that
listing's title words (`catalog/search.ts`, `matches`), and the product family shows in a search as one
card, its first child, whose title ends in a different finish and writes the capacity with the unit
abbreviated (`catalog/kettles/{kettles.ts,tidewell-kettles.ts}`). Measured offline against the built
catalog: the brand plus the product type returns 4; add the colour and it returns 0; the unit word alone
also returns 0. So any query naming the colour finds nothing; the scenario's own workflow searches the two
words brand + product type (`workflows/add-to-cart.ts`). The model's query was a reasonable reading of
the instruction; the store is strict on purpose (the debug's Stage 1: "search with a short query").

**What the page said, and what the model was shown.** The page states it twice and gives advice: a
results-bar count "No results for ..." (a `<span>` in `main`) and, after the filter rail's `<aside>`, two
`<p>` lines, "No results for ..." and "Try checking your spelling or use more general terms." (PNG 04,
`pages/results/search.ts:15,38`). None of it can reach the packet:
- The packet's page fields are location (origin and path, **no query**), title (reads like any results
  page's: the store name and the query), dialogs, loading, overlays (`domain/.../llm-evidence/page-evidence.ts`,
  `sanitize.ts`). No page text.
- Its elements are the capture's ranked head: `sanitize.ts` takes the first 40, then trims the tail to
  6,000 bytes. The capture ranks by bucket (`content/dom-snapshot.ts` `snapshotElementBucket`): event-backed
  0, page-state controls 1, page controls 2, links 3, other controls 4, **footer controls 5, text 6**, other
  text 7+. The no-results page renders 57 control tags (header search form, department select, filter
  rail, price form, sort, banner, chat, nav, footer links and signup). `evidence/controls.ts` already
  records the measurement on this very page: the packet carried 27 elements at its budget, every one a
  control. The run's own packets fit that: d6's 5,116 bytes and d16's 5,799 are a full packet of controls.
- Page-wide detection on a page with no results can only find the page's furniture, and it answered
  `web.structure.detected` (1,646 / 1,667 bytes) with no word about where the list sits; the reads that
  followed answered `web.inspect.succeeded` (7,133 / 7,162 bytes). The model named them as reads of the
  product's results (`detect1`, `extract1`, later `extractkettle1`), so it believed it had results.

So the model's query was the trigger, and the evidence took away the one thing that would have let it
correct itself: the page's own "no results" line and its advice to use more general terms.

## The fix

`apps/extension/src/content/evidence/lead-statements.ts` (new), `mainLeadStatements(candidates, order)`:
an element is a lead statement when it has its own text nodes under a parent that has none (a line is
lifted once, not again for the bold query inside it), it is at most 200 characters, its nearest landmark is
`main` (a labelled `region` is passed through; `aside`, `nav`, header, footer, search and form landmarks
are their own), and nothing up to `main` is a control's words (links, buttons, form controls, labels,
options) or a record. The first three in document order are lifted. A page with no `main` lifts nothing.
Cheap checks first; `visibleText` (a subtree walk) is asked last, behind a raw-length bound, because this
runs on every candidate of every capture.

`apps/extension/src/content/dom-snapshot.ts`: `snapshotElements` computes the set once
(`mainLeadStatements(included, composedDocumentOrder)`), and `snapshotElementBucket` puts a lead statement
in bucket 1 with the page-state controls. Priority still orders inside a bucket and text scores below any
control, so the lines come right after the page-state controls and ahead of the page's other controls and
links. On the no-results page that places the count and both empty-state lines at about positions 16 to
18 of a packet that holds about 30, costing three tail links. On an ordinary results page the result count
("1-16 of ... results") is lifted too. Comments on the bucket function and the evidence barrel say why.

Why here and not in the domain: the domain sanitizer takes the ranked head it is given; which elements
are worth describing first is the extension's ranking, which placed prose last on purpose ("a footer link
is at least something to act on"). That decision is the owning line.

## Why the 8 presses "changed nothing" (part 3)

The 8 presses are iterations 33-36, 38, 40, 60 and 61 (d30-d33, d34, d36, d51, d52), all `dom-click`,
`web.action.succeeded`, `effectApplied: true`, `pageState: unchanged`, 5,124-5,155 bytes. The model's
call ids name them as add-to-cart presses. Each was made **on the no-results page**: the navigation right
before them (d29, d35, d48/d49) came back 5,799 / 5,771 / 5,871 bytes, the same packet as the no-results
search (d16, 5,799), and PNGs 09, 10 and 15 show that page at those times. That page has no add-to-cart
control. Which control each press hit is not in the bundle (the step record carries no target, a gap the
debug already lists). So they changed nothing because the build was on the wrong page, a consequence of
this cause, not a press that misfired.

It is **not** t193's F2. F2 is a press that did change the page, where the result said only
`pageChanged: true` and not what changed (the store chip). Here the result said `pageChanged: false`,
which was true. Not fixed twice. Related, for whoever lands it: t195's F17 (on the t195 tree, after round
1, not in this build) tells the model to press the same control once more after an unchanged press. On a
page like this that advice buys a second futile press.

The one press that did change the page, the save-for-later at 43 (d38), left a pending line and the
first-save failure unretried (debug cause 6). That is F2's family (a result that does not say what
changed) and is left to t193.

## Commands run and observed results

- Offline render of the built scenario (no browser): the no-results page has 57 control tags and 23 text
  tags in its markup, and the empty-state message is present. `searchCatalog` counts: brand + product
  type 4, + colour 0, brand + product + colour + capacity + unit word 0, "electric kettle" 8.
- Failing first. The new test file was bundled and run alone (`scratchpad/w21-focus.mjs`, the suite's
  esbuild options) against a placeholder `mainLeadStatements` that returns an empty set, i.e. today's
  ranking: `# tests 6 # pass 3 # fail 3`. The three that need a line lifted failed (`not ok 1` the
  no-results page, `not ok 4` at most three, `not ok 5` a status line beside an item and prose); the three
  negative guards passed, as they should.
- With the rule: `# tests 6 # pass 6 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit` in `apps/extension`: rc 0 (after the wiring).
- `EXTENSION_TEST_BUILD_LABEL=t174-w21 bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w21" pnpm --filter @fluxiq-web-extension/extension test`:
  rc 0, `# tests 1333 # pass 1333 # fail 0 # cancelled 0`, zero `not ok`. The new tests ran in it
  (`ok 633 - a search that found nothing: ...`).
- `node scripts/structure-audit.mjs` (DS): `structure-audit: passed (125 warning(s), 120 baselined)`.
  `content/dom-snapshot.ts` carries the 400-line advisory warning (412 lines; it was 402 before this change,
  so the warning is not new).
- Every save compiled: the module landed unused, then the barrel export, the import, the bucket function
  with an optional set, the call site, then the parameter made required.

## Not verified

- **Live behaviour.** No browser or Lab run (the brief forbids it). The extension's Node suite cannot run
  `captureSnapshot` itself (no DOM), so the new rule is unit-tested on stubs and the ranking change by
  reading the code. That the three lines now reach the packet on the real no-results page, and at what
  position, is inferred from the bucket order and the measured packet size. The next everything-store run
  (or `e2e/content` evidence specs, a browser harness) confirms it.
- Whether the model then shortens its query. The page's advice is now in the packet; what deepseek-flash
  does with it is not tested.
- What exactly the detections and reads on the no-results page found (which furniture list); not in the
  bundle.
- The domain suite was not run: nothing in `domain/` changed.
- Run 23 (`run-munuks76-80ecb268`, bigbox) was compared only far enough to see it is a different
  mechanism: it reached product pages (PNG 05) and then repeated navigations with 1,208 / 1,845-byte
  packets. Not investigated.

## Open questions or contradictions found

1. **The store's search is stricter than the real thing.** It matches only the family card's own title,
   which names one finish, so no query naming the colour the instruction asks for can ever find the
   product, and the unit spelled as a word fails too. The debug's Stage 1 treats a short query as the
   intended path, so this looks deliberate; the supervisor may want to confirm, since it makes this task
   depend on the model discarding two of the instruction's attributes before it has seen the page.
2. **Detection on a page with no content list says only "detected".** The structure packet
   (`domain/src/runtime/llm-evidence/structure/packet.ts`) gives item count and fields but not the landmark
   the list sits in, so a footer or a filter rail reads like results. Adding the list's landmark
   (`navigation`, `complementary`, `contentinfo`) would let a model see it read furniture. Recommendation,
   not fixed; no lane owns it (t194 owns extraction F5-F7, not detection).
3. The rule lifts nothing on a page without a `main` landmark. The everything store has one
   (`pages/shell.ts:53`); the other nine scenarios were not checked.
4. The model loaded the same failing search five times, including by writing the search address itself
   (d16, d35, d48, d49). With the page's line now visible that should stop; if it does not, it is the
   repeat/no-progress family (debug causes 7 and 8, t174 / t195), not this cause.
