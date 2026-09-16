# x4c-background-control: X4.3, the picker's worker half

## Outcome

Done. X4.3 is complete and wired: `background/extraction/` holds the session
state machine, the definition builder and the confirm path; `background/index.ts`
routes the messages and clears a session when its tab closes or navigates;
`background/connection/gateway-payloads.ts` carries the recorded extraction to
the domain and projects counts for the activity log. X5.3's
`fluxiq.test.defineExtraction` seam is built and its origin refusal is tested
explicitly.

Three checks were run and observed: the extension check passes; the extension's
unit tests pass with 0 failures, including 22 new rows of mine (19 in
`extraction-control.test.ts`, 3 appended to `gateway-payloads.test.ts`); and
`node scripts/structure-audit.mjs` passes with my work staged.

Not exercised in a browser. Everything below rests on unit tests with a fake
page and a fake action runner.

## What I inherited, and what I wrote

**Inherited, kept, extended.** `apps/extension/src/background/extraction/session-store.ts`
(116 lines) was on disk, untracked, from the worker the machine crash killed. I
read it first. It is coherent and complete for what it claims: a memory-only
`Map` of sessions keyed by session id, at most one per tab, with `picking` /
`picked` / `recorded` states, a 20-row preview bound, a `previewKey` naming the
columns the rows were read under, and a `picked()` that refuses a proposal
arriving from a tab that is not the session's. Nothing in it touches
`chrome.storage`. I found no defect in it and changed nothing it already did.

I added three things to it:

- `refused`, the frame's own refusal word for a click it could propose nothing
  for, plus a `refuse()` transition that keeps the session open and `picking`
  (the overlay is still up and the next click is still the pick). The panel's
  `ExtractionSessionView` already has a `refused` field, which nothing was
  filling.
- `ExtractionPreviewRow` is now re-exported from `shared/extraction-messages.ts`
  rather than declared a second time, and `ExtractionSessionForm` is the shared
  `ExtractionPickForm`. Those landed in the shared file while I was working.

**Written by me.** Everything else:

| File | What it is |
| --- | --- |
| `background/extraction/control.ts` | The message router: `start`, the pick from a frame, `getSession`, `confirm`, `cancel`, and X5.3's test seam. Holds the control-page origin check and the refusal vocabulary. |
| `background/extraction/definition.ts` | Builds the recorded definition from the held proposal and the panel's columns, builds the preview request, and validates through the domain. |
| `background/extraction/confirm.ts` | The one confirm path both the user's Confirm and the Lab's test message run: record, then read. |
| `background/extraction/deps.ts` | The four browser seams and the single module-level `ExtractionSessions`, injectable so the whole flow is testable with no `chrome`. |
| `background/extraction/index.ts` | Barrel. |
| `background/index.ts` | Two lines of routing after the scripted-navigation check, and `clearExtractionTab` on tab removal and top-frame navigation. |
| `background/connection/gateway-payloads.ts` | Carries `extraction` into `recordedInputId` and the gateway event; projects `{ form, fieldCount, itemCount }` for the evidence payload. |
| `background/tests/extraction-control.test.ts` | 19 tests. New. |
| `background/connection/tests/gateway-payloads.test.ts` | 3 tests appended. |

## How it works, and the decisions inside it

**The origin check is the whole security story, and it is tested.** Every name
in `EXTRACTION_RUNTIME_MESSAGES` — `start`, `confirm`, `cancel`, `getSession`
and `fluxiq.test.defineExtraction` — is accepted only from an exact
`sidepanel/index.html` or `popup/index.html` URL belonging to this extension id,
the same predicate `scripted-navigation-control.ts` uses. The test loops all
five names across four senders: a page under test, another extension, a
different extension page, and a sender with no URL. All twenty combinations
refuse, and the test also asserts that no message reached the page and no action
ran. `fluxiq.test.defineExtraction` gets its own test as well, because it is the
one that would hand a page under test FluxIQ's own reader and the records back.

The pick message is the one message that legitimately comes from a content
script, so it is checked differently and no less strictly: `sender.frameId` must
be 0 and the session's tab must be `sender.tab.id`. A pick from another tab and
a pick from a child frame both leave the session untouched and still `picking`.

**The confirm path records first, then reads.** The recorded `data.extract` is
what a Flow is later built from and must land whether or not the read succeeds —
a list that came up short of its minimum is a failed read of an extraction the
user really did define. A test asserts the order and that a failed read still
sent the record message.

**The definition is built from the proposal the worker holds.** The item
selector is always the held proposal's; the panel's columns supply the key, the
label, what the column reads, and Include or Exclude. A repeated key refuses the
whole confirm rather than silently recording one column fewer (the fields are an
object, so the second entry would overwrite the first). The finished definition
goes through `webAutomationRecordedAction`, which is the function that decides
whether the recorded event becomes an executable `web.dom.extract_list` node —
so the read the worker runs now and the read a replayed Flow runs later are the
same request, rebuilt by the same code. A definition the domain refuses is
never recorded and never run.

**D12.** An excluded column is recorded as `handling: "exclude"` — that is what
keeps the exclusion durable so detection does not propose the column again and
Core's record schema can carry it — and it is *absent from the preview request
entirely*, so the page never reads it. The preview is re-read rather than
filtered when a caller names a different set of columns. Tests assert: the
sensitive column the proposal pre-excluded is never named in the preview read;
excluding a column and re-reading removes its values from what the background
holds rather than hiding them; and the recorded definition contains no cell the
fake page returned (a planted sentinel, asserted absent from the serialized
definition).

**Nothing durable.** A test drives a whole pick, preview and confirm against a
`chrome.storage` spy and asserts zero writes. The test seam's reply carries the
records, and a test asserts no session exists afterwards to hold them. The
evidence payload gets three counts and no selector, label or row.

## Commands run and observed results

1. `pnpm --filter @fluxiq-web-extension/extension check`

   ```
   > @fluxiq-web-extension/extension@0.1.0 check F:\!FluxIQWebExtension\apps\extension
   > tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json
   ```

   No diagnostics, exit 0.

2. `EXTENSION_TEST_BUILD_LABEL=x4c-background-control node scripts/test-extension.mjs`
   (in `apps/extension`; the label keeps the bundle directory off other workers')

   ```
   1..619
   # tests 619
   # pass 619
   # fail 0
   ```

   My rows, by name and by number in that run:

   - 119 a recorded extraction maps to the data-extraction input and crosses carrying its definition
   - 120 a definition the domain refuses stays evidence, and carries nothing
   - 121 the evidence payload is told three counts, and no selector, label or sample row
   - 222 every runtime message, the test seam included, is refused outside the two control pages
   - 223 a page under test cannot run an extraction through the test seam
   - 224 an unrecognised message is not handled here
   - 225 start puts the overlay in frame 0 of the automation tab
   - 226 start with no automation tab opens no session
   - 227 a pick from another tab, or from a child frame, fills no session
   - 228 a pick the page could propose nothing for keeps the session and says why
   - 229 the panel is served the proposal and a preview that never names a pre-excluded column
   - 230 naming different columns re-reads the preview rather than filtering the rows already read
   - 231 confirm records well-formed keys, runs the read, and puts no page value in the recording
   - 232 a confirm that names no columns records the proposal's own, with its pre-selected exclusion
   - 233 a confirm that repeats a key records nothing, rather than one column fewer
   - 234 the recording is written before the read runs, so a failed read still leaves the definition
   - 235 confirm outside a recording is refused, and nothing reaches the page
   - 236 cancel takes the overlay down and forgets the session; cancelling nothing is not an error
   - 237 closing or navigating the tab clears its session
   - 238 a whole pick, preview and confirm writes nothing to chrome.storage
   - 239 the test seam answers the control page with the records and stores none of them
   - 240 the test seam refuses a definition the domain would refuse, before anything runs

   Two failures occurred during development and were fixed, both in the test's
   own fixtures rather than in the code under test: an `assert.deepEqual(x, [])`
   narrowing an array to `never[]` for later lines, and a `harness()` default
   parameter firing when `undefined` was passed explicitly.

3. `node scripts/structure-audit.mjs`, with my work staged first

   ```
   structure-audit: passed (55 warning(s), 17 baselined).
   ```

   One warning names a file of mine:

   ```
   warn [file-lines] apps/extension/src/background/tests/extraction-control.test.ts: 493 lines is past the 400-line advisory threshold.
   ```

   Left as it is. It is the advisory threshold, not the 800-line limit, and it
   is one test file covering one module; splitting it would duplicate the fake
   page, the fake runner and the `chrome` stub across two files. Eleven other
   test files in the repository are already above it. Flagging rather than
   deciding: the supervisor may prefer the origin/security rows in a file of
   their own.

   Two `[working-docs]` failures appeared on an earlier run of this command —
   a ledger entry in `mvp-week2-automation-loop-plan.md` without a validation
   result, and `docs/working/README.md` being out of date. Neither names a file
   I touched (`git diff HEAD --stat -- docs/` is empty for me), and both were
   gone by the final run, so someone else fixed them while I worked.

   Source files: `control.ts` 299, `definition.ts` 228, `confirm.ts` 121,
   `deps.ts` 43, `session-store.ts` 132, `index.ts` 18.

## Not verified

- **No browser.** Nothing here has run in Chrome or Firefox. The four content
  messages, the overlay, the real `runBrowserActionCommand` against a real page,
  the Firefox popup being torn down mid-pick and rebuilt from the session — all
  unexercised. X4.4's manual validation list is the place that closes it.
- **The real action runner.** `runAction` is injected and stubbed in every test.
  The wiring to `runBrowserActionCommand` compiles and is one line, but nothing
  proves the command I build is one the page accepts.
- **`pnpm build` was not run.** `apps/extension/build/` was already modified in
  the working tree by someone else's build and I did not want to overwrite a
  tracked artefact another worker may be mid-way through. `background/index.ts`
  changed, so the built bundle is stale until someone runs it.
- **The whole-repository `pnpm check` and `pnpm test`** were not run; only the
  extension package's. Other workers were editing `content/`, `popup/`,
  `sidepanel/` and `shared/` throughout.
- **The content script's side of the four messages** does not exist in a form I
  could call. I sent what `ExtractionContentMessage` declares; whether the frame
  answers is untested from here.

## Open questions or contradictions found

1. **Two payload contracts collided mid-flight, and I moved to the panel's.**
   When I started, the confirm payload existed nowhere, so I designed one:
   `{ sessionId, label, columns: [{ key, label, handling }] }`, with the
   background rebuilding every selector from the held proposal. Before I
   finished, the X4.4 worker landed `popup/extraction/messages.ts` with a
   different, already-written shape: the payload nested under `request`, and
   each column carrying its full spec (`kind`, `selector`, `attribute`,
   `header`, `required`, `handling`) plus a key the panel has already derived.
   I switched the background to accept theirs, because theirs was written and
   tested and mine was not, and because the origin check already guarantees the
   sender is the user's own panel. I kept the item selector coming from the held
   proposal, and I kept my shape working as a fallback for a caller that sends
   only a `label`. **The supervisor should confirm this is the contract both
   halves keep**, and the two duplicate declarations
   (`popup/extraction/messages.ts` and my `definition.ts`) should collapse into
   `shared/extraction-messages.ts`.

2. **The preview is read once, and the background cannot learn about a later
   exclusion.** The panel's client sends `getSession` with no arguments, so the
   background reads the preview once, for the columns the proposal did not
   already mark `exclude`. If the user then excludes a column, the panel drops
   its values from its own copy and marks it stale for good
   (`popup/extraction/preview.ts`), but the background still holds the rows it
   already read for that column until the session ends or is recorded. Nothing
   durable ever carries them, and the sensitive columns the rule pre-selects are
   never read at all — so D12's binding clause holds. I left a seam for it: a
   `getSession` that names `fields` re-reads and replaces the rows. **If the
   supervisor wants the background's copy narrowed the moment the user excludes
   a column, the panel needs to send its current fields on `getSession`;** that
   is a one-line change on their side and already works on mine.

3. **Four domain functions the extension needs are not exported to it.**
   `webAutomationExtractListRequestValue`, `webAutomationRecordedExtraction`,
   `isWebAutomationExtractFieldKey` and `webAutomationExtractListTimeoutMs` all
   live in `domain/src/actions/extraction/`, which neither `domain/src/index.ts`
   nor `domain/src/client/index.ts` re-exports — `actions/types.ts` re-exports
   the *types* and two constants and nothing else. Consequences, all of which I
   worked around rather than editing `domain/` (outside my brief):
   - validation goes through `webAutomationRecordedAction` instead, which is
     arguably better (it answers the executability question directly) and is
     what I would keep;
   - the field-key pattern is restated as a literal in my test;
   - **the extraction timeout is a flat 60 s constant in `confirm.ts` instead of
     `webAutomationExtractListTimeoutMs(request)`, which scales by `maxPages`.**
     That is the one real loss. A paginated read of more than six pages could
     hit the ceiling. One line added to `domain/src/actions/types.ts`'s
     re-export block fixes it.

4. **`isControlPage` is now written twice**, here and in
   `scripted-navigation-control.ts`. I could not touch the other file. It is a
   security predicate and should exist once, in a `background/control-page.ts`
   both import. Noted in the code.

5. **`attachTabForRecording` is `ensureContentScript`, not the connection's own
   attachment.** `FluxIQConnection` keeps `ContentAttachment` private and I do
   not own `connection.ts`, so the confirm path passes `ensureContentScript` as
   the callback `runBrowserActionCommand` requires. For an extraction that is
   correct — it runs in the tab the user picked in, which a recording has
   already claimed, so the only thing still needed is that the frame is
   listening — but it skips the "a tab joining a recording late" bookkeeping. If
   the Lab ever drives the test seam against a tab the recording has not
   claimed, that bookkeeping is missing.

6. **`start` is allowed outside a recording; `confirm` is not.** The plan only
   specified the confirm refusal. The panel's Extract data button lives in
   `recorderView`, so a pick outside a recording should not be reachable
   anyway. Say so if it should be refused earlier.

---

# Follow-up: the scaled extraction timeout, and one copy of the control-page check

Both items the coordinator returned are done. The payload-contract item needed
no work: my call stands, and I left my local declaration alone for the
content-picker worker to merge.

## 1. The 60-second timeout is fixed, and the domain now exports what it owns

`domain/src/actions/types.ts` now re-exports the four extraction readers that
`domain/client` could not reach, not just the one I needed:
`isWebAutomationExtractFieldKey`, `webAutomationExtractListRequestValue`,
`webAutomationExtractListTimeoutMs` and `webAutomationRecordedExtraction`.

No cycle is introduced. `actions/types.ts` already had a runtime edge to that
directory (`WEB_AUTOMATION_EXTRACT_MAX_ITEMS` and
`WEB_AUTOMATION_EXTRACT_MAX_PAGES` come through it), and `actions/extraction/`
imports this module type-only, which is erased. The domain suite is identical
with and without the block; the measurement is below.

`background/extraction/confirm.ts` now asks the domain for the budget:
`timeoutMs: options.timeoutMs ?? webAutomationExtractListTimeoutMs(request)`.
The flat `EXTRACTION_RUN_TIMEOUT_MS = 60_000` is gone. Nothing is
reimplemented — the scaling stays the domain's one definition, which is also
the number the recorded node declares, so the read the worker runs now and the
read a replayed Flow runs later share a single figure. An explicit `timeoutMs`
on the test seam still wins, so the Lab can bound a measurement.

What this changes in practice: a 20-page `loadMore` read used to get 60,000 ms
and be cut off mid-read with nothing in the panel explaining why; it now gets
200,000 ms. The page waits up to 10,000 ms per page, so the budget is 10,000 ms
times the pages the request may follow (`maxScrolls` for `scroll`), capped by
the domain's own 50-page bound.

Two new tests, both passing:

- `a paginated read gets a budget scaled by the pages it may follow, not a flat ceiling`
  confirms an unpaginated read, a 5-page `next` read and a 20-page `loadMore`
  read, reads `timeoutMs` off the command the runner actually received, asserts
  each equals `webAutomationExtractListTimeoutMs` for the same request, asserts
  five pages gets strictly more than one, and asserts the 20-page read exceeds
  60,000 ms — that last row is the regression guard for the defect itself.
- `a caller that names its own timeout keeps it` pins the test seam's override.

I also removed the restated field-key pattern from the test. It now asks
`isWebAutomationExtractFieldKey` directly, which is the point of exporting it.

## 2. `isControlPage` exists once

New `apps/extension/src/background/control-page.ts` holds it.
`scripted-navigation-control.ts` and `background/extraction/control.ts` both
import it and their local copies are gone; the only edit to the
scripted-navigation file is the import and the deletion, with no behaviour
change.

**The two predicates were true duplicates** — character-for-character identical,
because I had copied the original verbatim. Nothing differed, so nothing had to
be reconciled and there was nothing to stop and report.

The shared file documents why each of the three conditions is there, since that
is the part a future tightening could get wrong: the extension id (another
extension's messages arrive the same way), the `typeof sender.url === "string"`
guard (an absent URL would otherwise compare equal to an absent URL), and the
exact-URL comparison rather than a prefix or origin test (every page this
extension serves shares the origin, and a prefix would accept
`popup/index.html.evil`).

Both call sites keep their existing coverage:
`scripted-navigation-control.test.ts` still proves a content sender, another
extension and a non-control extension page are refused, and
`extraction-control.test.ts` proves the same across all five extraction
messages.

## Commands run and observed results

1. `pnpm --filter @fluxiq-web-extension/extension check`

   ```
   > tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json
   ../../domain/src/runtime/llm-evidence/target-override.ts(87,36): error TS2339: Property 'handles' does not exist on type 'AutomationStudioRuntimeTargetOverrideTarget'.
   ../../domain/src/runtime/llm-evidence/target-override.ts(157,3): error TS2322: Type 'WebResolvedRepairTarget' is not assignable to type 'AutomationStudioRuntimeTargetOverrideTarget'.
     Property 'selector' is optional in type 'WebResolvedRepairTarget' but required in type 'AutomationStudioRuntimeTargetOverrideTarget'.
   Exit status 2
   ```

   **Not green, and none of it is mine.** Every diagnostic is in
   `domain/src/runtime/llm-evidence/target-override.ts`, which another worker has
   uncommitted and in flight (`tools.ts`, `index.ts` and a new
   `repairable-parameters.ts` are modified beside it, and the sibling Core
   checkout has a large uncommitted tree). The errors name a `handles` property
   on Core's `AutomationStudioRuntimeTargetOverrideTarget` that Core has not
   grown yet. Every errored line is a `+` line in their working diff. The error
   list also changed between two runs minutes apart, which is what a file being
   edited under you looks like. Zero diagnostics name any file I touched.

   `pnpm --filter @fluxiq-web-extension/domain check` reports the same errors and
   nothing else, which locates them in the domain package rather than in anything
   I changed there.

2. `EXTENSION_TEST_BUILD_LABEL=x4c-background-control node scripts/test-extension.mjs`
   (in `apps/extension`)

   ```
   1..621
   # tests 621
   # pass 621
   # fail 0
   ```

   The two new rows, by name and number in that run:

   - 234 a paginated read gets a budget scaled by the pages it may follow, not a flat ceiling
   - 235 a caller that names its own timeout keeps it

3. `pnpm --filter @fluxiq-web-extension/domain test`, run twice to prove the
   re-export is neutral — once with my block removed, once with it restored:

   ```
   # tests 472    # pass 469    # fail 3      (block removed)
   # tests 472    # pass 469    # fail 3      (block restored)
   ```

   Identical, and the three failures are the same three names both times:
   `validates target overrides only when one exact selector has semantics
   compatible with the failed action`, `matches a child-frame target on the
   selector that works inside its frame`, and `binds from the production host
   seam and selects the sole trusted web client without requiring stale pairing
   project metadata`. All three live in `runtime/llm-evidence/tests/`, the same
   in-flight area as the type errors, and all three fail the same way
   (`status: 'absent'` where `'matched'` was expected). They are not mine and
   they pre-date my edit.

4. `node scripts/structure-audit.mjs`, with everything staged

   ```
   FAIL  [working-docs] docs/working/README.md is out of date with the documents' header blocks. Run "pnpm structure:baseline" to regenerate it.
   structure-audit: 1 violation(s) across 1 rule(s).
   ```

   **This one is yours, not mine, and I could not fix it.** It is the generated
   working-document index, and it went stale when commit `f7374ef` changed the
   working documents' headers. I staged no file under `docs/` and edited no
   working document beyond appending to this report, which lives in `reports/`
   and is not indexed. `pnpm structure:baseline` regenerates it. The audit passed
   cleanly on my last run before that commit.

   Two advisory warnings name files of mine, neither a violation:
   `extraction-control.test.ts` at 548 lines and `domain/src/actions/types.ts` at
   483, both past the 400-line advisory threshold and well under the 800-line
   limit. `actions/types.ts` was already over it before I touched it.

## Not verified

- **Still no browser.** The scaled timeout is asserted on the command object the
  stubbed runner receives; no real page has been given 200,000 ms to read twenty
  pages. The number is right by construction — it is the same function the
  recorded node declares — but the end-to-end behaviour is X4.4's manual list.
- **The repository-wide `pnpm check` and `pnpm test` still do not pass**, for the
  other worker's reason above. I did not run `pnpm build`.
- **One edit to a file I own arrived mid-task from elsewhere.**
  `session-store.ts` gained an expanded comment on `previewKey` describing the
  exclusion behaviour while I worked. It is documentation only, it matches what I
  reported in open question 2, and I kept it; the suite passes against the
  on-disk version.
