# t107 — the packet stops repeating itself, and crossborder's filters reach it

## Outcome

Done. Both defects are closed, measured model-free in the content harness on
four of the ten campaign sites, before and after, with the same spec and at the
live 6,000-byte budget.

- **The repeated address is gone.** No packet element publishes an address
  identical to the packet's own `location`. On the everything store that was
  twenty-two of thirty-two described elements carrying the same 58-byte string:
  **1,320 bytes of 6,000, 22% of the budget**. It bought eight more described
  elements on that page, nine on crossborder, four on the big-box retailer and
  two on the job board, at the same budget.
- **Crossborder's filters are in the packet.** "Spain", "Free shipping" and
  "4★ & up" — the three the site's own instruction turns on — plus the other
  seven rail options, the price-range button, two sort tabs, the page-jump
  button and the consent banner's three answers. Before: none of them, at any
  budget, because the capture ranked them 58th to 63rd of 292 and the packet
  describes at most forty.

No bound and no byte budget was raised. No fixture was edited.

## What was measured, and what the numbers are

Real content script in headless Chromium on the Scenario Lab fixtures, the real
domain sanitizer over what it captured, `sanitizeWebLlmSnapshot` with no budget
named so the 6,000-byte exploration default holds. Every row below asserts the
packet is within that budget before it reads anything out of it. Each site was
measured twice — once with the code at `HEAD`, once with the change — by
swapping the three source files and re-running the same spec, and the two
element lists were diffed by name rather than compared by eye.

| Site and state | elements | bytes | repeated addresses |
| --- | --- | --- | --- |
| everything-store, banner up | 32 → **40** | 5,776 → 5,851 | 22 (1,320 B) → **0** |
| everything-store, banner answered | 33 → **39** | 5,856 → 5,735 | 22 (1,320 B) → **0** |
| crossborder-marketplace, loaded | 31 → **40** | 5,841 → **3,767** | 19 (1,368 B) → **0** |
| bigbox-retail, banner up | 36 → **38** | 5,490 → 5,864 | 4 (248 B) → **0** |
| bigbox-retail, banner answered | 36 → **40** | 5,809 → 5,566 | 10 (620 B) → **0** |
| job-board | 31 → **33** | 5,731 → 5,870 | 8 (448 B) → **0** |

Four of the six packets stopped being cut by the byte budget and are now cut by
the domain's forty-element bound instead (`budgetTruncated` false). Crossborder
finishes 2,233 bytes under budget with forty elements described.

**The facet t100 rescued is still present and still early.** "Brightaisle Plus"
is at index **9** of the everything store's packet, banner up and banner
answered, exactly where t100 left it. All five of t100's rows still pass
unchanged.

### Nothing was dropped, except on one site

Diffing the described names before and after:

- everything-store (both states), bigbox-retail (both states), job-board:
  **nothing dropped**. Eight, four, two, four and two elements *added*
  respectively — four more "Add to cart", the store's home link, "2 items in
  cart", the "Deliver to" control, bigbox's "Sort by" and "+ Add", two more job
  cards.
- crossborder-marketplace: **nine dropped, eighteen added**. The nine are seven
  product links, the site logo and the pager's "1". The eighteen are the ten
  filter options, "OK", "Go", the "Best Match" and "Newest" sort tabs, the
  consent banner's three answers and its "Cookie policy".

That one trade is stated plainly because it is real. Crossborder's packet is
now cut by the forty-element bound, and sixteen controls moved ahead of the
result links, which is the same judgement this ranking already makes on every
other site — the everything store's packet has never held a product link, before
this change or after t100's, for exactly the reason `isPageControlElement`
records: a page's results are one repeating structure, while the controls that
narrow them are described nowhere else. The seven links that went were seven of
twenty-four cards, an arbitrary sample the model could not have completed, and
the page's cards are read by extraction rather than one link at a time. Against
that, without the filters the page cannot be narrowed at all, which is the
whole of that site's instruction.

## What changed

Three files changed, one added, all inside the paths the brief assigned.

**`apps/extension/src/content/evidence/controls.ts`** (+163 lines) gains a
fourth rule and one shared predicate.

- **`isDrawnControl`** — a control the page built out of something that is not
  one: a `<div>` with a pointer cursor and a listener attached in script. The
  browser makes nothing of it, so no existing rule reaches it and it ranks in
  the last control band, behind every link on the page. It is now ranked with
  the page's *own* controls (band 2). Deliberately not with the page-state
  controls (band 1): that band claims the control changes what this page shows,
  and no `<div>` discloses that. Band 2 claims only "this is a control of this
  page", which is what can be read.

  Four guards, each measured to be load-bearing across all ten campaign sites
  before it was written:

  1. not something the browser already makes a control of — this keeps the
     big-box retailer's eighteen facet `<label>`s out, whose checkboxes are
     already described;
  2. not a record and not a container of records — this keeps the job board's
     twelve clickable `<article>` cards, and the listings, posts and products
     on five other fixtures, out; without it the page's own contents would rank
     ahead of every way of narrowing them;
  3. its clickability is its own — a pointer cursor is inherited, so every
     descendant of a clickable `<div>` looks clickable; only the outermost is
     the control. In crossborder's filter rail this is eleven controls instead
     of twenty-one elements, ten of them the empty `<span>` a filter option
     draws its checkbox with;
  4. it says in its own words what it is — its own text nodes, or an
     `aria-label`/`title` the author wrote. A clickable region whose every word
     belongs to a child is a panel, and what there is to press is inside it.
     Crossborder's account flyout wrapper was the packet's single most expensive
     element under the first three guards: 180 characters of its children's text
     for a handle that opens a drawer.

  Measured with all four guards, across all ten campaign sites: **twenty-five**
  admitted on crossborder — its ten filter options, the price-range button, five
  sort tabs, the pager and page-jump, the consent banner’s four and two cart
  controls, every one of them something a reader can press and none of them
  reachable any other way — and **at most two on each of the other nine**, none
  at all on six. The big-box retailer, the job board, local-classifieds,
  photo-social, social-network-feed and professional-network admit nothing; the
  everything store admits its banner close box and its delivery-address control,
  auction-marketplace its "Reject all", company-website its "Request a quote"
  and "Cookie settings".

- **`addressesThisDocument`** — whether a link's address is this very page, same
  origin and path, whatever the query. It is `isSameDocumentQueryLink` less the
  query, so the two share one reading of "this link points at the page it is
  on".

**`apps/extension/src/content/evidence/link-address.ts`** (new, 66 lines) holds
the one rule that decides whether a link's address is worth carrying:
`repeatsTheDocumentAddress`. It is separate from `controls.ts` because it
answers about the descriptor rather than about ranking, and because putting it
in `dom-snapshot.ts` took that file from 374 lines to 421, past the structure
audit's 400-line advisory threshold. It is now 385.

**`apps/extension/src/content/dom-snapshot.ts`** (+19 lines): `snapshotDescriptor`
drops `descriptor.href` when that rule holds, and `controlBucket` asks
`isDrawnControl` of what falls through every other control test.

**`apps/extension/src/content/evidence/index.ts`**: the two new exports, and a
header that now names both rules that answer about an element rather than about
the page.

### Why dropping the address costs nothing

Three things, all of them checked rather than argued:

1. **The full address is still on the wire.** `describeElement` puts the `href`
   attribute the author wrote into `attributes` as well — *query included*,
   which the packet's stripped copy never had. Recorded web state
   (`domain/src/recording/web-state/state-values.ts`), the element fingerprint
   (`domain/src/output-nodes/targets/targets.ts`) and every other reader of the
   snapshot still has the real destination. A spec row proves it: the
   "Brightaisle Plus" facet has no `href` and its `attributes.href` still reads
   `…?k=wireless+earbuds…`.
2. **The element must already be named some other way.** An `href` is the last
   identity a descriptor falls back on — `state-values.ts` labels an element by
   it once name, text and value are absent, and `element/selection.ts` keeps an
   element in web state for it alone — so a link known by nothing else keeps its
   address. Measured on four sites, every link this drops is named by its own
   words as well.
3. **A link that genuinely goes elsewhere is untouched.** A spec row asserts
   that the packet still carries addresses, and that none of them equals the
   packet's `location`. The store's logo, "2 items in cart" and a product's
   detail page all still publish theirs.

The published value it removes was not merely redundant — it was *wrong*. A
facet link's real destination is its query, and the query is what the domain
strips, so the address published on those twenty-two elements named a page none
of them goes to.

## Commands run, and what they printed

All in `F:/fxwork/t107-evidence-budget-waste`.

- `pnpm test:content` (full, in `apps/extension`) → **`359 passed (2.1m)`**,
  including `repeat-exemplars.spec.ts`, `unique-selectors.spec.ts` ("a large
  page is described … without making the snapshot slow"), t100's
  `evidence/tests/controls.spec.ts` (all five rows) and the six new rows.
- `pnpm --filter @fluxiq-web-extension/extension test` →
  **`# tests 740 / # pass 740 / # fail 0`**.
- `pnpm check` → **`structure-audit: passed (100 warning(s), 121 baselined)`**,
  `# fail 0` from `structure:test`, `lab:test` and `task:test`, and all ten
  packages `check: Done`. No new violation and no new baseline entry; the
  `[working-docs]` violation t100 reported is no longer present.
- `pnpm --filter @fluxiq-web-extension/domain test` →
  **`# tests 762 / # pass 762 / # fail 0`**. Run although the brief did not ask
  for it, because the snapshot the domain sanitizes changed shape.
- `npx tsc -p tsconfig.json --noEmit` in `apps/extension` → clean.
- **The new spec against the unchanged capture** (the three source files
  restored from `HEAD`, then restored again): **`3 failed, 2 passed`**, plus the
  wire row which is about the descriptor and fails too. The everything-store row
  fails with `Error: a link back to this page publishes no address … Expected
  Array [] / Received + 24`; the address row with `Expected: not
  "http://…/scenarios/everything-store/s"`; the crossborder row with
  `Expected value: "Spain"` and a received array of category links. The job-board
  and bigbox rows pass on both, which is what they are for — they are the
  restraint guards, and their comments say so.
- **Capture timing**, seven samples per page, median of seven, same machine,
  `HEAD` then the change:
  - everything store (611 elements): **165 ms → 166 ms**
    (`[149,159,161,165,166,171,217]` → `[155,156,160,166,167,194,212]`)
  - crossborder (292 elements): **63 ms → 64 ms**
    (`[62,62,62,63,64,67,77]` → `[62,63,64,64,66,67,78]`)

  Within noise. The new ancestor walk is asked only of elements that fall
  through every other control test, and t100's decorate-before-sort change keeps
  it O(n).

## Not verified

- **No live run, campaign or provider call was made**, as instructed. That the
  model now *uses* the filters it can finally see is unproven here; the packets
  are what changed.
- **Firefox.** Everything above is headless Chromium through the content
  harness. The new rule reads `getComputedStyle().cursor` (already read by
  `isInteractableUiElement` on every capture) and `URL`, both of which Firefox
  implements the same way, but nothing was exercised there.
- **Six of the ten campaign sites were measured only by probe, not by packet.**
  local-classifieds, auction-marketplace, photo-social, social-network-feed,
  company-website and professional-network were measured for how many elements
  the new rule admits — at most two each, and none on three of them — but their
  packets were not captured before and after. The probe covered their start
  pages; a results or search page on those sites was not opened.
- **The effect on evidence reuse.** `domain/src/runtime/reusable-evidence.ts`
  puts `sameOriginLink: true` in the normalized fingerprint for a link whose
  address resolves to the page's origin. A same-document link no longer carries
  an address, so that flag is now absent for those elements and the structural
  digest differs from one recorded before this change. Both sides of any live
  comparison come from the same pipeline, so it stays self-consistent; a digest
  cached before this change will miss once. Not exercised.
- **A filter drawn as an `<li>`** is excluded by the record guard, and a control
  drawn as `<div><span>Label</span></div>` with no `aria-label` is excluded by
  the own-words guard. Neither shape occurs on the ten sites; both are real
  markup elsewhere. Stated as known limits rather than measured.

## Open questions and findings not acted on

1. **Crossborder's packet is now element-bound with 2,233 bytes unused, and
   nineteen of its forty slots are same-document query links from the site's
   header** — "Toys & Hobbies", "SuperDeals", "Top Brands", "usb c docking
   station" and the rest of its related-search chips. Those are category
   navigation and saved searches, not refinements of this result set, but each
   is a link to this path with a different query, so t100's `isPageStateControl`
   promotes them to the band ahead of everything. They, not the filters, are
   what displaced the product links. Narrowing that rule is the next thing worth
   measuring on this page, and it is deliberately not in this change: it is
   t100's measured result and tightening it blind could cost the everything
   store's rail.
2. **The forty-element bound is now the binding constraint on four of the six
   packets**, with 149 to 2,233 bytes unspent. `WEB_LLM_EVIDENCE_BOUNDS.elements`
   lives in `domain/src/runtime/llm-evidence/limits.ts`, which this brief put out
   of bounds. Whether forty is still the right number once elements cost ~140
   bytes instead of ~200 is a question for whoever owns that file.
3. **Crossborder's result cards are not folded into an exemplar.** They carry no
   per-instance key and are `<div>`s, so `repeat-exemplars.ts` sees no run and
   each of the seven product links was a slot of its own. One exemplar carrying
   `repeats: 24` would have said more in one slot than seven said in seven. That
   is `repeat-exemplars.ts`, which this brief did not assign.
4. **t100's finding about mis-attributed headings is untouched** — the store's
   pager links each carry a `heading` of the last product's title, ~78 bytes
   each, because `nearestHeading` in `identity/context.ts` walks back past the
   results. Still there, still wrong, still outside these paths.

## Files changed

- `apps/extension/src/content/evidence/controls.ts` — +163 lines, 364 total: the
  `isDrawnControl` rule with its four guards, `addressesThisDocument`, and the
  shared `isThisDocument` the query-link rule now reads too.
- `apps/extension/src/content/evidence/link-address.ts` — **new**, 66 lines:
  `repeatsTheDocumentAddress` and the measurement that forced it.
- `apps/extension/src/content/evidence/index.ts` — the two exports and a header
  naming both rules.
- `apps/extension/src/content/dom-snapshot.ts` — `snapshotDescriptor` drops the
  repeated address; `controlBucket` asks the new rule. 374 → 385 lines.
- `apps/extension/e2e/content/tests/evidence/tests/budget.spec.ts` — **new**,
  167 lines, six rows across four sites: two for the address, one proving the
  address is still on the wire, one for crossborder's filters, and two restraint
  guards (the job board's cards, the big-box retailer's counts).

Nothing outside `apps/extension/src/content/evidence/**`,
`apps/extension/src/content/dom-snapshot.ts` and their tests was modified. No
file under `apps/extension/src/content/extraction/`, `domain/src/`,
`packages/test-runner/` or FluxIQ Core was touched, and no fixture was edited.
Three temporary measurement specs were written under
`e2e/content/tests/evidence/tests/` and deleted; the working tree holds only the
five files above.
