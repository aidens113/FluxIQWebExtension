# Report: w2-extract-list

Worker: `w2-extract-list`. Brief: `### Brief: w2-extract-list` in
[briefs/wave-2.md](../briefs/wave-2.md), coding against the contract in
[reports/w2-foundation.md](./w2-foundation.md).

## Outcome

**Done.** The list-extraction capability and the `web.dom.extract_list` verb
replace their stubs; the T2 spec covers `product-catalog` (page 1, every page,
`text-variant`) and `data-table` (`column-reorder`). Everything in the shared
definition of done passes — observed output in
[Commands](#commands-run-and-observed-results). I edited only the two files my
brief lists as owned, plus two new test files of my own.

## What changed and why

### `content/action-runtime/list-extraction.ts` — the capability

`extractList(request)` returns the declared
`{ records, pagesRead, truncated, missingFields }` unchanged from the
foundation's contract.

- **Field grammar**, mirroring `packages/test-runner/src/scenario-steps/extract-records.ts`:
  a plain CSS selector reads text, an empty one reads the item itself,
  `selector@attribute` reads that attribute, and `column:<header text>` reads
  the cell under that header. An `@` only introduces an attribute when what
  follows is a valid attribute name, so `[data-owner="a@b c"]` stays a
  selector.
- **Columns are matched by position among the header row's cells**, which is
  what survives a reorder; the header row is `<thead>`'s first row, or the
  first row containing a `<th>`. Colspan is not modelled.
- **Pagination** follows `next` until it is absent or `maxPages` (clamped to
  `EXTRACT_MAX_PAGES`) pages were read, the first included. After each click it
  waits for the list to *become a different list* rather than for a delay:
  either the old first item is detached (a page that replaces its results) or
  the item count changed (a page that appends). The catalog keeps the stale
  page on screen for 150 ms while the next one loads, so a fixed delay or a
  bare "items exist" check would re-read the page it just left.
- **`truncated` distinguishes stopping from ending.** `maxItems` reached, or
  `maxPages` reached while a `next` control is still present, is truncation; no
  `next` control is the list simply ending, and is not.

Two conditions **throw** rather than ending the read quietly, because a short
record list that still validates is exactly the silent no-op decision D4
forbids: a `column:` field on items that are not table rows (the request cannot
be performed), and a `next` control that was followed without the list ever
changing within 10 s. The verb turns both into a `failed` result.

A **`column:` header that no header cell matches does not throw** — it yields
nothing for every record, so it lands in `missingFields` and fails the
validation with the field named. That is the difference between "the page
renamed a column" (reportable, with expected and actual) and "this request is
malformed". The reference implementation throws for both; this is a deliberate
divergence and is covered by a spec.

`EXTRACT_MAX_PAGES` is restated as a literal, not imported: a value import from
`@fluxiq-web-extension/domain/client` would pull the domain barrel into the
page bundle, which is the same reason `validation-outcome.ts` restates the text
bound. A T1 test asserts the two constants agree.

### `content/actions/extract-list.ts` — the verb

`extractListAction` is `async`. The records become `extracted`; the validation
is `passed` when every declared field appears on every record and `failed`
otherwise, which `deps.success()` turns into `output_not_observed` carrying
both sides. Validation text is deterministic, so the specs assert it exactly:

- `expected`: `every record carries name, price, rating, url`
- passed `actual`: `8 records from 1 page; every declared field present`
- truncated: `16 records from 2 pages, truncated; every declared field present`
- failed `actual`: `8 records from 1 page; missing from some records: sku`

Zero records passes: no record lacks a field. That is what the catalog's
`no-results` variant needs.

**The verb catches its own errors** and returns `deps.failure(...)`. It must:
`execute.ts` does `return extractListAction(...)` inside its `try` **without
awaiting**, and a promise returned from a `try` block settles after the block
exits, so a rejection would escape the catch and leave the background worker
with no reply at all. See [Open questions](#open-questions-or-contradictions-found).

### Tests

- `src/content/action-runtime/tests/list-extraction.test.ts` (T1, 8 tests): the
  field grammar, which needs no DOM, and the page-bound agreement.
- `e2e/content/tests/extract-list.spec.ts` (T2, 9 tests): the real content
  bundle on real fixtures. Variants are armed through the Lab's authenticated
  `POST /api/<scenario>/<operation>`, as `armScenarioVariant` does, then the
  page is reloaded and the content script's re-announcement asserted.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`. Every exit status was captured by
redirecting to a file and echoing `$?`, never through a pipe.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | exit 0 |
| `EXTENSION_TEST_BUILD_LABEL=w2-extract-list pnpm --filter … extension test` | exit 0 — `# tests 80 / # pass 80 / # fail 0` (72 before, +8 mine) |
| `pnpm --filter … extension test:content extract-list.spec.ts` | exit 0 — `9 passed (4.5s)` |
| `node scripts/structure-audit.mjs` (scratch index) | exit 0 — `passed (31 warning(s), 19 baselined)` |

The audit ran against a scratch index (`GIT_INDEX_FILE` → `git read-tree HEAD`
→ `git add -N` my two new files), so it saw HEAD plus my additions and none of
the twelve parallel workers' in-flight edits. `git ls-files` against that index
confirmed all four of my files were in it, so the pass is not vacuous. **31
warnings is exactly the foundation's count**: I added no warning and no
violation, and `pnpm structure:baseline` was not run.

`git status --porcelain` confirms the only paths I changed are the four above;
every other modified path belongs to a parallel worker.

## Not verified

- **The full `test:content` suite was not run** — I filtered to my own spec.
  Other workers are mid-edit in the same tree (`check-assert.spec.ts`,
  `select.spec.ts`, and eleven source files are modified right now), so a
  failure elsewhere would be theirs and unactionable by me. My `check` and
  `test` runs necessarily compiled their in-flight code too, so those green
  results are not solely evidence about my files.
- **No live browser with the unpacked extension.** `test:content` runs the real
  content bundle in headless Chromium, which exercises the foundation's
  `execute-action.ts` wiring and `execute.ts` dispatch for real — but nothing
  loaded the extension in a headed browser. This capability touches no
  `chrome.*` API, so there is little for a background context to change.
- **`pnpm build` was not run** (the brief forbids it), and no Lab command was
  run. **Paginated extraction end to end through a Flow is `w2-flow-lane`'s
  proof**, not mine; I proved it at the content-script boundary.
- **`extracted` was not traced past the content script.** I asserted the reply
  the background worker receives. Whether the record array survives
  `result-mapping.ts` and the domain payload mapping onto the wire is untested
  here — and the foundation found that the sibling field `failure` *is* dropped
  there (`w2-browser-actions`). Worth checking `extracted` on the same path.
- **Domain tests were not run**: I changed no domain file.
- **Append-style pagination is unexercised.** `listChanged` handles a changed
  item count, but both fixtures replace their list rather than appending;
  infinite-scroll extraction has no coverage.
- **Items inside an iframe** are not supported and not tested: the capability
  queries `document` in its own frame.

## Open questions or contradictions found

1. **`execute.ts` does not await the verbs it returns, and this is now a live
   hazard.** Its own comment explains the rule for the two waits — "a returned
   promise settles after the try block exits, and its rejection would escape
   the catch" — but the five new verbs were registered with plain `return`.
   Mine is async, so I catch inside the verb. **`w2-check-assert`'s `assert.ts`
   has the same shape**: `evaluateAssertion` returns a `Promise`, so unless that
   verb also catches internally, a rejection escapes and the content script
   never replies — the harness reports "the content script did not answer",
   which reads like a hang, not a failure. The clean fix is `return await` in
   `execute.ts`, which is w2-foundation's file, not mine. **Recommend the
   supervisor make that one-word change and re-check the async verbs.**
2. **Which grammar do `fields` use?** I implemented the scenario contract's
   *field* forms (CSS selector, `@attribute`, `column:`), matching the domain
   type's own documentation ("`fields` maps a field name to a selector inside
   it"). I did **not** accept the test-runner's *target* grammar (`testid:`,
   `role:`, `frame:`), even though the fixture manifests author fields that way
   — that grammar lives in `packages/test-runner`, and
   `cssSelectorForTarget()` exists precisely to convert a scenario target into
   a CSS selector "for callers that hand a selector string to FluxIQ". So a
   future bridge from a scenario extract step to an action command converts
   there. If the intent was for the action itself to accept `testid:`, this is
   the decision to revisit, and it is a small addition.
3. **`ListExtractionOutcome` has nowhere to report a structural failure.** The
   declared type is records/pages/truncated/missingFields, so "this table has no
   column headed Price" can only be expressed as a missing field, and "these
   items are not table rows" only as a throw. That works and is tested, but a
   richer outcome would let the verb build a `STATE_MISMATCH`-style validation
   naming the headers that *were* found. I kept the declared type exactly, since
   twelve briefs cite it.
4. **`WEB_AUTOMATION_EXTRACT_MAX_PAGES` duplication**, already raised by
   w2-foundation, now has a third copy: `SCENARIO_EXTRACT_MAX_PAGES` (test
   contracts), the domain constant, and `EXTRACT_MAX_PAGES` (content bundle,
   which cannot import a domain value). My T1 test ties the last two together;
   nothing ties the scenario contract's.
