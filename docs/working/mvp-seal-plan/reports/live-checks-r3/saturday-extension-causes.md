# Saturday certificate: extension and domain causes (R1, R2, R4, R5, S1; R3 key)

Worker report for E1. Trace: `saturday-certificate-loop.md` (run `run-mwc6ut8u-52e3c1b3`).
Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQWebExtension`, branch `task/t885-live-checks-r3`
at `2364ed6c6` (t903 merged as `c8379f323`, t904 as `685d0ebe4`). Nothing committed.

## Outcome

Done. All five causes were still open after t903. Each is fixed at its cause, with tests beside it.
R4's pager was confirmed by reproducing the old detection. The live run is not re-run here.

## Re-check verdicts (before any change)

| Cause | Fixed by t903? | Evidence |
| --- | --- | --- |
| R1 | No | `item-mark/state-sources.ts:28` still offered only pressed, checked and selected. Its last commit is `a5554a3d0` (W7). t903 only made a bare `:scope` name the item itself (`field-reader.ts:75-89` at HEAD). |
| R2 | No | `infer-list.ts` and `detect-structure.ts` were not touched by t903. t903's `elementRecord` (`structure/handles.ts`, `plan-resolution/extraction/element-record.ts`) reads one element as a one-row record. It gives no row per control and no group heading. |
| R4 | No | `detect-pagination.ts:71` `CONTROL_SELECTOR` and `:265` `PAGER_NEXT_LABEL` were unchanged (last commit `6819127fa`). t903 changed `page-advance/load-more.ts` only. |
| R5 | No | `page-advance/list-change.ts:175-181` still counted a detached first item as moved (last commit `5f25b2f59`). `move-page.ts:85` still counted new elements. |
| S1 | No | `page-view/fragment-merge.ts` was last changed in `77d877fca`. F3 itself is `page-view/line/choice.ts:80`, not `fragment-merge.ts:18-19`; that line is only the header comment. |

**R4 confirmed.** The steps carry no selector. I ran the HEAD `detect-pagination.ts` on a stepper fixture: a drawn `<div>Later ›</div>`, then Back and Next buttons. It proposed
`{"mode":"next","next":"main > div > div:nth-of-type(3) > button:nth-of-type(2)"}`, which is the stepper's Next. This was a temporary
test, since deleted. It matches the run:

- Step 0151's next_page answered `moved by next` in 5 ms.
- Its page view shows the unchanged week, then `t301 "Choose a time."`, `t252 button "Back"` and `t210 button "Next"`.
- The page view prints Later as `t266 clickable "Later ›"`. The fixture gives `.weekNav div` `cursor:pointer`.

## What changed and why

### R1: disabled as a state column
- `item-mark/state-sources.ts`: added a `disabled` state. Its column reads only while `:is([aria-disabled="true"], :disabled)` holds,
  which is the page view's own notion of disabled. It is offered when the element states `aria-disabled`, or when a form control is
  written `disabled`, form fields included. Pressed, checked and selected are still not offered on a form field.
- `item-mark/own-state.ts` (new): the item's own states. An item that is itself a control, such as a cell, offers
  `item (disabled)`, read through `:scope:is(...)`.
- `field-element/` (new): the one rule for the element a field reads. A bare `:scope` is the item. `:scope` followed by one compound is
  the item while it matches. A `group` reads inside the item's nearest matching ancestor. `field-reader.ts` and `infer-fields.ts`
  (coverage) use it. `infer-fields.ts` now calls the state sources for every element, plus the item's own. It stays at 799 lines.
- Domain: the request docs and the model-facing `MARK_NOTE` (`structure/packet.ts`) now say "pressed, checked, selected or disabled".
  The label's `(disabled)` note survives the packet: `field-sample.ts` keeps a state mark's closing note.

### R2: a grid of grouped controls, one row per control
- `cell-run/` (new):
  - `grid-cells.ts` finds the cells: controls of one tag, role and path in their groups. They must appear in at least two groups and
    sit at least twice side by side in one group, three or more in all. Their words must differ from group to group, so a card's
    same Like and Share buttons are not a grid. A group with no cells counts as saying nothing.
  - `cell-fields.ts` builds the columns: the run's first text column that every group has outside its cells, read in the group
    (`group: <run item selector>`, label `group heading`). Then the cell's own fields (`data-*`, link, states), and its own words
    (`item`, `:scope`) where nothing inside it offers words.
  - `cell-run.ts` assembles the proposal and keeps the run's pagination.
- `detect-structure.ts`: the final answer carries `cells` beside the run. They are computed once, never for each run judged on the way.
- Domain contract:
  - `WebAutomationExtractFieldSpec.group` (`actions/extraction/request.ts`) is parsed in `read-request.ts`, left behind on `column`, and
    added to `schema.ts`.
  - It is kept in the packet binding (`structure/packet.ts` `readableSpec`) and in the column copies
    (`plan-resolution/extraction/columns.ts`).
  - It is part of the derived output digest only when set (`derived-record-output.ts`), so existing digests are unchanged.
  - The wire (`extraction/structure-detection.ts`) validates `cells`.
  - `structure/detect.ts` reserves and retains a third handle after the record's.
  - The packet carries `cells: {handle, itemCount, fields, fieldMarks, note}` with a generic `CELLS_NOTE`, and gives `markNote` when
    only the cells carry marks.
- With R1 and R2, the Saturday read becomes:
  ```
  extractList: <cells handle>
  where:  [{field: group_heading, contains: "Sat"}, {field: item_disabled, is: "absent"}]
  fields: date from data-date, time from item
  ```
  No guidance names the site.

### R4: a drawn pager counts; a step's Next does not
- `pager-reading/drawn-control.ts` (new): an element the page drew as a control is a candidate on the page view's own signs: a click
  handler, the page-world press probe, or a pointer cursor it sets for itself. Only short-labelled elements whose label is a pager's
  are considered.
- `detect-pagination.ts`:
  - Drawn controls are asked about only at a level whose semantic controls propose nothing, so a pager of links keeps its answer.
  - `Later` and `Older` (with at most one word after them) are a Next.
  - A Next beside a `Back` is a form step (`isStepControl`). It is excluded both from detection and from next_page's fallback by label.
  - `Earlier` and `Newer` name another page, so a positional selector that drifts onto Earlier falls back to Later.
  - On the last week, with no Later, next_page finds no control: `control_absent`, which means the list ended. It never presses the
    step's Next.
- The fixture's Later control was not changed.

### R5: a redraw with the same records is not a move
- `page-advance/record-meaning.ts` (new; words, link addresses, image addresses) and `unread-record.ts` (new; a multiset comparison).
- `list-change.ts`: `listChanged` needs another count, or an item that says something else. Detachment alone no longer counts. The
  wait goes on for real content, so a page that draws the same list before the next one is not mistaken for either. When the window
  closes on a redraw of the same records, `afterListChange` returns `advanced`. The read loop's existing `page_repeated` / truncated
  answer therefore holds; two existing pagination tests protect it.
- `move-page.ts`: `hasUnreadItem` compares meanings. An `advanced` step whose items say exactly what they said before fails
  `list_unchanged`.
- Cost: a press that redraws the same page now waits the 10 s change window before answering. Before, it answered `moved` at once.

### S1: F3 keeps a message the last act raised
- `page-view/element/repeat-fold.ts` (new): a repeated line folds only if it is not `changed` while the line before it is not, and only
  if it sits in the same landmark and the same dialog.
- Used by F3 (`line/choice.ts`) and by the folding of a joined F4 line (`fragment-merge.ts`).

### Test helpers (sibling `tests/`)
- `fake-shadow-dom.ts` now reads:
  - the disabled condition;
  - `:scope` with a condition, which names no descendant;
  - top-level comma lists;
  - real `closest` (chains joined by `>`) and `matches`.
- `store-pager.ts` and `selector-page.ts` gained `hasAttribute`.
- `structure/first-item/tests/definition.test.ts` now lists `group: undefined`, because it builds its literal with `present<>`.

## Commands run and observed results

All were run through `heavy-slot.mjs run t885` from the worktree.

- `pnpm --filter @fluxiq-web-extension/domain check` stopped before tsc: "FluxIQ Core's build at ...t885/!FluxIQ is not current with
  its source". I did not rebuild Core, since Core is out of scope. Instead I ran tsc directly:
  - `domain`: `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit && ... -p tsconfig.test.json --noEmit` printed
    `DOMAIN-TSC-OK`, after fixing the one test literal above.
  - `apps/extension`: the same two tsc runs printed `EXT-TSC-OK`. That was before the final barrel-import edit; it was run again in
    the last pass below.
- The brief's `... typecheck` scripts do not exist in either package's `package.json`. `check` is the nearest one.
- `EXTENSION_TEST_BUILD_LABEL=e1-sat node scripts/test-extension.mjs content/extraction`: `# tests 513 # pass 513 # fail 0`.
- Extension dependents (`content/actions/tests/extract-list`, `content/actions/tests/next-page`, `content/action-runtime/recovery`,
  `content/picker`, `runtime/tests/next-page-continuation`, `runtime/tests/action-runner`, `background/page-pace`):
  `# tests 243 # pass 243 # fail 0`.
- `DOMAIN_TEST_BUILD_LABEL=e1-sat node scripts/test-domain.mjs actions/extraction output-nodes/extract-list
  runtime/llm-evidence/plan-resolution/extraction runtime/llm-evidence/structure runtime/llm-evidence/page-view extraction/
  client/tests`:
  - `# tests 555 # pass 555 # fail 0`.
  - Separately, "Domain test entry failed to load: src/client/tests/gateway-mapping.test.ts AssertionError: "web.dom.hover"". This
    already failed before my changes: the test expects `web.dom.hover` to be unknown, and t903 added hover. I did not touch
    `client/`.
- `test-domain.mjs runtime/llm-evidence/page-find runtime/llm-evidence/tests runtime/llm-evidence/start-state`:
  `# tests 277 # pass 277 # fail 0`.
- `pnpm structure:check`:
  - First run: one FAIL, `[imports] pager-reading/drawn-control.ts` reached into `../../evidence/press-cursor`. I switched it to the
    `../../evidence` barrel.
  - Rerun: `structure-audit: passed (248 warning(s), 552 baselined)`.
- Final pass after that edit and after restoring LF line endings in the touched files: extension tsc printed `EXT-TSC-OK`. Then
  `test-extension.mjs content/extraction content/actions/tests/extract-list content/actions/tests/next-page
  runtime/tests/next-page-continuation` gave `# tests 580 # pass 580 # fail 0`.

## Not verified

- No live or browser run. Nothing here proves that the booking widget's Later is pressable in Chrome by the cursor sign; the fixture's
  CSS says it is.
- `cellRunProposal` as a whole (`selectorFor` and `generalizedItemSelector` against a real document) has no unit test, because the Node
  fakes cannot stand up both inference and selectors. `gridCells`, `cellFields`, and the read and filter through domain and Core are
  tested.
- The domain capture-side helpers for `:is(...)` and `group` columns give those columns no `at` or sample (`first-item/chain.ts`
  cannot read `:is`). The labels `group heading` and `item (disabled)` carry the meaning instead.
- A wordless, nameless control natively disabled without `aria-disabled` gets a disabled column that reads `""`. Core reads that as
  absent. This is an edge case, and it is not fixed.

## Open questions or contradictions found

- **R3 key (no Core change made).** The domain already hands Core a handle-free list identity on every list read's draft statement:
  `reads: webListReadCode(...)` (`domain/src/runtime/llm-evidence/node-run/run.ts:422` and `:629`;
  `node-run/list-read/code.ts:42-52`). It is `list:` plus a digest of the page's origin and path and the resolved
  `extractList.item`. It is never the `extraction.N` handle, and never the fields, `where` or `paginate`.
  - Proposal: Core's `answer-first/rows/dataset-of-read.ts` keys the dataset by the step statement's `reads`, where present, in place
    of the input's handle. Two re-detections of one list are then one dataset, and rule 5 appends each week.
  - One domain gap: the digest ignores the frame. The booking widget is in a child frame, and two frames' lists with one item selector
    would collide. Add `ran.browserFrameUrlPath`, the Flow node's frame path, to the digest in `code.ts`.
  - Unverified: that the run's re-detections produced byte-identical item selectors. The packets hide selectors.
- The brief said a detection case should go in `extraction/tests/infer-list.test.ts`. That directory is at the 25-file budget and
  infer-list tests hold no DOM, so the disabled-options case is in `extraction/tests/marks.test.ts`. The S1 test is in
  `page-view/tests/line-rules.test.ts`, where F3 is tested.
