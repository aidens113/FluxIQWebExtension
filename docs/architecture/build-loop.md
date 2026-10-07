# The Build Loop: The Web Domain's Side

What the web domain does when a FluxIQ build runs, writes and tests the steps of
a Flow: a live run against a written step, a replay sent with a loop's row, the
rows a replayed list read hands the test, and the check of a lasting act.
Current-state design (t252/t262, 2026-10-03; t264, 2026-10-05), verified against source. Core owns the
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

## Which List A Read Read

A live list read (`web.output.dom-extract_list`) that succeeds sends
`draft.reads: "list:<16 hex>"`, made by `node-run/list-read/code.ts` from a
sha256 of the page's origin and path (no query or hash, so page 1 and page 5
of one search are one page, and a reload keeps it) and the resolved
`extractList.item` selector the read ran with. The model's `extraction.N`
handle, `fields`, `where` and `sort` are not part of it: they say how a list
was read, not which list. Page 1 and page 5 sharing a code is what a page loop
needs: the read is one step that runs once a pass, not a new read per page. A read whose page or item selector cannot
be found, every other node, every refusal, a look and a written step send no
code; a read whose command met a robot check carries the code it would have
sent. The dry-run replay builds no draft statement and sends none. Core
compares codes for equality only and refuses a read joining the Flow with the
code of a kept read when no kept step changed anything between them
(`AS/runtime/flow-draft/second-copy.ts`, live run `run-muq4oaof-464f5bce`).
`capture.ts`'s draft type does not declare `reads` yet; `node-run/run.ts`
widens its `WebNodeDraftStatement` with it until it does.

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

Core sends a step with a declared lasting consequence, or one claiming a
lasting act of the person's, as `replay: "verify"` on every pass. An act is
lasting by its kind (an add, save, claim, move or submit, so a Confirm is
checked even when it declared `consequences: []`), by a quote of Core's read of
the instruction, or by that read's per-act answer; a setting or an open it
neither quotes nor answers as lasting runs again (Core's
`flow-authoring.md`, "Lasting Acts And Excusal"). `verify.ts` resolves the
row-scoped parameters and asks the page, through `web.dom.assert`, whether the
target is there, visible and enabled, and dispatches nothing that acts. It
answers `verified`, `present` (the effect is already in place on the step's own
page), `unreproducible` or `failed`. So the test of a loop that confirms each
kept request presses no Confirm.

An accepted missing or withdrawn target also returns the current resolved
`draft.ranWith` declaration, including its normalized parameters and declared
consequences. Core can therefore keep that checked candidate runnable without
borrowing an earlier action's arguments. Declined or unresolved checks provide
no accepted declaration. Returning `present` applies no action and establishes
no historical execution proof; whole-Flow testing remains required.

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
- **What a replayed press changed.** A changing step the test ran again
  answers, as an explored one does, the lines of its own page that changed
  (`node-run/press-effect/page-changes.ts`: a state gained or lost, or a text
  that now reads otherwise, `was "<old>"`, then `and N more changes`) and any
  notice the page showed (`press-effect/notice.ts`). Core passes them to the
  judge as that step's `observed`, at most three lines of 160 characters, the
  step's own control first and a changed text second, counting the rest and
  the domain's `and N more changes` line as not shown (Core's
  `llm-flow-bootstrap.md`, `build-test/change-lines.ts`).

## The Model's Instructions

The Lists line of the web system instructions
(`runtime/llm-evidence/system-instructions/instructions.ts`, version `web-5`)
says repetitive work is a loop: list the items with a `where` that keeps only
the ones to act on, act once on one kept item or write the act (`write true`),
state `repeat`, never act on every item; and bind a value that changes between
runs or rows (`{"$input": name}`, `{"$row": field}`). It adds that every page
of a list is a loop too: read the list, then Next page on the same list, then
`amend_draft` `repeat` on the read through Next page while it succeeds (`most N`
for "the first N pages"); the Flow keeps each row once. The build runs Next page
once live and states the loop; it never repeats a call to reach page two.

Core adds its own notes beside these. Its start-location note says the Flow's
first step may go straight to a stable deeper address on the same site where
the work begins, unless the person's instruction names how to get there (pages,
menus or links to go through), when that route is followed and its steps kept.
That clause is prompt wording only; nothing detects a named route (Core's
`llm-flow-bootstrap.md`, "The Flow may start where the work does").

## Tracing A Build

With `FLUXIQ_BUILD_PROGRESS_TRACE=1` in Core's environment, Core prints one
content-free `[FluxIQ build-trace]` line per seam of a build: the loop's calls
and decisions, a dry run's own call ids, a completion its test sent back, and
the build, its judge and the proposal's apply with their durations. Step names,
durations, verdict words and codes only, never page text (Core's
`llm-flow-bootstrap.md`).

## Not Built

`$step` bindings and declared Flow inputs (`interface.inputs`) are Core's P5;
row anchors are P6. Stored Flow nodes keep `metadata.declaredConsequences`,
but no stored-run gate reads it; that change is the user's decision.

### Paged lists

A list read (`web.output.dom-extract_list`) reads the one page it is given. A
detected list that continues carries `pagination` (how it continues:
`next_link`, `numbered_pages`, `load_more_button` or `infinite_scroll`) and a
`nextPageNote` naming its handle: for every page, add Next page with
`nextPage: {list: "extraction.N"}` after the read, then repeat the read through
Next page while it succeeds (`runtime/llm-evidence/structure/packet.ts`). The
packet states no page bound. Next page (`web.output.dom-next_page`, action
`web.dom.next_page`) moves the list on by one page and answers `success`,
`ended` when there is no further page, or `failed`; Core's do-while
`repeat {through, while, most}` runs the span again while Next page moves on,
and an `ended` answer leaves the loop cleanly. `nextPage` may also name a
page-view handle for the site's own Next control (`control: "tN"`), or be a
literal `{item, next?}` for a list nothing detected
(`plan-resolution/next-page-slot.ts`).

A handle-form read that writes `paginate`, `maxPages` or `maxScrolls` is
refused `web.handle.malformed` at that key with the expected hint
`web.handle.expected.extract_list.next_page`
(`plan-resolution/extraction/slot.ts`); it is never dropped silently. A stored
or literal read whose `paginate` goes past one page (any `maxPages` above one,
a `scroll` mode or a `maxScrolls`) is refused at dispatch with
`web.extract_list.paginate_retired` and the sentence "This step used to go
through pages by itself; the Flow now needs a Next page step and a repeat", which
sends the run to repair (`output-nodes/extract-list/dispatch.ts`,
`actions/extraction/retired-paging.ts`). A one-page `paginate` (`maxPages: 1`,
what the picker used to record) is dropped, since it reads the same page.

Every pass of the read appends to that read's run dataset. At run end Core
processes each dataset's collected rows into its answer: each row is kept once
by default (whole row, first seen kept), then the read's declared `dedupe`,
`sort` and limit apply, carried as `recordOutput.process` (`maxItems` becomes
`limit`, `minItems` becomes `minRows`). Readers, exports, the Lab and the run
judges read the answer; the collected rows stay as evidence. The build test
replays the span pass by pass and ends on Next page's `ended` answer, bounded
by `most`.

### Bound target test values

A target Flow input may retain the executor state binding while its concrete
test handle is resolved: target.$state keeps its path, and its fallback becomes
the observed adapted target with selector and element identity. The handle
never reaches persistence. A supplied runtime target replaces that fallback;
resolution adds no fixed global selector or element identity to shadow it.

Only the exact target binding grammar with a concrete handle fallback is
recognized here. Existing control, scope, uniqueness, frame, declaration and
permission checks still apply to the concrete test value. Permission receives
a separate view of the observed fallback identity. Agreeing duplicate target
references are folded into the dynamic target; conflicting locator/identity
slots are refused. This does not add support for nested handle bindings in
selector or element slots, or infer execution proof from resolution.
