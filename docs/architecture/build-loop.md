# The Build Loop: The Web Domain's Side

What the web domain does when a FluxIQ build runs, writes and tests the steps of
a Flow: a live run against a written step, a replay sent with a loop's row, the
rows a replayed list read hands the test, and the check of a lasting act.
Current-state design (t252/t262, 2026-10-03), verified against source. Core owns the
draft, the binding forms, the walker that runs a loop once per row, and the
verdict; they are in FluxIQ Core's
`docs/architecture/automation-studio/flow-authoring.md` (in the sibling
`!FluxIQ` checkout; a link out of this repository fails the docs-links audit,
so Core's pages are named by path, as the neighbouring pages do). Paths below
are under `domain/src/`.

## Live Run Or Write

`core.run_node` reaches `runtime/llm-evidence/node-run/run.ts`. Without `write`
it runs the node live, as it always has. With `write: true` the call takes the
same path up to the point a live call would send its command: the node, the
call's keys, the page and start location, the handle resolved into the frozen
identity (`target_not_a_handle` otherwise), the control's words, the
`consequences` a mutating node owes, the origin and the addresses shown. It
skips the covered-target check, which is about where a press lands now, and the
permission gate, because nothing is done; then
`runtime/llm-evidence/node-run/written-step.ts` answers.

- `webWrittenStepIssue` holds a written step to the node's own schema, since no
  page judges its parameters until the test: the declaration must read as the
  gate would read it (`consequences_unreadable`), every required parameter must
  be given (`missing_input_keys` with `missing`), and every given one must be of
  the schema's type (`parameter_not_readable`). A `$state` leaf
  (`isWebPlanStateBinding`, `runtime/llm-evidence/plan-resolution/state-binding.ts`)
  counts as given and is not type-checked; plan-time resolution passes it
  through untouched.
- `webWrittenStep` answers `resultCode: "core.run_node.written"`,
  `effectApplied: false`, and a draft `{actionId, effect, input, ranWith,
  proposes: true, written: true, replay: {from: {location}}, control}`, with
  `ranWith` (node, parameters, consequences) as a live call states it.

A `write` that is not a boolean is refused `unexpected_input_keys`. A written
look is answered as an ordinary look. Bindings are supported at parameter-leaf
level only: a `$state` inside an `extractList` `where` condition value is not
supported: the extraction's condition readers do not resolve bindings.

## Choice Changes And Stable Handles

A live press that changes a control's chosen state on the same page sends
`draft.toggle: {key, to}` through `capture.ts`: the canonical target handle
and `on` or `off`. The shared `node-run/press-effect/chosen-state.ts` reader
compares the control's own `marked`, `selected` or `checked` tokens before and
after; `choice.ts` produces the explanatory sentence and `toggle.ts` produces
the structured statement. Navigation, missing evidence, unchanged controls
and written steps send no toggle. Core accepts this field explicitly and
uses it to recognize cancelling presses; the domain does not edit the draft.

`stable-handles.ts` preserves an unambiguous control's handle across a reload
that rewrites its selector shape by matching page, frame, record, tag and
identity words after the existing address tiers. Both capture and remembered
candidate must be unique. Wordless controls, duplicate labels and a candidate
still standing at another old address do not use this fallback. This prevents
a rerun from losing an otherwise identifiable control while keeping
ambiguous targets distinct.

## Replay With A Row

A loop body's step arrives in the test with the pass's row as `item`. Both
`runtime/llm-evidence/node-run/replay.ts` (`replay: "step"`) and
`runtime/llm-evidence/node-run/verify.ts` (`replay: "verify"`) scope the
parameters with `webAutomationScopedToRow(parameters, item)`
(`output-nodes/targets/row-scope.ts`) before the permission check, resolution
and the command. That is the function the Flow's own For Each pass uses in
`output-nodes/native-runtime.ts`, so the test targets each row exactly as the
stored Flow will: the row's values replace the recorded `element.context.record`,
and the page accepts the control only inside a record holding all of them. A
control that sat in no repeated thing, a missing row, or a row that is not an
object leaves the parameters untouched. Until extract_list rows carry an anchor
(P6, not built), two rows with equal values cannot be told apart.

## The Rows A List Read Gives The Test

A replayed `extract_list` answers the rows the Flow would save on
`outputs.records` (`withNodeOutputs`, `runtime/llm-evidence/capture.ts`;
`webNodeReplayFlowRows`, `runtime/llm-evidence/node-run/replay-answer.ts`). It
runs the same two steps as the Flow's capture: `webAutomationExtractListDispatch`
on the resolved parameters, then Core's `validateAutomationStudioRecords` on the
client's `extracted`, with the record output's schema and `maxRecords`. A
dispatch that refuses its record output, an answer with no row list, or a
schema that refuses every row gives no `outputs`, and Core's walker then runs
the loop once on the explored row. These are whole rows, page text and all:
Core carries `outputs` and never shows it to the model or the judge.

## Lasting Acts Are Checked Per Row

Core sends a step with a declared lasting consequence, or one doing an act of
the person's, as `replay: "verify"` on every pass. `verify.ts` resolves the
row-scoped parameters and asks the page, through `web.dom.assert`, whether the
target is there, visible and enabled, and dispatches nothing that acts. It
answers `verified`, `present` (the effect is already in place on the step's own
page), `unreproducible` or `failed`. So the test of a loop that confirms each
kept request presses no Confirm.

## What The Judge Is Told About Rows

- **Left-out rows' tested values.** A replayed list read also answers `readRows`
  (`webNodeReplayReadRows`): the kept rows by label, and under
  `leftOutOnlyByThis` the rows each condition left out by itself, each with the
  row's own cell for the column that condition tested (from `ranWhere`, the
  `where` the page actually ran), screened as a label is. These labels name
  each pass's row in Core's per-pass lines.
- **`rowContextKeys`.** The domain declares to Core the keys under which a
  step's argument carries the row its control was found in, `["record"]`
  (`WEB_LLM_ROW_CONTEXT_KEYS`,
  `runtime/llm-evidence/plan-resolution/row-context-keys.ts`, declared in
  `runtime/llm-evidence/tools.ts` beside `deniedEvidenceKeys`). Core leaves
  those keys out of a repeated step's target words, because the row it was
  built on is only its template.

## The Model's Instructions

The Lists line of the web system instructions
(`runtime/llm-evidence/system-instructions/instructions.ts`, version `web-4`)
says repetitive work is a loop: list the items with a `where` that keeps only
the ones to act on, act once on one kept item or write the act (`write true`),
state `repeat`, never act on every item; and bind a value that changes between
runs or rows (`{"$input": name}`, `{"$row": field}`).

## Not Built

`$step` bindings and declared Flow inputs (`interface.inputs`) are Core's P5;
row anchors are P6. Stored Flow nodes keep `metadata.declaredConsequences`,
but no stored-run gate reads it; that change is the user's decision.

### Bounded extraction feedback

Detected list evidence includes selector-free paginationBound (maxPages or maxScrolls). Omitting paginate, or passing true, retains the detected bound; it does not request every page. Explicit extractList.paginate.maxPages or maxScrolls changes that bound. Defaults remain bounded. A page_limit report names the reader's actual clamped bound and the nested amendment needed to read further; truncation is still incomplete evidence, never proof that the list ended.
