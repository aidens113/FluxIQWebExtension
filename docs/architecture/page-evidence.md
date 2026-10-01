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
  elements out, and nothing else. Current capture has no element cap; the
  flag remains readable for older snapshots.

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
- **Every collection merges whole.** There is no per-frame or merged element,
  dialog, blocker, region, form or loading-item cap. Frame order and each
  frame's document order are preserved; merging does not rank or sample.

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

## Stored Recording State Bounds

A flag that says only `truncated` does not identify what was omitted. The
recording-state projection keeps separate flags, interpreted in
[`domain/src/recording/web-state/evidence/input.ts`](../../domain/src/recording/web-state/evidence/input.ts).
The rule: a bare `truncated` is legal only inside the structure whose own cap
set it, beside that structure's counts; anywhere a flag would summarise more
than one cap it is named for the cap instead.

| Cap | Flag | What is missing | Remedy |
| --- | --- | --- | --- |
| An older browser capture that reported omissions | `captureTruncated` (`evidence.elements.truncated` at source) | Elements never left that capture | Recapture with the current uncapped producer |
| The state projection's element cap | `stateTruncated` | Eligible elements absent from `elements.*` | Raise the cap, or narrow what is recorded |
| A per-collection cap in the projection | that collection's own `truncated`, beside its `count` | Items of one collection | Read `count` for the true total |

`elements.truncated` in the state projection is the summary of the first two.
The current browser capture and frame merge have no count or byte cap. The
two projection caps are on the recording path's stored state, not on what a
model is shown. The sanitized packet has no cap of its own: its
`elementsTruncated` and `budgetTruncated` flags, and its `elementTotal`,
were retired with the element bound and the byte budget they reported (t200).

## Repeated Controls

Repeated controls carry an annotation, without changing the element list
([`content/repeat-exemplars.ts`](../../apps/extension/src/content/repeat-exemplars.ts)).
A run is a record by the rule a replay already checks
([`identity/record.ts`](../../apps/extension/src/content/identity/record.ts)) —
`tr`, `li`, `article`, the ARIA row and item roles, or a keyed element — whose
parent holds at least three of its tag; a kind is one position inside that
record (the tag and same-tag index at each level, with role and input type).
An exemplar carries the run's size as the descriptor's `repeatCount`; every
member remains in composed document order. Two things are exempt from the
annotation: something to act on that is its record's whole
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
- **The sanitized packet** (`domain/src/runtime/llm-evidence/`,
  `web-llm-evidence.v2`) holds the same items, whole: see "No Limits On The Way
  To A Model". It is the domain's own form of a page, which plan resolution,
  stable handles, the state digest, route state, shown addresses and the repair
  check read. A model never reads it: every page leaves the domain as the
  compact view, below.
- **The host runtime boundary** (`domain/src/runtime/host-runtime.ts`) reuses
  the packet's sanitizer for the state snapshots Core stores on an attempt, and
  stores the snapshot as the compact view (`summary`, `web-llm-page.v3`), so a
  state ref cannot carry more page data, or more sensitive page data, than a
  page the model is shown; Core returns it to a recovery model as
  `core.state_snapshot`. It snapshots only nodes that act on a page: a web
  output node, or a recorded action, which Core runs as `builtin.policy.action`
  naming its web output in `parameterValues.outputId`. It computes a state diff
  (`domain/src/runtime/state-diff/`, `web-state-diff.v3`) only when both the
  before and after snapshots were captured: the view's element lines that
  appeared or left, handle-free and compared as a multiset, as text. A summary
  stored before t223 as a packet is written as the view first.

## What A Model Reads: The Compact Page View

The user's order of 2026-09-30 (t223): only elements with visible text or that
are controls, in the least possible format, and a search over everything else.
Every page leaves the domain as `web-llm-page.v3`
(`llm-evidence/page-view/published-page.ts`):

```text
{ schemaVersion: "web-llm-page.v3", trust, location, truncated,
  failedTarget?, failedTargetMissing?, failedTargetUnknown?, repairParameters?, repairCandidates?,
  page }   // header lines, a blank line, then one line per element, joined by "\n"
```

- **Header lines**, each only when it has something to say: `PAGE "<title>"`,
  `URL <location on a ~ base>   (~ = <base>)`, `VIEW <w>x<h> at the top · <n>
  elements ...`, `COVERING`, `DIALOG`, `LOADING`, `FRAMES ... did not answer`,
  `ARRIVED`, `SELECTED`, and `CAPTURE incomplete`.
- **Which elements get a line**, in document order (`page-view/line-choice.ts`):
  every visible control, every visible layer, every visible element with
  meaningful words of its own, and an image whose alt says something no line
  near it says. "Visible" is not a search capture's `hidden`, and a box, when
  there is one, that reaches into the document (an off-page honeypot does not).
  Words already printed by the control or semantic element a text sits in, a
  label repeating its control, and a line repeating the one before are folded;
  letterless fragments of one value (`$`, `39.`, `99`) are joined. No element
  that qualifies is capped, ranked or cut.
- **A line** is `<handle> [<heading>] [<kind>] ["<words>"] <state>`: the `tN`
  handle, the kind (`link`, `button`, `field[:type]`, `select`, `checkbox`,
  `radio`, `toggle`, `tab`, `img`, `h1`-`h6`, `clickable`, `dialog`, `layer`,
  ...), the words in quotes, and states (`="value"`, a select's options,
  `checked`, `open`, `disabled`, a table cell's column, a link's address,
  `covered-by tA`, `focused`). Links are written on the page's `~` base, and a
  repeated address is written `same href`.
- **Structure markers** on lines of their own: `[landmark]` (with frame, modal
  dialog and form), `- i/n` for a list item, `- row r`, and
  `--- below the fold ---` and its kin where the screen zone changes.
- **Search and detail.** `web.find_on_page` (`llm-evidence/page-find/`) takes a
  fresh capture that also lists what is not rendered (`includeHidden`) and
  matches a query, case-insensitively, against every element's words, label,
  value, options and address and every attribute's name and value, hidden,
  off-page and text-less elements included; matches come in page order, fifty
  to a page, each printed as the view prints it plus the attribute that
  matched and where the element is (`web-llm-find.v1`).
  `web.describe_element` prints one element whole: its line, every attribute,
  its box and where it is, and every other field (`web-llm-describe.v1`). Both
  are authoring tools and recovery options (`web.recovery.find_on_page`,
  `web.recovery.describe_element`); a hidden element never moves a visible
  element's handle, and the state digest leaves hidden elements out.
- **Every path a page reaches a model** goes through `publishedWebLlmPage`: a
  node run's look or action result (`node-run/run.ts`), a refusal's `page`
  (`tool-rejection.ts`), a replay or verify answer, every recovery option, the
  failure evidence (`captureSanitizedFailureEvidence`), the adapter's
  `metadata.failureEvidence`, and the host runtime's state summary and diff.
  A node's read never carries the extension's page record (`snapshot`,
  `element`, `visualTarget`, `resolution`, `structure`;
  `node-run/page-record.ts`).
- **The repair check reads what the model read.** A shown page, search or
  description is retained under `location + " " + text`
  (`page-view/result-retention-key.ts`) with the structured packet behind it,
  24 per window (Core's default recovery budget), and
  `validateTargetOverrideEvidence` checks a repair's handle against that
  packet. One that was let go, or edited, is `evidence_unrecognized`.

Measured on 20 scenario pages (t223), the packets' 2,248,731 bytes are 117,929
bytes of view (5.2%), the largest page 15,056 bytes; one whole decide request on
everything-store results went from 1,414,167 bytes (471,405 tokens) to 159,997
bytes (53,349 tokens).

## Detecting A List, Or One Record

`web.detect_repeating_structure` asks the page for the list around an element
the model was shown, or for the page's largest list (`web.dom.capture_snapshot`
with `detectStructure`; the page side is `apps/extension/src/content/extraction/`).
The domain splits the answer (`domain/src/runtime/llm-evidence/structure/`):
the model gets an opaque `extraction.N` handle with each column's key, label,
kind and coverage, the item count and how the list continues; the handle store
keeps the selectors. A plan names the handle in an extraction node's
`extractList`, and the node is built from what the handle keeps
(`plan-resolution/extraction/slot.ts`).

A list may have one item, so a single record is read as a one-row table
(t195). The page answers in one of three forms:

- **A run.** The items that repeat around the target, as before.
- **A run with the record beside it.** When the target lies outside every
  item of the run, the page also sends the one record the target belongs to as
  `record` (one item, no pagination). On photo-social's message thread that is
  the reply card (name, price, note), and the run is the inbox's three thread
  rows, which carry no price. The record gets a second handle in the same
  scope and frame, and the packet carries it as
  `record: {handle, itemCount: 1, fields, note}`, where `note` is one closed
  sentence: name that handle when the instruction is about that item. A lone
  record never replaces a run, so a model aimed at a cart's subtotal still
  gets the cart lines.
- **One record as the list.** A label/value `<dl>` (job-board's application
  receipt: Role, Company, Reference, Submitted, each read from its `dd` and
  labelled by its `dt`) comes back as the proposal itself with `itemCount: 1`.
  So does a lone record on a page where nothing repeats, which the page answers
  only after its 5 s wait for a run has passed.

A one-item handle builds an extraction node like any other, including with
`minItems` and `maxItems` of 1. The Flow keeps the record's item selector, and
the handle store knows it as the Flow's own list, so a draft read back from the
Flow is not refused as a guess. The record and receipt reads above are covered
by provider-free tests on detection answers written from the scenarios' markup
(`structure/tests/record-detections.ts`), not on captures; the page-side walk
has not yet been run in a browser.

**In a child frame**, detection captures that frame's own document and holds
it to the origin the element was shown with (`data-fluxiq-frame-url`), not the
top page's. The handle keeps the path of that frame's document, and every node
a model builds in a child frame — an extraction node from a handle, or a
click, type or other action on an element shown in the frame — carries
`browserFrameUrlPath` (the pathname only, with no origin or query) beside
`browserFrameId`. A reload renumbers frames, so when a command names a path,
the extension waits up to 5 s for a frame at that path to appear, polling every
100 ms, before it refuses `web.target.not_found`. The wait is cut to the
command's own timeout less a 1 s margin
(`apps/extension/src/runtime/frame-address.ts`, `waitForFrameChoice`). An
ambiguous or empty frame list is answered at once.

## No Limits On The Way To A Model

The user's order of 2026-09-30 (t200): "Remove ANY AND ALL LIMITS ON THE NUMBER
OF ELEMENTS PASSED TO MODEL. DO NOT HIDE INFORMATION OR USE ANY RANKING
ALGORITHM." What the domain does with a capture, as of that task -- the
structured packet below is what the compact view is written from, and what
`web.describe_element` and `web.find_on_page` read:

- **Every element, in the capture's order.** `sanitize.ts` describes every
  element the capture sent, in document order. There is no element bound (it
  was 40), no front-layer reordering (an open modal's controls used to be moved
  to the front), no byte budget (6,000 bytes for exploration, Core's gate for a
  failure packet, 12,000 at most) and no trim. The domain's former byte-budget
  refusal is gone; Core's build ending `flow_bootstrap.evidence_budget_exhausted`
  names an actual spend, time, token, call or round limit. A capture of a child frame's elements and the frame
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
  faster, so a Flow's handles run `t1` to `t999999`
  (`stable-handles.ts`). Handles are minted `tN` (t223); a handle written
  the old way, `target.N`, is still accepted wherever the model names an
  element and is read as the `tN` it means
  (`llm-evidence/handle-spelling/`).

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
  `tN` handle is the only way to name an element.

The state digest (`state-digest/state-digest.ts`, `web-state.v3`) and the
route state (`route-state/project.ts`) are read off the same whole packet, with
a search capture's hidden elements left out, so a call's own capture answers
for them exactly as `captureStateDigest` and `observeRouteState` would, and a
search reads as the same state as a look. The route state names every dialog,
every blocker and every control.

Core carries every evidence entry in call order beside the complete draft and
history; the domain declares `page` (and the packet's `elements`, `dialogs` and
`blockedBy`) as its observed-state keys, so each earlier page is replaced by
`supersededBy` once a newer one is shown. The request's only page-information bound is the model's
1,000,000-token window (992,000 input and 8,000 reserved output). A request
that exceeds it is refused before sending with its measured size; no page
entry is ranked, sampled or trimmed to make it fit. Spend, deadlines and call
counts still bound how long a build runs, not which captured elements it sees.
