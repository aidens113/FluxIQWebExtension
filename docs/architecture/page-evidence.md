# Page Evidence

What a browser capture says about the page **as a whole**, rather than about
one element: the dialogs standing in front of it, what is painted over its
controls, whether it is still working, how it is laid out, what repeats on it,
its forms, and how it was navigated to. Current-state design, verified against
source on 2026-09-13.

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

`WebAutomationPageEvidence` has eight keys. Empty collections are omitted
rather than sent empty: a snapshot is taken on every action result, and a page
with no dialogs should cost nothing to say so.

| Item | Produced by | What it carries |
| --- | --- | --- |
| `elements` | `evidence/page.ts`, `changes.ts`, `interactions.ts` | `scanned`, `candidates`, `matched`, `returned`, `truncated`, `changed`, `recentlyInteracted` |
| `loading` | `evidence/loading.ts` | `document.readyState`, a `busy` verdict, `aria-busy` regions, progress bars and spinners, `pendingNavigation` |
| `navigation` | `evidence/navigation.ts` | url, origin, path, referrer, navigation type, redirects, history length, visibility |
| `dialogs` | `evidence/dialogs.ts` | open dialogs top-most first, whether any is modal, an unacknowledged `web.dom.dialog` arming, the last native dialog answered |
| `overlays` | `evidence/overlays.ts` | how many interactive candidates were hit-tested, how many were covered, and the blockers, most-blocking first |
| `regions` | `evidence/regions.ts` | landmark roles with labels, selectors and bounds |
| `repeating` | `evidence/repeating.ts` | runs of sibling elements from one template: container, signature, item count, a representative item and its field test ids |
| `forms` | `evidence/forms.ts` | forms with their controls: type, name, label, required, disabled, **whether** a value is present, the `autocomplete` tokens, and a `sensitive` marker |

Two flags are easy to misread and are worth stating plainly:

- `dialogs.armPending` is an arming written for `web.dom.dialog` and not yet
  taken by the page-world override. It is **not** "a native dialog is on
  screen": an unanswered `alert` blocks the page's script, so no snapshot
  leaves the page while one stands. A persistent `true` means the override is
  not installed.
- `elements.truncated` reports the **browser capture's** cap and no other. See
  the four caps below.

`forms` carries value *presence* and never a value. It carries the raw
`autocomplete` tokens deliberately, so a consumer can ask the shared
sensitivity rule itself rather than trusting the producer's `sensitive` flag:
both checks must fail before a value could escape.

## Across Frames

Evidence is gathered per frame, like the snapshot itself. On the recording
path the background worker collects one per frame and merges them into one tab
snapshot (`captureMergedTabSnapshot` in
[`background/connection/dom-snapshot.ts`](../../apps/extension/src/background/connection/dom-snapshot.ts),
reached from `recording-evidence.ts`). A frame that does not answer within
150 ms is left out rather than holding up an event.

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

The action path does not merge. An action runs in one frame — the top frame,
unless the command addresses a child frame, by its frame id or by the path of
its document, which survives a reload that renumbers frames (see
[child frames](web-capabilities.md#child-frames)) — and its result carries that
frame's own snapshot.

## The Four Caps

Four caps can cut evidence short on this path, each with its own remedy, and a
flag that says only `truncated` does not say which cap bit. The canonical
statement, with the remedy for each, is in
[`domain/src/recording/web-state/evidence/input.ts`](../../domain/src/recording/web-state/evidence/input.ts).
The rule: a bare `truncated` is legal only inside the structure whose own cap
set it, beside that structure's counts; anywhere a flag would summarise more
than one cap it is named for the cap instead.

| Cap | Flag | What is missing | Remedy |
| --- | --- | --- | --- |
| The browser capture's element cap | `captureTruncated` (`evidence.elements.truncated` at source) | Elements never left the page | Capture less of the page: one frame, one region |
| The state projection's element cap | `stateTruncated` | Eligible elements absent from `elements.*` | Raise the cap, or narrow what is recorded |
| A per-collection cap in the projection | that collection's own `truncated`, beside its `count` | Items of one collection | Read `count` for the true total |
| The sanitized packet's element bound and byte budget | `elementsTruncated`, `budgetTruncated` | Elements and page facts the model never saw | Re-ask with a larger budget, or narrow the page first |

`elements.truncated` in the state projection is the summary of the first two.

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
element's `repeats`, and a particular row's control is reached by narrowing the
page until it is listed.

A row control's selector is usually positional, so the domain's stable target
handles key on the record an element sits in as well as its selector
([`stable-handles.ts`](../../domain/src/runtime/llm-evidence/stable-handles.ts)).
The record stays in the binding beside the selector and never reaches the
packet; another post filtered into row one gets a handle of its own rather than
the previous post's.

## Who Reads It

- **The state projection**
  (`domain/src/recording/web-state/evidence/`) turns the evidence into
  `web` state paths — thirty `evidence.*` paths declared in
  `domain/src/recording/domain.ts`, from `evidence.elements.scanned` to
  `evidence.forms` — which is what Core stores and what a policy condition can
  read.
- **The sanitized LLM packet** (`domain/src/runtime/llm-evidence/`) exposes
  the same items compactly to a model, under its own byte budget: 6,000 bytes
  on the exploration path, Core's own failure-evidence gate on the failure
  path, and a 12,000-byte ceiling no caller can raise.
- **The host runtime boundary** (`domain/src/runtime/host-runtime.ts`) reuses
  the packet's sanitizer for the state snapshots Core stores on an attempt, so
  a state ref cannot carry more page data, or more sensitive page data, than
  the LLM packet may. It snapshots only nodes that act on a page: a web output
  node, or a recorded action, which Core runs as `builtin.policy.action` naming
  its web output in `parameterValues.outputId`. It computes a state diff only
  when both the before and after snapshots were captured.
