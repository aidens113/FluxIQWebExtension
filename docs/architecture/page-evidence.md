# Page Evidence

What a browser capture says about the page **as a whole**, rather than about
one element: the dialogs standing in front of it, what is painted over its
controls, whether it is still working, how it is laid out, what repeats on it,
its forms, and how it was navigated to. Current-state design, verified against
source on 2026-09-13; the limits on the path to a model were removed on
2026-09-30 (t200), and what replaced them is under
[No Limits On The Way To A Model](#no-limits-on-the-way-to-a-model).

Element descriptors and the recording path around them are in
[extension client architecture](extension-client.md#recording-evidence); what
is withheld from a capture is in [sensitive values](sensitive-values.md).

## One Contract, In The Domain

The wire shape is declared **once**, in
[`domain/src/page-evidence/`](../../domain/src/page-evidence/types.ts). It
lives in the domain package because the structure audit forbids `domain/src`
importing `apps/extension/src` while the extension may import the domain, so
the domain is the one place both sides of the wire can reach. The producer
imports it through `apps/extension/src/content/evidence/types.ts`, which
re-exports the same types under the extension's shorter local spellings and
adds nothing.

A contract restated on each side drifts with every gate green, because each
side is tested against its own restatement: a reader can look for a field no
producer writes, or at a path no producer writes to, and a ratchet over the
reader's paths can pass over an empty set.

Three mechanisms keep the two ends joined, and each closes a hole the previous
one left:

- **The shared type.** Readers reach the wire through `PageEvidenceWire<T>`
  (`page-evidence/wire.ts`), which keeps `T`'s keys and makes every value
  `unknown` — so a renamed field stops compiling, while a field the page
  corrupted still reports nothing rather than throwing.
- **`present<T>()`** (`apps/extension/src/shared/present.ts`) for every
  producer. TypeScript excess-checks nothing through an object spread, so a
  field emitted as `...(label ? { label } : {})` could be renamed with every
  gate green and simply stop arriving. `present` requires the literal to
  mention every key of the contract — optional ones included, valued
  `undefined` when absent — and drops the undefined ones afterwards. A deleted
  field is a compile error; an absent value is not.
- **A real capture.** `page-evidence/capture.ts` holds one capture taken from
  the content script in a real browser, asserted by both readers, because a
  type both sides satisfy can still be populated by neither.

The contract is types only. No caps, no defaults: a reader's bounds belong to
that reader and a producer's to the producer. It carries no DOM dependency
either — `documentState` and `visibility` are written out as unions rather
than as TypeScript's `DocumentReadyState` and `DocumentVisibilityState`, and
the producer assigns the DOM values to them so the compiler checks the two
agree.

## The Items

`WebAutomationPageEvidence` has nine keys. Empty collections are omitted
rather than sent empty: a snapshot is taken on every action result, and a page
with no dialogs should cost nothing to say so.

| Item | Produced by | What it carries |
| --- | --- | --- |
| `elements` | `evidence/page.ts`, `changes.ts`, `interactions.ts` | `scanned`, `candidates`, `matched`, `returned`, `truncated`, `changed`, `recentlyInteracted` |
| `loading` | `evidence/loading.ts` | `document.readyState`, a `busy` verdict, `aria-busy` regions, progress bars and spinners, `pendingNavigation` |
| `navigation` | `evidence/navigation.ts` | url, origin, path, referrer, navigation type, redirects, history length, visibility |
| `dialogs` | `evidence/dialogs.ts` | open dialogs top-most first, whether any is modal, an unacknowledged `web.dom.dialog` arming, the last native dialog answered |
| `overlays` | `evidence/overlays.ts` | how many interactive candidates were hit-tested, how many were covered, and every blocker in document order, each with every control it covers |
| `regions` | `evidence/regions.ts` | landmark roles with labels, selectors and bounds |
| `repeating` | `evidence/repeating.ts` | runs of sibling elements from one template: container, signature, item count, a representative item and its field test ids |
| `forms` | `evidence/forms.ts` | forms with their controls: type, name, label, required, disabled, **whether** a value is present, the `autocomplete` tokens, and a `sensitive` marker |
| `unansweredFrameIds` | the background frame merge | child frames the merge asked for a snapshot and got no answer from, so their elements are absent |

Two flags are easy to misread and are worth stating plainly:

- `dialogs.armPending` is an arming written for `web.dom.dialog` and not yet
  taken by the page-world override. It is **not** "a native dialog is on
  screen": an unanswered `alert` blocks the page's script, so no snapshot
  leaves the page while one stands. A persistent `true` means the override is
  not installed.
- `elements.truncated` reports that the **browser capture** itself left
  elements out, and nothing else. See the caps below.

`forms` carries value *presence* and never a value. It carries the raw
`autocomplete` tokens deliberately, so a consumer can ask the shared
sensitivity rule itself rather than trusting the producer's `sensitive` flag:
both checks must fail before a value could escape.

## Across Frames

Evidence is gathered per frame, like the snapshot itself. On the recording
path the background worker collects one per frame and merges them into one tab
snapshot (`captureMergedTabSnapshot` in
[`background/connection/dom-snapshot.ts`](../../apps/extension/src/background/connection/dom-snapshot.ts),
reached from `recording-evidence.ts`). A frame that does not answer in time is
named in `unansweredFrameIds` rather than dropped silently, because the frame
that did not answer -- a robot check, a consent wall -- is often the one that
matters.

Merging is per item, not per snapshot:

- **Additive items fold.** Element totals sum, `truncated` is true if any
  frame truncated, and dialogs, overlays, regions, repeating runs and forms
  concatenate with the top frame's first. `dialogs.modal` and the arming flag
  are true when any frame says so.
- **A child frame is restated in the top frame's terms** before it is folded
  in: every selector is qualified `frame[<id>] >> <selector>` and every rect
  is placed on the top frame's document, so evidence can be joined to the
  merged element list. A rect that cannot be placed is omitted rather than
  carried through frame-local.
- **Items that describe one document stay the top frame's.** `navigation`
  whole, and `loading.documentState`, because a child frame's URL is not the
  page's and there is no honest average of two `readyState`s. A merged
  snapshot can therefore read `complete` and still be `busy` — the right
  answer for a page whose iframe is mid-load. The rest of `loading` merges.
- **Each merged collection has a budget of its own**, roughly twice the
  per-frame cap, so ten frames cannot contribute ten times the cap to a
  payload built on every recorded event.

Both the merge and the per-frame restatement are written with `present<T>()`
over every contract key, so a ninth key on the contract stops them compiling
until each says what it does with it. Without that, a key added to the
contract would be produced per frame and silently dropped in the merge — two
documents carrying less evidence than one.

The look (`web.dom.capture_snapshot`) takes the same merged snapshot unless one
frame is addressed (t200), because a robot check or a consent wall is often a
child frame. An action runs in one frame — the top frame, unless the command
addresses a child frame, by its frame id or by the path of its document, which
survives a reload that renumbers frames (see
[child frames](web-capabilities.md#child-frames)) — and its result carries that
frame's own snapshot.

<a id="the-four-caps"></a>

## The Caps

A flag that says only `truncated` does not say which cap bit, so each cap on
this path has its own flag. The canonical statement, with the remedy for each,
is in
[`domain/src/recording/web-state/evidence/input.ts`](../../domain/src/recording/web-state/evidence/input.ts).
The rule: a bare `truncated` is legal only inside the structure whose own cap
set it, beside that structure's counts; anywhere a flag would summarise more
than one cap it is named for the cap instead.

| Cap | Flag | What is missing | Remedy |
| --- | --- | --- | --- |
| The browser capture, when it leaves elements out | `captureTruncated` (`evidence.elements.truncated` at source) | Elements never left the page | Capture less of the page: one frame, one region |
| The state projection's element cap | `stateTruncated` | Eligible elements absent from `elements.*` | Raise the cap, or narrow what is recorded |
| A per-collection cap in the projection | that collection's own `truncated`, beside its `count` | Items of one collection | Read `count` for the true total |

`elements.truncated` in the state projection is the summary of the first two.
The two projection caps are on the recording path's stored state, not on what a
model is shown. The sanitized packet has no cap of its own: its
`elementsTruncated` and `budgetTruncated` flags, and its `elementTotal`,
were retired with the element bound and the byte budget they reported (t200).

## Repeated Controls

A page built from a repeated template would otherwise fill the head of the
element list with the template. On the Lab's 280-row social scheduler the
packet held three filter selects and a column of row checkboxes, and none of
the page's own buttons, so the bulk bar's Retry was never shown to a model.

The snapshot therefore keeps one example per repeated control
([`content/repeat-exemplars.ts`](../../apps/extension/src/content/repeat-exemplars.ts)).
A run is a record by the rule a replay already checks
([`identity/record.ts`](../../apps/extension/src/content/identity/record.ts)) —
`tr`, `li`, `article`, the ARIA row and item roles, or a keyed element — whose
parent holds at least three of its tag; a kind is one position inside that
record (the tag and same-tag index at each level, with role and input type).
The first member keeps its rank and carries the run's size as the descriptor's
`repeatCount`; every other member is ranked after every distinct element, not
removed. Two things are exempt: something to act on that is its record's whole
content, such as a navigation `li > a`, which is a distinct destination; and an
element a person or an action has just touched. The packet carries the count as the
element's `repeats`. Every member is in the packet, in its own place: the
packet carries whatever the capture sent, in the capture's order, and cuts
nothing from the tail (t200).

A row control's selector is usually positional, so the domain's stable target
handles key on the record an element sits in as well as its selector
([`stable-handles.ts`](../../domain/src/runtime/llm-evidence/stable-handles.ts)).
The record stays in the binding beside the selector and never reaches the
packet; another post filtered into row one gets a handle of its own rather than
the previous post's.

A step inside a For Each acts on the pass's row, not the recorded one. Every
output node with an element target declares an optional `item` input after
`in`, and Core puts the loop's current row there: the extraction's record,
field key to string. When the recorded element sat in a record
(`element.context.record`), the node replaces that record with the row's
values — each non-empty string, whitespace-collapsed, deduplicated, at most 8
of at most 200 characters
([`native-runtime.ts`](../../domain/src/output-nodes/native-runtime.ts)).
The page accepts a candidate only in a record that holds every value in its
text, as a link's resolved `href`, or as an attribute or control value, and
`values` outranks the recorded `key` and `text`, which name the row the Flow
was built on. When the recorded selector answers with the build's row, the
veto refuses it and resolution falls back to the same-family candidates, which
the record gate narrows to the pass's row. A control recorded in no record, such
as a dialog's Close, is dispatched unchanged on every pass.

## Who Reads It

- **The state projection**
  (`domain/src/recording/web-state/evidence/`) turns the evidence into
  `web` state paths — thirty `evidence.*` paths declared in
  `domain/src/recording/domain.ts`, from `evidence.elements.scanned` to
  `evidence.forms` — which is what Core stores and what a policy condition can
  read.
- **The sanitized LLM packet** (`domain/src/runtime/llm-evidence/`) exposes
  the same items to a model, whole: see below.
- **The host runtime boundary** (`domain/src/runtime/host-runtime.ts`) reuses
  the packet's sanitizer for the state snapshots Core stores on an attempt, so
  a state ref cannot carry more page data, or more sensitive page data, than
  the LLM packet may. It snapshots only nodes that act on a page: a web output
  node, or a recorded action, which Core runs as `builtin.policy.action` naming
  its web output in `parameterValues.outputId`. It computes a state diff only
  when both the before and after snapshots were captured, and the diff lists
  every element that appeared or left.

## No Limits On The Way To A Model

The user's order of 2026-09-30 (t200): "Remove ANY AND ALL LIMITS ON THE NUMBER
OF ELEMENTS PASSED TO MODEL. DO NOT HIDE INFORMATION OR USE ANY RANKING
ALGORITHM." What the domain does with a capture on its way to Core, as of that
task:

- **Every element, in the capture's order.** `sanitize.ts` describes every
  element the capture sent, in document order. There is no element bound (it
  was 40), no front-layer reordering (an open modal's controls used to be moved
  to the front), no byte budget (6,000 bytes for exploration, Core's gate for a
  failure packet, 12,000 at most) and no trim. `evidence_budget_exhausted` is
  no longer a refusal. A capture of a child frame's elements and the frame
  merge's `unansweredFrameIds` ride on `frame`.
- **Every string whole.** Text, names, labels, headings, a row's words, every
  option of a select (100 of them as readily as 20, empty labels kept), the
  title and the selection arrive uncut; the field bounds (300 for text, 80 for
  placement, 200 for an option, 2,000 for a URL) are gone. Whitespace is still
  collapsed to one line.
- **More of each element.** Beside the tag, role, name and text, an element
  now carries its implied role, its `<label>` text, every attribute as
  `[name, value]` pairs in the page's order (minus the extension's own
  `data-fluxiq-frame-id` stamp), whether the page listens for a click, its
  document box rounded to whole pixels, whether it is on the viewport, a
  checkbox's checked state, and a non-sensitive text field's value when the
  capture read it. Attributes are pairs, never an object keyed by name, because
  Core's denied-key screen walks keys at every depth and `headers` -- a real
  `td` attribute -- and `selector` are among this domain's denied keys.
- **Every page item.** Every open dialog, every blocker (described, never
  addressed by selector), each loading indicator with its kind and label, the
  navigation URL and referrer. A dialog or blocker the capture also described
  as an element carries that element's `target` handle, and its `kind` where
  the extension recognised the layer (`consent`, `rate_limit`, `robot_check`,
  `promotion`, `assistant`; `WebAutomationLayerKind`).
- **What stands in front of the page, on the element itself.** Nothing is moved
  to the front, so what the old order told a model -- that a consent wall or a
  robot check stands between it and the page -- is carried as facts on each
  element's own entry, still in document order (`llm-evidence/layers.ts`):

  | Field | On | Says | From |
  | --- | --- | --- | --- |
  | `isDialog: { modal, native?, kind? }` | the element that is an open dialog | it is one, modal or not, native or not, and what kind | `evidence.dialogs.open[]`, joined by selector |
  | `inDialog` | every element inside an open modal dialog | the dialog's handle | the dialog's box (the element's centre inside it), after it in document order, and not covered |
  | `covers` | an element painted over controls | the handles of every covered control the packet describes | `evidence.overlays.blockers[].blocked` |
  | `coversCount` | the same | how many it covers in all, where some are not in the packet | `blockers[].blocks` |
  | `kind` | the same | what the layer is | `blockers[].kind` |
  | `coveredBy` | a covered control | the handles of what covers it | the same blockers |
  | `frontLayer: true` | an element | the capture placed it in the layer in front of the page | the descriptor's `frontLayer` |
  | `statement: true` | an element | it is one of the statements the page leads with, such as "No results for ..." | the descriptor's `leadStatement` |

  A selector is joined to a handle frame and all (`frame[<id>] >> <selector>`
  for a child frame), and one no described element carries marks nothing,
  because there is nothing to name. The handles are renumbered with the
  elements on a recapture (`stable-handles.ts`); the state digest reads what
  each mark is, never the handles it names.
- **URLs whole but for their secrets.** A location or link keeps its path,
  query and fragment, and a link to another origin is published too. The value
  of a query or fragment parameter whose name says it holds a secret -- token,
  key, secret, password, auth, session, signature, code, credential, ticket,
  matched as whole words -- reads `(withheld)`; a URL with embedded
  credentials is still refused.
- **Every repair candidate**, in document order, unscored; every field of a
  detected list; every row, field and string a reading node read; every
  element of a reusable-evidence projection, in document order.
- **Target handles to six digits.** A packet of every element spends numbers
  faster, so a Flow's handles run `target.1` to `target.999999`
  (`stable-handles.ts`).

What still never reaches a model:

- **A sensitive control**, dropped whole by the shared rule
  ([sensitive values](sensitive-values.md)) before any of its strings is read,
  whichever form its attributes arrive in.
- **A string shaped like a credential.** Every string the packet publishes --
  text, names, attribute names and values, URLs, the title, options, dialog and
  blocker labels, the selection, a read's rows -- passes Core's own check,
  `screenAutomationStudioLlmEvidence(text, []).secretShaped`, first; a match
  reads `(withheld: shaped like a secret)`
  (`WEB_LLM_WITHHELD_TEXT`, `llm-evidence/withheld.ts`), so one token-shaped
  attribute costs that attribute rather than Core refusing the whole page.
- **A card number**, in any published string, a text field's `value`
  included. Core's shapes are credentials and do not match one, so
  `withheld.ts` also withholds, in place, a run of 13 to 19 digits that passes
  the Luhn check, is written as a card is (unbroken, in fours, or 4-6-5 and
  4-6-4) and starts with 2 to 6, as a card issuer's number does. The grouping
  and issuer rules keep an order number (`112-5550123-4567890`) and a
  millisecond timestamp, one in ten of which passes Luhn by chance, as the
  page wrote them.
- **An address.** No selector, xpath or record key is published; the opaque
  `target.N` handle is the only way to name an element.

The state digest (`state-digest/state-digest.ts`, `web-state.v2`) and the
route state (`route-state/project.ts`) are read off the same whole packet, so a
call's own capture answers for them exactly as `captureStateDigest` and
`observeRouteState` would. The route state names every dialog, every blocker
and every control.
