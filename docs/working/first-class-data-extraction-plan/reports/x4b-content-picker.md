# X4.2 — Content-script element picker

## Outcome

Done. The picker is built, the `data.extract` recorded event exists end to end
on the page side, and the two claims the execution report had only reasoned
about are now proven by tests that fail when the code is mutated. The extra
task (folding the duplicated confirm payload into `shared/extraction-messages.ts`,
and settling the preview re-read comment) is done as well.

One caveat on validation: `pnpm --filter @fluxiq-web-extension/extension check`
is red at hand-off, and not from this work — see "Commands run".

## What changed and why

### New: `apps/extension/src/content/picker/`

- **`overlay.ts`** — the shadow-root host marked `data-fluxiq-picker`, with
  `pointer-events: none`, holding the highlight box and a caption ("8 items").
  Styles are set through the CSSOM rather than an inline `style` attribute or a
  `<style>` element, and nothing uses `innerHTML`: a page with a `style-src`
  policy blocks the first two, and a page requiring Trusted Types makes the
  third throw. The caption is the picker's own words, never text read off the
  page.
- **`session.ts`** — `startPick(sessionId, form)` / `stopPick()`. Capture
  listeners on `window` for `pointerdown`, `mousedown`, `pointerup`, `mouseup`,
  `click`, `auxclick` and `contextmenu`, each calling `preventDefault()` and
  `stopImmediatePropagation()`. `pointermove` moves the highlight; `keydown`
  Escape cancels and is swallowed the same way, so the key that cancelled a pick
  is not recorded either.
  - **The pick is taken on `pointerdown`, but the listeners stay up until the
    press finishes.** This is the one design decision the execution report did
    not cover and it is load-bearing: a browser sends up to seven events for one
    press, so tearing down on the press would let its own `mouseup` and `click`
    through to the recorder — exactly the bug the arrangement exists to prevent.
    After the pick the session enters a `draining` phase, swallowing the rest,
    and ends at `click` or `auxclick`. A 10-second timer, restarted by every
    swallowed event, is the backstop, so a press that never completes cannot
    leave a page that cannot be clicked.
  - A list pick sends the proposal from `inferListFromElement`; a value pick
    sends `{ selector, tagName, testId? }`, which is where the element is and
    nothing it says (D3); a pick that proposes nothing sends `refused` from the
    existing `ExtractionProposeRefusal` vocabulary.
- **`preview.ts`** — `readPreviewRows(request, limit)`, bounded by
  `min(20, limit, request.maxItems)`. It rebuilds the request as
  `{ item, fields, maxItems, minItems: 0 }`, deliberately **dropping
  `paginate`**: a preview must not move the page the user is about to confirm
  against.
- **`recorded-event.ts`** — `recordExtraction(definition)`, returning
  `recorded` / `not_recording` / `invalid_definition`. It emits
  `emit("data.extract", { extraction })` and **attaches no element descriptor**,
  although the execution report's sketch allowed one: a descriptor carries the
  element's text, and the element a list extraction is defined on is the list,
  so its text is the records. The definition already names where to read.
- **`messages.ts`** — `extractionContentMessage(message)` reads and validates a
  message, `handleExtractionMessage(message, sendResponse)` does it and answers
  `{ ok: true }` (with `rows` for a preview) or `{ ok: false, refused }`. The
  split is what lets `message-handler.ts` apply the top-frame rule without
  knowing anything about picking.
- **`index.ts`** — barrel, exporting only those two.

### New: `apps/extension/src/content/picker-host.ts`

One leaf module holding `PICKER_HOST_ATTRIBUTE` and `isPickerHostNode(node)`.
**This file is outside the brief's stated ownership list and is the one
structural judgement worth review.** The recorder must skip mutations the
overlay made, and the structure audit's `imports` rule requires a consumer to
enter another directory through its barrel — so `recorder.ts` importing
`picker/overlay.ts` fails the audit, and importing `picker/` (the barrel) pulls
in `session.ts`, which imports `recorder.ts`, forming a module cycle. A leaf
both can reach costs one file and removes the question. It collides with no
other worker (new file, in a directory this brief owns work in).

`isPickerHostNode` walks `parentNode` and asks each ancestor by duck type rather
than `instanceof Element`, because `recorder.ts` is unit-tested in Node against a
stub page where no `Element` global exists.

### Changed

- **`shared/protocol.ts`** — the kind `"data.extract"`, and
  `RecordingEventPayload.extraction?: WebAutomationRecordedExtraction`.
- **`shared/extraction-messages.ts`** — payload types beside the existing name
  constants (`ExtractionPickForm`, `ExtractionPickedElement`,
  `ExtractionPreviewRow`, `ExtractionContentMessage`, `ExtractionContentRefusal`,
  `ExtractionContentResponse`, `ExtractionPickedMessage`), then the folded
  confirm payload (below). The name constants were not renamed or restructured.
  The audit's `exported-values` rule counts *values*, not types, so the file's
  count against the 15 budget is still the three name constants.
- **`content/message-handler.ts`** — routes the four `extraction.*` messages to
  `content/picker`, top frame only. A child frame that receives one stays
  silent, which the worker already reads as the page refusing.
- **`content/recorder.ts`** — `data.extract` joins `EXECUTABLE_KINDS` (so it
  flushes the pending mutation batch); `tallyMutations` skips a record whose
  target is inside the overlay and does not count the overlay host as an added
  or removed node; `basePayload` copies `extraction`.
- **`content/snapshots.ts`** — `data.extract` attaches a state snapshot, as the
  execution report specifies. Note the consequence, stated plainly: with
  `captureSnapshots` on, that snapshot holds page text like every other
  executable event's. D3 governs *extracted values*, and the definition itself
  carries none; the e2e row that proves "no product name in the payload" runs
  with snapshots off and also asserts the definition separately.
- **`content/actions/extract.ts`** — reads the command's structured
  `action.extract` (contract C3) and falls back to `action.options` for
  recordings made before it. It copies the read field by field into the bag the
  reader takes, rather than changing `extractElement`'s signature, because that
  signature is declared in `content/actions/types.ts`
  (`ContentActionDependencies`), which this brief does not own. Typing the
  dependency properly is a one-line follow-up in that file.
- **`content/action-runtime/extract.ts`** — header only: it now documents that
  the caller resolves the structured read. D2's refusal is untouched.
- **`content/tests/recorder.test.ts`** — the executable-kind row includes
  `data.extract`; the mutation stubs became real node lists with a `target`, so
  the tally can be exercised; two new rows (the overlay is not counted, and a
  `data.extract` carries its definition).
- **New `e2e/content/tests/extraction/tests/extraction-picker.spec.ts`** — three
  tests, placed two levels below `e2e/content/tests/` for the reason
  `inference.spec.ts` sets out.

### Extra task: one confirm payload, not two

`ExtractionConfirmField` and `ExtractionConfirmRequest` now live in
`shared/extraction-messages.ts`. `popup/extraction/messages.ts` and
`background/extraction/definition.ts` each deleted their copy and re-export the
shared declarations, so every existing importer on both sides keeps its local
import and nothing else in either directory changed. The panel's shape is what
was kept, with exactly two widenings, both of which change nothing the panel
sends:

1. `handling` keeps the domain's full vocabulary rather than the panel's
   `include | exclude`. The worker builds one of these from a *proposal* too
   (`proposedColumns`), and inference may already have marked a field `encrypt`;
   narrowing here would have made the worker's own file fail to compile. D13's
   restriction stays where it is enforced — the draft row in
   `popup/extraction/view-model.ts` — so the panel still offers only two
   choices.
2. `maxItems?` is present, because the worker reads it for the Testing Lab's
   seam. The panel sends none.

`popup/extraction/messages.ts` also dropped its `ExtractionPreviewRow`, which
was an exact duplicate of the one added here, and re-exports it.

The shared file documents the envelope both halves must honour: the payload
travels under `request` on the confirm message, with the worker also accepting
the fields flat for an older caller (`confirmRequestOf` in `control.ts`).

### Extra task: the preview re-read

**Chosen: correct the comment, not add the message — and no message was needed
to make a re-read possible anyway.**

What actually happens: the panel sends no `columns` with
`fluxiq.getExtractionSession`, so `refreshPreview` reads the rows once, under the
columns the *proposal* named. Those already leave out every field inference
marked sensitive, so a sensitive column is never read at all (D12's main case).
A column the user *then* excludes in the panel was already in those rows: the
panel stops showing it, drops it from the payload it confirms, and the recorded
request never names it — so no value of it is stored, exported, recorded, or
read again when the extraction runs. Nothing is persisted either way.

Adding a fifth runtime message would have been the wrong fix: the worker's
`getSession` **already accepts `columns`** and `columnsKey` already re-reads
rather than filters when they change. What is missing is one line in the panel,
sending the columns it is showing — which is in a file this brief may not touch.
So the lying comment in `background/extraction/session-store.ts` (the
`previewKey` doc) now describes the mechanism as built and names the one-line
change that would turn the re-read on. `control.ts`'s own comment had already
been corrected by the background worker and needed nothing.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/extension check` — **passed** when run
  after every content, protocol and test change (output: the two `tsc`
  invocations and nothing else). Re-run after the confirm-payload fold it is
  **red**, with exactly two errors, both in a file this brief does not touch and
  which another worker is editing right now (unstaged in `git status`):

  ```
  ../../domain/src/runtime/llm-evidence/target-override.ts(87,36): error TS2339: Property 'handles' does not exist on type 'AutomationStudioRuntimeTargetOverrideTarget'.
  ../../domain/src/runtime/llm-evidence/target-override.ts(157,3): error TS2322: Type 'WebResolvedRepairTarget' is not assignable to type 'AutomationStudioRuntimeTargetOverrideTarget'.
  ```

  `tsc` reports every error in the program, and no error names any file in this
  change. The supervisor should re-run once the llm-evidence work lands.
- `node scripts/test-extension.mjs` (extension unit tests) — `# pass 621`,
  `# fail 0`. The new rows ran: `ok 458 - the picker's overlay is not a page
  change: its host, and what it holds, are not counted`, `ok 459 - a data.extract
  carries the definition it was given`, and `ok 454` for the executable-kinds row
  that now includes `data.extract`.
- `pnpm test:content -- extraction-picker --workers=2` (against
  `e2e/playwright.content.config.ts`) — **3 tests ran, 3 passed** (2.9 s):
  1. a picked product proposes the eight cards, and the pick is neither recorded
     nor acted on;
  2. Escape ends the pick, and the key that ended it is not recorded either;
  3. a preview reads at most the limit, goes to the panel only, and is never
     recorded.
- **Mutation tests, to prove the two rows are load-bearing rather than
  vacuous** (both files restored afterwards and the suite re-run green):
  - registering the pick listeners on `document` instead of `window` →
    test 1 fails at `expect(await harness.recordedEvents("dom.click")).toEqual([])`
    with `Received + 113` lines containing two `"kind": "dom.click"` events. This
    is the empirical proof the execution report wanted: window capture runs
    before the recorder's `document` capture listeners, and on `document` the
    recorder wins because it registered first.
  - removing the overlay filter from `tallyMutations` → test 1 fails at
    `expect(await harness.recordedEvents("dom.mutation")).toEqual([])` with
    `Received + 15` lines containing `"kind": "dom.mutation"`.
  - `preventDefault` needs no separate mutation: test 2 shows the same click
    navigating away once the picker is gone, which is what test 1 asserts does
    **not** happen while it is up.
- `node scripts/structure-audit.mjs`, with every new file staged first
  (`git add` of `content/picker`, `content/picker-host.ts` and the new spec) —
  `structure-audit: 1 violation(s) across 1 rule(s)`, and the violation is
  `FAIL [working-docs] docs/working/README.md is out of date with the documents'
  header blocks`, caused by other workers' working-document changes. Filtering
  the full output for `picker`, `extraction-messages` and `FAIL` returns only
  that one line: no file-lines, exported-values, imports, naming,
  directory-files or test-placement finding names anything in this change. The
  report file below is deliberately left unstaged so it cannot add a second
  working-docs finding.

## Not verified

- **No browser-level manual validation.** The picker has never been driven in an
  unpacked Chrome or Firefox build: no side panel, no popup, no real pick. The
  content harness runs the content script in the page's main world with a
  `chrome.runtime` stub, so nothing here proves delivery between extension
  contexts, the top-frame-only rule against a real child frame, or the Firefox
  popup-closes-on-click flow. X4.4's manual validation list still stands whole.
- **The `value` form is untested and cannot currently complete.** `startPick(…,
  "value")` works and sends `element`, but `acceptPick` in
  `background/extraction/control.ts` fills a session only from `proposal` or
  `refused`, so a value pick answers `no_session`. Whether that is the worker's
  gap or a deliberate deferral is open (below).
- **The drain backstop timer** (a press that never reaches its `click`) is not
  covered by a test; only the ordinary press-to-click path is.
- **Right-button and middle-button presses** are swallowed by construction
  (`auxclick`, `contextmenu`) but only the primary button is exercised.
- The extension `check` result for the final state of the tree — see above.
- `pnpm check`, `pnpm test` and `pnpm build` at repository scope were not run;
  the brief named three commands and those are what ran.

## Open questions or contradictions found

1. **A value pick has nowhere to land.** The content script sends
   `{ sessionId, element }` for `form: "value"`, as the execution report's
   "`proposal | element`" line says, but the worker ignores `element`. Either
   the worker grows that branch or the value form should be closed off in the
   panel until it does.
2. **`webAutomationRecordedExtraction` is not reachable from the content
   script.** `domain/src/actions/types.ts` re-exports the recorded-extraction
   *types* but only two constants as values, so `domain/client` does not export
   the reader. The picker therefore checks the definition's shape locally rather
   than rebuilding it field by field. The real gate still runs later
   (`io/input-model.ts` calls the reader when the recording is mapped), so
   nothing leaks — but if we want the page to refuse what the domain would
   refuse, the domain barrel needs that export.
3. **Escape tells the worker nothing.** The frame takes its overlay down and
   forgets the session; the worker's session stays `picking` until the panel
   cancels or the tab navigates. The refusal vocabulary has no word for
   "cancelled from the page" and I did not invent one. If the panel should
   return to its start state on Escape, that needs either a new refusal word or
   a `pickCancel` sent the other way.
4. **`content/actions/types.ts` still types the extract read as `JsonObject`.**
   The verb resolves `action.extract` and converts; the dependency itself could
   take `WebAutomationExtractRead` directly once someone owns that file.
5. **The confirm payload's two halves still disagree in one place that types
   cannot catch:** `control.ts` reads the payload with a cast
   (`message as unknown as ExtractionConfirmRequest`) behind
   `confirmRequestOf`, so a panel that stopped nesting under `request` would
   compile and fail at runtime. One shared declaration removes the drift in the
   *shape*; only a test of the envelope removes the drift in *where it sits*.
