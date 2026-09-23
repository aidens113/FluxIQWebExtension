# t100 — the evidence packet must show the page's narrowing controls

## Outcome

Done. The Brightaisle Plus facet is in the evidence packet at the live
6,000-byte exploration budget, and so is every other control that narrows the
everything store's search page. No bound and no byte budget was raised; the
capture's ranking was changed. Measured model-free in the content harness, on
four of the ten campaign sites, before and after, with the same spec.

## The measurement that located the cause

Everything store, `/scenarios/everything-store/s?k=wireless+earbuds`, real
content script in headless Chromium, real domain sanitizer, default budget.

Before, the snapshot's ranked list put the facet 56th of 611 elements. The
twenty elements immediately ahead of it were the store's footer: "Shipping
Rates & Policies", "Returns & Replacements", "Advertise Your Products",
"Become an Affiliate", "Sell on Brightaisle", "About Brightaisle",
"Sustainability", "Your Account", "Your Orders", "Back to top", "Careers",
"Help", and the header's "Today's Deals", "Gift Cards", "Registry", "Sell",
"All". The packet describes at most 40, and the byte budget cut it to 27, so
the rail never reached it.

Three separate reasons, all in the ranking rather than in the budget:

1. Every link sat in one bucket. A filter rail link, a pager link, a global
   navigation link and a footer legal link were the same kind of thing.
2. Inside that bucket the order is `elementPriority`, and a footer link beats a
   facet on it: the store wraps a facet's label in a `<span>`, so the facet
   scores no `directVisibleText` and loses 25 points to "Careers".
3. Three of the store's footer form controls — the newsletter email field, the
   "Website" field and Subscribe — are form controls, so they outranked the
   rail's own price inputs.

## What changed

New module `apps/extension/src/content/evidence/controls.ts` (209 lines), three
exported rules, and `snapshotElementBucket` in
`apps/extension/src/content/dom-snapshot.ts` reading them.

- **`isPageStateControl`** — acting on it changes what *this* page shows. Two
  shapes, both read from the page's own markup and neither framework-specific:
  a link whose resolved address is this origin and this pathname with a
  *different query string*; and a control of a GET form whose written `action`
  resolves to this pathname. That is what a refinement is on a server-rendered
  site. A fragment-only difference is not one, so "Back to top" (`#top`) stays a
  link. An *absent* action is not one either, which is what separates the
  store's price form (`action="/.../s"`) from its footer signup form (no
  action, so it submits to whatever page it stands on) — that distinction was
  added after the first measurement put the newsletter field in the packet.
  Ranked first.
- **`isFrontLayer`** — the element or a bounded walk of its ancestors is
  positioned `fixed` or `sticky`. Asked only of the page's own controls, never
  of its links, and ranked with the page-state controls: the page behind a
  consent banner cannot be clicked until the banner is answered. Without this
  rule, promoting the rail pushed the store's "Accept" out of the packet; with
  it, "Accept", "Decline" and "Customize cookies" are all in.
- **`isSiteChrome`** — the nearest landmark at or above it is `contentinfo`.
  Its *controls* are demoted behind every other control (and still ahead of the
  page's prose); its prose is ranked as prose, as it would have been. Demoted,
  never dropped: the snapshot still carries them, and the spec proves "Back to
  top" is still in `interactiveElements`.

No run treatment was added. `repeat-exemplars.ts` already folds a repeated row
control into one exemplar carrying `repeats`, and it is doing so on this page —
the packet holds one "Add to cart" per container, not sixteen. The rail's twelve
brand facets are deliberately *not* folded, for the reason that module already
gives for navigation links: each label is the payload, and folding "Kinetra"
into "Lumo Audio" would hide a refinement the model may need to name.

One incidental change: `snapshotElements` now asks each element for its bucket
and priority once, before sorting, instead of inside the comparator. The
comparator ran those questions O(n log n) times and they read computed style;
the new rules walk ancestors, so this keeps capture cost roughly where it was.

## Measured before and after

Same spec, same fixtures, one run each. "Packet" is the element count the
sanitizer produced at the default exploration budget; "bytes" is the serialized
packet measured the way Core's gate measures it. `@packet` is the index of the
site's narrowing control in the packet, `-1` meaning absent.

Consent banner still up, which is the state campaign `ten-sites-r5` captured in:

| Site | before | after |
| --- | --- | --- |
| everything-store | 27 elements, 5,854 B, "Brightaisle Plus" @ -1 | 32 elements, 5,776 B, @ **9** |
| bigbox-retail | 37 elements, 5,869 B, "ValueRidge (23)" @ -1 | 36 elements, 5,490 B, @ -1 |
| job-board | 31 elements, 5,731 B, "Remote" @ 6 | 31 elements, 5,731 B, @ **10** |
| crossborder-marketplace | 40 elements, 5,307 B, "Choice" @ 23 | 40 elements, 5,307 B, @ **19** |

Consent banner answered, which is the state a narrowing Flow is authored in:

| Site | before | after |
| --- | --- | --- |
| everything-store | 25 elements, 5,876 B, "Brightaisle Plus" @ -1 | 31 elements, 5,851 B, @ **9** |
| bigbox-retail | 35 elements, 5,766 B, "ValueRidge (23)" @ 12 | 36 elements, 5,809 B, @ **16** |

**What this costs in context: nothing.** Every packet above is
budget-truncated both before and after, so the size is set by the 6,000-byte
budget and not by the change. The largest movement is −78 bytes
(everything-store, banner up) and the largest increase +43 bytes (bigbox,
dismissed). What changed is what the same ~5.8 kB is spent on: on the
everything store it now buys 32 elements instead of 27, because a facet link
costs ~140 bytes where a `<select>` with its options costs ~370.

The everything store's packet, banner answered, now reads: the pager (4), sort
and department selects, the store search box and its Go, the Brightaisle Plus
facet, the 4-star facet, all four price bands, twelve brand facets, the custom
price range and its Go, then the page's own buttons. Every control on that page
that narrows the results is in it.

## Nothing the model relied on before was dropped

- The whole content harness passes: **350 passed** (`pnpm test:content`),
  including `repeat-exemplars.spec.ts`, `large-page-resolution.spec.ts`,
  `unique-selectors.spec.ts` ("a large page is described … without making the
  snapshot slow") and the existing `evidence/` specs.
- Extension unit suite: **731 passed, 0 failed**.
- The new spec proves the footer links are demoted from the packet but still
  carried in `interactiveElements`.
- The everything store's "Add to cart" buttons are still in the packet with the
  banner answered.

**The one exception, stated plainly.** On bigbox-retail *with its consent modal
still open*, the packet before held "Sort by" and two department checkboxes in
its tail; after, those slots hold the pager and "Rollbacks & More" instead.
That packet is dominated by the modal in both cases — the domain's
`frontLayerFirst` hoists the open modal's whole subtree, which takes 30 of the
~36 slots, including its unnamed `<div>`s and its privacy prose. Both packets
name "Accept all" at index 0, and the moment it is answered all eighteen facet
checkboxes are in the packet (before and after). So nothing actionable was lost:
a page under a modal cannot be narrowed until the modal is answered. The modal
hoisting 30 slots of `<div>`s is a separate defect, in
`domain/src/runtime/llm-evidence/front-layer.ts`, and is not mine.

## What is still not visible, with numbers

Two findings I measured and deliberately did **not** act on, because they are
outside the files this brief gave me. Both are worth a task.

1. **A same-document link's `href` in the packet is content-free, and costs
   ~1,000 bytes a page.** `sameOriginHref` strips the query
   (`domain/src/runtime/llm-evidence/location.ts`), so every one of the store's
   eighteen facet and pager links is published as the identical string
   `http://…/scenarios/everything-store/s` — about 58 bytes each, ~1,040 bytes,
   17% of the live budget, telling the model nothing that distinguishes one
   facet from another. Dropping it where the stripped href equals the document's
   own path would buy roughly six more elements at no loss of meaning. It is not
   a free change: `packages/test-runner/src/web-flow-exploration.ts` and
   `domain/src/runtime/llm-evidence/harness-options/execute.ts` navigate by
   `element.href`, and for these links that href is already the *wrong*
   destination (it drops the search), so the change needs to be made with those
   two readers in view.

2. **A filter drawn as a `<div>` reaches no packet at all.**
   crossborder-marketplace renders "Ships from Spain", "Free shipping" and
   "4★ & up" as `<div class="filterOption"><span class="filterBox"></span>…`
   with a click handler attached in script — no link, no form control, no ARIA
   role. They are `isInteractableUiElement` only, rank in the fourth band, and
   are in neither the before nor the after packet. The Farbazaar instruction
   ("ships from Spain, free shipping, rated 4.5 or higher") depends on exactly
   those three. Nothing in this change helps, and I could not find a rule for it
   that is not a heuristic fitted to that fixture. A real one probably exists —
   an interactable, non-link, non-control element whose sibling run sits under a
   group title in a complementary landmark — but it needs its own measurement
   across several sites before it is written.

Smaller, also measured: the store's four pager links each carry a `heading` of
the last product's title (78 bytes each, 312 in total), because
`nearestHeading` in `identity/context.ts` walks back past the results to the
final `<h2>`. That is a mis-attribution, not just waste.

## Files changed

- `apps/extension/src/content/evidence/controls.ts` — **new**, 209 lines, the
  three rules.
- `apps/extension/src/content/evidence/index.ts` — exports them, with a note
  saying this is the one module in the directory whose answer is not carried as
  a contract field.
- `apps/extension/src/content/dom-snapshot.ts` — `snapshotElementBucket` reads
  them; `snapshotElements` decorates before sorting.
- `apps/extension/e2e/content/tests/evidence/tests/controls.spec.ts` — **new**,
  147 lines, five rows across three sites.

**Two of those are outside the paths the brief assigned me**
(`apps/extension/src/content/evidence/**`), and I want that on the record.
`dom-snapshot.ts` is where the ranking lives — the brief named the capture's
ranking as the cause, and it is not in `evidence/`. Neither file is on the
brief's "must not touch" list and neither is owned by the four concurrent tasks.
I put the rules themselves in `evidence/controls.ts`, which I do own, and kept
the `dom-snapshot.ts` change to the bucket function and its import, so the
footprint outside my paths is as small as it can be while still fixing the
defect. I touched no file under `apps/extension/src/content/extraction/`,
`domain/src/extraction/`, `domain/src/output-nodes/`,
`domain/src/runtime/llm-evidence/plan-resolution/` or
`packages/test-runner/src/flow-lane/`.

The spec lives in `e2e/content/tests/evidence/tests/` rather than beside the
other top-level harness specs because the top-level directory was already at the
structure audit's 25-file limit; the `evidence/` subdirectory is where the other
evidence-harness specs are.

## Commands run, and what they printed

- `pnpm test:content` (full, in `apps/extension`) → `350 passed (2.2m)`.
- `pnpm test:content -- evidence/tests/controls.spec.ts` → `5 passed`.
- The same five rows against the **unchanged** capture (files restored from
  `HEAD`, then restored again) → `3 failed, 2 passed`. The three
  everything-store rows fail with
  `Expected value: "Brightaisle Plus" / Received array: ["Sort by:", "Search in",
  "Search Brightaisle", "Go", "Leave ad feedback", "Get deals in your inbox", …]`.
  The bigbox and job-board rows pass on both, which is what they are for: they
  are no-regression guards, and their comments say so.
- `pnpm --filter @fluxiq-web-extension/extension test` →
  `# tests 731 / # pass 731 / # fail 0`.
- `pnpm check` → `structure-audit: 1 violation(s)`, and it is
  `[working-docs] docs/working/README.md is out of date with the documents'
  header blocks`. **That is not mine.** No file under `docs/` is modified in this
  worktree; the index row for `flow-authoring-and-defensive-runtime-plan.md`
  records 663 lines and the supervisor is editing that plan on `dev`. The rule
  indexes only top-level `docs/working/*.md`, so this report cannot affect it,
  and `README.md` is a shared document I must not edit. Everything else in
  `pnpm check` is green: `pnpm structure:test`, `pnpm lab:test`, `pnpm task:test`
  and `pnpm -r check` (all ten packages `Done`), and the two violations my change
  *did* introduce — a 26th file in the harness test directory, and a
  `catch { return undefined }` in `controls.ts` — are fixed, the second by naming
  the `TypeError` that `new URL` throws and rethrowing anything else.

## Not verified

- No live run, campaign or provider call was made, as instructed. That the
  model now *uses* the facet it can see is unproven here; it is what campaign
  `ten-sites-r5` should be re-run to find out.
- Firefox. Everything above is headless Chromium through the content harness.
  The rules use `getComputedStyle().position`, `URL`, `HTMLFormElement.action`
  and `element.form`, all of which Firefox implements the same way, but nothing
  was exercised there.
- Six of the ten campaign sites (local-classifieds, auction-marketplace,
  photo-social, social-network-feed, company-website, professional-network) were
  not measured at all. The rule could plausibly promote a large set of
  same-path query links on a site I did not look at; that would be visible as a
  packet full of one kind of link.
- The `sticky` half of `isFrontLayer` is untested: the everything store's banner
  is `position: fixed`. A sticky header holding form controls would be promoted,
  which I judged acceptable but did not measure.
- Capture wall-clock time was not measured directly. The existing budgeted spec
  ("a large page is described with unique selectors without making the snapshot
  slow") passes, and the decorate-before-sort change removes far more work than
  the new rules add, but no timing number was taken.

## Open questions

- Should a page-state control be *published* as such in the packet, rather than
  only ranked? The model currently infers "this is a facet" from an href that
  has had its query stripped and therefore says nothing. A one-bit field would
  be cheaper than the href it would replace, and it is a change to
  `domain/src/runtime/llm-evidence/elements.ts` rather than to the page-evidence
  wire contract.
- The everything store's twelve brand facets take twelve of the packet's
  thirty-two slots. I argued above that folding them is wrong. If a page had
  eighty brands it would still be wrong, and the packet would hold nothing else
  — at that point the right answer is probably a run whose exemplar says "one of
  80 brand refinements" *and* a way to ask for the list, which is a capability
  rather than a ranking tweak.
