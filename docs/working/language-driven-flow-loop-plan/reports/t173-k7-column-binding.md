# t173-K7: extraction columns bound to the wrong controls (rank 7)

Worker report. Branch `task/t173-audit-close`, nothing committed.

## Outcome

**Done.** The binding cause was upstream of the model, in what detection
offers it, and is fixed there. After the supervisor extended ownership
(addendum below), the column name is fixed in `columns.ts`, and the two content
specs that could not load now load and pass.

### Root cause, reproduced on the fixture

A new content spec ran `detectStructure` on the everything store's starting
cart with the code as it was. Each line was offered as these columns, with
labels exactly as the model receives them:

```
attribute: data-line, attribute: data-sku, value: input.css-1hh1cyc,
attribute: img src, attribute: img alt, link: div > a.css-0y6s4m2 url,
text: div > a.css-0y6s4m2 > span, text: div > p.css-1bykiug, text: div > p.css-08ulstx,
text: div > div.css-0hhnejr > span.css-1o6vlrv > span.css-1gf1s47,   <- the quantity
text: div > div.css-0hhnejr > span.css-1o6vlrv > span:3, ... span:2..5,
text: p.css-10muxo3 > span                                           <- the price
```

- **`quantity` = `"on"`.** The line's only `value` column was
  `input.css-1hh1cyc`, which is the select checkbox (`main.ts:30`). A model asked
  for a quantity and shown one form-control column takes it. HTML reads a
  checkbox with no `value` attribute as the constant `"on"`, on every page. The
  label did not say it was a checkbox.
- **`price` = `"1"`.** The quantity (`main.ts:36`, `aria-live` span) and the
  price (`main.ts:38`) were two `text` columns labelled by paths through hashed
  class names. The model sees only label, kind and coverage (D3), so it had
  nothing to tell them apart by.
- **`item` named `title`.** The Flow's keys were `title`, `price` and
  `quantity`, the model's own keys in the map form, and the resolver kept them.
  So in this run the resolver did not drop the name: the model wrote `title`.
  The resolver does drop the name in one form the model may write, the array
  form with a guessed column (see Open questions).

## What changed and why

- `apps/extension/src/content/extraction/record-control.ts` (new):
  `recordControlType(element)`. It reads the tag and the `type` and `value`
  attributes, never the value, and returns the control's type (`number`,
  `text`, `select`, `textarea`, `hidden`, and `checkbox` or `radio` only when
  the page wrote a `value` attribute). It returns `undefined` for an unvalued
  checkbox or radio (constant `"on"`), for button-like inputs (the value is a
  caption) and for file inputs.
- `apps/extension/src/content/extraction/value-shape.ts` (new):
  `valueShape(samples)`. It returns `"number"` when every non-empty sample is a
  number, `"currency amount"` when every one is a number with a Unicode `Sc`
  currency symbol on either side, and `undefined` otherwise. It uses no word
  list and does not treat three-letter codes as currencies (`SKU 123` stays
  unshaped).
- `infer-fields.ts`:
  - A form control is offered only when `recordControlType` names it. Its path
    label gets `(<type> control)`, for example `(number control)`. An unvalued
    checkbox is no longer a column. A sensitive control is still offered,
    excluded, so D12's all-secret refusal is unchanged.
  - A `text` column with a path label (not a test id, not a table header, not
    sensitive) gets `(number)` or `(currency amount)` when every value it reads
    across up to 24 items of the run has that shape. The values are read through
    `readField` and dropped at once. Only the fixed word reaches the label. Keys
    derive from labels as before, so these columns' keys change, for example
    `..._span_css-1gf1s47_number`.
  - `FieldSource.pathLabel` (optional) records whether a label is a path.
    Labels the page's author wrote (test ids) are left exactly as written.
- `field-reader.ts`: a `value` read of a control `recordControlType` rejects is
  unreadable (`null`, or missing when the field is required) instead of
  returning `"on"` or a button caption. So a literal or hand-written Flow can no
  longer read an unvalued checkbox as data either.
- Tests: `content/extraction/tests/record-control.test.ts` and
  `value-shape.test.ts` (pure, node). The DOM reproduction is
  `apps/extension/e2e/content/tests/extraction/tests/cart-column-labels.spec.ts`
  (new). The extension's unit runner has no DOM, so a cart-shaped DOM test can
  only run in the Playwright content harness. That path is outside the literal
  owned list, but the brief requires the test. The spec asserts that no column
  reads the checkbox, that exactly one column reads the quantity and is
  labelled `(number)`, that exactly one reads the price and is labelled
  `(currency amount)`, that only the price is a currency amount, and that
  reading those two columns returns each line's quantity and price as shown.
- Nothing in `domain/src/runtime/llm-evidence/structure/**` changed. The packet
  passes labels through, so the model now sees the new labels.

## Commands run and observed results

- Before the fix: `pnpm --filter @fluxiq-web-extension/extension test:content -- cart-column-labels --workers=1`
  printed `1 failed`, at the first assertion: `"checkbox": true, "key": "input_css-1hh1cyc", "kind": "value", "label": "input.css-1hh1cyc"`.
- After the fix, the same command printed `ok 1 ... cart-column-labels.spec.ts:65:1 ...` and `1 passed (9.3s)`.
- `npx tsc -p tsconfig.json --noEmit` (apps/extension): exit 0.
- `npx tsc -p tsconfig.test.json --noEmit` (apps/extension): exit 0. The first
  run found one `exactOptionalPropertyTypes` error in my code, which I fixed.
- `npx tsc -p tsconfig.json --noEmit` (domain): exit 0.
- `EXTENSION_TEST_BUILD_LABEL=t173-k7 node scripts/test-extension.mjs`:
  `# tests 1027 / # pass 1027 / # fail 0`, including the new record-control and
  value-shape subtests.
- `test:content -- everything-store-cart everything-store-extraction extract-list-catalog extract-list-continuation extract-list-pagination extract-list-sensitive extract-list-table extraction-picker inference job-board-listing pagination-stop record-output-schema structure-detection cart-column-labels --workers=2`:
  `65 passed (2.1m)`. This covers inference's D3 no-value check and
  structure-detection's sensitive rows.
- `test:content -- tests.actions.spec tests.identity.spec tests.select.spec --workers=2`: `43 passed (20.0s)`.
- `node scripts/structure-audit.mjs`: one FAIL,
  `[working-docs] docs/working/README.md is out of date`. That comes from
  another party's edit to the plan document, not from these files. My files
  raise advisory warnings only: `content/extraction/` has 22 files (threshold
  15), `infer-fields.ts` is 606 lines (threshold 400), and
  `e2e/.../extraction/tests/` has 17 files.

## Not verified

- `item-conditions.spec.ts` and `list-completeness.spec.ts` do not load:
  `SyntaxError: TypeScript parameter property is not supported in strip-only mode`
  and `Total: 0 tests`. Both import `@fluxiq-web-extension/domain` (the runtime
  package) directly, and neither imports anything I changed. I did not check
  whether this also happens on the base commit.
- No live Lab run (forbidden by the brief), so whether a live model now binds
  the cart correctly is unmeasured. The fix makes a correct choice possible.
  It does not force one.
- Domain unit tests were not run. No domain file changed, and
  `structure/tests/captured-detections.ts` holds static data.
- Other fixtures whose path-labelled numeric or price columns now carry a shape
  suffix change keys. The content specs above pass, but Lab oracles or saved
  Flows that pinned an old path key were not checked.

## Open questions or contradictions found

1. **(Resolved in the addendum.)** Column-name survival lives in `plan-resolution/extraction/columns.ts`,
   which is not mine.** In `keptWebExtractionColumns`, the line
   `const under = written.ownKey === undefined ? column.key : written.written;`
   keeps an array entry under the *detected* key, even when the name was
   guessed (`how: "nearest"` or `"normalized"`). So
   `fields: ["item", "quantity", "price"]` returns path keys, and `item`,
   `quantity` and `price` are lost. The map form keeps the plan's key, which is
   why this run kept `quantity` and `price`. Suggested fix: for a string array
   entry that is not the exact detected key and is itself a valid key
   (`isWebAutomationExtractFieldKey`), keep it under the written name. It
   needs a slot test.
2. `column-match.ts` `columnShape` could read the new label suffixes as a
   shape signal: `(number)` means number, `(currency amount)` means number. A
   guessed `price` or `quantity` would then prefer a numeric column. It is not
   done, for the same ownership reason.
3. D3 reading: the shape word is derived from values but is not a value. I read
   D3 ("no label is text read inside an item") as allowing it. The supervisor
   should confirm that. The inference spec's check that no page value appears
   in the reply still passes.

## Addendum: extended ownership (columns.ts, spec loading)

### Column name kept in array form

- `domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts`: the
  new `listedKey(column)` keeps an array entry under the name as written
  (`column.assumed.written`, before any `@attribute`). It applies when that
  name found its column by anything but the exact detected key and is itself a
  valid key (`isWebAutomationExtractFieldKey`). Otherwise the entry keeps the
  detected key, as before: a name written as the key (`product-name`), and one
  that could not be a key (`.product-price`, `column:Price`). The map form is
  unchanged. The module's header comment says the same.
- Test: `plan-resolution/extraction/tests/slot.test.ts`, the new row "a list of
  the instruction's column names keeps each column under the name written...".
  `fields: ["name", "price", "rating", "url@href"]` on the catalog capture
  must return keys `name, price, rating, url`. A second assertion pins that
  `["product-name", ".product-price"]` keeps the detected keys.
- Before the fix: `DOMAIN_TEST_BUILD_LABEL=t173-k7 pnpm --filter @fluxiq-web-extension/domain test`
  printed `# tests 882 / # pass 881 / # fail 1`. The failing row's diff
  showed actual keys `product-link, product-name, product-price, product-rating`
  against expected `name, price, rating, url`.
- After the fix, the same command printed `# tests 882 / # pass 882 / # fail 0`.
  `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` in domain
  both exit 0.

### item-conditions and list-completeness specs did not load

- **Cause.** Both specs import `@fluxiq-web-extension/domain`, which exports
  `./src/index.ts`. Node 22.23 strips TypeScript natively, and it does so
  before Playwright's transform runs. The stripper cannot remove parameter
  properties, and `domain/src/runtime/llm-evidence/tool-rejection.ts:434-438`
  (`RecoverableToolRejection`, `constructor(readonly code, readonly detail?,
  readonly page?)`) has them. Result:
  `SyntaxError: TypeScript parameter property is not supported in strip-only mode`,
  then `Total: 0 tests in 0 files`.
- **On the base commit.** No stash was used. `git diff --stat 9686e160 --`
  shows no change to either spec, to `e2e/content/index.ts`, to
  `domain/package.json` or to `apps/extension/package.json`, and
  `git show 9686e160:domain/src/runtime/llm-evidence/tool-rejection.ts` has the
  same constructor at the same lines. The inputs are identical, so the specs
  failed to load at 9686e160 too. I did not execute the base tree itself.
- **Fix (harness only, no product source).** `NODE_OPTIONS=--no-experimental-strip-types`
  made both specs list 8 tests. That flag is now applied by the launcher:
  - `apps/extension/scripts/test-content.mjs` (new) replaces the inline
    `node -e` in `test:content`. It adds the flag to `NODE_OPTIONS` only
    when `process.features.typescript` is set, because older Node would
    reject it. Being in `NODE_OPTIONS`, the flag reaches Playwright's workers.
    The launcher also strips every leading `--`. The package script and pnpm
    each add one, and a second one left in place made Playwright read
    `--workers=3` as a file filter (`No tests found`).
  - `apps/extension/package.json`: `test:content` now runs the script.
  - `apps/extension/e2e/playwright.content.config.ts`: the comment no longer
    calls a bare `playwright test` the correct invocation, and says why.
  The alternative was to replace the parameter properties in
  `tool-rejection.ts` with declared fields. That is product domain source, so
  I did not do it.
- **Results.**
  - `test:content -- item-conditions list-completeness --workers=2`: `8 passed (41.3s)`, 5 item-conditions tests and 3 list-completeness tests.
  - Full content suite through the new launcher, `test:content -- --workers=3`:
    `Running 392 tests`, `391 passed (5.4m)`, 1 failed. The failure was
    `unique-selectors.spec.ts:357` "the capture round trip stays interactive",
    a timing check. Rerun alone (`test:content -- unique-selectors --workers=1`)
    it gave `11 passed`, so it was load-dependent.
  - `node scripts/structure-audit.mjs`: the only FAIL is still the stale
    `docs/working/README.md` index, which I did not touch.
    `slot.test.ts` is now 451 lines (advisory).

### Still open

- `column-match.ts` could read the `(number)` and `(currency amount)` label
  suffixes as a shape signal (Open question 2). Not done; not in scope.
- Whether D3 permits the shape word (Open question 3) still needs the
  supervisor's confirmation.
