# Sensitive Values

Which controls hold a secret, who asks, and what the guards around them are —
and are not — a boundary against. Current-state design, verified against
source on 2026-09-15.

## One Rule

`isSensitiveFieldSignature`
([`domain/src/sensitivity/signature.ts`](../../domain/src/sensitivity/signature.ts))
is the rule. It reads three attributes and returns a verdict:

- a control whose type is `password`, or `one-time-code` or `credit-card`
  given as a type (both are `autocomplete` tokens rather than input types, and
  the rule accepts them in either place);
- `data-sensitive="true"`;
- an `autocomplete` **token** that is `current-password`, `new-password`,
  `one-time-code`, or begins `cc-`.

`autocomplete` is a space-separated token list, so every token is checked:
`billing cc-number` is what a real card field carries, and matching the whole
attribute instead of its tokens would miss it.

**Signature, never value.** Nothing in the rule is given a control's contents,
so a caller can ask before it reads.

It lives in the domain package because that is the only place every caller can
reach: the structure audit forbids `domain/src` importing
`apps/extension/src`, while the extension already depends on
`@fluxiq-web-extension/domain/client`. Every caller asks this one function
rather than restating it, so no two callers can disagree about a control. Two
adapters sit over it and nothing else belongs
in the directory:

- `sensitiveFieldSignatureOfDescriptor` / `isSensitiveElementDescriptor`
  (`sensitivity/descriptor.ts`) ask the same question of a serialized element
  descriptor, whose attribute allowlist already carries `type`, `autocomplete`
  and `data-sensitive`. The input is `unknown` on purpose: a descriptor
  arrives from a page, over a wire, or out of stored state.
- `isSensitiveFormControl`
  (`apps/extension/src/content/element-traits.ts`) asks it of a live DOM
  element. It stays in the extension because the domain package must not
  depend on the browser.

`apps/extension/src/shared/sensitive-field.ts` holds no rule of its own; it
re-exports the domain's, so the extension's call sites keep one import path.

## Capture: The Value Never Leaves The Page

Withholding is unconditional and does not depend on a setting.

- **Element descriptors.** `readElementValue`
  ([`content/describe-element.ts`](../../apps/extension/src/content/describe-element.ts))
  returns nothing for a sensitive control, or for an element inside one — a
  span in an editable region marked `data-sensitive` is editable itself, and
  its words are the region's value — so no descriptor carries its value.
  A sensitive `<select>` yields neither its `selectedValue` nor its option
  list — the options are the value space, and publishing them narrows the
  secret. The attribute allowlist deliberately excludes `value`. A file input
  yields no value either, sensitive or not: its value is the chosen file's
  local name, which belongs to the person's machine rather than the page. Only
  `hasValue` says whether it holds files.

  Nor does a descriptor quote what a sensitive control holds as text: a
  sensitive `<textarea>`'s text, a sensitive `<select>`'s option labels, the
  words in any element the rule marks. `visibleText` and `directVisibleText`
  read through `textOutsideSensitiveControls`
  ([`content/sensitive-text.ts`](../../apps/extension/src/content/sensitive-text.ts)),
  so a sensitive control, or anything inside one such as a listbox's
  `<option>`, gives no `text` or `visibleText`, and a container's text leaves
  those contents out: a `<label>` wrapping a sensitive textarea reads as its
  label. Rendered elements are still listed in document order; secret screening
  withholds their sensitive contents without ranking or dropping ordinary
  nameless controls. The domain's model packet separately omits a descriptor
  that the shared sensitivity rule identifies as a sensitive control.

  Names follow, and the filter is in the name computation itself,
  `accessibleNameFor`
  ([`content/identity/accessible-name.ts`](../../apps/extension/src/content/identity/accessible-name.ts)),
  so every name it gives leaves those contents out, whoever asks: the
  descriptor's `accessibleName`, the names in page evidence (a form control's
  `label`, a region's, a dialog's, an overlay's, a loading indicator's), and
  the resolver's candidates. It reads page text in two places, and both go
  through the same helper: the text of each element `aria-labelledby`
  references, so a reference holding a sensitive control contributes only its
  other words, and the element's own text when its role takes a name from
  content, so a `<label>` wrapping a sensitive textarea is named by its label
  and an `<option>` inside a sensitive select takes no name. A name from
  `aria-label`, `title` or `placeholder` is kept, and so is an associated
  `<label>`, whose reader skips nested form controls, so a sensitive control
  still carries the name its label gives it. The descriptor sets
  `accessibleName` to that name as computed, with no second filter of its own,
  so a button named by a reference holding a sensitive textarea is named by the
  reference's other words.

  The rest of a descriptor's identity reads page text the same way. The
  `<label>` reader
  ([`content/identity/label.ts`](../../apps/extension/src/content/identity/label.ts)),
  whose text is the descriptor's `label` and, for an associated label, the
  accessible name, skips a subtree rooted at a sensitive control as it skips a
  nested form control, gives nothing for a label that sits inside one, and
  reads the text beside an unlabelled control through the same helper. Every
  string in `context`
  ([`content/identity/context.ts`](../../apps/extension/src/content/identity/context.ts))
  — the fieldset legend, the heading, the table's column header, and the text
  of the reference a landmark is named by — goes through it too, which matters
  because `context` rides on every descriptor, a sensitive control's included.
- **Recorded events.** The `change` listener's `inputValue` comes from the
  same reader, so a file input's `change` carries none, and `recordableKey`
  ([`content/dom-events.ts`](../../apps/extension/src/content/dom-events.ts))
  drops the key itself: a printable key pressed in a sensitive control *is*
  that control's value, one character at a time, and never goes through a
  value reader. The rule it asks is the ancestor-aware one
  (`isWithinSensitiveControl`), so a printable key pressed in **anything inside
  a marked element** is withheld too, not only one pressed in a control the
  rule marks itself: an ordinary text field inside a `data-sensitive` group
  yields no value, text or state anywhere, and its characters must not be
  recordable one by one and reassembled in order.
- **The page selection.** `capturedSelectionText` in
  `content/dom-snapshot.ts` withholds `selectedText` when the selection came
  out of, or reaches into, a sensitive control — the focused control, the
  anchor and focus nodes and their ancestors, and any sensitive control the
  ranges intersect. This is a leak the value reader cannot close: Chromium's
  `getSelection().toString()` returns the text selected inside a focused
  ordinary `<input>`, so without this guard a select-all in a card field puts
  its value in every snapshot. Chromium returns nothing for
  `type="password"`, which is a browser quirk rather than a control, so a
  password field alone does not show the leak.
- **Runtime confirmations.** `confirmedValue`
  (`background/connection/runtime-status.ts`) reads the value off the wire
  descriptor and withholds it for a sensitive control. Only the `type` and
  `select` confirmations read a value, and `clear` carries `""`. The `check`
  and `upload` confirmations carry none, and a tab confirmation carries only
  its operation and a pathname.

What travels is *presence*: `hasValue` on the descriptor and the form
evidence, which carries nothing to redact.

**`captureSettings` is not this boundary.** `inputValues` (default on) is a
user preference about ordinary controls
([`content/capture-settings.ts`](../../apps/extension/src/content/capture-settings.ts)).
Turning it on cannot re-enable a sensitive value, and turning it off is not
what protects one.

## The Wire: Comparison Strings

A verb proves its post-condition by comparing what it asked for with what the
field ended up holding, and says both in `expected` and `actual`. Those
strings reach the gateway on the result's `validation` and Core's failure
record, so quoting a value there hands the secret to every consumer.

The producer's answer is not to drop the comparison but to stop quoting:
`describeFieldValue` (`content/actions/value-redaction.ts`) replaces the value
with its length — "a withheld value of 12 characters" — which is what someone
debugging a read-back needs and says nothing about the content. `type`,
`clear` and `select` build their validations this way and set
**`redacted: true`** on the validation to declare it.

`upload` compares file names but quotes none. A chosen file's name is the
user's data, as a typed value is, and whatever a verb writes into `expected`
and `actual` is kept in Core's saved command attempt. So its post-condition
still passes only when the input holds exactly the requested names, in order,
but both strings say only how many files there are and whether their names
match, and a page-side refusal names a file by its position in the request
([`content/actions/upload.ts`](../../apps/extension/src/content/actions/upload.ts),
`content/action-runtime/file-input.ts`). It sets no `redacted` flag, because it
names neither a value nor a length.

Two guards then ask about the descriptor riding on the same result:

- `webAutomationSecretSafeValidation`
  ([`domain/src/client/gateway-mapping.ts`](../../domain/src/client/gateway-mapping.ts)),
  before the result crosses the WebSocket;
- `clientReportedFailure` in `domain/src/runtime/adapter.ts`, re-establishing
  the failure record on the far side.

Each replaces both comparison strings with one shared marker,
`WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT`, unless the producer declared the
strings already withheld. The marker is shared rather than phrased twice
because a marker that reads differently at the two exits is one nobody can
grep for, and grepping a serialized payload is how a leak is found. `status`,
the code, the category, the retryable flag and the evidence
digest are unaffected, so a Flow still routes on the failure it was given.

`isProducerRedactedComparison` **fails safe**: anything other than the boolean
`true` reads as "not declared" and the caller withholds. An older client, a
new verb nobody taught the flag, or a hand-written wire value is withheld.

A withheld comparison deliberately leaves carrying **no** flag. The flag means
"the producer named a length rather than a value", not "this text is safe". A
stamp at the extension-side guard would read downstream as the producer's
declaration and disarm the adapter's guard for every extension result, so
neither guard stamps one, and the adapter strips any flag it did not honour.

## Readers

- **Recording state.** `webAutomationStateReducer`
  (`domain/src/recording/reducers.ts`) asks the rule again from the
  descriptor before writing `forms.<selector>`, rather than trusting the
  producer's guard on the far side of a wire. `elements.*` state omits a
  sensitive control's value, and will not fall back to it as a label
  (`web-state/state-values.ts`). `forms.*` is declared `sensitive: true` in
  the recording domain, which labels it downstream.
- **The sanitized LLM packet.** `sanitizedEvidenceElement`
  (`domain/src/runtime/llm-evidence/elements.ts`) drops a sensitive control
  from the packet entirely. No packet element carries a `value` field at all;
  a select's `selectedValue` is carried only when it matches one of the
  options already listed.
- **Recorded uploads.** A recorded file choice becomes a `web.dom.upload` node
  that asks for its files at run time, under `web.upload.<key>`, and holds no
  file name, count or content. Its element fingerprint drops `value`
  (`domain/src/output-nodes/payloads.ts`). The request has a namespace of its
  own, apart from `web.secret.`, so an upload request is never read as a secret
  request, nor a secret request as an upload
  ([`domain/src/output-nodes/upload-binding.ts`](../../domain/src/output-nodes/upload-binding.ts)).
- **Page evidence.** Form controls report `hasValue`, the raw `autocomplete`
  tokens, and a `sensitive` marker — see [page evidence](page-evidence.md).
  Every name in it comes from the same filtered `accessibleNameFor` (see
  "Element descriptors" above).
  The tokens are carried on purpose, so a consumer can ask the rule itself
  instead of inheriting whatever the producer concluded.

## Authored Data Shown To Judgement And Repair

Authored parameters are not captured page evidence, but they still cross a
model or artifact boundary only through Core's parameter screen. Core's
`automationStudioScreenedNodeParameters` preserves complete ordinary parameters
for the model, while screening secrets, denied keys and locators. The
created-Flow lane then applies its separate `createdFlowArtifactScreen`
(`packages/test-runner/src/flow-lane/creation/artifact-screen.ts`) and validates
the result with the repository-local `AuthoredFlowNode` contract before
writing `snapshots/flow-lane.json`. Each action-node entry carries only its
`nodeId`, `definitionId`, `outputId`, screened `parameters`, and
`parametersWithheld`, the dotted paths whose values the screen refused.
The sibling `authoredGraph` record (control nodes and edges) carries
identifiers only -- node, definition, edge and port ids, each checked against
Core's identifier shape -- and never an edge label, a node label or description,
metadata, or any control node's parameters.

Those fields preserve three different facts. A missing parameter was never
authored. A safe transformation may survive -- for example an absolute URL can
be reduced to its origin -- while `parametersWithheld: ["url"]` still records
that the original URL did not. A value omitted because the screen reached a
artifact depth, key, item or string bound is likewise named as withheld rather
than silently reading as absent. The local contract rechecks bounded trees,
closed identifiers, denied keys and safe URL origins; it never treats the
artifact as permission to retain selectors, page text or supplied values.
The artifact screen reduces URLs to origins and keeps only approved classifier
or naming/comparand strings within its bounded trees. These artifact bounds
never reduce the evidence or authored parameters Core shows the model.

The same rule applies to result judgement and repair. The result-repair
directive is bounded and screened before model judgement can influence
recovery, and the durable result record keeps Core's structured findings and
fix rather than arbitrary model prose. This authored-data projection does not
relax any rule for snapshots, extracted values, credentials, recorded page
data, or failure comparisons elsewhere in this document.

## Extraction: Structure Crosses, Values Are Not Kept

Extraction exists to read the page, so what each part of it may carry is stated
rather than left to judgement. How a pick becomes a recorded extraction is in
[the extension client architecture](extension-client.md#defining-an-extraction);
what follows is what the one rule, and the guards around it, mean on that
path.

- **A sensitive control is refused, not redacted.** Every field kind asks
  `isWithinSensitiveControl` before it reads, so a field resolving to a sensitive
  control, or to anything inside one such as an `<option>` of a sensitive select,
  refuses the **whole** read with an ACTION_REJECTED record that names the
  author's field key and quotes no value
  (`content/extraction/field-reader.ts`). The `value` kind needs it most, since a
  control's live value is the secret itself.
- **A proposal carries selectors, names and counts.** It crosses a message
  channel and is shown before the user has judged anything, so it carries no
  value read from the page, and a proposed field's spec cannot carry an element
  fingerprint at all — the one fingerprint normalizer records an element's text,
  value and link target
  ([`domain/src/extraction/proposal.ts`](../../domain/src/extraction/proposal.ts)).
  A label is a test id, a column header or an attribute name. A column header is
  page structure rather than a sample value, which is why it may be a label while
  text read inside an item may not.
- **A refusal names a reason, never page content.** `target_not_found`,
  `no_repeating_run`, `not_picking`, `unreadable_request`, `not_recording`,
  `invalid_definition` and `value_form_unsupported` are a closed vocabulary, so
  the worker learns that a field resolved to a sensitive control without learning
  which field it was or what it held.
- **The confirmation preview is the one extraction payload carrying page
  values.** At most 20 rows are read for the panel to show while the user chooses
  columns, and they travel from the frame to the extension's own UI and nowhere
  else. The session holding them is in the background worker's memory, never in
  `chrome.storage`, and it drops them when the extraction is recorded. No
  recording, stored definition or export ever contains one.

**Excluding a column is not masking it.** A column marked `exclude` is left out
of the request, so no value of it is ever read: it is absent from the preview,
the records, the summary's `fieldNames`, the dataset, every export and Core's
saved run trace. Three places enforce that, so no single refactor can turn it
into a filter over rows already read: inference pre-selects `exclude` for a field
whose element is, or sits inside, a sensitive control, and can propose nothing
else (`content/extraction/infer-fields.ts`); an edit in the panel makes the
worker ask the page for a fresh read without the column rather than narrow the
rows it already holds (`background/extraction/control.ts`); and
`normalizeExtractField` (`content/extraction/field-spec.ts`) drops the field
before anything on the page is read.

The column's *declaration* is kept — in the recorded request and in Core's record
schema, as `handling: "exclude"` — because it is the record of a decision the
user made. Drop it, and the next field detection proposes the column again and
the user excludes their card-number column a second time. Core copies captured
rows by allowlist, so an excluded field's value reaches neither the values map,
nor a later node's inputs, nor the saved trace.

What the promise covers is what FluxIQ **keeps**. A run may hold a secret in
memory while it uses one — a recorded entry into a sensitive control comes back
as a run input and is typed into the page
([run time](#run-time-the-value-returns-as-a-run-input)) — and that is exactly why
exclusion is decided before the read rather than applied afterwards: a mask
applied to rows already read leaves a copy, and a copy is what ends up persisted.
On the extraction path there is not even an in-memory copy, because the page is
never asked for the column.

## Run Time: The Value Returns As A Run Input

A recording holds no secret, so a Flow built from one must be given it. A
recorded entry into a sensitive control becomes a `web.dom.type` node whose
`text` is a request rather than a value: Core's parameter state binding,
`{ $state: { path } }`, at `web.secret.<key>`
([`domain/src/output-nodes/secret-binding.ts`](../../domain/src/output-nodes/secret-binding.ts);
`recordedTypedText` in `payloads.ts`). The key names the control, by the rule
in `recorded-element-key.ts` that a recorded upload's request shares, and never
the value, so the request is safe in a recording, a stored Flow, a log or an
evidence packet.

- **The run supplies the value** as a run input at that path. Core resolves
  the binding before the node executes, so the value reaches the dispatched
  action. The binding has no `fallback`: an unsupplied value fails the node
  with its path named, rather than typing nothing and reporting success.
- **A request that reaches the gateway unanswered is not dispatched.**
  `webAutomationActionFromGatewayCommand`
  (`domain/src/client/gateway-mapping.ts`) refuses it as
  `web.intervention.required`, naming the parameter and the path and never a
  value. An unanswered upload request is refused the same way.
- **Core keeps each key and withholds each value at rest** (fluxiq 0.4.0):
  - a runtime session's `metadata.inputs`, and the `inputs` of the run-summary
    envelope in the run's event stream, read `[withheld]`;
  - the persisted run trace withholds each supplied input at its own position,
    and each supplied input and each value the run resolved out of a state
    binding by value, wherever a copy of one appears under a data key -- so an
    input a node copies into an output under another key is withheld at the
    copy too;
  - a saved command attempt withholds those values in `command.parameters`,
    `command.target`, `command.metadata`, `result.message`, `result.error`,
    `result.payload` (or the whole payload when the caller withholds it),
    `result.target`, `result.metadata`, the `expected` and `actual` prose of
    `result.failure`, and the attempt's `message`
    (`packages/fluxiq/src/runtime/attempt-withholding.ts` in Core).

  The run itself executes with the real value. Core states the rules in its own
  `docs/architecture/automation-studio.md` and `package-boundaries.md`.

What Core does not withhold, and a supplier must allow for:

- **Page text that echoes nothing supplied.** An action result's page snapshot
  is in `result.payload`; it is withheld only where it contains a supplied or
  resolved value. Page text is a route of its own (see "Not a rule about page
  text" below).
- **A declared default.** An input still equal to the default the Flow's
  published interface declares for it is authored -- the Flow holds it -- so it
  is withheld at its own position but not by value.
- **Records saved before this change,** which are not rewritten.

The by-value rule has a cost: a value the run computed that equals a supplied
input (`5 + 0` with an input of `5`) also reads `[withheld]` in the saved trace
and attempts, because a copy cannot be told from a computation by value. The
executed trace a Call Flow parent or a rerun is handed keeps the real value.

In the Lab, the Flow lane supplies each declared secret once, under the path
its node asks for, paired with its declaration by control one to one; a
pairing that fails stops the run before the Flow starts
([declared replay secrets](testing-facility.md#declared-replay-secrets)).

## At Rest In The Browser, And What The Lab Checks

The extension keeps its pairing token, session, offline event queue (recorded
events, which can carry page data) and extraction sessions in
`chrome.storage.local`. None of it leaves the background worker in a status, a
log or a problem report (below). The Lab's run leak check scans that storage on
disk -- the profile's `Local Extension Settings`, `Sync Extension Settings` and
extension `IndexedDB` LevelDB files -- for every declared secret, best effort
for compressed tables ([testing facility](testing-facility.md#the-run-leak-check)).
It does not cover the panel's `localStorage` draft of unsaved Connection
settings, nor Firefox.

## Problem Reports

"Report a problem" (in the panel's settings) asks the background for
a bundle built by allowlist in `background/diagnostics/`: versions, browser
name and major version, connection state and address origins, client, session
and project ids, recording and runtime state, activity kinds, recent run ids
and states, and the last 30 recorded failures. Every failure's text is
redacted when it is written (`redactDiagnosticText`): the pairing token and code
wherever they appear, URLs cut to their origin, bearer credentials, secret-named
assignments, quoted text, e-mail addresses and long digit runs. The bundle
never holds the token, cookies, page addresses beyond an origin, page text,
recorded events, typed or extracted values, or activity labels, and its
`withheld` list says so. Core's Problems view has its own "Report problem",
which copies problem codes and ids and never a problem's message or an
object's name.

## What These Guards Are Not

- **Not a text scanner.** Nothing reads a comparison string looking for things
  that resemble card numbers. A predicate over free text both misses and
  misfires, and is worse than withholding.
- **Not wider than the descriptor.** The wire guards ask the rule about the
  element descriptor the result carries. A result with a text-bearing
  validation and **no** `element` cannot be judged and passes through as the
  producer wrote it.
- **Not a classifier of content.** The rule is a *signature* rule. A plain
  `<input type="text">` holding a password, with no `autocomplete` and no
  `data-sensitive`, is an ordinary control to every guard here. Marking it is
  the page's job — or the recording operator's.
- **Not a rule about page text.** Visible text, extracted values and
  assertion text are page content the automation was asked for. The rule
  reaches into text in two places only, each because the text is a control's
  value in another form: the selection, which can silently contain a
  control's value, and a sensitive control's contents — a sensitive
  `<textarea>`'s text, a sensitive `<select>`'s option labels, the words in
  any element the rule marks. No element descriptor — its text, name,
  `label` or `context` — and no computed name quotes those contents (see
  "Element descriptors" above). Extraction refuses a sensitive control, and any
  element inside one, in every mode: an `<option>` of a sensitive select or a
  span in a marked editable region is refused as the control is, by
  `isWithinSensitiveControl` in the same helper. It leaves those contents out
  of a container's HTML and, through the reader descriptors and names use, its
  text (`content/action-runtime/extract.ts`). A list field is held to the same
  rule in every kind (`content/extraction/field-reader.ts`), the `value` kind
  most of all, since a control's live value is the secret itself: a field that
  resolves to a sensitive control, or to anything inside one, refuses the
  *whole* read rather than returning the other columns.

  An **excluded** column is the other half of that, and it is not a redaction:
  a field with `handling: "exclude"` is dropped in
  `content/extraction/field-spec.ts` before anything on the page is read, so
  its values are never read rather than read and removed, and the column is
  absent from the output, the summary's `fieldNames`, the saved table and every
  export (decision D12). The user picks which columns are excluded, and
  inference pre-selects one for a field whose element is, or sits inside, a
  sensitive control; the whole path is under
  [extraction](#extraction-structure-crosses-values-are-not-kept).

  Everything else is ordinary content. A page that displays a secret as
  unmarked text puts it into every state snapshot, into the snapshot each
  action result carries, and so into Core's workspace, and no guard here or in
  Core withholds it. Nor is every string read from the page filtered for a
  sensitive control's contents yet: in page evidence a loading indicator with
  no accessible name is labelled by its raw text
  (`content/evidence/loading.ts`), as a repeating structure's representative
  text is (`content/evidence/repeating.ts`), and a resolver candidate's
  `visibleText` is read raw (`content/identity/candidates.ts`). The Lab's run
  leak check finds a declared secret shown this way
  ([testing facility](testing-facility.md)).
- **Not shadow-DOM aware.** A selection inside a closed shadow root is not
  reachable, here or anywhere else in the recorder.
- **Not a substitute for the other end.** The producer redacts, and each
  reader asks again. Both checks must fail before a value escapes; that
  redundancy is the design, not duplication to be tidied away.
