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

## Applied capture settings

Raw `evidence.captureOptions.includeHidden` reports the boolean actually used
by the element walker. It is optional for compatibility: sending a hidden-read
request, an older capture, or a missing/malformed marker does not prove hidden
coverage. A merged snapshot reports this setting only when every included
component supplies a valid value; it reports true only when all say true.
Unanswered frames remain separately reported, so this marker does not promise
whole-tab completeness. Scoped identity recovery uses explicit addressed-frame
captures and keeps this provenance privately, outside the model packet.

## Observed all-frame topology

Only background all-frame composition emits raw `evidence.frameCoverage`:
`{ mode: "all_frames", enumeration: "complete" | "unavailable", frameIds,
capturedFrameIds }`. Both ID lists are sorted unique nonnegative safe integers.
`frameIds` records the valid browser IDs from the first enumeration, including
empty child documents; `capturedFrameIds` records actual requested-ID snapshot
replies, including a supplied seed. Missing child replies remain separately
listed in `unansweredFrameIds`. Descriptor stamps never establish topology.

Two bounded browser topology reads must surround every frame capture.
Fresh standalone composition enumerates before requesting the top frame. A
prepared composition closure can retain a real enumeration taken before the
caller's existing top-frame RPC, without taking an extra snapshot. The native
unaddressed look uses an internal prepare hook before that original RPC and
passes the prepared closure to its normal merge; addressed looks skip it.
The closure retains its original deadline, including time spent on the top
capture, so composition cannot renew an expired command's allowance. Only successful, valid, nonempty enumerations containing frame 0 with the same
ID set report `complete`. API absence/errors, timeout, empty/malformed results,
or changed topology report `unavailable`; no fallback invents `[0]`. The final
read spends only time remaining inside the existing two-wait merge envelope.
A top-only page with both successful reads reports `[0]` in both lists. Legacy
frame-list callers keep their empty-array failure behavior, while native snapshot
transports preserve enumeration failure explicitly.

The marker proves enumeration and replies, not semantic DOM completeness or an
atomic document snapshot. A reused event/top-frame seed without the prepared
pre-capture observation always reports `unavailable`: later enumeration cannot
prove topology at that seed's capture instant. Loading, truncation and shown-element totals must still be checked independently.
Explicit single-frame captures and historical content-only captures omit the
marker, so their all-frame coverage remains unknown. This is raw provenance only;
it adds no gateway command, capability or model-facing packet field. Historical
fixtures retain their original data and are explicitly classified as not
exercising topology provenance.

## Observed control states

A resolved handle's CC9 `control` view distinguishes the actual readable
state (`shown`) from the state another press would leave (`ensures`). Both
are opaque state signatures; the optional `state` word describes what is
currently shown. A stated boolean attribute gives `shown` with its actual
value and `ensures` with the other value. Learned name/class transitions
give these signatures only when the actual reading matches a known side.
A state-holding role with no readable state supplies only `stateful: true`.

Successful presses preserve the actual before and after readings as
`toggle.beforeSignature` and `toggle.signature`, respectively. These are
observations, not the requested end state. Authoring a known toggle requires
an explicit `ensureState` copied from this step's observed choices; Core
refuses unsupported or contradictory choices instead of inferring a
direction from the first control pressed. The paired browser/domain and
Core updates ship together because older Core validators do not accept the
additional `shown` field.

## Passive result checks

The web runtime opts into Core's `judgeEvidenceVersion: 1` semantic judge
format. Ordinary publication computes one `judgeState` version-1 value from
the already sanitized capture; passive result observation and declared
end/witness state retain that same value without another capture. It keeps
actual named control values, selections, marks and explicit alert/status/log
or output notices. False and empty values differ from unavailable state.
Unrelated hidden text and unnamed containers do not become notices or control
names. Selectors, geometry, arbitrary attributes and rendered full-page text
are absent from this semantic value; current sensitive-value filtering remains.

The pure web projector recognizes actual read/action results, validates any
supplied record schema, and supplies source/read metadata beside Core's
separate execution/failure/effect facts. Allowed rows and complete deterministic
accounts remain in Core's existing retained row/page evidence. A data role does
not erase a mixed step's lasting effects. Unknown or invalid semantic state
remains an explicit repairable gap; intentionally omitting a raw capture from
complete data is not a gap. An unmatched look with valid versioned semantic
state retains it, while an opaque legacy look cannot fabricate a state reading.

Candidate-trial and saved-run checks use the web domain's optional Core
`observeResult` binding. It requests a fresh `capture_snapshot` with
`includeHidden: true`, runs the existing snapshot sanitizer and publishes the
ordinary rendered page followed by sanitized non-rendered state. Those rows keep
their hidden marker and descriptive values, without selectors, attributes,
targets or reusable bindings. Sensitive controls and strings retain the existing
withholding rules. The temporary selector maps are discarded; observing hidden
state does not make it executable.

Ordinary page publication and snapshot defaults keep their current behavior.
The result view preserves visibility provenance, so a hidden value is evidence
of page state rather than proof that a user-visible confirmation occurred.
Failed, missing or cancelled result captures are not replaced with an ordinary
view. This domain requires the matching optional Core binding contract; domains
that omit it retain their existing initial-observation path.

## Start state for a build's site reset

Before each candidate trial, a build puts the site back the way it found it
(t462; Core's `flow-bootstrap/site-reset/`). The web domain answers Core's
optional `startState` binding from `domain/src/runtime/llm-evidence/start-state/`
with the same passive capture `observeResult` takes. Hidden elements are
included; nothing is restamped or retained; no handle, selector or binding is
kept. The state is the address, the title, and the page's lines without their
handles. Those lines are read by `page-view/handle-free-lines.ts`, the same
reading a state diff makes. Then come the non-rendered state rows a result
check prints.

The gateway action result also carries the background worker's `sourceId`,
formed from its resolved tab and frame identifiers (frame zero when omitted).
The page cannot supply it. Reset bindings combine this trusted context with
the selected gateway session as an opaque `resetResource`. Collection scope
digests include that resource, location, frame and collection selector;
the raw identifiers are not part of the published page view. Missing or invalid
source identifiers cannot establish a reset baseline for another resource.

Left out of the state is whatever stands in front of the page: a dialog, a
recognised cover or the front layer, everything described beneath one, and
everything inside an open modal. An interruption is not the site's state. A
`covered-by` that names a layer left out is dropped from its line.

Given the `start` it answered as the build began, it says what `differs`, as a
multiset of lines: `location: <start> -> <now>`, then `gone: <line>`, then
`new: <line>`. Nothing is capped. A `start` it did not make answers
`undefined`. Core takes the target back to the build's start before it asks,
and shows the model `differs`.

Every answer also gives the address it read (`location`) and the same
differences as the lines themselves (`lines: { gone, added }`,
`start-state/changed-lines.ts`; t471). Core reads the page in place just before
and just after each lasting act a build makes while exploring, then before a
trial comes back to that act's page by navigating to `location` and looks for
what the act changed there. It compares the lines only for equality, so it can
tell which act changed which line without reading the domain's words.

An answer also carries, as opaque tokens only, the page's `scope` and trusted
`resource`, the `items` and `subjects` on it, the page's positively complete
lists and tables as `collections` (`{ scope, group, subjects, states }`), and
its stateful controls as `controls` (`{ [place]: { [state]: count } }`), each
absent when empty. Both are described in the next section. Core settles a
build's acts against them (Core `llm-flow-bootstrap.md`, "How an act
settles"); they never reach a model.

## Complete Lists And Control States For A Reset

Core's site reset (L1 reset settlement, t724) settles an act when fresh reads
show what it could change as the build found it. Two facts on a passive read
are its evidence, both built in `domain/src/runtime/llm-evidence/control-spot/`.

**Complete lists and tables** (`collection.ts`, `webResetCollections`). Only
a list the page positively vouches is whole can witness that an item is gone;
DOM absence alone never does. A container is a list (`list` role, written or
implied) or a table (`table` or `grid`); its items are its own `listitem`s, or
its `row`s less header rows (a row in `thead`, or one whose every cell is a
`columnheader`). It vouches one of two ways:

- **ARIA set sizes.** When any item carries `aria-setsize`, the list is read
  by set sizes alone: every item states the same size, equal to the number of
  items, and every position from 1 to that size appears exactly once. A table
  whose rows carry set sizes is never reported.
- **Native.** Otherwise the capture must not be truncated (neither
  `elements.truncated` nor `captureTruncated`), the container must hold at
  least one item, must not be `aria-busy="true"`, and must carry
  `listWayOn: "none"`. That fact is set per container by the extension's
  snapshot (`content/dom-snapshot.ts`) from
  `content/extraction/read-coverage/list-way-on.ts`, which asks the read's own
  continuation detection (`list-continues.ts`) about the list's items with
  nothing scrolled: a pager's Next or a following page says `next_page`, a
  Load more says `load_more`, a list the page declares a feed
  (`isDeclaredFeed`: `role="feed"`, an unknown set size, or more rows declared
  than mounted) says `feed`, and anything else `none`. A disabled way on, or a
  pager on its last page, is a list that ended. An absent fact is not `none`,
  so such a list is not complete. The domain reads the word into
  `WebLlmEvidenceElement.listWayOn` (`elements.ts`); it is never printed in the
  page view or a description.

Either way each item must hold exactly one subject token and no two items the
same one, or the list is not reported. A complete list's `scope` digests the
trusted resource, location, frame and the list's selector; its `group` the
resource, location and frame; each row's `states` value digests the row's and
its descendants' semantic fields (tag, role, implied role, name, text, value,
checked, selected, disabled).

**Control places and states** (`stateful.ts`, `place.ts`, `state.ts`,
`states.ts`). A stateful control is a visible element whose role (written, or
implied by its tag; `role.ts`) is `button`, `checkbox`, `switch`, `radio`,
`menuitemcheckbox`, `menuitemradio`, `option` or `tab`, or any visible element
carrying `aria-pressed`, `aria-checked` or `aria-selected`.

- Its **place** (`webControlPlace`) is one opaque token of the trusted
  resource, the page's location, its role, and the subject of the record it
  sits in (a record whose row names nothing gets a record place of its own
  kind; a control in no record gets ""). Its words are no part of it, since a
  toggle's words change with its state, so the same control shown in a dialog
  over a page and on that page itself shares one place. A page with no trusted
  resource has no places.
- Its **state** (`webControlState`) digests its name, `aria-pressed`, its
  checked state (`checked`, else `aria-checked`) and `aria-selected`.
- A read's **`controls`** (`webControlStates`) counts, at each place, how many
  visible controls show each state. A read with more than 2,000 places (Core's
  bound) reports none.
- A read's **`values`** (t772 value witness, `webValueStates` in
  `control-spot/values.ts`) maps each shown value's place to an opaque token of
  what it shows: the place digests the trusted resource, location, frame and
  the element's selector (the parts a list's `scope` uses), the value its
  page-view words, field value and chosen option. Stateful controls (read by
  `controls`), hidden elements, anything in or under a dialog or layer,
  elements with no words and no value, and places two elements share are left
  out; a page with more than 2,000 places reports `{}`. It is what Core sees a
  value set back by: a choice confirmed by a button that reloads its page
  shows its effect not on the pressed control but on a value elsewhere on the
  page.

Where they travel:

- The **start-state answer** carries `controls`, `collections` and `values`
  (`start-state/observe.ts`; `values` absent when empty).
- A **permission declaration**'s `control` carries the acted control's `place`
  and `state` just before the action (`permission.ts`, from `webTargetSpot` in
  `control-spot/target.ts`), beside `item`, `dialog`, `subject`, `page`,
  `scope` and `resource`.
- A **step diff**'s `spot` carries the same tokens, and for a step whose
  control has a place and that stayed on its page the diff adds
  `controls: { page, before, after }`: the page's scope token and that place's
  counts on the page before and after the step (`state-diff/places/diff.ts`).
  Core reads from it a toggle a trial pressed, and from later reads the press
  that turns it back. For a step that stayed on its page and replaced a shown
  value the diff adds `values: { page, location, replaced: [{ place, from, to,
  newValue? }] }` (`state-diff/places/value-replacements.ts`, at most 256): a
  place is replaced when its value changed and the old value is gone from the
  page (one still shown elsewhere only moved), and `newValue` marks a new value
  the page did not show before. A step **stayed on its page** when it stayed
  on its document, or when the page reloaded to the same address on the same
  trusted source (a settings form's Save, a chooser's confirming press); a
  list's `items` and `collections` still need one document. Core judges a
  value act by these (`flow-bootstrap/reset-settlement/value-tracker.ts`).
- **One place token per act.** The permission declaration's `spot.place`, the
  step diff's `controls` (before and after) and the start-state receipt's
  controls all come from one function, `webControlPlace`
  (`control-spot/place.ts`), so an act's control is addressed by the same
  token everywhere Core reads it. The token belongs to the act's page: a
  looped pass on another item carries its own page's token, never the first
  pass's. `control-spot/tests/place-per-act.test.ts` guards it. Value places
  are a separate token kind by design. The start-state answer may also carry
  an optional `effect` record that lets Core pair an undo with its act by
  inverse effect; the domain does not fill it yet, and Core then pairs from
  the control counts alone.

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
  stores the snapshot as the compact view (`summary`, `web-llm-page.v4`), so a
  state ref cannot carry more page data, or more sensitive page data, than a
  page the model is shown; Core returns it to a recovery model as
  `core.state_snapshot`. It snapshots only nodes that act on a page: a web
  output node, or a recorded action, which Core runs as `builtin.policy.action`
  naming its web output in `parameterValues.outputId`. It computes a state diff
  (`domain/src/runtime/state-diff/`, `web-state-diff.v3`) only when both the
  before and after snapshots were captured: the view's element lines that
  appeared or left, handle-free and compared as a multiset, as text. A summary
  stored before t223 as a packet is written as the view first.
  Beside the view, never in it, the snapshot carries `documentTimeOrigin`: the
  page's `performance.timeOrigin` (navigation evidence `timeOrigin`), one value
  per document and unchanged by `history.replaceState`/`pushState`. The diff
  says `documentChanged` from it when both sides carry one, and otherwise
  `documentChanged` equals `locationChanged`. An address rewritten in place
  (run `run-muw5zv4m-52d83027`'s size buttons) is therefore the same document,
  and Core's finished-run check keeps its change lines; a single-page app's
  route change reads the same way. The page-state digest omits navigation, so
  the identity never changes a digest.
  Beside the view too (t655), the snapshot carries `groups`: each named set of
  options the view names (`group="…"`), as `{ name, options: [{ words, count?,
  chosen }] }`, the option's words as its line prints them less a whole number
  in parentheses ending them, which is its `count`, and `chosen` where its line
  says checked, selected, pressed, current or marked; and `resultCount`, the one
  number of results the page states in a text line ("40 results"), absent where
  it states none or several (`domain/src/runtime/llm-evidence/page-groups/`).
  Each key is absent when empty. They are read off the same screened packet as
  the view and say nothing it does not; Core reads them to say what a narrowing
  step chose and left out without parsing a line of the view.
  A snapshot also carries `from: { location }`, the page's real address as the
  reset token a step's `replay.from` is, so Core's re-author can put the page
  back where a node started in the run it repairs (t194 cause C-D). It is
  written only when that address is exactly what the packet publishes, nothing
  in it withheld, so it carries no secret; otherwise the snapshot has no `from`.
  The diff also carries two keys Core ties a trial's lasting act to its own
  item by (t609, Core t598), both opaque tokens of the kind a permission
  declaration's `control.item` and a start-state read's `items` take
  (`llm-evidence/control-spot/`): `spot`, `{ item?, dialog?, subject?, page?,
  scope?, resource?, place?, state? }`, where the element the node's selector
  addresses sat on the page before the step and, for a stateful control, its
  place and state there (see "Complete Lists And Control States For A Reset");
  and
  `items`, `{ before, after }`, the items of the lists both pages show. A list
  is a container with the shape of the way down to its items
  (`state-diff/places/snapshot.ts`), and it counts only when the page before
  showed it with at least one item and every one of those is still in it, so a
  drawer the step merely opened over lines that existed before the build, or a
  line whose words changed, never reads as an item the step created; a move to
  another document names no items. Both are read from the capture's records and
  selectors, which a summary must not carry, so the host runtime keeps each
  capture's places in memory by `stateRef` for its last few snapshots
  (`state-diff/places/memo.ts`) and a diff of refs it no longer holds names
  neither key. Two more keys come from the same places, on a step that stayed
  on its document: `collections`, `{ before, after }`, the complete lists of
  each page when every group after was also there before; and `controls`,
  `{ page, before, after }`, the counts at the step control's place. Like the
  rest of the diff, all of them stay under Core's withholding of `stateDiff` in
  a saved trace.

## What The Page Changes By Itself

A press is credited only with what it changed (t1043). Run
`run-mww6euuw-ecdb20f8` pressed a cookie banner's "Accept all" while the home
page's carousel turned to its next slide; the press's draft statement said the
slide's heading and text `reads` otherwise, Core read that as a change the press
made that stays, carried the press into the next attempt, and that attempt's
judge was held unsure. Any page with a carousel, a ticker, a clock or a live
region can do the same, so the domain tells the page's own changes apart from
the press's (`llm-evidence/node-run/press-effect/self-change/`), from two
signals that are honest on any site and with no wait or timeout:

- **The page's own markup** (`markers.ts`). Everything inside an element whose
  `aria-roledescription` says carousel or slide, whose role is `marquee` or
  `timer`, or that is a `<marquee>`, is the page's to change. A live region
  (`aria-live` polite or assertive, role `status`, `alert` or `log`) is not by
  its markup alone, because a page announces a press's own result into one
  ("Added to cart", a cart total); it counts only when the run has also seen a
  line in it change with nothing done.
- **What the run has seen** (`memory.ts`). Each Flow keeps, per location, the
  page-view lines (by their stable handles) whose words changed between two
  captures that nothing came between: no act since the first (the target
  packets' `acting`, called before every command and around every replay), one
  document (location and `navigation.timeOrigin`), both whole. A line counts
  once it has done so in two such pairs: a change an act caused that lands
  after the look following it is seen once per act, while what a page changes
  by itself keeps changing. The memory is fed with every capture the target
  packets record (`watch.ts`) and keeps what it saw on the capture
  (`webPressSeenChanging`), so a press reads it from its own two looks.

Neither applies where the press reached the element: a press on a control
inside it, or one whose `aria-controls` names it (a carousel's next arrow), is
credited with the slide it turned; a line seen changing by itself is the
press's when the press was made on it or on a control around or inside it.

What the page changed by itself (`own-changes.ts`) is then left out of the
draft statement Core reads acts from (`change/statement.ts`), set aside when a
press is judged to have changed the page at all (`unchanged-page.ts`, so
`pageChanged` and a press's no-effect retry read only the press's own effect),
and still shown to the model in the outcome's `changed` list, after the
press's own entries and marked `(changes by itself)` (`page-changes.ts`). A
replay's change list does not classify: it is told no pressed control.

Core's side of the same run is its own before-side note (Core
`runtime/result-verification/judge-evidence/earlier-before-note.ts`): when acts
an earlier attempt made are carried in and no reading from before them is held,
the judge is told so in Core's words and the note is never handed to this
domain's judge-evidence projector, which could not read it.

## What A Model Reads: The Compact Page View

The user's order of 2026-09-30 (t223): only elements with visible text or that
are controls, in the least possible format, and a search over everything else.
Every page leaves the domain as `web-llm-page.v4`
(`llm-evidence/page-view/published-page.ts`; `.v3` carried the same lines as
one `page` string):

```text
{ schemaVersion: "web-llm-page.v4", trust, location, truncated,
  failedTarget?, failedTargetMissing?, failedTargetUnknown?, repairParameters?, repairCandidates?,
  pageView: { key, lines: [{ key, text, extra? }] } }
  // the lines' texts joined by "\n": header lines, a blank line, then one line per element
```

- **Keyed lines for Core's page channel** (t1036, D1). `pageView.key` is the
  page's key (`page-view/location-key.ts`): its screened location without the
  query (user, 2026-11-25: the URL "not including the ? params"), with the scheme
  and host lower-cased, a default port dropped, the path's trailing slash
  dropped (not the root's) and the fragment dropped unless it is a route
  (`#/`, `#!`; the lead's reading). A layer over a page, a filter, a sort and
  another page of the same list are the same key and arrive as changes; where a
  query names a different page, Core's channel sends a diff longer than the base
  as a new base. Each line is keyed (`page-view/keyed-line.ts`): a header
  line by its label (`PAGE`, `URL`, `VIEW`, ...), the blank line `-`, an
  element line by its handle (`t49`, its text starting with it), and a marker
  line by the element line it stands before (`^t62`, then `^t62.2`). Keys are
  unique in a view. Core keeps the last view it delivered for each key in a
  run and sends the next as the lines that changed; it never reads a text.
  `extra: true` marks a line only a full capture shows, never part of the base
  a later diff compares with. Every domain reader of the text reads it through
  `webLlmShownPageText` (`llm-evidence/shown-page/`, browser-safe), which also reads a `.v3`
  page's `page` string, as a stored state summary or a recorded result may
  carry. The keyed view is not an observed-state key
  (`observed-state/observed-state-keys.ts`): Core's page channel owns it.
- **Header lines**, each only when it has something to say: `PAGE "<title>"`,
  `URL <location on a ~ base>   (~ = <base>)`, `VIEW <w>x<h> at the top · <n>
  elements with visible words or a control, in page order`, `COVERING`,
  `DIALOG`, `LOADING`, `FRAMES ... did not answer`, `ARRIVED`, `SELECTED`, and
  `CAPTURE incomplete`. The view says nothing of a page search (D15).
- **The whole page on request** (t1036, D5). `webLlmFullPage`
  (`llm-evidence/full-page/`) is Core's `core.full_page` hook: it takes the
  capture that also lists what is not rendered (`includeHidden`), restamps it
  as every authoring capture is, and publishes the ordinary view with, marked
  `extra`, a `FULL` header line, each hidden element as
  `tN hidden <kind> "<words>"` (key `tN`) and each element's attributes whole
  as `tN attributes: name="value" ...` (key `tN.attributes`), in page order
  (`page-view/full-view.ts`). The lines that are not extra are exactly the
  ordinary view of the same capture. A page that cannot be read now answers
  nothing; Core sends a view over its page budget in parts.
- **Which elements get a line**, in document order (`page-view/line/choice.ts`):
  every visible control, every visible layer, every visible element with
  meaningful words of its own, and an image whose alt says something no line
  near it says. "Visible" is not a search capture's `hidden`, and a box, when
  there is one, that reaches into the document (an off-page honeypot does not).
  Words already printed by the control or semantic element a text sits in, a
  label repeating its control, and a line repeating the one before are folded;
  letterless fragments of one value (`$`, `39.`, `99`) are joined. No element
  that qualifies is capped, ranked or cut. A `<legend>`, a `<caption>`, a
  `<label>` naming no control beside it, an `<a>` with no address and an
  element whose role is `heading`, `tooltip`, `cell`, `row` or `listitem` take
  their words from `text` alone, so the sanitizer keeps their `text` even
  where it equals the name (`elements.ts`, `wordsOnlyInText`, t605); it used
  to drop it, and a filter sidebar's group headings never reached the model.
- **A line** is `<handle> [<heading>] [<kind>] ["<words>"] <state> [group]`:
  the `tN` handle, the kind (`link`, `button`, `field[:type]`,
  `field[search]`, `select`, `checkbox`, `radio`, `toggle`, `tab`, `img`,
  `h1`-`h6`, `clickable`, `dialog`, `layer`, ...), the words in quotes, and
  states (`="value"`, a select's options, `checked`, `open`, `disabled`,
  `selected`, `pressed`, `current`, `marked`, `placeholder "…"`, a table cell's
  column, a link's address, `covered-by tA`, `focused`). Links are written on
  the page's `~` base, and a repeated address is written `same href`. A
  control inside a `<fieldset>` ends with its legend, `group="Size"`
  (`page-view/element/group-token.ts`, t605): the extension collects
  `context.fieldsetLegend` for every element, and the sanitizer publishes it
  as the element's `group` where it says something the element's name and
  text do not (a legend's own group is left out). A bare option says what it
  filters by only through it. A control in an option set drawn without a
  fieldset -- an element whose role is `group` or `radiogroup`, named by
  `aria-labelledby` or `aria-label` -- ends the same way (t610,
  `page-view/group-names.ts`): the view reads the group from the packet's tree,
  the ARIA group's accessible name as the capture resolved it, else the words
  of the packet elements its `aria-labelledby` points at. The nearest named
  group around a control wins, a fieldset or an ARIA group; an unnamed one (a
  fieldset with no legend, a group with neither attribute) names nothing and
  the walk goes on up. A named ARIA group gets a text line of its name before
  its options, as a legend does, unless the element its `aria-labelledby`
  points at has a line, or a legend around it or inside it says the same
  words. The sanitizer writes the same resolved group into the packet's
  `group` field once every parent is known (`sanitize.ts`, `writeGroups`), so
  the packet, the state digest (`web-state.v7`) and the look-alike
  descriptions name the group the view prints: two "None" radios in two ARIA
  groups are told apart by their group.
- **Structure markers** on lines of their own: `[landmark]` (with frame, modal
  dialog and form), `- i/n` for a list item, `- row r`, and
  `--- below the fold ---` and its kin where the screen zone changes.
- **Whole page and detail.** There is no page search (page-diff D15, t1036):
  the way to see more than the view is the whole page on request
  (`core.full_page`, `llm-evidence/full-page/`), the view with the hidden
  elements and every element's attributes as extra lines, captured with
  `includeHidden`. `web.describe_element` (`llm-evidence/page-find/`) prints one
  element whole: its line, every attribute, its box and where it is, and every
  other field, `group` among them, read as the view reads it
  (`web-llm-describe.v1`), from a fresh capture that also lists what is not
  rendered. It is an authoring tool and a recovery option
  (`web.recovery.describe_element`); a hidden element never moves a visible
  element's handle, and the state digest leaves hidden elements out. The
  retired ids stay in the vocabulary and the call words only so that recorded
  runs still read.
- **Every path a page reaches a model** goes through `publishedWebLlmPage`: a
  node run's look or action result (`node-run/run.ts`), a refusal's `page`
  (`tool-rejection.ts`), a replay or verify answer, every recovery option, the
  failure evidence (`captureSanitizedFailureEvidence`), the adapter's
  `metadata.failureEvidence`, and the host runtime's state summary and diff.
  A node's read never carries the extension's page record (`snapshot`,
  `element`, `visualTarget`, `resolution`, `structure`;
  `node-run/page-record.ts`).
- **A handle outlives a layer.** A popup, dialog or cookie banner the page
  puts beside its main column shifts every positional selector
  (`body > div` becomes `body > div:nth-of-type(2)`), and handles used to be
  keyed on the selector, so the whole page renumbered each time one opened or
  closed (`run-mup2i28c-6c7fc209`, C1). `stable-handles.ts` now finds an
  element whose exact address is new by its address with positions removed,
  its tag, record and words, so every control behind the layer keeps its
  handle, and the layer's controls get their own. A changed list is not paired
  up by position: new items get new handles.
- **The same element keeps its handle for the whole run** (t1036, D2). Within
  one document, an element keeps the number last seen with its own node
  (`nodeToken`, the content script's serial per element) while it is the same
  kind of element at the same address with positions removed, record included:
  through an insertion above it, a change of its words, or a filter applied
  without a load (top frame only). The address with positions removed and the
  place name the page by its path, not its query, so the same card under
  another query -- a filter, a sort -- is found again by that address and its
  words, only where exactly one element of the capture and exactly one number
  last seen under another query have them; look-alikes get new handles, never
  a guess. A control on another path keeps a number of its own. A bare handle
  that two remembered pages place at selectors differing only in positions
  resolves to its newest view (`plan-resolution/target-packets.ts`).
- **A handle the page as it is now still gives to an element binds to it**
  (t1036, t1042). Whichever view printed a handle -- a view of another address,
  one whose selector has since moved, the whole page -- the capture a call
  takes before it acts, numbered by the run's stable handles, says whether the
  handle still names an element; when it does, that element as it is now is the
  target and nothing is refused. Only a handle the page now gives to no element
  is refused as stale (`page_moved_since_packet`, `handle_no_longer_on_page`),
  with the page as it is. One check serves every path that binds against a
  capture of its own (`structure/held-now.ts`): a detection
  (`structure/detect.ts`) and a runtime recovery's press and field entry
  (`press.ts`). A node run's press and read bind through the packet store,
  which is handed the same numbered capture before the call resolves
  (`node-run/run.ts`), so the same handle resolves there
  (`node-run/tests/held-handle/tests/press-and-read.test.ts`).
- **A runtime recovery gets the page as a build does** (t1042). Core carries
  the page channel into a recovery's exploration: each result's page whole the
  first time the exploration meets its key, then only what changed, and
  `core.full_page` among its tools. There is no look option:
  `web.recovery.inspect` is retired, and the opening look before the first
  decision -- also the look after a person's Continue on a robot check -- is
  Core's own first call of `web.recovery.navigate_in_scope` with no address, an
  input its schema refuses from the model (`harness-options/options.ts`), which
  captures the page where it stands and moves nothing. Every capture a recovery
  option takes is numbered by the run's stable handles, as authoring's are, so
  a recovery's pages and the whole page print one handle per element. The
  `core.full_page` hook answers with the published page; Core reads the view
  under its `pageView` member.
- **A press through a cover is not sent.** When the look a press takes before
  acting shows its control `coveredBy` a layer, the press is refused
  `target_covered` (`blocked_by_dialog` under a modal) with the reason
  `covered_by_layer`, the covering handles in `instead`, and the page, whose
  `COVERING` or `DIALOG` line names the layer (`node-run/covered-target.ts`).
  Its `layerControls` (t792) name the layer's own controls by handle, header
  controls first and an icon-only one as "a control with no words in the
  layer's header" (`node-run/layer/own-controls.ts`); the links inside the
  layer are its content and are never listed as its controls, and a repeat of
  the refusal keeps them (`repeated-refusal.ts`). The client never presses one
  by itself: naming it lets the builder close or collapse the layer.
  A refusal for a handle the page no longer has carries the page too, and
  both pages become the shown packet, so the next call can use their handles
  (C3, C4, C9).
- **The repair check reads what the model read.** A shown page, search or
  description is retained under `location + " " + text`
  (`page-view/result-retention-key.ts`) with the structured packet behind it,
  24 per window (Core's default recovery budget), and
  `validateTargetOverrideEvidence` checks a repair's handle against that
  packet. One that was let go, or edited, is `evidence_unrecognized`.
- **A candidate names only what it was shown** (since t378;
  `llm-evidence/plan-resolution/target-packets.ts`,
  `resolve-plan-node.ts`). When a candidate submission's steps are resolved
  against the Flow's view history (`view_history`), a handle resolves only if
  some evidence the model read printed it: a line of any capture's page view
  (a look's too), a failure packet's repair candidates, or a handle that
  begins a line of any tool answer -- a search's matches, a description, a
  detection's column `at` (which may name a wordless element the view left
  out), a node run's answer (`tools.ts` feeds each answer as it leaves the
  runtime). A refused call's own input echoed back does not count, and
  neither does a handle mid-line. A handle the store holds that nothing
  printed -- a number in a gap the view left between wordless wrappers -- is
  refused `web.handle.unknown`, as a handle no packet carried.
- **A candidate press needs a control.** A candidate's
  `web.output.dom-click` (also inside a Run Output node) on an element that is
  not pressable is refused `web.handle.not_a_control`, with
  `web.handle.not_a_control:<position>`. An element is pressable when it is a
  control by its own tag, role, listener or cursor, is actionable by implicit
  role, a layer or a `<label>`, or sits inside an ancestor the view prints as a
  control (not a delegate holder such as a chat panel listening on its whole
  body) (`pressable-targets.ts`, `page-view/line/control-holders.ts`). The
  exception: words exploration pressed and saw change the page
  (`node-run/run.ts` marks the handle `pressed` when the capture after the
  press differs) are not refused; a press that changed nothing proves
  nothing. A Next page control is not held to this rule.
- **Exploration itself is unrestricted.** The model's own node runs while it
  explores are held to neither rule: it may press anything a person could, and
  a listener a framework adds at the document is invisible to the capture, so
  text and a control can look the same.
- **The model is told how to read it.** The domain binds
  `systemInstructions` (`llm-evidence/system-instructions/`, version
  `web-12`, under 3,600 characters) on its evidence runtime, and Core places the
  text in the system message of every model request made for this domain's
  work (evidence decisions, bootstrap, runtime patch, result checks and the
  chat), after Core's JSON and injection rules and before Core's task prose
  (t237; Core's seam is `llm/domain-instructions/`). It says the model operates
  a real website in the person's browser on their behalf, how the header lines,
  element lines, states and markers above read, that the site's own search and
  navigation find things,
  how a covering popup is handled (press the control; the runtime closes a
  dismissable layer first; only a refusal with `closeWith` needs a closer),
  that optional cookies are declined, that a marked option is left alone, that
  every page of a list is a loop the Flow states and one page read plus one
  Next page is enough to explore, and never to solve a robot check. The rules
  that hold for every domain -- written instructions outrank recordings, the
  person's limits (money, delete, send/publish asked first; never type a
  secret), the loop and bound-value rules, item type by evidence, stating
  `repeat`, and efficiency -- are not here: Core says them in its own task
  prose (`runtime/llm/deepseek/system-prompt.ts`), only to the task kinds
  that act or write steps ([build loop](build-loop.md#the-models-instructions)).
  Change `version` with the text, so a run's step log names what its model read.

### Controls The Markup Does Not Name

Many pages build controls from styled `<div>`s bound with `addEventListener`.
An isolated content script cannot see a listener the page adds in its own
world, so three facts make those controls visible:

- **The press probe.** `page-world/press-listeners.ts` runs in the page's world
  at document start, wraps `addEventListener` and the `onclick` setter, and
  remembers which elements get press listeners; it writes nothing to the page.
  `content/page-press.ts` asks about one element by dispatching the cancelable
  `fluxiq:press-probe` event (`shared/press-probe-event.ts`), and
  `describe-element.ts` sets `hasClickHandler` from the answer. Such an element
  prints as `clickable` (`traits.ts`, `kind.ts`).
- **`cursor`** (`content/evidence/press-cursor.ts`): the element's own
  `pointer` or `not-allowed`, recorded only where its parent's cursor differs.
  A pointer makes the element a control; `not-allowed` adds `disabled`.
- **`setApart`** (`content/evidence/set-apart.ts`): set on the one member of a
  run of like siblings that carries a class few of the others carry (siblings
  with a `not-allowed` cursor are left out of the run). It prints `marked`,
  beside `selected` (`aria-selected`), `pressed` (`aria-pressed`) and
  `current` (`aria-current`), for pages that mark a chosen chip by class only.

An element that is a control only through a listener or a cursor, and that
contains another control, gets a text line instead of a control line
(`line/choice.ts`), so a list that delegates its buttons' clicks does not
become one line holding them all. Such a control prints its own words, not
every word under it; one with no words takes the alt text of its images.

**Fields.** `kind.ts` prints `field[search]` for type `search`, role
`searchbox`, a field inside a `search` landmark, a field in a form whose action
is a search (the sanitize flag `searchForm`, from `context.formAction`), and a
field named or id'd `q` or `search`. Sanitize sets `placeholderName` when a
field's only name is its placeholder; a placeholder is never a field's words
(`words.ts`) and is shown as `placeholder "…"` whenever it differs from the
line's words (`state-tokens.ts`). `identity/label.ts` `nearbyLabel` skips a
neighbour that is a control or has no letter or digit, and looks before the
field's wrappers, up to two levels, while each wrapper holds no other field;
that is how a stepper box between "−" and "+" is named "Quantity".

Visibility goes by computed `display`, not the `hidden` attribute
(`rendered-elements.ts`). The guard spec
`apps/extension/e2e/content/tests/evidence/tests/page-view-controls.spec.ts`
checks that every visible control on the ten scenarios gets a line.

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
kind and coverage, the item count and how the list continues (a list that
continues also carries `nextPageNote`, which says a read reads this page only
and every page is read by a Next page step naming the same handle, `nextPage:
{list}`, and a repeat on the read through it; no page bound is stated); the handle store
keeps the selectors. Each column also carries `at`, the page-view handle of its
element in the list's first item, as the model was last shown the page, so a
column labelled by a meaningless atomic-CSS class path can still be matched to
the words the page view prints beside that handle (run 38, C2). The domain finds
the element by walking the detection's own selectors over its capture
(`structure/first-item/`); a column whose element cannot be told unambiguously,
or a detection with no shown page, has no `at`. No value or selector is added. A plan names the handle in an extraction node's
`extractList`, and the node is built from what the handle keeps
(`plan-resolution/extraction/slot.ts`).

First-item handles and samples use the same captured selector walk, including
the item itself when a field reads `:scope` or a table cell is its own field
element. A group selector written as `container > group` resolves only a
matching direct child of that exact container; a nested matching group or an
ancestor outside the container cannot supply its heading. A bare group
selector retains the live reader's nearest matching ancestor behavior.
Ambiguous or unsupported matches supply neither a guessed sample nor a handle.

A one-page read carries the domain's opaque structural `listKey` separately
from its conditions, requested fields and transient extraction handle. Its
optional `place` is observed on the page: the pager's current page, a parameter
the pager's Next link actually advances, or a proved append offset. A whole,
unsorted static list has origin `offset=0`, including a read whose conditions
kept no item while the source list remains present. A resumed, locally sorted,
growing or virtual window cannot claim that origin merely because no following
control is shown. Declared feeds, larger row/set counts and positions away
from the origin retain unknown place when no pager supplies it. No place is
inferred from row values or from the read's requested page parameter.

**A saved read keeps what its handle stood for.** A handle is a counter in one
process's store (16 kept), so a saved `extractList` that named only
`extraction.N` could not assemble after a restart, and numbers restart, so the
same name could come to mean another list. The step now keeps the binding
beside it, under `extractionBinding`: the item, every detected column, the
pager and the frame (`plan-resolution/extraction/saved-list.ts`). Where a step
holds one it wins over the store on assembly, replay and forward runs; a
number a step holds is never issued again. The key is on the denied list
(`llm-evidence/denied-keys.ts`), so a model never sees it and one it writes is
refused. An old draft that holds only the handle is refused after a restart and
the model reads the list again.

**A read is one call that detects its own list (t1038, D13).** A read no
longer needs a detection first. Its `extractList` names the list by the handle
of a line of the page view inside it or the heading above it
(`{handle: "tN"}`), by the words such a line shows (`{words: "..."}`), or by
nothing for the page's largest list; the read runs the detection above itself
(`node-run/list-read/own-detection.ts`, the same `detectRepeatingStructure`,
retained the same way) and goes on as a read of the `extraction.N` it issued.
A line inside the list reads the list; where the page also sends the record
the line sits in, outside the run it found, that record is read, unless the
line is a heading or shows the list's own name, which names the list under
it and reads the run. A `tN` read
with `fields` naming only the element's own columns (`text`, `value`, `link`),
or one around which no list exists on the page, reads that element as a
one-row table as before (t903). Words no line shows are refused
(`list_not_on_page` with `web.list.words_not_shown`), never read as the
largest list. The step keeps the issued handle and its binding, so a rerun
detects nothing. The detection tool stays, and a read that names an
`extraction.N` or detected keys reads as before.

**Every column is kept under a readable name.** A column whose key the page's
own words gave (`price`) keeps it as its name; one whose key is a generated
class path gets a name from what its element is and what of it is read, in
closed words with no page value (`link`, `url`, `price`, `image_src`,
`text_2`; `structure/column-names.ts`). The names are made once, at detection,
and kept in the binding (`names`) and in a saved read's `extractionBinding`, so
the same list read again keeps them. A read keeps every column: those its
`fields` asks for under the plan's own keys, every other under its name, and
`fields` (optional) may name a column by its name or its key. The packet
shows a column's `name` beside its `key` where the two differ, the read's
answer lists the names it kept (`columns`, with `asked` for the ones `fields`
picked), and the retained record schema labels such a column by its name
rather than its class-path key.

Definition-list columns retain an exact semantic term and whether they read
that term or its associated value. Their keys, coverage and stored readers do
not identify a numbered pair. The first-item capture walk follows the same
row-owned `dl`/`dt`/`dd` association as the live reader; ambiguous or unavailable
terms have no `at`, rather than pointing to another pair or the whole item.
Structural terms may label proposals, while definition values and unrelated
record text remain screened out of proposals. Confirmation and saved
extractions retain the association, including private condition readers for
detected columns that are not projected into the output.

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

A one-item handle builds an extraction node like any other, but a handle that
names one record (the record beside a run, a receipt, or a lone record) always
reads at most one row: the node gets `maxItems: 1` whatever bound the plan
wrote (`oneRecord` on the binding), because two rows from what the model chose
as one record are a wrong table. The Flow keeps the record's item selector, and
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
`browserFrameId`. Every `web.dom.*` node declares both, so such a node passes
Core's check of the plan and its Flow can be saved (t1062). On a later attempt
the path finds the frame, and the saved id only breaks a tie (see
[Child Frames](web-capabilities.md#child-frames)). A reload renumbers frames, so when a command names a path,
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
`web.describe_element` and the whole page read:

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
  `promotion`, `assistant`; `WebAutomationLayerKind`). The cleared-layer and
  obstruction wire to Core uses the generic words instead (`overlay`, `notice`,
  `rate_limit`, `assistant`, `other`), mapped from these.
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
  included. Core owns the card rule: a run of 13 to 19 digits that passes the
  Luhn check, is written as a card is (unbroken, in fours, or 4-6-5 and
  4-6-4) and starts with 2 to 6, as a card issuer's number does. The grouping
  and issuer rules keep an order number (`112-5550123-4567890`) and a
  millisecond timestamp, one in ten of which passes Luhn by chance, as the
  page wrote them. Core's screen reports such a run as `secretShaped`, and
  `automationStudioWithoutCardNumbers(text, marker)` (from
  `fluxiq/automation`) replaces each run with a marker and keeps every
  other character. `withheld.ts` calls that helper with `WEB_LLM_WITHHELD_TEXT`
  **before** the credential screen, so a card costs only its own digits; run
  after, the screen would withhold the whole string.
- **An address.** No selector, xpath or record key is published; the opaque
  `tN` handle is the only way to name an element.

The state digest (`state-digest/state-digest.ts`, `web-state.v7`) and the
route state (`route-state/project.ts`) are read off the same whole packet, with
a search capture's hidden elements left out, so a call's own capture answers
for them exactly as `captureStateDigest` and `observeRouteState` would, and a
search reads as the same state as a look. `v7` (t724) names an element's
`listWayOn` as a left-out field, so every element's projection gained one
empty field; the version moved so that projection change does not read as a
state change. The route state names every dialog,
every blocker and every control.

**The controls line carries the headings (t869).** `state.page.controls` is a
flat line of names, and an evidence history keeps it after the page view that
showed the headings is gone: two listings under "Results outside your search"
read as ordinary matches. The line (`route-state/controls-line.ts`) now writes
the capture's own `heading` for a control (the nearest heading before it, left
out where it only repeats the control's own words) in square brackets before
the first control it covers, and again only where it changes:
`... | [Results outside your search] £30 Small table | £55 White table`.
Nothing is cut or renamed, a name seen once is written once (its heading goes
with that sighting), and a page with no headings reads as before. The mark is
taken off by one function, `webRouteControlName` (`route-state/control-mark.ts`),
which the route signature, a step's effect and the page's own changes read
through (`route-state/page-features.ts`), so a heading never changes what a page
is compared by. The state digest and the loop guard read other fields and are
untouched. A heading containing ` | ` has it written ` / `, and a `]` written
`)`, so it cannot split the line or close its own mark.

**A condition reads the bare names.** The marks are for the model reading its
history. A saved Flow's Router condition (`state.page.controls contains "Sold
out"`) must test what the page offers, so before a condition reads the observed
state Core hands it to the host's `routeConditionState`
(`route-state/condition-state.ts`, wired in `host-runtime.ts`), which takes
every mark off the controls line and leaves every other key as it is. A
heading's words therefore never satisfy a condition, and `equals`, `matches`
and the rest read the line as they did before headings. Core's evaluator is
unchanged: the seam is `resolveAutomationStudioRouterState`.

A Flow node keeps a route signature of the page it started on and the page it
left (t243). The host runtime's `signRouteState`
(`route-state/signature.ts`, `web-route.v1`) reduces a route state to hashes
alone: `path` is the FNV-1a hash of the path's shape (lowercased, a segment
holding a digit read as `#`, one longer than 24 characters as `*`, so
`/p/123` and `/p/456` are one shape); `layers` hashes the sorted distinct
dialog and blocker names, or is `""` when nothing stands in front of the page;
`controls` is a bottom-64 sketch of the distinct control names (the 64
smallest of their FNV-1a hashes, each passed through MurmurHash3's finaliser
so numbered names do not cluster); and `count` is how many distinct control
names there were. Names are whitespace-collapsed, trimmed and lowercased
first. A signature holds no page text, title or path, and stays under Core's
2,048-character bound. `compareRouteSignatures`
(`route-state/compare-signatures.ts`) reports `closeness`, the Jaccard index of
the two control sets estimated from the sketches (exact when neither page had
more than 64 controls; 1 when both have none, 0 when one has none), and
matches only when `layers` are equal, path shapes are equal and `closeness` is
at least 0.5, so a page with a popup open never matches the same page without
it. A signature of any other version never matches. A node also keeps its
step's effect: `signRouteEffect(before, after)` (`route-state/effect/sign.ts`,
`web-effect.v1`) records, with the same names and hashes as `controls`, the 16
smallest hashes of the control names the step added and of those it removed,
and the path shape it moved to when that changed. When the step cannot run,
`routeEffectHolds(effect, observed)` (`route-state/effect/holds.ts`) holds only
when the step added something, every added hash is among the observed page's
exact control hashes, and any recorded path shape is the observed one; it never
tests `removed`, because a layer the run itself opened, such as a store picker,
may still show controls the recorded step removed. When a lasting step without
`done when:` answers success, Core asks `routeEffectSeen(effect, observed)`
(`route-state/effect/seen.ts`, t476): `seen` when the effect holds, `not_seen`
only when the step added at least three control names, none of them is on the
observed page and the page is not on the path shape the step moved to, and
`unknown` otherwise -- a later add whose panel words its quantity differently
still shows part of the effect. Core fails a step on `not_seen` alone.

**It is also `not_seen` when the page still stands where the step found it**
(t1062). The effect keeps a second pair of samples, `marked`: the same hashes
over each control name joined to the heading the controls line put it under
(`route-state/page-features.ts`, `markedHashes`). They are kept only when the
step took a control away from under its heading. When the observed page shows
every one of those under its heading again and none of what the step brought,
the step is not on the page, however few names it added. A stepper's Next adds
only "Back", or nothing. In run `run-mwxk0spp-0e94cbfe` the booking widget's
Next was carried from the first attempt and held to a look. Core's run gate
asks this question before it lets such a hold go
(`SVC/answer-first/run-acts/run-gate.ts`, t994), and until t1062 nothing could
answer it for that press. The route signature never reads `marked`, so a
heading still never makes an unchanged page read as changed. Core keeps each
saved step with what its attempt's routing signed for it
(`framework/automation-service/route-state/signed-steps.ts`), so a later
attempt's Flow has the effect at all.

A step a build created carries the same effect even where Core's build routing
signs none, as on the candidate path (t447). When exploration acts on a
handle's control, the target store keeps, beside the control as the act found
it (t442, `plan-resolution/target-packets.ts` `acted`), the effect of that same
act: `signRouteEffect` over the route states of the capture the act was made
from and the one it left (`plan-resolution/act-effect.ts`), kept only when the
act added a control name the page can show. A candidate's resolution of that
handle answers it as `effect`, and Core writes it onto the node's
`routeSignatures.effect`; exploration's own resolutions and a legacy one answer
none. It is hashes only and never the control's identity: "Collected" is what
the press made true, never who the control is. A build test's check
(`node-run/verify.ts`) asked with a recorded `effect` answers `present` when
the page taken now shows it, whatever the control reads, and otherwise checks
the control as before; nothing is run either way.

Core carries every evidence entry in call order beside the complete draft and
history; the domain declares `page` (and the packet's `elements`, `dialogs` and
`blockedBy`) as its observed-state keys, so each earlier page is replaced by
`supersededBy` once a newer one is shown. The request's only page-information bound is the model's
1,000,000-token window (992,000 input and 8,000 reserved output). A request
that exceeds it is refused before sending with its measured size; no page
entry is ranked, sampled or trimmed to make it fit. Spend, deadlines and call
counts still bound how long a build runs, not which captured elements it sees.


Control subject capture uses the same interactable-element predicate as captured
control text, including pointer-only controls without a role, tab stop or own
listener. Ordinary noninteractive wrappers gain no subject merely by containing
a control. Existing bounded record lookup, ambiguity and sensitive-text rules
still apply; this metadata does not grant permission or make an input executable.

Reset ownership witnesses require a positively complete collection inventory:
a list vouched whole by ARIA set sizes or, natively, by the capture's
`listWayOn: "none"` (see "Complete Lists And Control States For A Reset"),
with one unambiguous subject per row. A partial, continued, busy, truncated or
merely rendered list cannot prove absence. Permission declarations and trial step spots
carry the owning collection's resource-bound scope; Core compares only opaque
scope and subject tokens. The complete baseline must precede the act before
absence can establish that a later line was created by this build. Matching
titles do not establish ownership of an existing line or quantity. A later
complete read of that same collection must prove the new subject absent before
deletion is accepted as restored. One removal may account for multiple adds
by this build to the same new line; it never authorizes deleting a baseline line.


Project-builder exploratory pure creation now requires original authority before
execution. The domain passes its existing trusted, hashed `resetResource` into
private start-state reads and control declarations, alongside the subject and
scope. Core issues bounded original-destination references from complete trusted
observations, and compares the actual control's resource and subject before
allowing an identified `create_new`. The model supplies only the issued
`resetDestination` reference; it supplies no resource, inventory or subject
authority. The envelope is stripped before domain execution. Missing authority
or a missing preflight adapter refuses without mutation or a permission ask,
leaving ordinary navigation and observation available for a safe retry. This
project-exploration guard does not cover unseen dynamic trial actions or change
finalized-run permissions. Updated Core and domain must ship together because
older declaration parsers reject the added resource field; browser transport is
unchanged.

Modern resource-scoped reversible acts settle only when fresh complete reads
show their witnesses (complete lists, and a toggled control's state) as the
build found them. If such an act is kept or named cannotUndo while still open,
Core refuses the next ordinary trial as candidate.trial_reset_unproved. It never measures leftovers
as a successful reset. Irreversible effects and legacy no-subject contracts
retain their existing semantics. Exact quantitative and saved-list inverse
operations remain unsupported by this creation witness and fail honestly.
