# Report: t173-EF, extract-list dedupe and sort (domain + extension)

## Outcome

Done. The first pass left two gaps outside my files. The supervisor then
extended my ownership, and the second pass (below) closes both:

- The handle form now takes `dedupe` and `sort`.
- The counts now leave the page on the result summary.
- The number rule is written once.

The page applies `dedupe` and `sort` in the binding order (`where`, then
dedupe, then sort, then `maxItems`) and reports duplicates and unsortable rows.

## Second pass (ownership extended by the supervisor)

- `domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts`:
  - `LIST_KEYS` admits `dedupe` and `sort`.
  - A new `keptOrder` reads both with the dispatch reader, against the columns
    the plan keeps (the plan's own keys), and writes the canonical form onto the
    resolved request. An off dedupe or an empty sort leaves the request without
    either.
  - A part the reader would drop is refused as `web.handle.malformed` at
    `dedupe` or `sort.N`. It is not dropped, because a model is still there to
    repair it.
  - The probe is built without conditional spreads: the first version tripped
    the `[contract-spread]` audit rule for this directory.
  - The header comment now says the handle form takes both.
- `apps/extension/src/content/actions/extract-list.ts` `summaryOf` copies
  `outcome.order` onto the summary. The domain summary reader already accepts
  it, and the wire copy keeps it.
- `domain/src/actions/types.ts` re-exports `webAutomationExtractConditionNumber`
  through `domain/client`. `order-rows.ts` imports it, and the copy of the rule
  I had written there is deleted.
- New tests:
  - `slot.test.ts`, two tests:
    - Forgiving spellings resolve to canonical form, and the resolved request
      has no issues.
    - Off values resolve to nothing.
    - An unreadable dedupe, or a sort key naming no column, is refused at its
      position.
  - `content/actions/tests/extract-list.test.ts`, one test: the order report
    reaches the evidence and the wire summary, and is absent when the read
    had no order.
- Second-pass validation:
  - The domain type check and domain test type check exited 0, as did both
    extension type checks.
  - Focused domain tests, adding all of plan-resolution/extraction to the
    earlier set: `# tests 83 / # pass 83 / # fail 0`.
  - After the spread fix, `slot.test.ts` alone: `# tests 11 / # pass 11`.
  - All extension extraction and extract-action tests:
    `# tests 125 / # pass 125 / # fail 0`.
  - `node scripts/structure-audit.mjs`: the only FAIL is still the
    `docs/working/README.md` staleness, which is not from my files.
    `domain/src/actions/types.ts` is 533 lines, past the 400-line advisory; it
    was already past before my two-line addition.
- Still open:
  - A refusal at `dedupe` or `sort` is quoted by position
    (`extractList.2`), because `plan-resolution/issue-position.ts`
    `GRAMMAR_KEYS` does not spell those keys. Adding `"dedupe", "sort", "by",
    "order", "as"` there would give `extractList.sort.1`. That file is outside
    my ownership.
  - The per-document duplicate count and the pre-cut `missingFields` edges
    below are unchanged.

## What changed and why

**Domain (`domain/src/actions/extraction/`)**
- `request.ts`: removed the comment that claimed node-level `dedupe`/`sort`
  folded in by `dispatch.ts`. It now states the binding decision: both live
  inside `extractList` only, and the page applies where, dedupe, sort,
  maxItems. It also documents the dedupe identity rule and the date forms that
  `auto`/`date` read.
- New `order-report.ts` (barrel entry added): `WebAutomationExtractionOrderReport
  {duplicates, unsortable}` and its reader. It is a separate module because
  adding it inline pushed `summary.ts` past the 400-line advisory.
- `summary.ts`: optional `order` on the summary, under the same rule as every
  other optional part. It is copied count by count, and a malformed one drops
  the whole summary.
- No change to `order-request.ts`, `read-request.ts` or `schema.ts`. acc4648a's
  reader and schema were already correct, and the tests below now cover them.

**Domain (`domain/src/output-nodes/extract-list/`)**
- `catalog-text.ts`: the grammar gains `dedupe?: true|key, sort?: "key desc";`.
  It is written once, before `minItems`/`maxItems`, and covers both branches, as
  pagination does. It is 698 of Core's 700 characters. To make room I cut
  `also`, `(number)`, the spaces around `=` in the link clause, and changed
  "-- read only the page shown unless asked" to "; one page unless asked". The
  comment records each cut.
- The example now declares `dedupe: false, sort: []`. Core's
  `flow-bootstrap/authoring/matching.ts` moves a key written beside
  `extractList` into it only when the example declares that key, and the node
  has no fields of its own. The values are deliberately off: a sort copied onto
  a read that asked for none would, under `maxItems`, return different rows.
- `parameters.ts`, `dispatch.ts` and `issues.ts` are unchanged.
  - Parameters "accept and validate" through the existing contract.
    `issues.ts` already derives allowed keys from the schema and emits
    `invalid_dedupe`/`invalid_sort`.
  - Dispatch passes `extractList` through as written.

**Extension (`apps/extension/src/content/extraction/`)**
- New `order-rows.ts`, `listRowOrderFor(request, fieldNames)`:
  - `identity(row)`: the dedupe key, computed over the `by` columns with layout
    and case ignored. A row with none of the `by` values is never a duplicate.
    A `by` naming no column the read reads falls back to the whole row.
  - `apply(rows, bound)`: dedupe, then a stable sort, then the cut.
  - How values are read:
    - Type `auto` picks date, then number, then text, by majority of the
      column's values.
    - Dates can be relative ("3 days ago", "30+ days ago", "a week ago",
      "yesterday", "just posted") or absolute (ISO, "3 Sep 2026",
      "Aug 30, 2026", "Sep 20" with no year, "25/09/2026").
    - Numbers follow the `where` bound rule. Text uses a numeric-aware collator
      that ignores case.
  - An unreadable value sorts last in either direction. `unsortable` counts the
    rows with at least one unreadable key.
- `list-reader.ts`:
  - A kept row whose identity repeats is skipped before the bound check, so it
    takes no place under `maxItems`, and it is counted. The identities are
    seeded from a continued read's carried records.
  - With a sort, the read is bounded by `WEB_AUTOMATION_EXTRACT_MAX_ITEMS`
    instead of `maxItems`.
  - `outcome()` runs `apply(answer.records, maxItems)` after
    `filteredListAnswer`, so the unfiltered fallback rows are also deduplicated,
    sorted and cut. `truncated` also covers the sort's cut.
  - New `order` field on the outcome.
  - `awaitListComplete` and the rejected-rows bound use the full bound when an
    order is present.
- `index.ts`: exports the type `ListExtractionOrderReport`.

## Commands run and observed results

- `npx tsc --noEmit -p domain/tsconfig.json`: exit 0, no output.
- `npx tsc -p tsconfig.test.json --noEmit` (in `domain`): exit 0.
- `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.test.json` (in
  `apps/extension`): both exit 0. The first extension run failed with TS2724:
  `webAutomationExtractConditionNumber` is not exported by `domain/client`.
  Fixed as described under Open questions.
- Focused tests. The package runners take no file filter, so I used a scratch
  runner that bundles the named entries exactly as
  `scripts/test-domain.mjs`/`test-extension.mjs` do, into
  `.test-build-scratch/t173-ef` (since deleted):
  - Domain (order-request, read-request, summary, summary-pagination-stop,
    extract-list issues, catalog-text, output-nodes definitions):
    `# tests 59 / # pass 59 / # fail 0`.
  - Extension (order-rows, list-reader): `# tests 22 / # pass 22 / # fail 0`.
  - Extension (every `content/extraction/tests/*` plus
    `content/actions/tests/extract*`): `# tests 124 / # pass 124 / # fail 0`.
- `node scripts/structure-audit.mjs`: exit 1. Its only FAIL is
  `[working-docs] docs/working/README.md is out of date`, which comes from
  another worker's report edit (`in-place-effect-shadow.md`), not from my
  files. `list-reader.ts` is 665 lines, past the 400-line advisory; it was
  already 628.

## Not verified

- No live browser, content e2e (`test:content`) or Lab run. The list-reader
  tests use the file's existing fake page on the continued-read path, so the
  first-page wait with an order present is not exercised.
- Repo-wide `pnpm check`/`test`/`build` were not run, per the brief.
- Relative-date parsing is only tested on English phrasings. Localized boards
  will count as `unsortable`, which the report makes visible.

## Open questions or contradictions found

Items 1 to 3 below were written after the first pass. The second pass
resolved all three.

1. **slot.ts (required for the handle form).** `LIST_KEYS` at
   `plan-resolution/extraction/slot.ts:78` should add `"dedupe", "sort"`. After
   the `where`/`paginate` lines, pass both through:
   `if (value.dedupe !== undefined) request.dedupe = value.dedupe as JsonValue;`
   and the same for `sort`. The existing `webAutomationExtractListRequestValue`
   check then resolves their column names against the kept (plan) keys.
   Without this, the catalog's `dedupe?`/`sort?` produce
   `web.handle.malformed` refusals on the detected branch. `issue-position.ts`
   may also need the keys.
2. **Summary wiring (required for the counts to leave the page).** In
   `content/actions/extract-list.ts` `summaryOf`, add
   `...(outcome.order ? { order: { ...outcome.order } } : {})`. The domain
   summary type and its reader already accept it. The verifier and repair
   cannot see `unsortable` until then.
3. **One number rule, written twice.** `order-rows.ts` restates
   `webAutomationExtractConditionNumber`, because `domain/client` re-exports
   extraction helpers only through `domain/src/actions/types.ts`. Add it to
   that re-export list and import it in `order-rows.ts`.
4. **Edges I left as they are:**
   - With a sort, `missingFields` is computed before the cut, so a required
     field missing only from rows the cut dropped is still reported.
   - A continued read's `duplicates` counts only its own document, because the
     checkpoint type (`shared/extraction-continuation.ts`) carries no count.
   - Without a sort, a read that stops at `maxItems` reports `truncated` even
     when every remaining item would have been a duplicate. That matches how
     the content-key dedupe already behaved.
5. **Core's frozen grammar copy.** Core's
   `flow-bootstrap/plan/tests/extraction-vocabulary.test.ts` holds a dated copy
   of the old grammar and says explicitly that it is "not a contract", so it
   needs no change.
