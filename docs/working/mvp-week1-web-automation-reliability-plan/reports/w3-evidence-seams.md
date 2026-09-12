# Report: w3-evidence-seams

Worker: `w3-evidence-seams`. Wave 3 follow-up: the three seams `w3-evidence`
left unowned — the top-frame-only merge, the duplicated landmark rule, and the
widened snapshot types living outside the protocol module.

## Outcome

**Done**, all three, with one file edited that the brief did not list (one
line, named below) and one stale comment left behind in a file I was told not
to touch.

Extension `check` passes, all 189 extension unit tests pass, and the 19
`evidence.spec.ts` rows pass twice. The structure audit is clean for every file
I touched: 1 violation and 27 warnings, exactly the numbers `w3-evidence`
recorded, and none of them names a file of mine.

The headline answer the brief asked for: **the merge is reachable and runs, but
nothing reads its output yet.** Detail in
[Is the merge reachable?](#is-the-merge-reachable).

## Task 1 — merging evidence across frames

`captureMergedTabSnapshot` built its result as
`{ ...topSnapshot, interactiveElements: mergedElements }`. The spread carried
the top frame's `evidence` at runtime while the element list spanned every
frame, so a merged snapshot described one document and counted another.

The merge is now item by item. What each item means when a page is made of
several documents is a different question per item, so here is the decision and
the reason for each.

| Item | Merged how | Why |
| --- | --- | --- |
| `elements.*` counts | **Summed**; `truncated` true if any frame truncated | These count the elements, and the element list spans every frame. Not summing them is the defect: `elements.returned` read low against the list beside it. |
| `dialogs.open` | **Concatenated**, top frame first | A dialog in a child frame is a dialog on the page. A reader deciding whether it may act has to see it. |
| `dialogs.modal` / `armPending` | **True if any frame says so** | A modal in a child frame still blocks that frame's controls, and a persistent `armPending` still means an override is missing. |
| `dialogs.lastNative` | **Most recent by `at`** | It is one page-level fact with a timestamp; the newest is the answer. |
| `overlays.tested` / `blockedCount` | **Summed** | Counts, like the element totals. |
| `overlays.blockers` | **Concatenated, most-blocking first** | Same statement from every document. Sorting by `blocks` keeps the per-frame ordering rule; the sort is stable, so equal blockers keep the order the frames answered in. |
| `regions`, `repeating`, `forms` | **Concatenated** | Each describes its own document, and a merged page has all of them. A child frame's checkout form is a form on the page. |
| `loading.busy`, `pendingNavigation`, `busyRegions`, `indicators` | **True if any / concatenated** | A page is still working if any of its documents is. This is the reading an automation needs before it decides to act. |
| `loading.documentState` | **Top frame's, kept deliberately** | It is `document.readyState`, which belongs to one document. There is no honest merge of two of them, and inventing a "least advanced" value would make the field no longer be what its name and doc comment say. A merged snapshot can therefore read `complete` and still be `busy: true` — which is the correct description of a page whose iframe is mid-load, and is pinned by a test. |
| `navigation` | **Top frame's, whole, kept deliberately** | A child frame's URL, origin, referrer and history length are not the page's. Reporting an embedded payment iframe's origin as the page's origin would be worse than reporting nothing, and the alternative — merging the fields — has no meaning at all. |

Two things the merge does beyond folding, both because the alternative is
actively misleading rather than merely incomplete:

- **Selectors from a child frame are qualified** `frame[<id>] >> <selector>`,
  the identical prefix `translateFrameElements` already puts on that frame's
  element selectors. A bare child-frame selector resolves against the wrong
  document or against nothing, and a reader cannot join it to the element list.
  Qualified: `dialogs.open[].selector`, `overlays.blockers[].selector` and
  `.blocked[]`, `regions[].selector`, `repeating[].containerSelector` and
  `.representative.selector`, `forms[].selector`, `.controls[].selector` and
  `.submit`, `loading.busyRegions[]` and `loading.indicators[].selector`.
- **Rects from a child frame are placed on the top frame's page**, by handing a
  bounds-only descriptor to `translateFrameElements` rather than repeating its
  arithmetic here. A child frame's dialog left at its frame-local rect would be
  drawn at the top of the page. Where the frame's viewport offset is unknown the
  translator leaves an element's rect alone, and it leaves these alone the same
  way, so evidence and elements are never in different coordinate systems. A
  rect that cannot be placed is dropped rather than carried through frame-local.

Two smaller judgements:

- **Merged collections are capped again** (dialogs 10, blockers 10, busy regions
  16, indicators 16, regions 40, repeating 12, forms 16 — about twice the
  per-frame cap). The per-frame modules cap themselves, but ten frames would
  otherwise put ten times the cap into a payload built on every recorded event.
  The numbers are declared in `dom-snapshot.ts` because it cannot import the
  content script's constants; that is a duplication of intent, and worth
  removing when one owner holds both directories.
- **When the top frame reports no evidence at all** (an older content script in
  the top document, a newer one in a frame), the non-mergeable items come from
  the first frame that did report, rather than the merged evidence being dropped
  or its required fields left empty. Pinned by a test.

### Is the merge reachable?

Asked because `action-runner.ts:210` sends `topFrameOnly: frameId === undefined`
for `capture_snapshot`. The answer has two halves, and the second is the one the
supervisor needs.

**The function runs.** `captureMergedTabSnapshot` has exactly one caller:
`background/connection/recording-evidence.ts:185`, inside
`captureDomSnapshotForEvidence`, which runs for every payload
`shouldRequireStateForEvidence` accepts — every executable recorded action,
`action.result`, `browser.navigation`, `dom.click`, `dom.input`, `dom.change`,
`dom.submit`, `dom.keydown`. It is seeded with the event's own frame, so a click
inside an iframe hits it directly. The action path (`runActionInFrame`) and the
on-demand `captureActiveSnapshot` never call it, so `topFrameOnly` does not
suppress it.

**Nothing reads the result yet.** The merged snapshot is used for one thing:
`createWebAutomationStateFromSnapshot`. That function
(`domain/src/recording/web-state/snapshot.ts`) reads only the fields
`WebAutomationDomSnapshotInput` names — url, title, viewport, selectedText,
focusedElement, interactiveElements — so `evidence` is dropped before the state
reaches the wire. Meanwhile the recording *event*
(`connection.ts:421` → `gateway-payloads.ts:61`, `snapshot: payload.snapshot`)
does put a whole snapshot with its evidence on the wire, but that is the content
script's own frame-local one, sent before the merge happens.

So: **correct, on a live path, and dormant.** It becomes live the moment either
of two things happens, neither of them mine:

1. the domain state projection carries `evidence` (`w3-state-identity` and
   `w3-llm-packet` own that ground, and `w3-llm-packet` was asked to make frame
   coverage match the state pipeline — this is that seam); or
2. `background/connection.ts` sends the recording event with the merged snapshot
   instead of the frame-local one. Today it sends the event at line 421 and
   *then* recovers the merged snapshot at line 422, so the better snapshot
   arrives one line too late.

I did not change either, because both files are outside my Owns, and the second
would change what goes on the wire for every recorded event.

## Task 2 — the duplicated landmark rule

**The two implementations were byte-identical**: the same eight-role set, the
same eight-tag map, the same `hasAuthoredName`, the same "explicit role replaces
the tag's own, landmark or not" comment. So collapsing them changed no
behaviour, and there was no latent difference to adopt or reject. That is worth
stating plainly because the brief asked me to check: this was duplication
waiting to diverge, not duplication that already had.

`landmarkRole` is now exported from `content/identity/context.ts` with a comment
saying why it is exported, `regions.ts` imports it from the identity barrel, and
`regions.ts` lost the rule, both tables and its `hasAuthoredName` (69 → 44
lines).

Both copies share one inaccuracy I did **not** fix, because fixing it would
change behaviour and is not what the brief asked for: ARIA says a `<header>` or
`<footer>` nested inside `<article>`, `<aside>`, `<main>`, `<nav>` or
`<section>` is not a landmark, and neither copy checked that. It is now one
rule, so it is a one-place fix whenever someone wants it.

## Task 3 — the widened types moved to the protocol

`DomElementDescriptor` and `DomSnapshot` were declared once in
`shared/protocol.ts` and then re-declared in `content/types.ts` as intersections
adding `changed`, `recentlyInteracted` and `evidence`. The widening now lives in
`shared/protocol.ts` on the base declarations themselves, and `content/types.ts`
is a pure re-export module again (77 → 48 lines).

A move, not a redesign: no field renamed, no shape changed, every consumer that
compiled before compiles now. The three added fields are optional exactly as
they were, so a value of the old protocol shape is still assignable.

One consequence worth naming: `shared/protocol.ts` now carries
`import type { PageEvidence } from "../content/evidence"` and re-exports the
fifteen evidence type names. That is a type-only import, so nothing from
`content/` reaches the background or panel bundles, and the structure audit
treats it as a directory import through the barrel. It does invert the usual
layering — `shared/` naming a type that `content/` owns — and the tidy end state
is for the evidence *type* declarations to live in `shared/` beside the snapshot
they hang off, with `content/evidence/` importing them. I did not do that
because `content/evidence/types.ts` is on my Must-not-touch list. It is a pure
type move whenever someone owns both.

The payoff is immediate for Task 1: `background/connection/dom-snapshot.ts`
reads the evidence shapes from the protocol it already imports, instead of
reaching into the content script or redeclaring them.

## The file I edited that the brief did not list

`apps/extension/src/content/identity/index.ts`, one line:

```
-export { elementContext } from "./context";
+export { elementContext, landmarkRole } from "./context";
```

Task 2 cannot be done without it. The structure audit's `imports` rule fails any
module that reaches past another directory's barrel into its files, so
`evidence/regions.ts` cannot import `../identity/context` directly; it has to go
through `../identity`, and the barrel is not in my Owns. Reporting instead of
editing would have left the task undone rather than left something inert, so I
made the change and am flagging it here. **The brief should have listed
`apps/extension/src/content/identity/index.ts`.** `w3-resolver` has filed its
report, so the collision risk on that barrel has passed; the edit is additive
and alphabetical either way.

## A stale comment I could not fix

`apps/extension/src/content/evidence/types.ts` is on my Must-not-touch list, and
its `PageEvidence` doc comment now describes behaviour that no longer exists:

> Per frame, like the snapshot itself. On the recording path the background
> worker merges every frame's `interactiveElements` into the top frame's
> snapshot (`background/connection/dom-snapshot.ts captureMergedTabSnapshot`)
> and keeps the top frame's other fields, so a merged snapshot's `evidence`
> describes the top frame while its element list spans all of them, and
> `elements.returned` will read low against it. The action path is top-frame
> only unless a frame is addressed, where the two agree.

Everything from "and keeps the top frame's other fields" onward is now false.
Whoever owns that file next should replace it with something like: *the merge
folds the additive items across every frame, qualifies a child frame's selectors
and places its rects on the top frame's page, and keeps the top frame's
`navigation` and `loading.documentState` because those describe one document.*

## Tests added

- `apps/extension/src/background/connection/tests/dom-snapshot.test.ts`, 10
  tests driving the real `captureMergedTabSnapshot` through a fake transport,
  not a merge helper in isolation. They pin: a child frame's dialogs, overlays,
  regions and forms surviving the merge; every selector qualified by frame and
  matching the element prefix; a rect translated through the frame offset *and*
  the top frame's scroll; the totals matching the merged element list; `busy`
  and `pendingNavigation` folding while `documentState` stays the top
  document's; `navigation` staying the top frame's; a single-frame page merging
  to exactly what it reported (deep-equal, so the merge cannot quietly reshape
  an ordinary page); the no-top-evidence fallback; and a snapshot with no
  evidence gaining none.
- `apps/extension/src/content/tests/landmark-role.test.ts`, 4 tests over 14
  element fixtures covering every branch of the rule (the six implied roles, the
  two tags needing an authored name, `aria-label`/`aria-labelledby`/`title` as
  names, an explicit landmark role on a `<div>`, an explicit role replacing a
  tag's own, and an explicit non-landmark role). It puts the same elements to
  **both** call sites — `elementContext(...).landmark` and `regionEvidence()` —
  and asserts they answer identically, which is the agreement the collapse is
  supposed to guarantee. It sits in `content/tests/` because the two subjects
  are in sibling directories and that is the nearest directory holding both. The
  DOM is a minimal stub because the extension unit runner is Node; the browser
  side is covered by `evidence.spec.ts`'s `product-catalog: landmarks and
  regions` row, which still passes.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-evidence-seams` was set for every extension
command. Exit status was captured by redirecting to a file and echoing `$?`,
never through a pipe. No `pnpm build`, no `pnpm lab`, no
`pnpm structure:baseline`.

- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**.
  `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics.
  (An earlier run was exit 2 on one generic-return error in my own new helper;
  fixed, then clean.)
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**,
  `# tests 189 / # pass 189 / # fail 0`. My 14 new tests are among them. Note
  for the supervisor: the 3 unit failures `w3-evidence` reported are gone —
  this suite is green on the current tree.
- `pnpm --filter @fluxiq-web-extension/extension test:content -- evidence.spec.ts`
  → **exit 0**, `19 passed (4.4s)`. Re-run later: **exit 0**, `19 passed (8.3s)`.
- `pnpm --filter @fluxiq-web-extension/extension test:content` (whole suite) →
  **exit 1**, `23 failed / 159 passed (1.2m)`. **None is mine.** 22 are the
  foreign failures the brief described, in files three other briefs changed:
  `check-assert` ×7, `click` ×3, `keyboard` ×4, `select` ×3, `upload-dialog` ×2
  all expect codes like `web.action.not_checkable` and
  `web.action.unsupported_key` where the tree now emits `web.action.rejected`
  (`w3-failure-producers`); `resolve-target` ×3 (`w3-resolver`). The 23rd,
  `evidence.spec.ts › infinite-feed: repeating structures`, is not an assertion
  failure — it is `Tearing down "openHarness" exceeded the test timeout` plus
  two `ENOENT` errors on Playwright's own trace artifacts, i.e. the harness
  losing its tracing directory under six-worker load. Re-run on its own, twice:
  green both times. I read the failure text rather than inferring it.
- Structure audit, `node scripts/structure-audit.mjs` with a scratch
  `GIT_INDEX_FILE` (a copy of `.git/index` plus `git add -N` of
  `content/evidence/`, `content/tests/` and
  `background/connection/tests/dom-snapshot.test.ts`; the real index was never
  written, confirmed with `git status`) → **exit 1**, one violation:
  `FAIL [working-docs] docs/working/README.md is out of date with the
  documents' header blocks`. Pre-existing, not mine, and the same finding
  `w3-evidence` recorded — both `docs/working/README.md` and the plan document
  are already modified in the tree. **No finding and no warning names any file
  I created or changed**, and the warning count is 27, the same number
  `w3-evidence` observed. As that report warned, `content/evidence/` must be
  staged before `pnpm check` or the audit flags an untracked-directory import.

## Not verified

- **No live browser validation across extension contexts.** The merge is
  background-worker code, and nothing here loaded an unpacked extension. The
  merged snapshot has never been observed on a real page with a real iframe: my
  10 tests drive the real function, but through a fake transport with
  hand-written frame snapshots. The rect translation in particular is proven
  against my arithmetic, not against a browser.
- **The dormancy finding is read from the code, not observed.** I traced
  `captureMergedTabSnapshot` → `createWebAutomationStateFromSnapshot` and read
  that function's field list; I did not run a recording and inspect what reached
  Core.
- **No `pnpm build`, no root `pnpm check`, no domain, test-runner or Lab
  command.** All the supervisor's.
- **`e2e/content/tests/evidence.spec.ts` has a cast that is now unnecessary.**
  `w3-evidence` cast the harness's `capture()` result because the protocol shape
  lacked `evidence`; it no longer does. Harmless, still compiles, and the spec
  is not in my Owns, so I left it.
- **The 22 foreign harness failures are attributed, not bisected.** I read the
  diffs in the failure output and matched them to the briefs; I did not revert
  anyone's work to prove a green baseline.
- **Per-capture and per-event cost was not measured.** The merge adds work to
  every recorded event on a multi-frame page. It is bounded by the caps above
  and does one rect translation per bounded evidence item, but I did not time it.

## Open questions or contradictions found

- **Who is supposed to read the merged evidence?** This is the important one.
  The merge is correct and nothing consumes it: the state projection ignores
  `evidence`, and the recording event that does carry evidence is sent one line
  before the merged snapshot exists. Two candidate fixes are in
  [Is the merge reachable?](#is-the-merge-reachable); both are outside my Owns
  and one of them changes the wire. The supervisor should decide which, and
  whether it belongs to `w3-llm-packet`'s "make frame coverage match the state
  pipeline" or to a new brief.
- **`elements.returned` on a merged snapshot now sums the frames that reported
  evidence, which is not necessarily the frames that contributed elements.** The
  two coincide unless a frame runs a content script old enough to send elements
  but no evidence. I chose summing over `interactiveElements.length` so that
  every total is derived the same way and `returned <= matched` cannot break; a
  reader wanting the length of the array they hold should read the array.
- **The merged caps duplicate the per-frame caps' intent in a second file.**
  Same failure mode as the landmark rule, one level up: lower `MAX_REGIONS` in
  `content/evidence/regions.ts` and nothing lowers the merged budget. A shared
  constants module under `content/evidence/` that the background may import
  would fix it; both files would have to be owned together.
- **Cross-frame stacking order is not knowable, and `dialogs.open` claims to be
  top-most first.** Within one document the content script's ordering holds and
  I preserve it, with the top frame's dialogs first. Across documents there is
  no answer — an iframe's modal may be painted over by a top-frame overlay and
  nothing in either snapshot says so. The same limit applies to `overlays`: the
  hit-test runs inside a frame, so a top-frame banner covering an iframe is
  invisible to both. Worth a line in whatever documents `PageEvidence`, and it
  is a genuine gap rather than a bug in the merge.
