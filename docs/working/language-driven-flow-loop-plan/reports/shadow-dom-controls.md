# Worker report: shadow-DOM controls visible to the model and the runtime

Cause 1 of `lane-run-mulwm2dc-0bd95f22.md`: the job board's consent wall
(`rf-consent`, open shadow root) was invisible to the snapshot, the resolver
and the interference scans.

## Outcome

Done. The new spec passes (6/6), unit tests pass (939/939), and all 305
content specs outside `extraction/` have run in chunks. Every failure among
them is either the pre-existing recovery-note wording (7 rows) or a load
timeout that passes when run alone. Full-suite runs were cut off twice by
machine crashes and once by a session restart.

## What changed and why

**Shared traversal helper**: new `apps/extension/src/content/shadow-dom/`.
- `composed-tree.ts`: `composedParent`, `composedClosest`, `composedContains`,
  `shadowHostsOf`, `composedDocumentOrder` walk upward and across. They go from
  a shadow root's top to its host, and they give page order with a host before
  its root's content.
- `composed-roots.ts`: `composedRoots` (the document plus every nested open
  root, bounded at 500 roots and 50,000 elements), `composedDescendants` (a
  lazy generator that reads an element's own root first), `openRootsWithin`
  and `queryComposed` walk downward.
- `is-shadow-root.ts`: a node-type test, so the unit tests can use fakes.
- The point descent is the existing `selector/shadow` `deepElementFromPoint`;
  I reused it rather than copying it. Actionability's private copy
  (`topmostAt`/`isWithin`) is deleted in its favour.

**Closed shadow roots.** A closed root is never entered: `host.shadowRoot` is
`null`, so every walk skips it and nothing throws. The widget is described,
hit-tested and named as its host alone, which is how the browser already
presents it. In a refusal it reads "landed on closed-wall ... it is part of
closed-wall, a layer over the page with no control to press". The extension API
`chrome.dom.openOrClosedShadowRoot` could enter closed roots. I did not use it
(see Open questions).

**Snapshot** (`dom-snapshot.ts`)
- All four gathering passes (controls, text, media, the `*` sweep) run over
  `composedRoots(document)`.
- The hidden, aria-hidden and script/style/template exclusions use
  `composedClosest`, so a widget hidden at its host hides its content too.
- The front-layer bucket also asks the element's shadow hosts, because
  `rf-consent` is `position: fixed` and its buttons are not. The wall's buttons
  therefore rank with the page-state controls.
- The ranking tie-break uses `composedDocumentOrder`. Plain
  `compareDocumentPosition` calls two trees "disconnected".
- The descriptors need no new code: `describeElement` already wrote
  `context.shadowHosts` and a selector written within the root.

**Handle resolution** (`action-runtime/resolve-target.ts`)
- A model's handle reaches the page with no host chain. The domain's
  `plan-resolution/element-identity.ts` copies only tag, role, name, text,
  selector and inputType. So a handle to a shadow button would have missed in
  the document and failed `TARGET_NOT_FOUND`.
- `resolveTarget` is now one pass per scope (`resolveIn`). When a target with
  no host chain misses entirely in the document, a second pass runs over every
  open shadow root under the same exact strategies, veto, gate, ambiguity rule
  and family scoring.
- The document pass is unchanged, and a target with a host chain never widens.
- A miss after both passes reports both sets of misses.

**Actionability and covering checks** (`action-runtime/actionability.ts`)
- The hit test uses `deepElementFromPoint`, containment uses `composedContains`
  and inertness uses `composedClosest`.
- A `covered` refusal now names the layer and its controls through
  `interference/covering-layer.ts`. The layer is the declared dialog around the
  hit, or else its outermost fixed or sticky ancestor, found across shadow
  boundaries. A layer that contains the target is not named.
- Observed text on the job board: `covered: the point x,y landed on div.scrim,
  which covers the target; it is part of rf-consent headed "We value your
  privacy", a layer over the page whose controls are "Accept all", "Reject
  non-essential", "Manage choices"; the target can be reached once that layer
  is answered or closed`.
- Controls are the browser's pressable ones plus drawn ones (`isDrawnControl`),
  at most 5 names of at most 40 characters each. Form fields and sensitive
  controls are never listed.
- It only names; it never presses. It never throws: a read failure becomes a
  sentence.

**Interference scans** (`interference/overlays.ts`, `way-out.ts`)
- `coveringDialog` uses the point descent and `composedClosest`, and
  `outermostFixed` walks `composedParent`. The declared dialog inside an overlay
  is found with `composedDescendants`, bounded at 5,000 elements.
- `renderedModals` uses `queryComposed`. `firstDismissal` scans
  `composedDescendants`, with the same 400-element bound.
- **Policy is unchanged.** `vocabulary.ts` is untouched, so a consent wall
  offering only Accept, Reject and Manage still has no way out. The spec
  asserts that `consent` stays `pending` after the refused click and the
  defence's retries.

**Challenge guard** (`action-runtime/challenge-evidence.ts`)
- `challengeIn` now reads open shadow roots under the overlay, for selectors,
  dialog text (`innerText` does not cross a root) and headings.
- This was needed for safety. The way-out scan now reaches a close glyph
  inside a shadow root, so a robot check drawn in one must be seen first, or
  the defence would close it.

**The fixture's other widgets** (brief step 4)
- Chat panel (`rf-assistant`, open root): its input is described with host
  chain `["body > rf-assistant"]`, and a `web.dom.type` through its handle
  succeeds.
- A light-document control placed under the panel is refused as covered with
  "it is part of rf-assistant, a layer over the page whose controls are "–",
  "Send"". Both are drawn `<div>`s; the dash is the minimise control.
- Job-alert offer: this is light DOM, not shadow DOM. A click on the search box
  behind it still succeeds, because the runtime presses its own "No thanks",
  and the state shows `alertOfferDismissed: true, alertSubscriptions: []`.

**Tests**
- New `apps/extension/src/content/shadow-dom/tests/composed-tree.test.ts`
  (6 rows, hand-built tree including a closed root).
- New `apps/extension/e2e/content/tests/shadow-roots/tests/shadow-root-controls.spec.ts`
  (6 rows on job-board):
  - wall buttons in the snapshot with host chain and rank below 15;
  - the handle-shaped click on "Reject non-essential" succeeds, and the state
    is `consent: rejected`;
  - the search click is refused, names the wall's controls, and `consent`
    stays `pending`;
  - the closed-root wall is not entered, and the refusal names the host
    without throwing;
  - the chat panel row;
  - the job-alert offer row.
- Changed `shadow-root-targets.spec.ts`: the row "without the chain the same
  command finds nothing" asserted exactly the behaviour this change removes.
  It now asserts the chainless command presses Accept all and the state is
  `consent: accepted`. The ambiguous-twin and widget-gone rows are unchanged
  and still pass.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` (apps/extension): no errors in my files.
  The errors are all in `src/panel/simple/run-stop.ts` (workstream A) and
  `src/content/extraction/list-reader.ts` or the extraction specs (the other
  worker).
- `pnpm check` (extension): the same, and only those.
- `node scripts/test-extension.mjs` (label `shadow-dom-controls`), last run
  after the crash: `# tests 939 # pass 939 # fail 0`. An earlier run showed
  915/918 with 3 failures I did not capture. The next run was 918/918 while
  other workers were editing, so I cannot attribute those 3.
- `node scripts/structure-audit.mjs`: no FAIL in my files. The one FAIL is
  `docs/working/README.md` out of date (working docs, not mine). There are
  advisory warnings only on `resolve-target.ts` (697 lines; it was 664 and
  already above 400).
- `pnpm test:content -- e2e/content/tests/shadow-roots/tests/shadow-root-controls.spec.ts`:
  6 passed.
- `pnpm test:content -- shadow-roots/ dialog-refusal dialog-dismissal click
  actionability/ resolve-target` (67 tests): 65 passed, 2 failed.
  - `shadow-root-targets` "without the chain": expected, and since rewritten.
  - `shadow-root-waits` "a wait with no recorded host chain still looks only in
    the document": the only difference is that the recovery note was appended
    to `actual`. That note comes from committed `recovery/` code I did not
    touch.
- Full content suite, three attempts, all cut off by the machine. The first was
  an access violation at test 27 of 385. The second got to test 233 before the
  crash and the third to test 157 before the session restart.
  - Failures seen before the cutoff: 17 in `extraction/` (the other worker,
    mid-edit), and 3 where the recovery note is appended to `actual`
    (`actions.spec` wait_for_selector timeout, `check-assert` rows 169 and 194).
    The last three are the same pre-existing cause as the wait row above.
  - None of those failures is in a file or path I changed.
- **Chunked run, everything except `extraction/`** (after the restart):
  - Chunk A, `pnpm test:content -- actionability/ evidence/ exploration-state/
    selectors/ shadow-roots/ --workers=3`: 83 passed, 1 failed. The failure is
    `shadow-root-waits` :94, where the only difference is the recovery note.
  - Chunk B, `pnpm test:content -- <the 24 top-level *.spec.ts> --workers=3`:
    222 passed, 7 failed.
    - Six are the same recovery-note difference:
      - `actions.spec` :169;
      - `check-assert` :169 and :194;
      - `waits.spec` :50, :64 and :220.
      Each diff is exactly `; the execution did not recover within its N
      attempts after absorbing timeout...` appended to `actual`.
    - The seventh, `large-page-resolution` :94, timed out at 30 s with no
      assertion diff. Rerun alone with
      `pnpm test:content -- e2e/content/tests/large-page-resolution.spec.ts
      --workers=1`: 3 passed, that row in 6.1 s.
  - So all 305 non-extraction tests have run. Every failure is either the
    pre-existing recovery-note wording or a load timeout that passes when run
    alone.

## Not verified

- **A model's handle end to end.** The spec builds the command the way
  `webPlanElementIdentity` does. It does not run the domain's packet and
  handle store, and no live Lab run was made.
- **That the shadow-root-waits failure pre-dates my change.** I inferred it
  from the text (a recovery note from untouched code). I did not rerun it at
  HEAD.
- **Firefox.** Only the Chromium content harness ran.
- **The `extraction/` content specs.** Not run after the restart: they belong
  to the other worker's in-progress edits and were failing before my files were
  involved.
- **Whether my change slowed the large-page row.** I have no timing from before
  the change for `large-page-resolution` :94 (6.1 s alone). It rests on one
  observation.
- **Whether the recovery-note failures pre-date my change.** Inferred, not
  shown: the appended text comes from committed `recovery/` code I did not
  touch, and I did not rerun those rows at HEAD.

## Open questions or contradictions found

1. **The domain throws the refusal sentence away.**
   `domain/src/runtime/llm-evidence/action-failure/refusal.ts` passes the model
   only the code (`target_covered`) and never `failure.actual`, on purpose. So
   the new "whose controls are ..." sentence reaches Core's record and anyone
   debugging, not the model's packet.
   - The model does now see the wall's buttons as handles at the head of the
     failure snapshot, and it sees `blockedBy`.
   - To put the named controls in the refusal itself needs a domain change: for
     example, handles for the covering layer's controls in the rejection
     detail's `instead`. I cannot make it (domain is outside my ownership).
2. **The overlay evidence now reports false blockers.**
   `content/evidence/overlays.ts` is not in my ownership and I did not edit it.
   - Its `blockerAt` uses `document.elementFromPoint` and `Node.contains`.
     Neither crosses a shadow boundary. Now that shadow-DOM controls are
     snapshot candidates, each one inside a fixed widget is reported as
     blocked by its own host.
   - Effects: the consent wall's 3 buttons are counted as blocked by
     `rf-consent`, and the chat panel's controls as blocked by `rf-assistant`.
     That inflates `blockedBy.blocks`, and can create a `blockedBy` where
     nothing real is covered.
   - Fix, about 3 lines in `evidence/overlays.ts` `blockerAt`: take `hit` from
     `deepElementFromPoint` (`../selector`); replace `candidate.contains(hit) ||
     hit.contains(candidate)` with `composedContains(candidate, hit) ||
     composedContains(hit, candidate)` (`../shadow-dom`); and make
     `overlayRoot` walk `composedParent`.
   - I reasoned this out from the code and did not measure it.
   - `evidence/controls.ts` `isFrontLayer` and `evidence/dialogs.ts` also stop
     at the root. I worked around the first in `dom-snapshot.ts`. The second
     only misses dialogs declared inside a shadow root.
3. **The resolver widens but waits do not.** A wait with no host chain
   (`wait-conditions.ts`) still looks only in the document, while a click with
   no host chain now widens. A model's handle wait for a shadow button would
   therefore time out even though the click would land.
   - I left waits alone: a wait has no identity veto, so widening could let a
     widget's copy of a generic selector satisfy it, or never let `absent`
     hold.
   - The real fix is in the domain. Carrying `context.shadowHosts` through
     `WebPlanElementIdentity` would make both wait and click scoped exactly.
4. **Closed roots.** `chrome.dom.openOrClosedShadowRoot` would let the
   isolated-world content script enter closed roots. It is Chromium-only and
   the brief said closed roots cannot be entered, so I did not use it.
5. **The wait spec's comment is stale.** The wait row's comment says "exactly
   as the resolver decides it", which is no longer true of the resolver. I left
   it, because that row fails for the pre-existing reason in any case.
6. **Line endings.** My edits were first written with CRLF endings on Windows
   and have been converted back to LF.
