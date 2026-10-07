# s45-h-core-process report

## Outcome

Partial. Everything in my files is done and passes. One test I am not allowed to edit,
`domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/slot.test.ts`, still
expects the old link-column default, and it now fails. It needs a one-line change by
whoever owns `runtime/**`.

## What changed and why

- `domain/src/actions/extraction/order-request.ts`: when `dedupe` names no column, it
  now means every column the read reads, which is the whole record. This matches Core's
  default whole-row identity, so the page's own dedupe during exploration agrees with
  the stored answer. `defaultKey`, `readsLink` and `LINK_KEY` were removed, and the
  header comment now explains the change. The doc comment on
  `WebAutomationExtractListDedupe` in `request.ts` was updated to match.
- `domain/src/output-nodes/extract-list/record-output-process.ts`: the stub type and the
  domain validator are gone. `WebAutomationRecordOutputProcess` is now
  `NonNullable<AutomationStudioRecordOutput["process"]>`, taken from
  `fluxiq/automation-studio/nodes`. The module keeps only the mapping
  `webAutomationRecordOutputProcessOfRead(request) -> { process, wholeRowDedupe }`.
  `dedupe {by}` is written only when `by` is not every readable column. `sort` keeps its
  keys, `maxItems` becomes `limit`, and `minItems` becomes `minRows`.
- `one-page-read.ts`: now uses that mapping and also returns `wholeRowDedupe`.
- `dispatch.ts`: the parse-without-`process`-then-reattach step (`withoutProcess`) is
  removed. The new `withReadProcess` merges the read's `process` over the author's:
  - The read's members win where both set one.
  - A whole-row dedupe from the read also clears the author's `dedupe`.
  - A `process` that is not an object is passed through unchanged for Core to refuse.

  The whole output then goes through `parseAutomationStudioRecordOutput`. If Core
  refuses the `process`, the node fails before dispatch with `record_output.invalid`
  and Core's own `record_output.process_*` issues. The header comment was updated.
- `declared-columns.ts`: a whole-row dedupe no longer keeps helper columns in the read.
  After narrowing, its `by` lists only the columns that remain, so it still means the
  whole row. Without this, `dedupe: true` would have kept every column and undone the
  live-run-11 narrowing.
- Tests:
  - `actions/extraction/tests/order-request.test.ts`: the "each once" test now expects
    every readable column, and an excluded column is left out.
  - `output-nodes/extract-list/tests/record-output-process.test.ts`: rewritten for the
    mapping.
  - `output-nodes/extract-list/tests/one-page-read.test.ts`:
    - The derived `process` is now checked by parsing the whole output with Core's
      parser and comparing the `process` that comes back.
    - New test: Core-refused `process` values (`limit: 0`, an unknown sort field,
      `dedupe: true`, a string) fail the node with `record_output.invalid` and Core's
      issue code.
    - New test: `dedupe: true`, or a `by` listing every column, writes no
      `process.dedupe`, and it clears an authored one. It also checks that the page
      request resolves `true` to every readable column.
    - New test: `{by: ["url"]}` is kept as written.
    - New test: "each once" over a narrowed read still drops the helper column.

## Commands run and observed results

- Fail-first, before the code changes. I ran run-subset (label s45-h) on
  order-request, one-page-read and record-output-process, then `node --test`:
  - The record-output-process bundle failed to build, because
    `webAutomationRecordOutputProcessOfRead` did not exist yet.
  - The other two files gave pass 15, fail 4: the "each once" default, Core refusal
    codes, no dedupe for whole-row, and narrowing.
- After the change, the same three files: all pass. I loosened one test after its first
  run. With the `ordered` read, the read's own `limit` replaces the author's `limit: 0`,
  so that case only applies to a read that sets no limit.
- run-subset s45-h on `actions/extraction/tests/*`, `output-nodes/extract-list/tests/*`,
  `output-nodes/tests/*` and `runtime/llm-evidence/plan-resolution/extraction/tests/*`,
  then `node --test`: tests 270, pass 269, fail 1. The failure is `slot.test.ts`, "a
  detected list may be deduplicated and sorted by the plan's own column keys". It
  expects `by: ["url"]` and now gets `["name","price","rating","url"]`, which is
  exactly the intended change.
- Extension tests that mention dedupe (`content/actions/tests/extract-list.test.ts`,
  `content/extraction/tests/{list-reader,order-rows,pagination}.test.ts`), run-subset
  s45-h in `apps/extension`: tests 90, pass 90, fail 0. None needed changes.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` exits 0.
- `node scripts/structure-audit.mjs` exits 0: "passed (172 warning(s), 118 baselined)".

## Not verified

- No full suites, extension build, Lab, browser or provider calls (the brief excluded
  them).
- Domain tests outside the listed folders were not run, apart from the grep-selected
  files.

## Open questions or contradictions found

- `domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/slot.test.ts`
  (~lines 441-446) still expects the old default. It is under `runtime/**`, which this
  brief does not allow me to edit. The fix:
  - Change `dedupe: { by: ["url"] }` to `dedupe: { by: ["name", "price", "rating", "url"] }`.
  - Change the comment "`true` keys on the list's link column" to say it keys on every
    column the read reads.
- The extension's `content/extraction/order-rows.ts` comment mentions the domain
  reader's fallback; it is still accurate. Its own fallback for a dedupe whose every
  column is gone is already the whole row.
