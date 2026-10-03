# t251-w2-row-targets: how a step targets "this row's control"

Paths: `D/` = `fxwork/t251-general-flow-authoring/domain/src/`, `E/` = `.../apps/extension/src/content/`,
`C/` = `!FluxIQ/packages/fluxiq/src/programs/automation-studio/` (read only, cited where the
domain hands off to Core), `R/` = `lab-runs/2026-10-02/run-murwcaj0-40e56557/steps/`.

## Outcome

Done. All five questions answered. Read only: no code or tests changed.

## What changed and why

Nothing changed except this report. Findings follow.

### Q1. Who declares `item`, and what the runtime does with it

- `itemInput` is the optional data port `item` (`D/output-nodes/definitions.ts:29-38`). Every output whose
  action schema requires `selector` declares it (`definitions.ts:216`, and `requiredParameters` at `:170-174`).
  Those are click, type, clear, select, wait_for_selector, extract, capture_snapshot, check, assert and upload
  (`D/actions/schemas.ts:52,226-330`; `required: ["selector"...]` at :52, :242, :251, :291, :310, :330).
  Navigate, extract_list, dialog, tab, scroll, keypress, wait_for_text and download do not declare it.
- Core wires For Each's `item` to each body step whose node declares an `item` input
  (`C/runtime/flow-bootstrap/authoring/draft-routing.ts:24-26,259-265,325-331`).
- The native runtime runs `scopedToRow(parameters, context.inputs?.item)` before it dispatches
  (`D/output-nodes/native-runtime.ts:77`). `scopedToRow` (`:158-166`) acts only when the row is an object
  and the recorded `element.context` has a `record` or a `listPosition`. In that case it replaces
  `context.record` with `{ values }`, built from the row's string values by `webAutomationRecordValues`
  (whitespace collapsed, at most 200 characters each, no repeats, at most 8;
  `D/output-nodes/targets/targets.ts:381-394`). The selector, `listPosition` and fingerprint are left as they were.
- **No code rebases the selector into the row.** Row scoping happens on the page, as a gate:
  - Where the recorded selector matches several elements, only the matches in the row are kept
    (`E/action-runtime/resolve-target.ts:305,513-516`).
  - Where it matches one element (a positional selector into another row), the veto refuses it with
    `other-record` (`E/identity/veto.ts:229,251`). The refusal counts as a miss (`resolve-target.ts:322-328`).
  - Family scoring then runs over candidates gated by the same row test before the pool cap
    (`resolve-target.ts:377-383`).
  - The row test `agreesWithRecordedRecord` takes `values` before any key or text
    (`E/identity/record.ts:174-176`). The candidate's record is its enclosing
    `tr/li/article/[role=row|listitem|option|treeitem|article]` (`record.ts:131`). Failing that,
    `rowOfOneControl` climbs to the largest ancestor that holds no other control with the same role and
    name (`record.ts:324-338`). That record must contain every value as a substring of its text, or as
    an exact attribute or control value (`holdsRowValues`, `record.ts:237-241`).

### Q2. What one extract_list row carries

Fields only. A record is `Record<string, string | null>` (`E/extraction/list-reader.ts:143-144`), filled
field by field (`list-reader.ts:753-762`) and returned as the result's `extracted`
(`E/actions/extract-list.ts:83`; the records path `result.extracted` is set at
`D/output-nodes/extract-list/records-path.ts:25`). A row carries no anchor, selector, key attribute, item
index or row identity. Nothing in `D/output-nodes/extract-list/*` adds one (a grep for
rowIndex/anchor/rowKey found only the item selector in the binding's request shape,
`derived-record-output.ts:12,88`). Inside a loop, the only way a row identifies its element is through
its visible values, which `holdsRowValues` looks for.

### Q3. `element.context.listPosition` and `record` on a click argument

- **Shape.** The wire contract is `listPosition {index,total}` and
  `record {keyAttribute?, key?, text?, values?}` (`D/actions/types.ts:66`). The domain re-reads both
  (`targets.ts:339-344,355-365`).
- **Recorded nodes.** The page writes both at capture (`E/identity/context.ts:82,226`, and
  `recordIdentity` at `record.ts:153-161`: a key if the row has one, otherwise the row's whole text if
  the row was one of several).
- **Model-built nodes** (the run's case). The element's evidence fields are written into the argument by
  `webPlanElementIdentity` (`D/runtime/llm-evidence/plan-resolution/element-identity.ts:89-104`):
  - `listPosition` comes from the evidence element's `item` (`:93`), which comes from the page's
    `listPosition` (`D/runtime/llm-evidence/elements.ts:456`).
  - `record` is `{ text }`, the packet's `within` (`element-identity.ts:95,107-110`). `within` holds the
    row's words without its controls' words (`elements.ts:269,329-332`).
  - It is called once per described element when a handle is bound (`plan-resolution/target-packets.ts:171`).
  - A record the page keyed by attribute travels no record here. Its key lives only in the binding's
    `records` map, used for handle addressing (`stable-handles.ts:213,304,339-348`).
- **Readers.**
  - `native-runtime.ts:162`: their presence is the "this control sat in a repeated thing" test that turns
    on row scoping.
  - On the page, `record` is the gate described in Q1. `listPosition` is captured but deliberately never
    scored (`E/identity/candidates.ts:175-190`; `record.ts:29-38`).
  - `listPosition` is also printed to the model as the `- i/n` markers (`page-view/structure-markers.ts:49-51`).

### Q4. Can a model name "the Confirm inside row k"?

No. The model has two kinds of handle: `tN` for one element and `extraction.N` for one detected list
(`plan-resolution/handle-tokens.ts:1-11,28-32`). A target is written `{ handle: "tN" }`
(`R/0069.../call.json`). The page view prints every row's controls with their own `tN` under `- i/n`
and `- row r` markers (`structure-markers.ts:9-10,49-54`; `R/0077.../result.json`, the "Confirm" lines
under `- 3/8` ... `- 8/8`). The model can therefore pick one concrete row's control, but nothing in its
vocabulary means "the Confirm in the current row" or "row k's Confirm":

- The structure packet carries fields, labels and counts, never controls or selectors
  (`structure/packet.ts:1-5`).
- No handle form combines an extraction or row with a control role or name (`handle-tokens.ts:28-32`
  accepts only those two patterns).

Row relativity comes about only implicitly. The model presses one row's `tN`, the draft states
`repeat over <listing>`, and the loop swaps that row's identity for each pass's values (Q1).

### Q5. Why run-murwcaj0 s8 / steps/0077 clicks Tom Becker's button

- The model pressed `t744` live (`R/0069-tool-core.run_node/call.json`, `web.action.succeeded`,
  `effectApplied: true`). In the page the model was shown, `t744` is the "Confirm" of list item `1/8`,
  the Tom Becker card with "1 mutual friend" (`R/0062.../result.json`, `R/0064.../result.json`). That
  row is one the step-4 listing's `where` (`[5-9]|[1-9][0-9]+ mutual friend`) rejects: the listing kept
  3 of 8 rows (`R/0068.../call.json` `produced.records: 3`). Core's instruction told the model to press a
  row the listing kept (`R/0071-decide/request.txt:1481`). I found nothing that checks the pressed row
  against the listing's kept rows (not verified exhaustively).
- `amend_draft {step:6, change:repeat, over:4}` made that press the loop body (`R/0070-decide/decision.json`).
- The stored argument (`R/0077-test-core.run_node/call.json`) is `web.output.dom-click` with:
  - a positional `selector` ending `div:nth-of-type(2) > div:nth-of-type(1) > div > div:nth-of-type(2)`,
    which points into the first card;
  - `element.accessibleName: "Confirm"`;
  - `context.listPosition {index:1,total:8}`;
  - `context.record.text: "Tom Becker1 mutual friend2w"`.

  It was frozen from `t744` by `webPlanElementIdentity`.
- **What the test did.** The dry run replays each proposed draft step once, in order, under
  `dryrun.<attempt>.<position>` (`C/runtime/llm/node-tools/replay-draft.ts:1-9,130,172`). There is no
  For Each and no `item`, so `scopedToRow` never ran, and the click went out with Tom Becker's record.
  `dryrun.1.6` is draft position 6; the judge called it "s7/s8" (`R/0071-decide/request.txt:241`). Tom's
  Confirm had already been pressed live at 0069, so the target was gone, and the replay answered
  `core.replay.remembered` (`R/0077.../meta.json`; code at `D/runtime/llm-evidence/node-run/replay-answer.ts:37`).
  The rows the listing kept were never pressed. The judge saw exactly this: "one remembered target
  repeated, not a per-row confirm" (`request.txt:241-242`).
- **What a real graph run would do.** For Each hands each kept row, for example `{name, mutualFriends}`,
  to the click's `item` (`draft-routing.ts:259-265`).
  1. `scopedToRow` sees `record` and `listPosition` and replaces the record with
     `{values:[<name>, <n mutual friends>]}` (`native-runtime.ts:158-166`).
  2. The positional selector matches one element, row 1's Confirm, if it is still there. The veto refuses
     it as `other-record` (`veto.ts:229`), because row 1 does not hold the pass's name.
  3. Gated family scoring then looks for a Confirm whose row holds both values (`resolve-target.ts:377-383`;
     the cards are `div`s, so `rowOfOneControl` supplies the row, `record.ts:324-338`).

  So the loop should land on each kept row's own Confirm, and fail as not found where that row has no
  Confirm. This is inferred from the code: no graph run of this Flow exists in the run files.

### What is missing for deterministic "this row's control" targeting

1. **Rows carry no identity.** An extract_list row is field values only (Q2), and row identity is
   "contains every value as text". It is ambiguous when two rows share their extracted values, and it
   breaks when a value is not drawn inside the row. Pagination re-renders are not covered either.
2. **The control is not addressed relative to the row.** The body step keeps the selector and
   fingerprint from the build row. The page finds the pass's control by vetoing that row and then
   rescoring the family (Q1). Nothing records "this control, at this path inside the row element the
   listing's item selector names".
3. **The model cannot express a row-relative target** (Q4). It must press one concrete row's `tN`, and
   nothing checks that the row is one the listing kept (Q5: it pressed an excluded row, and the press
   itself accepted that request during the build).
4. **The test never runs the loop.** The dry run replays the body once with the build row's identity
   (Q5), so per-row targeting is neither exercised nor judged before completion.
5. **A stale comment.** `native-runtime.ts:150-152` says a model-built node "carries its list position
   and never a record". `element-identity.ts:40-61,95` has carried `record.text` since t193.

## Commands run and observed results

Read-only `sed`, `grep`, `cat` and `python json` over the files cited, plus the run's `steps/0062-0079`.
No build, test or typecheck was run (the brief made this read only).

## Not verified

- No live or graph run of this Flow under For Each: the Q5 "real run" behaviour is inferred from code.
- Whether any Core or domain check refuses pressing a row the listing excluded: not searched exhaustively.
- Whether Core's dry run ever expands a `repeat` (I read only the replay-draft header and its loop,
  `replay-draft.ts:1-9,110-175`).

## Open questions or contradictions found

- `native-runtime.ts:150-152` contradicts `element-identity.ts:95` (item 5 above).
- The brief's "s8" is the judge's label. The dry-run call is draft position 6 (`dryrun.1.6`).
