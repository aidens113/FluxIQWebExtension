# t095 — a field reads the page's own tightest statement of a value

## Outcome

Done. The everything store's rating column now reads `3.7` where it read
`3.7 out of 5 stars`, proven model-free against the live fixture in the
content-script harness. No word list, no prefix or suffix stripping and no
pattern over natural language was added; every rule is a mark the page's own
author wrote.

## What changed and why

### What the evidence actually said

`test-runs/instances/r5/run-mudwci8d-de88aa32/snapshots/extraction-mismatches.json`
has sixteen records: seven differ on `rating` alone (`3.7` expected,
`3.7 out of 5 stars` observed), five differ on every column because the
observed list is offset by one row, and four were not observed at all. Only the
first seven are this task's; the offset and the missing rows belong to the
concurrent task that owns the list reader and the item filter.

The store's card states the rating twice, and this is the whole of the defect:

```html
<span class="stars">
  <span class="rating-number" aria-hidden="true">3.7</span>
  <i data-stars="3.5"><span class="offscreen">3.7 out of 5 stars</span></i>
</span>
```

Both spans are text leaves, both resolve in every item, and their labels are
paths made of per-seed hashed class names, so the model choosing columns had two
indistinguishable candidates and picked the sentence. Confirmed by running
detection and `web.dom.extract_list` against the live fixture before any change:
the proposal carried **both**
`…span.css-11xfgav > span.css-14idg5p` → `"3.7"` and
`…span.css-11xfgav > i > span.css-1f32dgn` → `"3.7 out of 5 stars"`.

So the field named a leaf whose entire text is the sentence. Nothing inside that
leaf is tighter — the tighter statement is in a sibling subtree. A reader that
looked outward from the element it was told to read would be reading an element
the field does not name, so the fix is in both halves, each in its own place:
the reader descends, and inference stops offering the sentence at all.

### The rule, and why it cannot be containment alone

New module `apps/extension/src/content/extraction/value-statement.ts` owns one
idea — the page's own tightest statement of a value — and exports the two
questions the reader and inference ask of it. Every rule is an authored mark:

- microdata: `itemprop` with a `content` attribute, which is the author saying
  the text is a rendering and `content` is the value. An element that opens an
  `itemscope` of its own is skipped, because choosing one of its properties
  would be a guess;
- `aria-valuenow`, which ARIA defines as the widget's current value;
- `aria-label`, **only** where it occurs verbatim inside the element's own text
  and is shorter than it — that is what "states the value alone" means here, and
  it is why `aria-label="16,733 ratings"` beside the text `(16,733)` is not
  taken;
- a paired rendering: a page that draws one value twice marks one copy
  `aria-hidden="true"`. Where one copy's whole text occurs verbatim inside the
  other's, the shorter copy is the tighter statement.

The `aria-hidden` mark is load-bearing and the reasoning is written into the
module. Verbatim containment between sibling subtrees is not evidence of
anything on its own: the same card's brand line reads `Kinetra` beside a title
beginning `Kinetra Run Wireless Earbuds`, so a rule that took the shorter of any
contained pair would have dropped every product title on the page. There is a
test for exactly that.

### The two call sites

- `field-reader.ts` — `readText` now returns `tightestStatedValue(element)` and
  falls back to the whole collapsed text when the page declares nothing tighter,
  so an element with no microdata, no ARIA value and one rendering reads exactly
  as it always did.
- `infer-fields.ts` — a text leaf the page states more tightly elsewhere is no
  longer proposed. A test-id element is unaffected (a test id is the author's
  own name for the element). The effect is that the model is not shown the trap
  rather than being expected to reason its way past it.

### What this deliberately does not do

It does not repair the Flow already on disk: that Flow names the sentence leaf
by selector, and a field must read the element it names. The supervisor's
verification run rebuilds the Flow from a fresh proposal, which now offers one
rating column reading `3.7`.

## Commands run and observed results

**1. Model-free proof in the content harness, against the live everything-store
fixture.** Driven from a scratch script in the session scratchpad that does what
`e2e/content/harness.ts` does — builds the real content and page-world bundles
with `bundleExtensionEntry`, starts the Scenario Lab, injects the bundles with a
`chrome.runtime` stub, passes the browser check, then delivers
`web.dom.capture_snapshot` with `detectStructure` and `web.dom.extract_list`. No
e2e file was touched and no Lab run, campaign or provider call was made.

Before the change, the proposal carried two rating columns and the records
carried both values:

```
…span.css-11xfgav > span.css-14idg5p      | cov=1 | text  -> "3.7"
…span.css-11xfgav > i > span.css-1f32dgn  | cov=1 | text  -> "3.7 out of 5 stars"
```

After the change, the second is gone from the proposal, and the records read:

```
=== READ === succeeded 15
"div_css-1h13pfs_h2_…_a_…_span":            "Kinetra Run Wireless Earbuds, Bluetooth 5.3 Headphones with 60H Playtime, Built-in Mic, LED Power Display, Ivory"
"div_css-1h13pfs_div_…_span_…_span_css-14idg5p": "3.7"
"div_css-1h13pfs_div_itemprop_offers_…_span_css-1f32dgn": "$79.99"
```

(`4.5` and `4.1` on the two rows above it.) The rating column reads `3.7`. The
title, price and link columns are unchanged, and no field with coverage 1 was
lost — the freed slot went to the price's `99` fragment, which is pre-existing
noise rather than anything this change introduced.

The fixture was not edited. It already states the value tightly, in its own
`aria-hidden` span; the code now reads what it states.

**2. Unit tests.** New
`apps/extension/src/content/extraction/tests/value-statement.test.ts`, nine
rows, on the store's own shapes with a Node DOM stub:

```
ok 411 - the sentence wrapping a value is not proposed beside the value: this is the zero-matched-rows defect
ok 412 - a value the page draws the same way twice loses neither copy, so the price columns stay
ok 413 - words shared by two values are not a restatement, so a brand line does not swallow the title
ok 414 - a read of the region descends to the copy the page states tightest, on both of the store's shapes
ok 415 - microdata's content is the value where the page declares one, and an element's own itemscope is left alone
ok 416 - one microdata property inside a plain element is the value; two are a guess and neither is taken
ok 417 - aria states the value where ARIA says it does, and an aria-label phrasing something else is not a value
```

`EXTENSION_TEST_BUILD_LABEL=t095 pnpm --filter @fluxiq-web-extension/extension test`
→ `# tests 740 / # pass 740 / # fail 0` (`duration_ms 17104.9653`).

**3. The extraction content-harness specs**, which cover the store end to end
(`everything-store-extraction.spec.ts`, `item-conditions.spec.ts`,
`inference.spec.ts`, `structure-detection.spec.ts`, the picker and the six
`extract-list-*` files):
`pnpm exec playwright test -c e2e/playwright.content.config.ts content/tests/extraction --workers=2`
→ `57 passed (1.7m)`.

**4. `pnpm check`** in the worktree → exit 0;
`structure-audit: passed (98 warning(s), 121 baselined)`, every project's
`check` `Done`. The audit warns
`[file-lines] apps/extension/src/content/extraction/infer-fields.ts: 506 lines
is past the 400-line advisory threshold` — it was already past it at 488 lines
before this change, and the 18 lines added are the header paragraph recording
why the sentence leaf is no longer proposed.

## Not verified

- No live browser run with the extension actually loaded, no Lab run, no
  campaign and no provider call, as instructed. The harness runs the real
  content-script bundle in real Chromium against the real fixture with no
  extension around it.
- The `aria-valuenow`, `aria-label` and microdata branches are proven by unit
  test only. The everything store uses none of them for its rating, so nothing
  on that page exercises them; they are the shapes other sites of the ten use,
  and no site was measured here.
- The reader-side descent changes no value on the everything store: on that page
  every proposed field is a leaf that declares nothing tighter. Its effect will
  show on a hand-written or model-written selector that names a region rather
  than a leaf.
- Whether the rebuilt Flow's other three columns now match is not this task's to
  say: five of the twelve rows in the failing run were offset by one and four
  rows were missing entirely, which is the list reader and item filter the
  concurrent task owns.

## Open questions or contradictions found

- The brief describes the fix as the reader preferring the tightest statement
  "over the ancestor text that contains it". On this page the field named the
  sentence **leaf**, not an ancestor of the value, so the reader alone could not
  have moved the number without reading an element the field does not name. I
  implemented the reader-side descent as described and put the fix that changes
  the measured value in inference, where the choice between the two renderings
  is actually made. If the supervisor wanted the reader to look outward from its
  element, that is a different and much riskier contract and I did not take it.
- I added one file beyond the three the brief lists —
  `apps/extension/src/content/extraction/value-statement.ts`. Both call sites
  need the same rule, and the repository's structure rules say a capability gets
  a focused module rather than being hung off a convenient file. It is new, it
  is in the directory this task owns, it is not in the concurrent task's
  do-not-touch list, and it needs no barrel change because neither
  `field-reader.ts` nor `field-spec.ts` is exported from `index.ts` either.
- Pre-existing and out of scope, but visible in every proposal of this page: the
  price is proposed as four columns — the readable `$79.99` and the visual
  `$`, `.` and `99` fragments — because each fragment is its own text leaf. The
  paired-rendering rule deliberately leaves them alone, since the page states
  the same amount both ways rather than one inside the other. A model can still
  pick `$` as the price column.
