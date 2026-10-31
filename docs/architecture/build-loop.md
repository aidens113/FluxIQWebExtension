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

## Authored script examples

The runtime supplies its versioned worked-example tails through Core's explicit
companion binding. See [web-authored script examples](web-script-examples.md) for
ownership, missing-client behavior and byte-preserving parity checks.

## Declaring available operations

Core checks required operations against declared node identities: node id,
label, tags and fixed or allowed output ids. Descriptions, parameter names,
data ports and category text remain in the complete model-facing catalog but
do not declare executable operations. In particular, the click node's help
asking the author to choose `ensureState` does not provide a selection action.
The domain explicitly tags secondary operations: check provides selection,
type provides submit, and browser tab provides open. A restricted catalog
missing a required operation is rejected before invoking a model.

## Frozen prior-call execution

The host can attest exact original executions and rerun them without reusing a
model handle against a replacement map. See [frozen node reruns](frozen-node-reruns.md)
for scope, actual permission proof, retry/receipt handling and conservative limits.

## Relative dates share a run reference

Core supplies a fixed `referenceNow` in native-node host context and runtime
dispatch context. The web domain forwards it through the existing
`extractList.now` request field. Browser date filtering and ordering therefore
use the same instant as Core's result processing and judgement, even when the
wall clock crosses midnight. Explicit request `now` values still take priority;
legacy calls without reference metadata retain their local-clock fallback.
Replay binding metadata carries the same reference without a model-authored
timestamp. A fresh execution captures a fresh reference; reused replay evidence
retains the time at which it was executed.

## Choosing a toggle's end state

A successful in-place press reports paired observations as
`toggle: { signature, beforeSignature?, idempotentWith? }`. `signature` is
the state after the press; `beforeSignature` is computed from the actual
readings in the reverse direction. The extension carries these as raw
`toggle` and `toggleBefore`; the gateway dispatcher wraps them for Core.
Failed, skipped, navigated-away or removed controls supply no new toggle
observation. Legacy after-only observations remain valid without an invented
pre-state.

The click catalog exposes `ensureState`. For a known toggle the model must
choose the state the instruction asks to leave by copying an exact observed
signature from this step's paired evidence or its control view. Core grounds
that choice and refuses missing, unobserved or conflicting choices with
answerable evidence. The first press and the most frequent transition do not
choose task intent. The selected signature remains the executable step's
state across loop passes and later opposite transitions. A control already
showing it answers `skipped: "already_in_state"` without a press.

## Which Build Runs

Every build starts from explicit task instructions owned by the Flow. Optional
recordings provide supplementary evidence only, with a separate description of
what each demonstrates. Recorded retries and extra acts do not expand the task
or force corresponding nodes into the automation. Core owns instruction and
recording persistence, evidence assembly and authoring/execution admission;
the web domain supplies browser evidence and actions.

Saved automations also need current active task instructions before their next
run or resume, including deterministic execution. Missing instructions lead to
the owning Flow's instruction editor. Valid written instructions allow reuse
without a new model call. Old graphs/recordings remain accessible; entering a
task does not retroactively prove an old recording-derived graph implements it.

Core's configured product default is `candidate`: exploration is separate from
submission of the whole Flow. Core's single setting `FLUXIQ_AUTHORING_MODE`
(Core `model/authoring-mode/`, described in Core's
`docs/architecture/automation-studio/llm-flow-bootstrap.md`) can explicitly select
`legacy` to retain the evidence-guided draft path. No environment file is rewritten.
Submission assigns a revision and digest; when a trial runner is available,
Core tests that exact candidate from the declared start, judges its outcome and
promotes only a passing candidate through the normal proposal path. Without a
trial runner, completion stores an unverified draft. The Lab starts each Core in
the mode a run names (`--authoring-mode`, `legacy` by default); the current
creation-qualification lanes explicitly select `candidate` and provide a trial
runner and start reset. Raw Core API requests that omit authoring mode retain
legacy compatibility. The domain capabilities below serve both paths; draft
retention details apply to legacy builds.

Candidate trial helper execution uses Core's exact unapplied candidate-owned
sibling graphs and normal child frames. Repeated/nested helper inputs and
results remain scoped; child lasting acts, reads and step feedback are counted
once for reset and judgement. A helper's authored failure alternatives keep
that helper's own budget. A successful selected entry does not prove every
alternative start or automatic decomposition quality.

Candidate checks distinguish a wrong result from an affirmative judge whose
exclusion explanation lacks required evidence. Core can re-ask that judge for
precise row-local name/quotation proof under the existing ask and spend bounds,
using the same screened task and result. Persistent missing proof remains
unconfirmed and cannot promote the candidate; a later test can rejudge the
same exact revision's retained evidence without executing the Flow again.
Actual wrong rows, counts and contradictions still require the existing repair
and validation path. The domain's task and independent Lab oracle are unchanged.

**Lists during candidate exploration.** One list read and one Next page provide
evidence for the paging loop. The submitted Flow reads subsequent pages at runtime;
exploration does not need to visit every page. Written candidates express repetition
with script repeat lines, while legacy drafts retain their `amend_draft` repeat form.
Core keeps submission and trial tools available when repeated looks are withdrawn
and through the final counted budget decision. A budget estimate never grants
acceptance or bypasses the whole-Flow spend ceiling: completion with a trial runner
still requires the exact latest revision's positive trial.

The web Lists guidance uses evidence of an item's type for categorical exclusions;
mentioning another type in a title does not establish membership in that type.
This guidance leaves deterministic filter operators unchanged. Its delivery is
tested; correct semantic filtering still requires live trial and oracle evidence.

The registered list-detection tool describes numeric bounds against recognized
combined counts using their whole total; otherwise the parser uses the first
numeric token. Quantity constraints use those numeric comparisons. Text regex
conditions match characters, so their cohorts still require semantic verification
against the instruction. Generic status exclusions illustrate text conditions.
These descriptions match existing extraction behavior; they do not establish that
a model chooses the correct condition or that result judges prove completeness.

## Live Run Or Write

`core.run_node` reaches `runtime/llm-evidence/node-run/run.ts`. Without `write`
it runs the node live, as it always has. With `write: true` the call takes the
same path up to the point a live call would send its command: the node, the
call's keys, the page and start location, the handle resolved into the frozen
identity (`target_not_a_handle` otherwise), the control's words, the
`consequences` the node owes, the origin and the addresses shown. It
skips the covered-target check, which is about where a press lands now, and the
permission gate, because nothing is done; then
`runtime/llm-evidence/node-run/written-step.ts` answers.

**Which calls declare (t439).** One rule, the domain's
`webPlanStepMustDeclare` (`plan-resolution/step-permission.ts`): a press, a
key press, a dialog answer and a typing step with `submit: true` must carry
`consequences` (`[]` for none), at plan time and on every live or written
`core.run_node` call alike, and Core's Flow script format states the same.
Any other node may declare and need not. Until t439 every acting node was
held to it live, so a saved navigate, check or type -- written as the script
format says -- was refused `missing_input_keys` on every rerun in a repair
(`run-mv4912r9-53b05a51`). A press must declare even when the Flow saved it
without one: undeclared, Core's permission gate would never be asked about it.
The rule is one table, `actions/consequence-declaration.ts`, which each output
node also states to Core as `metadata.consequenceDeclaration`, so Core
schedules only the saved steps that need not declare (or did) to run as saved
in a repair's test.

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

## Trusted Client Effect Floor

Canonical web node definitions carry Core's typed `actionEffect` contract,
resolved from `actions/action-effect/`. Click, keypress, dialog, download, tab
operations and Next are committing operations; typing becomes committing when
`submit` is true or unresolved. Explicit/default false keeps ordinary typing a
state change. Reads and waits remain observations. The table is independent of
the consequence-declaration rule above: a commit alone supplies no concrete
permission class and adds no declaration requirement or playback prompt.

The table separately promises `repeatSafe: true` for inspected absolute setters:
plain typing replaces the value, clear empties it, select assigns the requested
option, check establishes its requested boolean, and same-tab navigation sets
the location. State alone never implies this promise. Typing with submit and
navigation with true/unresolved `newTab` resolve to commit; known or declared
lasting consequences also override repeat safety. Upload has no repeat-safety
promise.

Exploration, plan projection, native playback, verification and direct presses
pass the canonical resolved floor separately from model metadata. Core keeps it
through failures and retries. A thrown gateway acknowledgement becomes a typed
unknown result without exposing exception text; an uncertain committing action
is checked and held rather than blindly repeated. Proven unacted/not-landed
actions retain automatic retries. The browser-safe helper imports only Core's
`fluxiq/automation-studio/action-effect` public subpath.

Core 0.17.1 also uses that floor for optional absent steps. A known commit is
recorded as `notDone` when skipped, including a click with a dismissal label;
the optional route stays nonfatal. Strict positive evidence that the recorded
effect already holds keeps its existing state-held route. An ambiguous target
failure must settle its effect before optional skipping or another state route.
State/observe labels cannot invent lasting acts; old clients without a contract
retain their annotation fallback.

## Elements Are Named By Handle Only

The user's rule (2026-10-10, t432): every saved element carries the full
multi-signal fingerprint ([element identity](element-identity.md)), and the
model "shouldnt have to worry about any of that, that's all handled by
extension". The model names an element by the handle the page view printed and
by nothing else; the domain turns the handle into the address and the identity
the step runs with.

**What the model reads.** An element node's `selector`, `element` and
`visualTarget` are declared `shownToModel: false`
(`domain/src/output-nodes/definitions.ts`), so Core's catalog and
`core.describe_nodes` never list them and a refusal never gives their shape
(Core's `llm-flow-bootstrap.md`, "The catalog an evidence decision is shown").
The node still declares them, so a saved Flow that holds them runs. The one
element parameter the model sees is `target`, described as "named only by the
handle the page view printed for it ... `{"handle": "t5"}`; in a Flow script,
`target: t5`", with `{"handle": "t5"}` as its example. `expectedState` is
described as the step's `done when:` line, which names its element by handle;
its locator `conditions` form is not described. The wait node keeps its id,
`web.output.dom-wait_for_selector`, because saved Flows name it; its label is
**Wait For Element** and its description names the element by its target
handle. The list read's grammar and example and the Next page's grammar and
example are the handle form only (`extraction.N`, `{list, control?}`); the
literal `{item: css, ...}` requests stay valid for a hand-authored Flow and are
no longer offered. A guard test fails if any catalog text asks for a selector,
a locator, CSS or XPath (`domain/src/output-nodes/tests/model-facing-catalog.test.ts`).

**What the model writes.** Plan resolution judges what the model wrote
(`runtime/llm-evidence/plan-resolution/written-literals.ts`) and refuses, at
its position:

- `web.handle.not_a_handle`: a `selector`, `target` or `element` holding
  anything but a handle reference (a `target` bound to state whose fallback is a
  handle is one), a `visualTarget`, or a `selector` inside an
  `expectedState` condition. A literal written beside a handle is refused, not
  silently replaced;
- `web.handle.required`: a node the model wrote whole that cannot run without
  an element (its schema requires `selector`) and names none;
- `web.handle.extraction_required` for a literal list read, and
  `web.handle.not_a_handle` (with `web.handle.expected.next_page.list_control`)
  for a literal Next page request, unless the read is the Flow's own detected list.

Both new codes are placement reasons, so a refusal also names
`web.handle.expected.target.handle_location` -- the code that was
`web.handle.expected.selector.handle_location` until t432. Exploration maps both
to the tool rejection reason `target_not_a_handle` (`tool-rejection.ts`).

**Who wrote what.** Only the model's writing is judged:

- Core passes `writtenByModel: true` for a candidate submission, a reply's plan,
  the no-exploration bootstrap and an in-run repair's steps;
- Core passes `modelWrittenParameters` for a plan built from the draft: the
  parameters an `amend_draft` decision's `settings` wrote over a step, which
  are judged, while what the step ran with stands;
- exploration (`node-run/run.ts`) treats every parameter of a call as the
  model's, except, in a round that continues a Flow, a parameter whose value is
  the one the Flow already holds for that node -- or a list request with the
  held item -- which a rerun merged from the saved step
  (`node-run/held-literals/`, fed by the `held` calls of the round's opening,
  which Core marks `continuing`; see [what a build remembers](#what-a-build-remembers)).
  A held value counts as held after the screen of denied keys too: the shown
  copy of a saved element (its `selector` taken out) is put back to the saved
  element, with the saved `selector` beside it, when the call names no handle
  (t439).

A step the draft ran, a recorded step, a step the Flow already holds and a
hand-authored Flow (the Lab's recovery matrix, the demo workspace) are never
flagged, so their literal selectors still resolve `unchanged` and run. A held
step rerun as saved, its element held and no handle named, runs on its saved
element rather than being refused `target_not_a_handle` (t439).

**What a step keeps as its input (t439).** A call that named its element by a
handle keeps `input` naming it by that handle alone: its `selector`, `element`
and `visualTarget` are left out of `input` (`node-run/node-call.ts`), not
screened, and stay in `ranWith`, which the Flow keeps. Screened, the saved
element came back without its selector, and a rerun from it was refused as an
element the model had written (`run-mv4912r9-53b05a51`, t942 and t870). A
stale handle on such a rerun is answered by the handle refusals
(`handle_not_in_packet`, `renumbered_by_reload`).

**A candidate's step stands where the steps before it left the page (t748).**
The store that turns a handle into its element
(`runtime/llm-evidence/plan-resolution/target-packets.ts`) keeps one view per
location. A site can open an item as a dialog over a list and push the item's
own address, while loading that address gives a different document, and one
Flow handle can name a control in each. Once the build has looked at both, the
handle names the standalone page's control. On its own, that sent a Flow that
opens the dialog and presses the handle into the dialog with the standalone
identity (`web.target.ambiguous` among the dialog's look-alike controls). So
each Flow also keeps its dialog views and the dialog each exploration press
opened (`plan-resolution/step-views/`). When Core resolves a candidate's plan,
it sends each node `precedingSteps`: the plan's steps before it in plan order,
as the plan held them (handles intact, the consequence declaration removed).
That list includes the steps Core never asks the domain about, such as an
untouched inherited step or a handler whose page fact was refused. Page-fact
targets are not steps, so they are never in the list and are sent none. A node
with more than 200 steps before it is sent none. The resolver works out how each
of those steps moves the page (`step-views/move.ts`) and folds them in order:
- a press stands in the dialog exploration's press of that handle opened;
- a read, or an act on a control in place, stays where the step before it stood;
- a navigation, a key, a page fact or any other node stands nowhere in particular.

A handle that the dialog those steps left open shows, inside the dialog,
resolves to that dialog's control wherever the pages name another control or
none. It carries the dialog's context, that view as `handleViews`, and the
identity exploration's first press of the handle found there. Everything else
resolves as before. A step after a navigation to the item's address names the
standalone control, with the words that page showed last. Nothing is kept
between resolutions. Where a step stands comes from the steps Core sent, never
from the order Core asked. So a plan resolved straight after another starts
from nothing, and an inherited navigation still moves the page for the steps
after it. A node sent no steps, which is every node outside a candidate
submission or from a Core without the field, stands nowhere and resolves exactly
as before. t743 tried keeping the two documents as two views with the
acted identity kept per address, and that was reverted: the first act at the
standalone address was the press that undid the dialog's act, so the Flow saved
the words that undo found ("Unlike"). The acted identity stays the handle's
first act's, lent only to its matching retained source. One limit remains. Plan
order is used as run order, so in a Flow whose nodes branch, the node listed
before a press may not be the step that runs before it. A handler, or any node
the domain does not run, counts as moving the page anywhere, so a press after one
resolves as before.

**Control intent is host evidence, separate from saved targets.** Each actual
retained binding is classified once, by its own captured control and containing
layer. Its private target carries `accept`, `dismiss`, `neutral` or `navigate`;
only an actual consent response may carry `accept` with `responseOnly: true`.
The resolver supplies that annotation as the top-level `controlIntent`
companion, including nested Run Output and bound-target fallbacks. It never
writes it into executable parameters, fingerprints, handler facts or model
packets. Fact targets and unrelated parameters contribute no annotation.

Intent follows the exact selected target's location, frame, document and layer.
Explicit historical location selection retains that location's own identity,
not the newest target under the reused handle. A restored pre-act identity
keeps its original capture's intent; another positively selected control at the
same address keeps its own identity. Candidate/history semantic disagreements
refuse as an ambiguous target instead of choosing a permissive tag or dropping
the companion. Current exact-page resolution uses its latest actual capture's
intent with the existing identity merge; bare cross-page conflicts still refuse
and pre-act restoration cannot erase them.
Repair resolution uses only the runtime's exact retained packet binding.

A host-held absolute target can receive the companion without changing its
parameters only when its full observed identity, selector and frame match one
unique retained source. Multiple matching sources refuse. Missing evidence
preserves the existing unchanged result and supplies no safety claim. Model
absolute selectors remain refused, and annotation-shaped fields in model or
saved JSON never supply authority. The companion does not grant permission,
lower an action's effect floor, make a lasting act repeatable or change the
extension's automatic interference-clearing policy.

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

## What A Press Changed

A press, a type or a choice that changed the page in place sends
`draft.changed`: at most sixteen `{ words, how }` lines in page order, made by
`node-run/press-effect/change/statement.ts` from the same walk
(`press-effect/change/walk.ts`) as the outcome's own `changed` list, so the
two never disagree. A text line that appeared or went is stated `appeared` or
`went` in the cut words the outcome entry quotes; a line of any kind with
words on both pages whose words changed is stated with its words now, `rose`
when they differ only in one number that went up ("Cart (2)" to "Cart (3)",
"1 item" to "2 items", `press-effect/change/rose.ts`) and `reads` otherwise.
State-token changes and lines without words are never stated. It is sent under
the outcome's own conditions -- a mutating node that does not move the page,
both pages read, one location -- and absent otherwise; a look, a navigation, a
read, a refusal, a robot-check standing step and a written step send none.
Core withholds a line whose words the call's evidence never showed (so a line
past the outcome's eight that went is usually withheld) and keeps the rest on
the step, where it reads which step did an act from what the step changed
rather than from the model's label (`AS/runtime/flow-draft/step.ts`,
`changed`; week report W1, run `run-muqiho5c-e830ce01`). A checked rerun given
a new argument clears it with `toggle` and `reads`.

`stable-handles.ts` preserves an unambiguous control's handle across a reload
that rewrites its selector shape by matching page, frame, shadow-root depth,
record, tag and identity words after the existing address tiers. Both capture
and remembered candidate must be unique. Wordless controls, duplicate labels
and a candidate still standing at another old address do not use this
fallback, and neither does a number last seen in the same document
(`navigation.timeOrigin`): without a load, a control that vanished is gone and
one that appeared is new, so a handle never moves to a control that a later
step opens (t642, `run-mv9v3u68-6efbd7ae`). This prevents a rerun from losing
an otherwise identifiable control while keeping ambiguous targets distinct.

At replay, a saved target whose several matches are all hidden is not found
rather than ambiguous (`resolve-target.ts`), so an optional step whose control
the page has not shown yet is skipped as absent; a tie among visible matches is
still `web.target.ambiguous`, and a lone hidden match still resolves.

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

A replayed single-value read, `web.dom.extract`, answers the value it read on
`outputs.value` (t646, `replayedReadOutputs` in
`runtime/llm-evidence/node-run/replay.ts`): the client's `extracted`, which is
what the Flow's run copies to the node's `value` port from the dispatched answer
at the port's `resultPath`, `result.extracted`
(`output-nodes/extract/value-port.ts`; Core
`runtime/executor/node-execution/result-path-outputs.ts`). A later step of the
test that reads `$step.<label>.value` therefore resolves as it will when the
Flow runs. An answer with no `extracted` -- a sensitive control, whose value the
gateway mapping drops -- gives no `outputs`, as the Flow's port stays empty.

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
  each pass's row in Core's per-pass lines. Under `leftOutTogether` (t655) it
  names once each row two or more conditions left out together, grouped by
  the set of conditions it failed (`conditions` by name, `conditionIndexes`
  0-based), by label alone and withheld as a label is
  (`node-run/left-out-together.ts`), so a read's labels can name every row it
  saw. A read asked only for each condition's alone rows (`rejectedSamples:
  "alone"`, as a playback and the replay ask) gets, after each list's alone
  lead, the rows it shares with another condition's list, each with a `null`
  observation (`apps/extension/src/content/actions/extract-list.ts`); a row in
  one list only is not sent. Core admits a playback's as
  `conditions.togetherRows` (its `service/summaries/extraction-summary.ts`).
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

## What A Build Remembers

The domain keeps four memories across the calls of one build: whether it has
reached its start location (`node-run/arrival.ts`), the addresses it has been
shown and may navigate to (`node-run/shown-addresses.ts`), the values a
continued Flow already holds (`node-run/held-literals/`), and the layers its
own presses opened (`node-run/own-layers/`). Core, not the domain, says which
build a call belongs to and whether it starts that build afresh. Inside every
`executeTool` the domain reads `automationStudioEvidenceBuildScope()` (from
`fluxiq/automation-studio`; Core's
`runtime/llm/harness-options/evidence-build-scope.ts`), which gives
`projectId`, `flowId`, `buildId`, `callScope` (present only when project briefs
run side by side for the same Flow), `opening`: `"fresh"` on an opening
that starts the build, `"continuing"` on the opening of a repair or re-author
round whose draft already holds the Flow, and absent on every other call, and
`move: "core"` on a call that is a move Core makes itself (the site reset's
arrivals and looks), which Core sets from its own async-context marker and
never from the call id. The domain parses no call ids (`initial.*`) of its own;
`webNodeBuildOf` (`node-run/build-state/build-key.ts`) answers the key, the
opening and `coreMove`. The arrival, held-literals and own-layers memories are
keyed by `buildId` plus `callScope` and reset only on `"fresh"`; a call with no
frame for this project and Flow (a direct call or a test) is keyed by project
and Flow alone, never reset and never stored. Repeated refusals
(`repeated-refusal.ts`) start over on any opening, per build and brief, and
their reason, `AUTOMATION_STUDIO_REPEATED_ANSWER_REASON`, is Core's
(`fluxiq/automation-studio`).

**Shown addresses belong to the build (t743).** The address rule exists to stop
the model navigating to addresses it made up, and an address the site showed to
any brief of a build is not made up. So `node-run/shown-addresses.ts` keys its
memory by the build alone, without `callScope`: briefs that run side by side
share one in-process memory and one stored value, and no opening forgets it --
a repair or reset brief's fresh opening still admits the pages an earlier
brief searched for or stood on. A new `buildId` is a new key, so a new build
starts empty. What counts as shown: a link's href, the location of a page any
brief of the build was shown or stood on, a read's address, the start
location, a repaired step's address (`repairs`), and Core's `places`. Core puts
`places` -- the locations of the build's issued lists -- on every brief's
opening call; `webNodeOpeningPlaces` (`node-run/arrival.ts`) strips it, read
only when Core's frame marks the call an opening, and `node-run/run.ts` passes
each entry to the memory as held, as it does repaired addresses: shown, not an
arrival and not a step. On any later call `places` stays on the value and is
refused `unexpected_input_keys`. A call framed `move: "core"` skips the address
rule only; the cross-origin check, the permission gate and the rest still run.
A navigation the rule refuses is answered `address_not_shown`, and its
`instead` names three ways around it: press, by its handle, the link that goes
there; navigate to an address this build was shown (a link's href, a page any brief stood on, a
read's address or the start location); or reach a page a typed search reached
by typing the search into the site's own search field and submitting it, never
by writing the page's address.

The memories also outlive the process. Core owns a durable, size-bounded
domain build state (`runtime/domain-build-state/`, exported from
`fluxiq/automation-studio`) that keeps values opaque under the Flow; the domain
reaches it with `automationStudioDomainBuildState(fluxiq, "web-automation")`
(`domain/src/cleared-way-outs/build-state-source.ts`, asked lazily). Each memory writes
through to scope `{ projectId, flowId, buildId }` under `web.arrival`,
`web.shown-addresses`, `web.held-literals` or `web.own-layers` (with
`:<callScope>` for a brief, except `web.shown-addresses`, which is one key for
the whole build), in order and coalesced, and a call's writes settle
before its answer returns (`node-run/build-state/persistence.ts`,
`memory.ts`). The in-process memory stays authoritative: a write Core refuses
leaves the last stored copy, and after a restart a memory is read back the
first time its build calls again. A memory that can grow past Core's 64 KiB
value bound stores a bounded copy instead of having its writes refused
(`node-run/build-state/stored-prefix.ts`, t737): `web.shown-addresses` keeps,
within three quarters of that bound, every typed text it can and then the
most recently shown addresses (a page's own location counts as newer than its
links, and an address shown again as newly shown). Forgetting an old address
after a restart can only refuse a navigation, never allow one; the set is not
split over several keys because they would share the build's 256 KiB scope
with the other memories. A stopped build that is continued later gets a new
`buildId`, so its build-scoped memories start empty.

Cleared way-outs -- the references of popups a press cleared, which Core hands
back for a trial -- are kept per Flow rather than per build
(`domain/src/cleared-way-outs/registry.ts`): Flow scope with no `buildId`, key
`web.cleared-way-outs`, at most 256 entries and 60 KiB, oldest first out.
`find(reference, flow)` reads the process cache, then the Flow's record, so a
cleared control's handle still resolves after a restart. The output dispatcher
keeps each way-out with the Flow named by the command context or Core's build
frame.

## The Model's Instructions

The rules that hold for every domain are Core's, in Core's task prose
(`packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/system-prompt.ts`),
placed only in the task kinds that act or write steps. Repetitive work is a
loop, not a sequence: list the items with a `where` that keeps only the ones to
act on, do or write the act once on one kept item, state `repeat`, never do it
to every item; and bind a value that changes between runs or rows
(`{"$input": name}`, `{"$row": field}`)
(`AUTOMATION_STUDIO_LOOP_AUTHORING_INSTRUCTION`, sent to Flow Bootstrap and the
runtime, subflow and expectation-target patches; evidence decisions get the
same rule from Core's loop policy). Keep an item by evidence of its own type,
and state a loop's repeat by `amend_draft` `repeat` in a draft and by repeat
lines in a written Flow (`AUTOMATION_STUDIO_LIST_AUTHORING_INSTRUCTION`), and be
efficient against the build's small cost ceiling
(`AUTOMATION_STUDIO_EFFICIENCY_INSTRUCTION`), both sent to Flow Bootstrap and
evidence decisions. Core also says the person's limits (anything a person could
do, but money, delete and send/publish are asked first; never type a secret;
`AUTOMATION_STUDIO_PERSON_LIMITS_INSTRUCTION`) and, when a request carries
recordings, that written instructions outrank them
(`AUTOMATION_STUDIO_SUPPLEMENTARY_RECORDINGS_INSTRUCTION`).

A recording the person attaches in the extension chat reaches a build this way (t770): the relay's `onScreen.recordingId` makes Core's `flow.createHere` check it (finished, described, in this project) and link it to the Flow's saved instruction, so every provider request of the build carries it as `supplementaryRecordings` beside the person's own message, which stays the task.

The web system instructions
(`runtime/llm-evidence/system-instructions/instructions.ts`, version `web-12`)
keep only what is web-only. Their Lists line says every page of a list is a
loop the Flow states: read the list, then Next page on the same list, then
repeat the read through Next page while it succeeds (`most N` for "the first N
pages"); the Flow keeps each row once. Exploring needs one page read and one
Next page: the build runs Next page once live and states the loop; it never
repeats a call to reach page two.

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

By default, every pass of the read appends to that read's run dataset. At run end Core
processes each dataset's collected rows into its answer: each row is kept once
by default (whole row, first seen kept), then the read's declared `dedupe`,
`sort` and limit apply, carried as `recordOutput.process` (`maxItems` becomes
`limit`, `minItems` becomes `minRows`). Readers, exports, the Lab and the run
judges read the answer; the collected rows stay as evidence. The build test
replays the span pass by pass and ends on Next page's `ended` answer, bounded
by `most`.

A declared `recordOutput.purpose: "intermediate"` keeps validated rows for
computation and row-bound controls without saving an answer dataset. The
domain preserves this explicit property through extraction reconciliation and
the shared Core parser; it never infers the purpose from columns, names or
loop usage. Schema validation and sensitivity handling still apply, and Core
refuses invalid/truncated intermediate captures and nonempty answer `process`
declarations. Intermediate output cannot satisfy a requested answer-table
capability. Its read, condition and action evidence remains available to
verification across current and reopened runs. Old Flows retain answer
behavior; the new optional field requires a matching Core contracts/runtime
release because older parsers reject it.

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
