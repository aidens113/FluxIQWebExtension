# t195-w20j: one record read as a one-row table (domain half)

## Outcome

Done.
- A detection answer that carries `record` now issues a second extraction handle in the same store, scope and frame.
  The packet names it as `record: {handle, itemCount: 1, fields, note}`.
- A 1-item proposal, such as the `<dl>` receipt, already passed through the packet and the slot. It is now pinned by
  tests.
- w20h's `WebLlmKeptExtractionBinding` is folded into `WebLlmExtractionBinding`.
- The extract_list description now names one record.
- `page-evidence.md` gains a detection section.
- Domain check, the three test directories (100/100) and the structure audit all pass.

## What changed and why

D = `domain/src/runtime/llm-evidence/`.

- **`D/structure/handles.ts`**
  - `WebLlmExtractionBinding` gains optional `frameUrlPath`, documented.
  - `WebLlmKeptExtractionBinding` is removed; it was used only inside `structure/`. This is the cleaner form w20h's report
    suggested.
  - A header paragraph says one detection can issue two handles.
- **`D/structure/packet.ts`**
  - `WebLlmStructurePacketInput` gains `recordHandle` and `frameUrlPath`.
  - `WebLlmStructureSplit` gains `recordBinding: WebLlmExtractionBinding | undefined`.
  - New type `WebLlmStructureRecord = {handle, itemCount, fields, note}`. `WebLlmRepeatingStructure` gains `record?`.
  - The run and the record are cut by the same `readableFields` (sensitive fields are dropped from both halves) and the
    same `boundList`.
  - The record's pagination is `boundPagination(record.pagination, false)`, so the run's infinite scroll never applies
    to the record.
  - `note` is the private constant `RECORD_NOTE`, the brief's sentence verbatim: "record is the one item you aimed at,
    read as a one-row table; name its handle in extractList when the instruction is about that item".
  - Header paragraph added.
  - A 1-item proposal needed no code. The packet never looked at `itemCount` beyond copying it.
- **`D/structure/detect.ts`**
  - Reserves the run's handle, then `recordHandle` only when `detection.record` is present.
  - Passes `frameUrlPath` to the split instead of re-wrapping the binding.
  - Retains `split.binding`, then `split.recordBinding` if present, in the same scope.
  - Header paragraph added.
  - Because `retain` already calls `answersTo`, the record's item becomes an "own" list with no change to
    `own-extraction-list.ts`.
- **`D/plan-resolution/extraction/slot.ts` and `own-extraction-list.ts`: no change needed.**
  - `minItems: 1` and `maxItems: 1` already pass `webAutomationExtractListRequestValue`.
  - The binding sets neither key, so a one-item handle does not force `maxItems: 1`. A lone record's item selector may
    match several items later, for example a one-result search page, and the plan says how many it wants.
- **`domain/src/output-nodes/extract-list/catalog-text.ts`**
  - The first description sentence changes from "Scrape the items of a repeating list or table into a dataset, one page
    or many." to "Scrape a repeating list, table or one record into a dataset, one page or many."
  - The sentence is 78 characters, within Core's 80. The whole description is 232 of 240.
  - The grammar is untouched, because it is at 700/700.
  - Header paragraph added, and a test case for the first sentence.
- **`docs/architecture/page-evidence.md`**: new section "Detecting A List, Or One Record", placed after "Who Reads It".
  It covers:
  - the three answer forms (run; run with `record`; one record as the list, either a dl receipt or a lone record after
    the 5 s wait);
  - the second handle and its packet shape;
  - that a lone record never replaces a run;
  - that a one-item handle builds a node, including with min/max 1, and is an own list;
  - that these reads are tested on written answers, not captures;
  - w20h's child-frame detection origin, `browserFrameUrlPath` on LLM-built nodes, and the 5 s / 100 ms frame wait
    bounded by timeout less 1 s.

  No other architecture document had a detection passage that I own.
- **Tests**
  - New `D/structure/tests/record-detections.ts` holds two detection answers, **written from markup, not captured**. The
    header says so and why.
    - photo-social thread (seed 238, `photoLook(238).cls` class names computed): the run is 3 thread rows
      `a.x1ui8mjl.x1unrdkg.x1xae3z8` (avatar alt, name, preview). The `record` is the card's inner div
      `a.x1q2ucds.x1rgczww.x1ui8mjl > div`, with `span_1`, `span_2`, and the classed meta span, named as `pathStep`
      would.
    - job-board receipt: `dl.tl-receipt` with role, company, reference and submitted, each `:scope > dd:nth-of-type(k)`.
  - New `D/structure/tests/record.test.ts` has 3 cases:
    - A look and a targeted detection issue `extraction.1` (run) and `extraction.2` (record). The packet's `record`
      deep-equals the expected shape and note, and no selector appears in the packet. Both handles resolve, the record
      to the card item and spans. Another Flow gets `unknown_handle`.
    - Sensitive record fields are dropped from both halves.
    - The 1-item receipt passes through with no `record`.
  - New `D/plan-resolution/tests/one-record.test.ts` has 2 cases:
    - The record handle with `fields: {item: "span_1", price: "span_2"}` resolves to `{item: <card item>, fields:
      {item: {kind, selector: span:nth-of-type(1), required}, price: {... span:nth-of-type(2) ...}}}`. The run's handle
      still names the thread rows. The kept request, read back with selectors withheld, resolves to itself (own list).
    - The receipt handle with min/max 1 resolves to an extract node carrying `minItems: 1, maxItems: 1`.
  - `D/structure/tests/badge-column.test.ts`: the call is updated to the new input keys.

## Commands run and observed results

All were run from the downstream root.

- **`bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w20j check" pnpm --filter @fluxiq-web-extension/domain check`**
  - First run: `"build-cache":"build" ... "reason":"inputs changed: domain; stored in the shared store"`, with no errors.
  - Rerun after the revert check: `"build-cache":"reuse" ... inputs and outputs match the stamp`, `EXIT 0`.
- **`node .../scratchpad/run-dir-tests.mjs domain w20j runtime/llm-evidence/structure/tests runtime/llm-evidence/plan-resolution/tests output-nodes/extract-list/tests`**
  - Ran 18 test files.
  - Before the catalog case: `tests 99, pass 99, fail 0`.
  - Final: `tests 100, pass 100, fail 0`.
  - On the first run, the own-list draft assertion failed because my draft dropped `required`. I fixed the test so the
    draft withholds only the selector, as the real draft screen does.
- **`node scripts/structure-audit.mjs`**: `structure-audit: passed (146 warning(s), 118 baselined)`, exit 0.
  - The only warnings in my directories are advisory `file-lines` warnings on files I did not grow:
    - `detect.test.ts`, 639 lines;
    - `resolve-plan-node.ts`, 573 lines;
    - `resolve-plan-node.test.ts`, 530 lines;
    - `slot.test.ts`, 451 lines.
- **Revert check.**
  - I backed up `packet.ts` and `catalog-text.ts` to the scratchpad. I then mutated `packet.ts` so that `recordBinding`
    is always `undefined` (no record handle or packet field) and put back the old description sentence.
  - Running the three new or changed test files gave `tests 12, pass 8, fail 4`. The failures were:
    - the record packet case: `actual: undefined`, expected the record object;
    - the sensitive-record case;
    - the plan-resolution record case: `actual: undefined, expected: true` on `assert.ok(record)`;
    - the catalog first-sentence case, against `/one record/`.
  - The two receipt cases passed. A 1-item proposal and min/max 1 already worked before this change, so those cases pin
    existing behaviour rather than prove a fix.
  - I restored both files. `grep -c "const recordBinding = true"` printed 0, and the full rerun gave 100/100.

## Not verified

- **No browser, Lab or model run, by the rules.** The two detection answers are written from the scenarios' markup and
  w20i's rules, not captured.
  - The real item and field selectors the content script emits for the card, its key names (`span_1`, `span_2`) and the
    `<dl>` labels may differ.
  - What the tests prove is the domain handling of any such answer, not those exact strings.
- No full suites, by the user's rule. Tests outside the three named directories that could observe the packet were not
  run. Examples are `D/harness-options/tests/detect-option.test.ts` and the node-run tests. Because the packet omits
  `record` when it is absent, existing packets are unchanged.
- I did not check Core's catalog code to confirm the exact 80-character first-sentence bound. The value comes from this
  file's own header.
- Playback against the card was not exercised: the 10 s wait for 1 item, and a second reply card making the item
  selector match 2.

## Open questions or contradictions found

1. **Unused handle number.** When the record's every field is sensitive, its reserved handle number goes unused. That
   case is unreachable from the wire today, because `webAutomationStructureDetectionValue` refuses such a record and
   with it the whole detection. The packet guard is defensive.
2. **No `maxItems: 1` on a one-item binding, by decision.** If a later reply adds a second card, the Flow's read returns
   2 rows unless the plan wrote `maxItems: 1`. The detect tool's description (`D/tools.ts`, not mine) could tell the
   model to add `maxItems: 1` for a record. The packet's `note` does not say this, because the brief fixed its wording.
3. **Test helpers imported across directories.** `plan-resolution/tests/one-record.test.ts` imports
   `structure/tests/record-detections.ts`, as w20h's `frame-path.test.ts` imports `captured-detections.ts`. The audit
   accepts it.
4. **The written captures should be replaced with real captures** once the content harness can run the thread page and
   the confirmation frame (w19e's e2e spec, a browser run).
