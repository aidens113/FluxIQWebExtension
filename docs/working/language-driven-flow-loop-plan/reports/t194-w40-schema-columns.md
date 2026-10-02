# t194-w40: the stored answer carries only the instruction's columns

## Outcome

Done. When a `web.dom.extract_list` node's authored `recordOutput.schema` names a subset of its field map, the
read the page is sent keeps only the declared columns. A helper column that a `where` condition reads is still
read, through that condition's own `read` spec. The schema Core captures by names only the declared columns
(plus any D12-excluded ones, as before). When there is no declared schema, nothing changes.

## What changed and why

**Layer.** The schema is applied in the domain output node's dispatch (`output-nodes/extract-list/dispatch.ts`),
on the request before it reaches the page. It is applied there, rather than only in the record schema, because of
how the read result reaches Core:
- The page answers `{extracted, extraction, snapshot}` (`apps/extension/src/content/actions/extract-list.ts:74`).
  `extraction.fieldNames` and `rejectedSamples` are built **by the page** from the request's field map
  (`includedFieldNames`).
- Core's record capture (`!FluxIQ/.../runtime/executor/record-capture.ts`) copies each row by the schema. This
  allowlist copy drops excluded and unknown keys (`contracts/src/record-sets/validate-records.ts:29`). It writes the
  copied rows to `outputs.records` and back over `result.extracted` (the same array), and it stores the batch with
  `storedAutomationStudioRecordSchema`.
- So narrowing the schema alone would have fixed the stored rows and `extracted`, but the page's account would
  still name `plus`/`ad`. Narrowing the read makes the page's rows, `fieldNames`, rejected samples, `extracted`,
  the stored batch, its schema and the preview agree, all from the source.

**Files**
- `domain/src/output-nodes/extract-list/declared-columns.ts` (new): `webAutomationDeclaredColumnsRead(authored,
  request)`.
  - Declared columns are the authored schema's field ids, used only when **every** id is a field-map key. A schema
    naming a column the read does not take means the names disagree, and guessing which columns are helpers could
    drop an asked-for column.
  - Helpers are kept, non-excluded fields outside the schema. They are removed from `fields`. A condition with
    `field: <helper>` becomes `{read: <helper spec minus required>, ...rest}`, which is the form
    `plan-resolution/extraction/conditions.ts` already uses for a column the table does not keep.
  - A helper that `sort` or `dedupe.by` names stays in the read, because `order-rows.ts` only orders by read
    columns and would otherwise silently drop the sort. It is left out of the schema only.
  - The result is re-read through `webAutomationExtractListRequestValue`. A narrowing that would not read back
    narrows nothing.
  - It returns `undefined` for: no schema, an empty schema, a non-subset schema, no helpers, or a recording's own
    output (which declares every field).
- `dispatch.ts`: applies the narrowing. Only when something was narrowed is `parameters.extractList` sent as the
  reader's narrowed request instead of as written. The timeout and record output are computed from the narrowed
  request.
- `reconciled-record-output.ts`: takes an optional `columns` set and filters the schema to declared ids plus
  `handling: "exclude"` fields. Header comment updated.
- `index.ts`: barrel export.
- `tests/declared-columns.test.ts` (new, 6 tests).

No file in `domain/src/actions/extraction/` was changed.

## Commands run and observed results

All from the tree root, through `heavy.sh`:
- `npx tsc -p domain/tsconfig.json --noEmit`: exit 0, no output.
- `npx tsc -p domain/tsconfig.test.json --noEmit`: exit 0, no output.
- `narrow-tests.mjs <domain> t194-w40 output-nodes/extract-list`: 40 tests, 40 pass (first run).
- `narrow-tests.mjs <domain> t194-w40 output-nodes` (extract-list plus the callers' tests, `native-runtime.test.ts`
  among them), after the final edit: 15 test files, 169 tests, 169 pass, 0 fail.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (154 warning(s), 118 baselined)`. No warning names a
  touched file.
- **Old-source check.** I swapped `HEAD`'s `dispatch.ts` and `reconciled-record-output.ts` back in, with the new
  module present so the test imports resolved, then restored my versions.
  - Four tests failed: run 11; the ordering helper; the helper with no condition; the excluded column. 36 passed.
  - The invariant test "the narrowed read reads back unchanged" passed on the old source, so I folded it into the
    run-11 test.
  - The two "narrows nothing" tests (no, empty or non-subset schema; a recording's own output) assert invariance,
    so the old code passes them. They fail on the true old source only because `declared-columns.ts` does not
    exist there.

## Not verified

- **Live page behaviour.** I did not run the extension's `item-filter.ts` on the narrowed request. I am relying on
  its code:
  - a `read` condition uses `normalizeExtractField` with `required: true`;
  - a `field` condition tests the field's read value;
  - the two should agree for presence and comparisons.
- **New `seen` values.** A `read` condition records a bounded `seen` value and a `field` condition does not, so
  helper conditions now report `seen`. I did not check the effect on the judge's account.
- **The Lab judge.** I did not check whether the Lab judge pairs rows from `outputs.records` or from
  `result.extracted`. Capture makes both the same stored rows.
- **Core.** I made no Core change and did not read further than record capture and validation.

## Open questions or contradictions found

- **Run 12 is not fixed by this.** Run 12 (`run-muq4oaof`, cause 7) had `recordOutput: null`, so per the brief
  ("with no declared schema, nothing changes") its derived output still stores `plus` and `ad`. This change covers
  run 11 (4-column authored schema). Fixing run 12 needs the instruction's columns from somewhere other than the
  node, which is a supervisor decision.
- **Case-sensitive matching.** Schema ids are matched to field keys exactly. A schema written as `Name` over a key
  `name` narrows nothing.
- **Sort or dedupe helpers stay in the account.** A helper named by `sort` or `dedupe` still appears in the page's
  `fieldNames`, though it is not stored. This is the one remaining inconsistency, chosen so a sort is never
  silently dropped.
