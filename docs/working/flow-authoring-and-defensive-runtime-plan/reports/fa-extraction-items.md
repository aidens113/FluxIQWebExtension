# fa-extraction-items — letting a Flow say which items it wants (task t093)

Worktrees `F:\fxwork\t093\!FluxIQWebExtension` and `F:\fxwork\t093\!FluxIQ`, both
on `task/t093-extraction-items`, off `9791935`. **No commit was made, and Core
was not changed**: the gap is entirely in this repository's extraction request,
its resolver and its inference, and nothing in Core's dataset or extraction
contracts had to move for the filter to reach the page.

## Outcome

**Done, except the live run, which is held for the supervisor.** A built Flow
can now say which items of a detected list are records, the model can say so in
the vocabulary it was shown, and the condition survives into the saved request
and runs with no model attached. Measured model-free in the content harness on
two of the ten campaign sites:

| | items the page shows | records read | left out |
| --- | --- | --- | --- |
| `everything-store`, settled first page | 15 | **12** | 3 sponsored cards |
| `everything-store`, after the lazy load | 20 | **16** | 4 sponsored cards |
| `bigbox-retail`, paper towels | 15 | **12** | 3 promoted tiles |

The 20 → 16 row is the brief's headline number, and it is the one the expected
dataset `extract-first-page` wants.

The broken `field-entry-target-stability.spec.ts` is repaired and green, and
whether it can come under `pnpm check` is answered in *Open questions* 1.

## What I chose, and why

The brief named three things to weigh. They are not alternatives — they are the
three layers of one answer, and all three were needed.

### 1. A filter the extraction node carries and applies while reading

`WebAutomationExtractListRequest` gains `where`: a list of conditions every item
must satisfy to be read at all. It is applied in `list-reader.ts` as each item
is read, so an item that fails one **is not a record in any sense** — not in the
records, not against `maxItems`, not in `missingFields`, not in the dataset.

This is where the filter has to live, and the reason is the brief's second
constraint. The condition is a property of the *request*, so it is carried by
the node's `extractList` parameter, stored in the Flow, lifted by
`client/gateway-action-parameters.ts` and read by the page exactly as `item` and
`fields` are. A replay with no model attached applies the same conditions to the
same items. Nothing re-decides anything.

`minItems` therefore counts the rows the answer has rather than the items the
page drew, which is what a person asking for "every product, leaving out
sponsored placements" means.

### 2. An item-level predicate the model supplies as part of the request

The model is never shown a selector (D3), so a condition can only name a value
the **detection** showed it: a detected column key. `plan-resolution/extraction/conditions.ts`
resolves a condition the same way `columns.ts` resolves a kept column — a
detected key, a key in another case, `column:Header`, a bare header — and
refuses it the same ways, so there is one vocabulary for "which column" rather
than two.

What a condition may say is deliberately small:

- **`is: "present"` / `is: "absent"`.** Presence is the whole of what a mark
  says. Absent `is` and absent bounds mean `present`.
- **`atLeast`, `atMost`, `lessThan`, `greaterThan`** on the number in the value,
  read out of what the page wrote for a person: `$1,299.00` is 1299,
  `4.5 out of 5 stars` is 4.5. An item whose value is missing or holds no number
  fails a bound, because a row with no price is not a row under $50.

**There is no test against text, and that is the contract rather than an
omission.** A mark the page's own author wrote is a fact about the item; a word
found in its prose is a guess about what the words mean, and this repository
deleted a word-list heuristic on 2026-09-18 after it made not one state-changing
job possible. Adding `contains` here would re-add that pattern with the model
holding the pen instead of us. It is written into `request.ts` so the next person
reads the decision rather than the gap. The one cost is named in *Open
questions* 2.

**The resolved condition carries the column's own spec, not a reference to
`fields`.** The item a read leaves out is usually one it wants no column for: a
table of products wants sixteen rows of name, price, rating and url, not
seventeen columns one of which is the ad label. Carrying the spec lets a
condition test a column the table does not keep, and leaves the saved request
self-contained. A hand-written or recorded Flow may still write
`{ field: "<a key of this request>" }`, which reuses the value already read.

**A bare string is refused.** `where: ["ad_label"]` could only mean `present`,
which is the opposite of what someone writing it about sponsored placements
means, and a filter that silently keeps the complement of what was asked for is
worse than one that refuses.

On "easy for the model to produce": the required part of a condition is one key
and one word — `{ field: "data-ad-id", is: "absent" }`. A single condition may
be written without the list around it. Four naming keys are accepted, keys match
case-insensitively, and everything else — the item selector, the column's kind,
its selector, its optionality — Core derives from the detection.

### 3. Recognising the page's own marking of a sponsored or promoted card

The first two are useless if no column names the mark, and **measured before any
edit, on the two sites, that is exactly where it stood**:

- on `everything-store` the ad label *was* proposed, at coverage 0.20, purely
  because the run's first card happens to be an advertisement;
- on `bigbox-retail` the "Sponsored" tag was **in no proposal at all**. Its ads
  sit at the second, seventh and eleventh tiles, and `inferFields` walked only
  the run's first item.

Three changes in `infer-fields.ts`, all of them about what the page states:

- **Sources come from the run, not from one item of it.** Every item offers its
  sources, each is kept once, and each sits at the position it had in the item
  that first offered it — so a mark that is an item's first child sorts to the
  front of the proposal wherever in the run it was found, while values two items
  share keep document order. Bounded to 12 items walked and 64 candidates; every
  item still counts toward coverage.
- **The item's own `data-*` attributes become `attribute` fields read off the
  item.** This is the one part of a card's markup that says what the card *is*
  rather than what it shows, and it is what a real results page marks an
  advertisement with: `data-ad-id` on the everything store's sponsored cards,
  `data-adid` on the auction marketplace's. It is also the only legible label on
  a hashed-class site — the attribute's own name, which the author wrote (D3
  already allows an attribute name as a label). `data-testid`, `data-test` and
  `data-cy` are excluded: they name the element, this module already uses them
  as labels and selectors, and proposing one as a column would give a run of
  nothing but a password a readable field and stop it being refused
  `sensitive_region`.
- **Part of the field bound is reserved for partial columns.** `MAX_PROPOSED_FIELDS`
  kept the widest-covering 24, which is precisely backwards for this feature: a
  column every item carries says nothing about *which* items a read wants, and a
  mark is by construction partial. Eight of the 24 places now go to columns with
  coverage strictly between 0 and 1 before coverage spends the rest. On
  `everything-store` the proposal now hits the bound exactly, and without the
  reservation `data-ad-id` at 0.20 would be among the first cut.

After the change, `data-ad-id` is proposed at coverage 0.20 on the everything
store and the promoted-tile tag at 0.20 on the bigbox retailer.

## What changed and why

Nothing in `packages/test-runner/`, `scripts/lab/`, `runtime/flow-draft/`, or
FluxIQ Core.

### The contract — `domain/src/actions/extraction/`

- **`request.ts`** — `WebAutomationExtractItemCondition` and the request's
  `where`, with the reasoning above written into the type.
- **`read-request.ts`** — reads `where` off an untrusted value. A condition sent
  but unreadable refuses the whole request, as `paginate` does: dropped, the page
  would read every item of a run the author asked it to narrow and report
  success having done it. A condition must name its value exactly once; `field`
  must name a field this request actually reads, since an excluded column is
  never read (D12) and a condition over one could only ever be false; `is:
  "absent"` beside a bound is refused rather than read one way.
- **`schema.ts`** — `where` declared as an array, its `read` under `metadata`
  for the same reason a field spec is (Core's dialect has no `oneOf`).

### The model's vocabulary — `domain/src/output-nodes/extract-list/`, `domain/src/runtime/llm-evidence/`

- **`catalog-text.ts`** — the grammar leads the detected form with
  `where?: [{field: "detectedKey", is: "absent"}]`, and the example gains a
  `where`. The example matters as much as the grammar: Core reads a parameter's
  example as the declaration of which keys belong inside it
  (`flow-bootstrap/authoring/matching.ts`), so an example with no `where` is one
  a model is refused for narrowing.
- **`tools.ts`** — the detect tool's description, which has no length bound and
  which a model must read before it can name a handle at all, carries the whole
  of what a condition may say and how to use it.
- **`issues.ts`** — `web.extract_list.invalid_where`, so a malformed `where` is
  named when a plan is validated rather than at run time.
- **`derived-record-output.ts`** — the conditions enter the dataset-id digest.
  Two nodes reading the same columns and keeping different items produce
  different tables; without this they would append into one dataset and a read
  that left the advertisements out would be indistinguishable from one that did
  not.
- **`plan-resolution/extraction/conditions.ts`** (new) — the resolver.
- **`plan-resolution/issue-position.ts`** — `where`, `read`, `is` and the four
  bounds added to the grammar keys, so a refusal says `extractList.where.0.is`
  rather than a positional index.

### The page — `apps/extension/src/content/extraction/`

- **`item-filter.ts`** (new) — normalizes every condition before anything on the
  page is read, as every field is, and evaluates it. Conditions read through the
  one field reader, so a value inside a sensitive control refuses the whole
  extraction here exactly as it does in a column (D2).
- **`list-reader.ts`** — applies the filter, counts what it left out, and carries
  that count across a continued read.
- **`infer-fields.ts`** — the three inference changes above, plus one more the
  run scan forced: **what is inside a form control is no longer proposed as a
  field.** A `<select>`'s options are what its value may be, not values of the
  record, and the control is already a `value` source. Scanning the whole run
  made this visible — the basic form's three labels, each holding a different
  control, proposed the select's three options as text columns and so stopped
  reading as the form it is. Found by two content-harness rows going red, not by
  reasoning.
- **`actions/extract-list.ts`**, **`shared/extraction-continuation.ts`**,
  **`shared/protocol.ts`**, **`content/types.ts`** — the count of items a `where`
  left out reaches the read's own account of itself
  (`16 records from 1 page, 4 items left out by where`), and survives a read that
  crosses documents. Sixteen rows read from a page of twenty is a different fact
  from sixteen items found, and the row count alone cannot tell them apart.

### A structural move the audit required

`structure-audit` failed `[naming]`: three files in `plan-resolution/` shared the
prefix `extraction-`. They are now `plan-resolution/extraction/{slot,columns,conditions}.ts`
with a barrel and their tests under `extraction/tests/`. `resolve-plan-node.ts`
imports the directory rather than a file inside it.

## Commands run and observed results

### Model-free, in the content-script harness (real Chromium, real Scenario Lab fixtures, real content bundle, no provider)

| Command | Observed |
| --- | --- |
| probe: detect on `everything-store` and `bigbox-retail`, **before** any edit | store: 19 fields, the ad label at 0.20 only because card 1 is an ad, **no `data-ad-id` column**. bigbox: 13 fields, **no column for the "Sponsored" tag at all**; its ads are tiles 2, 7 and 11 |
| the same probe **after** | store: 24 fields including `data-ad-id` at **0.20**. bigbox: 25 fields including the promoted tag at **0.20** |
| `pnpm test:content -- item-conditions` (5 new rows) | **5 passed.** 15 → 12 on the settled store page; **20 → 16** after the lazy load; 15 → 12 on bigbox; a rating bound keeps exactly the cards above it; the resolved request that reached the page carries `where: [{read: {…data-ad-id…}, is: "absent"}]` and no `field` |
| `pnpm test:content -- field-entry` (the spec broken since t082) | **1 passed** (24.5s) |
| `pnpm test:content` (whole suite), first run after the inference change | **342 passed, 3 failed** — `inference.spec.ts` and two `structure-detection.spec.ts` rows on `basic-form`. Both regressions mine, both fixed (the test-id exclusion and the form-control exclusion above) |
| `pnpm test:content` (whole suite), final | **345 passed, 0 failed** (1.6m) |

### Suites and checks

| Command | Observed |
| --- | --- |
| `DOMAIN_TEST_BUILD_LABEL=t093 node domain/scripts/test-domain.mjs` | `# tests 760 / # pass 760 / # fail 0` |
| `EXTENSION_TEST_BUILD_LABEL=t093 node apps/extension/scripts/test-extension.mjs` | `# tests 731 / # pass 731 / # fail 0` |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (96 warning(s), 122 baselined)` |
| `pnpm check` (this repository) | **exit 0** |
| `pnpm check` (`F:\fxwork\t093\!FluxIQ`) | **exit 0**; `structure-audit: passed (177 warning(s), 360 baselined)`. Core is unchanged; this is a clean-tree confirmation |

### Live

**Not run.** The brief holds every live provider run until the supervisor
clears it, and the ten-site campaign was running on this machine throughout.
Everything above is model-free. **I am ready for the live run and am asking for
it**: the row to take is `everything-store-first-page-plus-earbuds`, whose
expected dataset is the sixteen organic results, and it is now the first time
that row has had a way to express its own row set.

## Not verified

- **That a live model writes a `where` at all.** Every claim above is about what
  the model *can* say and what happens when it says it. Whether DeepSeek reaches
  for `where` when the instruction says "leaving out sponsored placements", and
  whether it picks the `data-ad-id` column over the ad-label column, is a model
  behaviour and is unmeasured. The detect tool's description is written to make
  it likely; that is not evidence.
- **That the store's last four results are read on a live run.** The 20 → 16 row
  scrolls the page itself. No live Flow has yet put a `web.dom.scroll` node
  before its extraction (t092's open question), so whether a built Flow reaches
  twenty items is still untested end to end. Without the scroll the read is 15 →
  12 and the dataset match would fail on count.
- **The eight other campaign sites.** Two were measured. The item-attribute
  source should carry `auction-marketplace` (`data-adid`) and the
  crossborder marketplace, but neither was run.
- **The picker.** `inferFields` also feeds the human picker, which now shows
  `data-*` columns and up to eight partial columns it did not before. Nothing was
  exercised through the picker UI.
- **The byte budget on a denser page.** The store's packet fits 24 fields at
  24,000 bytes with no `fieldsTruncated`. `packet.ts` cuts from the end, and the
  marks sort to the front, so a truncated packet should still carry them — not
  measured on a page that truncates.
- **Firefox.** No run; the content harness is Chromium.
- **`where` across a paginated read that crosses documents.** The count is
  carried in the checkpoint and the filter is applied per page, but only
  single-page reads were measured.

## Open questions or contradictions found

1. **`field-entry-target-stability.spec.ts` can come under the gate, and I
   recommend it, but not as `pnpm check` runs today.** The whole content suite is
   **345 rows in 1.6 minutes** at four workers and needs Chromium; `pnpm check`
   today is type checks, bundles and node tests with no browser. Three options,
   in the order I would take them:
   - **add `pnpm test:content` to `pnpm check`.** It is the honest fix — the
     harness is the only thing that proves content-script behaviour, and
     everything this task changed is only provable there. 1.6 minutes is real
     but it is not prohibitive next to what `pnpm check` already spends, and the
     suite is stable (345/345, twice, with no flake seen);
   - **a narrower gate**: run only `e2e/content/tests/exploration-state` and
     `.../extraction`, which is about 70 rows and under 30 seconds, leaving the
     rest to a fuller command. Cheaper, and it leaves most of the harness
     ungated;
   - **a mechanical guard instead of a run**: `WEB_LLM_EVIDENCE_TOOL_IDS` keeps
     four retired ids deliberately, so a spec can still name one and compile. A
     unit test asserting that no file under `apps/extension/e2e` imports a
     retired id would have caught exactly this defect, cheaply — but it catches
     only this defect, not the next one.
   The first is what I would do; the choice is the supervisor's because it
   changes what every task pays.
2. **Nothing can express "leave out accessories such as ear tips or charging
   cases".** That is the second everything-store task
   (`everything-store-plus-earbuds-under-50`) and the condition it needs is about
   what a product *is*, which no page states. `where` deliberately cannot say it.
   The honest options are that the model narrows the *search* instead (a facet, a
   better query), or that a later contract lets a condition name a column and a
   list of values the model read from the rows it was shown — which is a
   different thing from a word list we wrote, and should be decided on its own
   rather than slipped in here.
3. **A detection's `confidence` fell on both sites** (store 0.67 → 0.59, bigbox
   0.69 → 0.53) because it is the item selector's strength times the *mean*
   coverage of the fields, and partial columns are now proposed where they were
   not. Nothing refuses on confidence — `detect-structure.ts` uses it only as the
   last tiebreak between two runs of equal size and equal field count — so no
   behaviour changed here. But "how sure the detection is" now falls when the
   proposal gets *better*, which means the number is measuring the wrong thing.
   Worth a small fix (mean coverage of the full-coverage columns, or drop
   coverage from confidence entirely); not done, because it would change a number
   the packet shows the model and that belongs in its own change.
4. **An `exclude`d column still cannot be filtered on by key**, by design, and
   the workaround is to write the condition as `read` instead. The resolver
   always writes `read`, so a model never meets this; a person hand-editing a
   Flow might, and the refusal says the column is excluded rather than suggesting
   `read`. A better message is a small improvement nobody has needed yet.
5. **The first read's wait still counts items, not records.** `awaitListPresent`
   waits for `minItems` elements matching the item selector, which with a filter
   is a lower bound rather than the number the answer needs — a request for 16
   rows on a page of 20 waits for 16 elements. The growth settle (900 ms after
   the list stops growing) covers it in practice and both store rows passed, but
   a page that renders its results in two slow batches could be read between
   them. Making the wait evaluate the conditions would fix it and would mean
   running the field readers inside `page-render.ts`; I judged that too much for
   this brief and it is worth doing if a site shows the symptom.
6. **The grammar had no room and something had to go.** Core cuts a parameter
   description at 600 characters and `extractList`'s was at 595. To fit
   `where` I dropped `required?: false` from the *literal* branch's field spec
   and the literal branch's own `where` example, and put everything a condition
   may say into the detect tool's description instead. Both are still accepted by
   the resolver; what is lost is discoverability for a model writing a literal
   request, which the catalog text itself calls a guess. If that trade is wrong,
   the fix is to shorten the literal branch further rather than to grow the
   string past what Core sends.
