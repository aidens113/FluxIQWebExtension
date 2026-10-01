# t194-w36: condition-only columns

## Files owned (declared before editing)

- `domain/src/runtime/llm-evidence/tools.ts` -- the `web.detect_repeating_structure` description, the one place under
  `runtime/llm-evidence/` that teaches the model how to write `extractList` and its `where`.
- `domain/src/runtime/llm-evidence/tests/tools.test.ts` -- its assertions.

## Outcome

Partial. The model is now told, in the one domain text under `runtime/llm-evidence/` that teaches `where`, that a
condition may name a column the plan does not keep and that it should keep only the columns asked for. The second
half of the brief, a note on the read's result naming kept columns used by conditions, needs a change in
`node-run/run.ts` (another worker's), so it is described below, not built.

## Where the model learns to write an `extract_list` plan

Searched `domain/src/runtime/llm-evidence/` for `extract_list`, `extractList`, `where` and column text, and the Core
`runtime/llm/` tree for model-facing extract text.

1. `runtime/llm-evidence/tools.ts`, the detect tool description (Core bound: 2,000 characters). This is the full
   `where` vocabulary. **Edited.**
2. `output-nodes/extract-list/catalog-text.ts`, `WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR` (the `extractList` parameter
   description, Core bound 700, at 700 of 700) and the node description. **Not edited**: it is outside
   `runtime/llm-evidence/`, so not in my ownership, and it has no room. Its shape
   `where?: [{field: "colKey", is: "absent"}, {field: "yourKey", ...}]` shows a condition on a detected key beside
   `fields?: {yourKey: ...}` but never says the `colKey` need not be in `fields`. A clause there would have to
   displace one (the doc comment lists what each earlier clause cost).
3. `runtime/llm-evidence/structure/packet.ts`: only `RECORD_NOTE`, about one-record handles. Nothing on columns.
4. `runtime/llm-evidence/vocabulary.ts`: tool ids and result codes only. Nothing model-facing about plans.
5. Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/`: no text describes the extract plan or `where`.
   The only extract text found is `AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION` (`diagnosis-instructions.ts:43`),
   which is the judge. **Proposed Core change, not made**: nothing is needed for building. If the judge should name
   the defect, it could add one clause such as "a stored column the request did not ask for is a wrong column; name
   it". That belongs to lane C (judge) and is not part of this brief.

## What changed and why

`tools.ts`, the detect description (1,990 -> 1,992 characters of 2,000):

- Added: "It may name a column fields does not keep: keep only the columns asked for, never a mark used only to filter."
  It sits right after the sentence saying what a condition names.
- Merged the closing sentence "Name a column the detection showed, never a word you hope is somewhere in the item"
  into the condition sentence: "each names one column the detection showed, never a word you hope is in the item, and
  compares it". The rule is unchanged, and saying it once made room.
- Wording cut to fit, no rule removed: "Returns no values or selectors." (the text already says to run the node to see
  rows), "naming it", "when"/"opaque" before "target handle", "the comparison" after "(no number fails", "really"
  before "reads", "in" in "mixes advertisements in with", ", and" became ";", and the comma before "and how the list
  continues".
- The comment above `tools:` now gives the new count, the cause (`run-muq4oaof-464f5bce`, cause 7), and what paid for
  the room. It also corrects "catalog-text.ts sits three characters inside" to "sits at", which is what that file's
  own doc says (700 of 700).

`tests/tools.test.ts`: one assertion that the description carries the new sentence, with the run id.

Not changed: the resolver. It already accepts an unkept detected key
(`plan-resolution/extraction/conditions.ts`; `tests/conditions.test.ts` "a condition names a detected column and
becomes the column's own read").

## The read note (described, not built)

This is cheap and exact, but it needs the dispatched parameters, which only `node-run/run.ts` has.
`webNodeReadWithRejectedRows` (`node-run/rejected-rows.ts`) gets the payload alone, and the extraction summary
(`actions/extraction/summary.ts`) does not say which column each condition read.

- Data: the resolved `extract_list` request `ran` has `fields: {key: spec}`, and each resolved `where` entry is
  `{read: <column spec>, ...saying}` (`conditions.ts`, `keptWebExtractionConditions`, line ~93: `read: column.field`).
  The keys that conditions use are the kept keys whose spec equals a condition's `read` under a JSON deep-equal. That
  is exact, because both come from the same detected spec. A kept column read as `@attr` has a different spec and
  rightly does not match.
- Shape: put it beside the rows, as `rejectedRows` is put: `{ filterColumns: ["plus", "ad"] }`, keys only, plus at
  most one short sentence, e.g. "filterColumns are kept columns a condition tests; drop any the instruction does not
  ask for: the condition still works." Only add it when the list is non-empty.
- Wiring: add an optional `ran?: JsonObject` argument to `webNodeReadWithRejectedRows` (or a separate pure helper in
  `node-run/` with its own test), and pass `ran` at `run.ts:414`, which already has it from line 368. `filterColumns`
  sits inside the read, not as an execution-result member, so Core's closed result-key list
  (`WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`) is not touched.

## Commands run and observed results

All run from the tree root through `heavy.sh`.

- `npx tsc -p domain/tsconfig.json --noEmit`: exit 0, no output.
- `npx tsc -p domain/tsconfig.test.json --noEmit`: exit 2, with one error at
  `domain/src/runtime/llm-evidence/node-run/tests/covered-press.test.ts(51,9)` TS2322 (an `overlays.blockers` object
  is not assignable to `JsonObject`). That file is unmodified in the tree and is not mine, so the error is not from
  this change.
- `narrow-tests.mjs <domain> t194-w36 runtime/llm-evidence/tests`: 191 tests, 190 pass, 1 fail. The failure is
  `capture-after-action.test.ts:113` "the default wait is ended by cancellation without running out its interval"
  (wall-clock: "the 250 ms wait was cut short"). The test that holds the description assertions passes:
  `ok 163 - binds from the production host seam ...`.
- Baseline: I copied the original `tools.ts` back, ran the same command, then restored my version and confirmed it with
  `git diff --stat`. Result: 189 pass, 2 fail. The same timing test fails, so that failure was there before this
  change. Test 163 also fails, as expected, because the old text lacks the new sentence.
- `node scripts/structure-audit.mjs`: "structure-audit: passed (154 warning(s), 118 baselined)."

## Not verified

- Whether a live model now leaves the filter-only columns out of `fields`. No Lab run, no model calls.
- The read note: not built (see above).
- The covered-press type error and the capture-after-action timing failure are both outside this change. I did not
  investigate either.

## Open questions or contradictions found

- The tools.ts comment said catalog-text "sits three characters inside" its 700 bound, but catalog-text's own doc says
  700 of 700. I corrected the tools.ts comment to match.
- catalog-text's grammar is a second place the model learns `where`, and it has no room for this rule. If the
  supervisor wants the rule there too, a clause has to be cut or Core's 700 bound raised.
