# X4.5 — the seams between the picker's three halves

## Outcome

Done. Both named gaps are closed, a third of the same shape was found and closed,
and a fourth was found and is reported rather than fixed because closing it needs
a file this brief does not own. Every behaviour claimed below is covered by a
test that was run, and the four new behaviours were each proved load-bearing by
mutating the code and watching the row fail.

The tree's `check` is now **green**. The two `domain/.../target-override.ts`
errors the brief warned about are gone — that worker landed while I worked — and
their disappearance uncovered one real error in a file I own, which was masked
because the two `tsc` invocations are chained with `&&`. It is fixed. Details
under "Commands run".

## The two gaps

### 1. The preview never re-read. It does now.

**What was wrong.** The worker's `getSession` already accepted the columns to
read under, and already re-read rather than filtered when they changed. The panel
sent none, so the rows were read once under the proposal's columns and never
again. Excluding a column emptied the panel's own copy (`retainExtractionPreview`)
and left the worker holding the values; the panel is rebuilt from the worker on
every mount and on every Firefox popup reopen, so those values were one
`getSession` away from being back on screen.

**What now happens.** `popup/extraction/panel.ts`'s `edit()` — the one funnel
every draft change already ran through — compares the columns the panel may show
before and after the edit, and on a change calls `readExtractionSession` with
them. The worker's `previewKey` stops matching, it asks the page for a fresh
read that does not name the excluded column, and the panel replaces its rows with
what comes back. The excluded column's values are gone from **both** halves in
the same turn, and the page is never asked for them again.

Three design points worth review:

- **The key space.** `extractionPreviewSelection` (new, in `preview.ts`) names
  each column by the proposal's `sourceKey`, not by the record key the confirm
  payload derives from the user's label (D16). Those two names diverge the moment
  a column is renamed. Sending the confirm payload's fields instead would have
  matched no proposal field for a renamed column, read as "as proposed", and put
  the column the user had just excluded straight back into the read — silently,
  and only for columns they had renamed. The new
  `ExtractionPreviewColumn` type exists to say which of the two names it carries,
  and `control.ts`'s `columnsOf` now refuses to read a confirm payload nested
  under `request` for exactly this reason (it accepted one before; nothing sent
  one). A test drives the renamed case end to end.
- **What counts as a column to read.** The selection sends `include` only for a
  column whose values the panel may display *now*: not excluded, and not stale.
  A column the user re-includes after excluding it stays stale, so the page is
  not asked to read it again for a preview that will not show it.
- **A reply for columns that changed again is dropped**, compared by the same key
  rather than by object identity, so a rename in flight does not throw away a
  good read.

**Why this matters beyond tidiness** (restating D12 as the brief does): an
excluded column is never recorded at all, and the preview was the one place a
value the user had just marked private was still held after they marked it.
Nothing was persisted either way — the session is memory-only — but "we still
have it, we just do not show you" is not the promise.

### 2. A `value` pick now lands somewhere: an explicit, typed refusal

**Decision: refuse it, in words, at both ends. Do not implement it.**

The reasoning, because the brief asks for it:

- The confirm path **already** refuses a value definition: `confirm.ts` builds a
  runnable request only for `form === "list"` and answers `invalid_definition`
  otherwise. So the run end was already closed; the pick was the only end left
  open.
- A recorded value extraction maps to the `web.dom.extract` output, whose
  parameter schema **requires `selector`** (`domain/src/actions/schemas.ts`), and
  the selector comes from the recorded event's element descriptor.
  `content/picker/recorded-event.ts` deliberately attaches none. So a value pick
  accepted here would be recorded as passive evidence and would never become the
  node the user thought they had defined — the same "wired at one end" defect,
  moved one step later and made harder to see.
- Closing that would need `content/picker/recorded-event.ts` (a target on the
  recorded event) and panel UI for naming a single value. Both are outside this
  brief's ownership, and the second is a feature rather than a seam.

**What now happens.** `ExtractionSessionRefusal` (new, in
`shared/extraction-messages.ts`) is `ExtractionProposeRefusal` plus
`value_form_unsupported`. The worker refuses `fluxiq.extractionStart` with
`form: "value"` before it opens a session or touches the page, and if a pick
carrying `element` arrives anyway it answers `{ ok: false, code:
"value_form_unsupported" }` and puts that word on the session, so the panel says
"FluxIQ cannot record a single value yet. Pick an item in a repeating list."
The pick is answered rather than dropped, at both the door and the pick.

The panel's `REFUSALS` map is now `satisfies Record<ExtractionSessionRefusal,
string>` and `ExtractionSessionView.refused` is typed with that union instead of
`string`, so a refusal word the worker can send and the panel has no sentence for
is a **build error** rather than a blank notice.

## 3. Found in the sweep, and fixed: a refused pick left the page unpickable

The frame closes its overlay on **every** pick and tears its own session down
when the press finishes (`content/picker/session.ts`), including for a pick it
proposed nothing for. The worker's `refuse()` kept the session `picking`, with a
comment saying "the overlay is still up and the next click is still the pick".
It was not. The panel showed "That item is not part of a repeating list. Pick an
item inside a list or a table row." over a page where no click could ever produce
another pick; the only way out was Cancel and start again.

`control.ts` now re-arms the pick — it sends `pickStart` again for the same
session — after any pick that left nothing to confirm. `startPick` on the frame
already tears down and re-opens, and the rest of the press is still swallowed
because `preventDefault`/`stopImmediatePropagation` run before any phase check.
A frame that cannot be reached leaves the session refused, which is what the
panel already displays. Covered by a test that counts the `pickStart` messages
and asserts a successful pick does **not** re-arm.

## Everything else in the seam, checked

Each of the five runtime messages, sender against receiver, and each panel state
against what the worker can produce.

| Message | Verdict |
| --- | --- |
| `extractionStart` | Agreed. Panel sends `{ type }`; worker reads an optional `form` the panel never sets. See the session-id note below. |
| `extractionConfirm` | Agreed. Panel nests the payload under `request`; `confirmRequestOf` reads it, and the payload is now one shared declaration. |
| `extractionCancel` | Agreed. Panel ignores the `cancelled` flag, which is fine. |
| `getExtractionSession` | Agreed, and now two-way: the panel sends `fields`. |
| `test.defineExtraction` | Not a panel message; the Lab's, and origin-checked. |

Panel states: `picking`, `picked`, `recorded` and "no session" are each
producible, and all three refusal words are now producible and all three have
sentences (enforced by the compiler). I found no state the panel can display that
the worker cannot produce.

**Still wired at one end, and deliberately left, each with why:**

1. **Escape on the page tells the worker nothing** (x4b's open question 3, and
   the same shape as the defect I fixed in §3). The frame swallows Escape, takes
   its overlay down and forgets its session; the worker's session stays `picking`
   forever and the panel keeps saying "click an example item" over a page with no
   overlay. The panel's own Escape handler cannot see it, because the key never
   leaves the page. **Closing this needs `content/picker/session.ts` to send
   something back** — a `pickCancel` the other way, or a refusal word — which
   this brief does not own. Everything on the receiving side is ready for it: a
   new word in `ExtractionSessionRefusal` would force the panel to give it a
   sentence.
2. **The confirm reply's counts have no reader.** The worker answers Confirm with
   `datasetId`, `label`, `recordCount`, `pagesRead`, `truncated` and `durationMs`;
   `confirmExtraction` in the panel's client returns `void` and the panel closes.
   Nothing is lost — the definition is recorded and the read ran — but the person
   who just confirmed is never told "14 records read". Left because showing it
   means a success state in a panel that currently closes, which is a product
   decision rather than a seam repair.
3. **The panel discards the session id**, so every later message omits it and the
   worker falls back to the most recently started session. Exact with one panel
   and one automation tab. A second control page starting a pick on another tab
   would make the first panel address the newer session. Left deliberately: the
   Firefox popup is destroyed on every page click and cannot carry an id across
   that, which is why the fallback exists.
4. **`ExtractionSessionView.form`, `sessionId` and `tabId` have no reader** in the
   panel's type. `form` is now always `"list"`, since a value pick cannot be
   started. Harmless; named here so nobody reads meaning into it.
5. **A `recorded` session is never dropped from the map** until the tab navigates,
   the tab closes, or a new pick starts. Its preview is already emptied at
   `markRecorded`, so nothing is held; `getSession` simply keeps answering
   `recorded` and the panel keeps closing itself.

## Files changed

- `apps/extension/src/shared/extraction-messages.ts` — `ExtractionSessionRefusal`
  and `ExtractionPreviewColumn`, both documented with the trap they exist to
  close. No new exported *value*, so the file's 15-value budget is untouched.
- `apps/extension/src/background/extraction/control.ts` — the value-form refusal
  at `start` and at the pick, the re-arm, `columnsOf` narrowed to the proposal's
  key space, and the corrected `readSession` doc.
- `apps/extension/src/background/extraction/session-store.ts` — the refusal type,
  and two doc comments that described a mechanism that was not built (the
  `previewKey` comment x4b left, and "the overlay is still up").
- `apps/extension/src/background/extraction/definition.ts`,
  `.../index.ts` — the preview request takes `ExtractionPreviewColumn`.
- `apps/extension/src/popup/extraction/preview.ts` —
  `extractionPreviewSelection`.
- `apps/extension/src/popup/extraction/client.ts` — `readExtractionSession`
  carries the columns.
- `apps/extension/src/popup/extraction/panel.ts` — the re-read on edit, the
  refusal sentence, the typed `satisfies`, and the notice cleared when a later
  pick succeeds (it used to sit beside the proposal from the pick that worked).
- `apps/extension/src/popup/extraction/messages.ts`, `.../index.ts` — types.
- `apps/extension/src/background/tests/extraction-control.test.ts` — four new
  rows, plus the pre-existing type error and a `chrome` stub hazard, below.
- **New** `apps/extension/src/popup/extraction/tests/preview-reread.test.ts` —
  four rows driving the panel's own client into the real worker through a
  `chrome.runtime.sendMessage` stub, with a fake page.

**Placement note.** The new test sits in `popup/extraction/tests/` although it
imports `background/extraction`. The subject is the panel — the missing wiring
was the panel's — and the worker is the collaborator it is measured against,
brought in real rather than faked because both known defects here were a sender
and a receiver that agreed on nothing. It enters the background through its
barrel, so the audit's `imports` rule is satisfied. If a reviewer prefers it as a
two-subject test, its home by the letter of AGENTS.md would be a new
`apps/extension/src/tests/`.

## Commands run and observed results

1. `pnpm --filter @fluxiq-web-extension/extension check`

   ```
   > @fluxiq-web-extension/extension@0.1.0 check F:\!FluxIQWebExtension\apps\extension
   > tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json
   ```

   No diagnostics, exit 0, on the final state of my work.

   **The two foreign errors are gone, and hid one of mine.** The first run of the
   session reported neither `target-override.ts` error; the llm-evidence worker's
   fix had landed. What it reported instead was:

   ```
   src/background/tests/extraction-control.test.ts(381,78): error TS2352: Conversion of type
   '{ paginate?: {} | null; item: string; fields: { product_name: { kind: "text"; }; }; }' to type
   'WebAutomationExtractListRequest' may be a mistake because neither type sufficiently overlaps with the other.
   ```

   That error is in a file I own and was **masked, not absent**: the two `tsc`
   invocations are chained with `&&`, the test project is the second, and the
   domain errors were in the first. It arrived with x4c's timeout follow-up and
   nobody could have seen it while the domain was red. Fixed by typing the two
   local helpers `WebAutomationExtractListPagination | undefined` and deleting
   the cast that was papering over it; the assertions are unchanged.

2. `EXTENSION_TEST_BUILD_LABEL=x4e-picker-integration node scripts/test-extension.mjs`
   (in `apps/extension`)

   ```
   1..629
   # tests 629
   # pass 629
   # fail 0
   ```

   The eight new rows, by name and number in that run:

   - 243 a value pick cannot be started, so no one can make one that has nowhere to land
   - 244 a value pick that arrives anyway is refused in words, not dropped
   - 245 a pick that left nothing to confirm puts the overlay back up, so the next click is still the pick
   - 246 the columns a preview is re-read under are the proposal's keys, never the confirm payload's
   - 479 the first preview is read for the proposal's columns, and never for the one the picker pre-excluded
   - 480 excluding a column changes what the preview returns: the page is read again without it
   - 481 a column the user renamed is still the column the worker stops reading
   - 482 a column whose kind the user changed is not read again either, until the extraction runs

   **An intermediate run failed 55 rows in other people's files, and the cause is
   worth recording.** My first version of the new test installed its `chrome`
   stub with `Object.defineProperty(globalThis, "chrome", { configurable: true,
   value })` and no `writable`, which makes the property read-only. The whole
   suite shares one Node process, and several other test files install their stub
   by plain assignment, so every one of them died with `TypeError: Cannot assign
   to read only property 'chrome'`. Adding `writable: true` fixed it. The same
   latent hazard was in `background/tests/extraction-control.test.ts`'s
   `installChrome` — a file I own — and I fixed it there too, so the suite no
   longer depends on which file happens to run first.

3. **Mutation tests, to prove the new rows are load-bearing rather than
   vacuous.** Each mutation was applied alone, the suite run, and the file
   restored; the suite is green again afterwards (the 629/629 above is the
   post-restore run).

   - Panel stops sending the columns (`client.ts` builds the `getSession` message
     without `fields`) → **3 fail**: 480, 481, 482. This is the defect itself, so
     the rows fail exactly when it is reintroduced.
   - Worker drops the `element` branch and the re-arm (`acceptPick` reads only
     `picked.refused`; `rearmPick` not called) → **2 fail**: 244, 245.
   - `columnsOf` restored to also reading `request.fields` → **1 fail**: 246.

4. `node scripts/structure-audit.mjs`, with my work staged (`git add` of
   `popup/extraction`, `background/extraction`, the background test and
   `shared/extraction-messages.ts`)

   ```
   structure-audit: passed (56 warning(s), 17 baselined).
   ```

   exit 0. One warning names a file of mine, and it is advisory, not a failure:

   ```
   warn [file-lines] apps/extension/src/background/tests/extraction-control.test.ts: 657 lines is past the 400-line advisory threshold.
   ```

   The limit is 800; x4c already flagged this file at 493 and chose not to split
   it, because splitting duplicates the fake page, the fake runner and the
   `chrome` stub. I added four rows and left the decision where they left it, but
   at 657 the next addition should split it — the origin and security rows are
   the natural file of their own. No `imports`, `exported-values`, `naming`,
   `directory-files` or `test-placement` finding names anything I touched.

   One run out of the four I made showed a single failure,
   `FAIL [working-docs] docs/working/README.md is out of date with the
   documents' header blocks`. It was gone on the next run, names a document I did
   not touch, and is another worker editing working documents concurrently. This
   report is left unstaged so it cannot add one of its own.

## Not verified

- **No browser.** Nothing here has run in Chrome or Firefox. In particular the
  re-arm (§3) is proved only as "a second `pickStart` is sent": that the frame
  puts the overlay back up mid-press, and that the remaining events of that press
  are still swallowed, rests on reading `content/picker/session.ts`, not on
  watching it. X4.4's manual validation list is the place that closes it.
- **The two lines inside `mountExtractionPanel` that call the re-read** are not
  covered. The suite runs in Node with no DOM, so `edit()` itself cannot be
  driven; the test starts one call later, at the selection the panel builds and
  the client call it makes. What is untested is the `if` that decides to call it.
- **The `value` refusal is proved as a refusal, not as a user journey.** No test
  drives a real `form: "value"` pick from the page, because the panel cannot ask
  for one and the worker now refuses to start one.
- **`pnpm build` was not run**, so `apps/extension/build/` is staler than it
  already was; `background/` and `popup/` sources changed. It is a tracked
  artefact another worker had already modified and I did not overwrite it.
- **Repository-scope `pnpm check`, `pnpm test` and `pnpm build`** were not run;
  the brief named three commands and those are what ran. `domain/` was being
  edited throughout.
- I did not re-run the Playwright content harness (`pnpm test:content`). Nothing
  I changed is in `content/`, and x4b's three picker specs cover that side.

## Open questions or contradictions found

1. **Escape is the last one-ended wire in this feature**, and it needs
   `content/picker/session.ts`. See §"Still wired at one end", item 1. It is the
   same defect shape as the two the brief named and the one I found, so I would
   not assume it is the last either.
2. **The confirm reply's counts have no reader.** Either the panel should show
   "14 records read" before it closes, or the worker should stop computing them
   for the user's path. Right now it is a measurement made for nobody.
3. **`ExtractionPickForm` is now half-dead.** `"value"` is still in the type, the
   content picker still implements the pick, and the worker refuses it at both
   ends. That is the honest state — the page half exists and the rest does not —
   but if value extraction is not on the plan, the picker's `value` branch is
   dead code that currently cannot be reached, and if it is, the missing pieces
   are an element target on the recorded event and a panel that asks for a name.
4. **The confirm payload is still read through a cast** (`message as unknown as
   ExtractionConfirmRequest`, x4c's open question 5). The shape is one
   declaration now, but where it sits on the message is still convention. My new
   row 246 pins the *other* half of that envelope — that a confirm payload is not
   read as preview columns — and not this one.

---

# Round 2 — Escape, the confirm counts, and one more one-ended wire

The coordinator widened the scope to `apps/extension/src/content/**` and asked
for the two items this report had logged rather than fixed. Both are done, the
sweep found a third of the same shape and a fourth smaller one, and the test file
I had grown to 764 of its 800-line limit is split rather than left as a trap for
whoever adds the next row.

## 1. Escape now tells the worker, and the panel stops waiting

**The disagreement, plainly.** The user presses Escape. The page's overlay
disappears and the frame forgets the pick — `stopPick()` removes every listener.
The worker's session stays `picking`, so the panel keeps polling and keeps saying
"Click one example item on the page". Nothing the user clicks can produce a pick,
because nothing is listening any more. The page and the panel disagree about what
just happened, and only the user can see both sides.

**Why the key cannot simply reach the panel.** Escape is swallowed in the frame
with `preventDefault` and `stopImmediatePropagation`, deliberately: a key that
cancelled the picker is not a key the page was sent, so it must not appear in the
recording. The panel's own Escape handler listens on the panel document, which
never sees it. A message is the only way across.

**What was built.** `EXTRACTION_PICK_CANCELLED_MESSAGE`
(`fluxiq.extractionPickCancelled`), sent by `content/picker/session.ts` and
handled in `background/extraction/control.ts` by `acceptPickCancelled`, which
checks the sender exactly as a pick is checked — top frame, and the session's own
tab — and then drops the session. The panel's next poll finds no session and
closes itself, which is what its own Cancel button and its own Escape already do.

**The one judgement worth review.** A press that has *already taken a pick* sends
nothing. The picker keeps listening after the press so the rest of that press is
swallowed, which means Escape can arrive while the proposal is in flight;
cancelling then would throw away what the user had just chosen. The frame sends
only while its phase is still `picking`, and `ExtractionSessions.cancelled`
refuses anything that is not `picking` as well, so the guard holds even if a
later caller forgets it. Both halves are tested.

## 2. The confirm counts: shown, not deleted

**Chosen: show them.** Deleting would have been defensible only if the answer
were unavailable or unsafe, and it is neither. The worker already runs the read
at confirm time and already holds the counts; the reply carries no record and no
cell, so there is nothing in it D3 forbids; and "did it actually get my rows?" is
the question the person asks the moment they press Confirm. A panel that closes
silently leaves them to find out by exporting later.

**What the user now sees.** The panel no longer closes on a successful confirm.
The draft and its preview rows are dropped exactly as `close()` drops them, and
the panel stays up with one sentence:

- `Captured 12 records from 3 pages into "Product catalog".`
- `Captured 1 record into "Product catalog". It stopped at FluxIQ's limit, so the page may hold more.` — when the read was truncated.
- `Recorded "Product catalog", but the page returned no records. Check the columns and pick again if that is wrong.` — a read that found nothing is an answer, not a success to dress up.
- `The extraction is recorded.` — an older worker that sends no counts.

They dismiss it with Close, or start another pick. It needed no new markup: the
sentence goes in the panel's existing status line, which matters because
`popup/index.html` and `sidepanel/index.html` are outside this brief's ownership.

`ExtractionConfirmOutcome` is declared in `shared/extraction-messages.ts` and the
worker builds its reply *as* that type, so a count renamed on one side and read
on the other is a compile error rather than a blank in a sentence. The panel's
client checks every field before phrasing anything, so a half-filled reply
produces "recorded" rather than "Captured undefined records".

## 3. Found in the sweep: a refused preview left the worker holding the rows

`refreshPreview` runs only when the columns have changed, and it ignored a
refusal from the page: its comment said keeping the rows beat losing the preview.
But the commonest reason the columns change is that the user just excluded one,
so "keep the rows" meant keeping that column's values after the worker had been
told to stop reading it — the exact thing the panel-side re-read exists to
prevent. The frame's `unreadable_request` had no reader, which is the shape this
whole report is about.

A failed or refused re-read now calls `ExtractionSessions.clearPreview`: the rows
go and the key goes with them, so the panel shows "No preview was read for these
columns" (true) and the next `getSession` asks again rather than treating the
failure as the answer. Tested both ways, including that the retry recovers.

## 4. `not_picking` deleted: a refusal word nothing could say

`ExtractionContentRefusal` offered `not_picking`, and no frame could produce it —
`pickStart` and `pickCancel` answer `{ ok: true }` unconditionally. A word in a
refusal vocabulary that nothing can ever say reads to the next person as a case
the worker ought to handle. Removed, with the reason recorded where it stood.

I also checked `extraction.propose`, which has no sender in `src/`. It is not
dead: the content harness sends it
(`e2e/content/tests/extraction/tests/inference.spec.ts`), which is what its own
header says. Left alone.

## 5. The background test file is split, not left at 764/800

I flagged this in round 1 and then added four more rows to it, so I split it
rather than hand the next person a file 36 lines from the hard limit. By subject,
each now well under the 400-line advisory:

| File | Lines | Subject |
| --- | --- | --- |
| `background/tests/extraction-harness.ts` | 161 | the fake page, the fake runner, the `chrome` stub and the fixtures |
| `background/tests/extraction-boundary.test.ts` | 140 | who may drive the picker, and what it refuses to keep |
| `background/tests/extraction-control.test.ts` | 319 | the pick, the preview, and what it stops reading |
| `background/tests/extraction-confirm.test.ts` | 239 | what a confirmed extraction records, runs and answers |

**How I know nothing was lost.** The suite ran 638 tests before the split and 638
after, and the sorted list of test names is byte-identical across the two runs
(`diff` of the two lists is empty). Not one row was dropped, renamed or
duplicated. The row *numbers* moved, so round 1's numbers above are the run as it
was observed then; the names are the stable handle, and the post-split numbers
are listed below.

The harness trips one advisory warning — 13 exported values against an 8-value
threshold — which is what a shared fixture module looks like in this repository;
`e2e/content/tests/identity-fixtures.ts` carries the same warning at 14. The
total warning count is unchanged at 56: this one replaces the file-lines warning
the split removed.

## How to write a `chrome` stub in a background test

The coordinator asked for this in one place, because the next person to write one
will hit it:

> Define the global as `Object.defineProperty(globalThis, "chrome", {
> configurable: true, **writable: true**, value: … })`. Every test bundle runs in
> one Node process, and other test files install their stub by plain assignment
> (`globalThis.chrome = …`). A property defined without `writable` is read-only,
> so the moment your file has run, every later file that assigns dies with
> `TypeError: Cannot assign to read only property 'chrome'` — 55 unrelated rows
> in my case, in files I had not touched, with nothing in the failure pointing at
> the cause. `configurable: true` is not enough: it lets a later
> `defineProperty` through, but not a later assignment.

Both stubs in this feature now do that, and both say why in a comment.

## Commands run and observed results (round 2)

1. `pnpm --filter @fluxiq-web-extension/extension check`

   ```
   > @fluxiq-web-extension/extension@0.1.0 check F:\!FluxIQWebExtension\apps\extension
   > node scripts/check-extension.mjs
   ```

   No diagnostics, exit 0. The package's check is now the coordinator's
   `check-extension.mjs` rather than the chained `tsc && tsc`, so the test project
   is checked even when the source project fails — which is what hid the error I
   found in round 1. It caught seven real errors of mine mid-split (imports the
   two new test files needed) and they are fixed.

2. `EXTENSION_TEST_BUILD_LABEL=x4e-picker-integration node scripts/test-extension.mjs`

   ```
   1..638
   # tests 638
   # pass 638
   # fail 0
   ```

   The nine new rows, by name and by number in that run:

   - 235 the confirm reply says what was captured, in counts and no page value
   - 248 Escape in the page drops the session, so the panel stops waiting on a pick that is over
   - 249 a cancel from another tab, from a child frame, or after the pick landed, leaves the session alone
   - 250 a page that will not read the new columns leaves no rows behind, rather than the ones read under the old ones
   - 451 Escape ends a pick that was waiting, and tells the worker so the panel does not wait on it
   - 452 a key that is not Escape neither ends the pick nor says anything
   - 453 Escape after the press has taken a pick cancels nothing: that pick is already on its way
   - 454 Escape with no pick open says nothing at all
   - 491 confirming answers what was captured, so the panel can say whether the rows arrived

   Round 1's rows in the same run, for the record: 244, 245, 246, 247 (value form,
   re-arm, key space) and 487-490 (the preview re-read).

   Rows 451-454 are a new file, `content/picker/tests/session.test.ts`, which
   drives the real `startPick`/`stopPick` against a stub page in Node: a `window`
   that collects its capture listeners, a `document` whose `createElement` answers
   the overlay's CSSOM calls, and a `chrome.runtime.sendMessage` that records what
   the frame sent. It follows `content/tests/recorder.test.ts`'s pattern — stubs
   in first, module imported dynamically, every global restored — because the
   bundles share one process.

3. **Mutation tests, each applied alone and then restored.** The suite is green
   again afterwards (the 638/638 above is the post-restore, post-split run).

   - The frame stops sending the cancel (`cancelOnEscape` no longer calls
     `sendMessage`) → **1 fail**: "Escape ends a pick that was waiting…". That is
     the defect itself.
   - The worker stops routing it (`handleExtractionControl` loses the
     `EXTRACTION_PICK_CANCELLED_MESSAGE` branch) → **2 fail**: "Escape in the page
     drops the session…" and "a cancel from another tab…". This proves the other
     half independently: the frame can send and still change nothing.
   - The worker keeps the rows when the page refuses (both `clearPreview` calls
     removed) → **1 fail**: "a page that will not read the new columns…".
   - The client stops returning the counts (`confirmExtraction` returns
     `undefined`) → **1 fail**: "confirming answers what was captured…".

4. `node scripts/structure-audit.mjs`, with every file staged

   ```
   structure-audit: passed (56 warning(s), 17 baselined).
   ```

   exit 0, no `FAIL`. One warning names a file of mine, the harness's 13 exported
   values, discussed above. No `imports`, `naming`, `directory-files`,
   `test-placement` or `file-lines` finding names anything in this change.

## Not verified (round 2)

- **Still no browser.** In particular: that a real Escape in a real page produces
  the message (the frame half is proved against a stub `window`), and that the
  panel's new "Captured N records" line renders where I expect in the side panel
  and the popup. Nothing in this round has been seen on screen.
- **The panel's own call sites remain untested**, for the same reason as round 1:
  the suite has no DOM, so `captured()` and the `edit()` re-read trigger are
  driven by nothing. What each of them calls is tested; that they are called is
  not.
- **The stub page in `content/picker/tests/session.test.ts` is not a browser.** It
  proves which messages the frame sends and when. That the overlay is really
  gone, that the key really does not reach the page, and that the drain still
  swallows the rest of the press belong to the content harness
  (`e2e/content/tests/extraction/tests/extraction-picker.spec.ts`), and I did not
  run Playwright.
- **`pnpm build` was not run**, so `apps/extension/build/` is staler still, and
  `content/` has now changed as well as `background/` and `popup/`.
- Repository-scope `pnpm check`, `pnpm test` and `pnpm build` were not run.

## Open questions (round 2)

1. **The panel now has a fourth state — "done" — with no markup of its own.** The
   captured sentence lives in the status line and the body is hidden. It reads
   correctly, but if this becomes a place to show more (a link to the dataset, a
   "record another" button), it wants its own section in `popup/index.html`,
   which is outside this brief's ownership.
2. **A cancelled session is dropped, not remembered.** Escape leaves no trace in
   the worker, so a panel reopened after an Escape sees "no session" and closes,
   which is right. If we ever want "your last pick was cancelled" in the panel,
   that needs a session that outlives its own cancellation.
3. **The value form remains half-present**, unchanged from round 1 and by
   instruction: the page can pick one, and both entry points refuse it in words.
4. **Two seams from round 1 are still open by choice**, and neither changed here:
   the panel discards the session id and relies on "the most recently started
   session", and `ExtractionSessionView.form` has no reader now that it is always
   `"list"`.
