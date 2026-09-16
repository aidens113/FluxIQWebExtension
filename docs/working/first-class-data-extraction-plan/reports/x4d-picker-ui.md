# X4.4 — Extraction UI in the Chrome side panel and the Firefox popup

Worker report. Written 2026-09-15. Nothing here was committed or pushed.

## Outcome

Done. The extraction panel exists end to end in the extension's UI: an
"Extract Data From This Page" button, a picking state, a confirmation sheet
showing the item count, the detected columns and a preview, per-column rename /
remove / Include / Exclude with D12's hover, a follow-pages choice, and Confirm
and Cancel. It is wired into both `popup/index.html` and `sidepanel/index.html`,
which remain byte-identical files, and into `popup/index.ts` in five lines.

Not verified in a real browser. See **What was not verified**.

## What was inherited, and what I judged of it

Four files were already on disk, untracked, from the worker a machine crash
killed:

| File | Verdict |
| --- | --- |
| `popup/extraction/view-model.ts` | Coherent and complete. Kept unchanged. |
| `popup/extraction/messages.ts` | Coherent and complete. Kept unchanged. |
| `popup/extraction/confirm-payload.ts` | Coherent and complete. Kept unchanged. |
| `popup/extraction/preview.ts` | Coherent and complete. Kept unchanged. |

They compile, they are consistent with each other, and their D12 story holds
together: the draft never holds a page value; `stale` makes an exclusion
irreversible for display purposes; `retainExtractionPreview` **rebuilds** each
row from the surviving keys rather than filtering at render time. I changed no
line of any of them. What was missing was everything that makes them visible:
no renderer, no message client, no barrel, no HTML, no CSS, no wiring, no tests.

**On the shared message contract.** The brief asked me to check whether the
inherited `messages.ts` duplicates `EXTRACTION_RUNTIME_MESSAGES`. It does not.
It declares *payload* types only (`ExtractionSessionView`,
`ExtractionConfirmRequest`, and the two response shapes) and names the shared
constant in a comment. No message name is re-spelled anywhere under
`popup/extraction/`. The names are imported from
`shared/extraction-messages.ts` in exactly one place, the new `client.ts`.
Nothing needed fixing.

## What I wrote

New, under `apps/extension/src/popup/extraction/`:

- **`client.ts`** (62 lines). The four runtime messages —
  `start`, `confirm`, `cancel`, `getSession` — sent through
  `runtimeSendMessage` with the names imported from
  `shared/extraction-messages.ts`. Each call answers or throws, so the panel has
  one failure path rather than four. An `undefined` response (no listener, e.g.
  a torn-down service worker) becomes a sentence rather than a `TypeError`.
  `testDefineExtraction` is deliberately not sent: it is the Testing Lab's
  control-page entry, and the panel has a human.
- **`panel.ts`** (261 lines). The controller: start a pick, poll `getSession`
  every 600 ms while the user is still choosing, build the draft once a proposal
  arrives, apply edits, confirm or cancel. Every edit funnels through one
  `edit()` function that re-applies `retainExtractionPreview`, so no edit path
  can forget to drop what the user just excluded.
- **`panel-elements.ts`** (57 lines). The panel's seventeen element handles,
  looked up once and typed, so the controller reads as a flow.
- **`field-row.ts`** (159 lines). One editable column: name input, kind select,
  coverage, Include/Exclude radios, Remove, D12's info hover, and a stated
  reason when the picker pre-selected Exclude. Everything that came off the page
  is written with `textContent` or `.value`.
- **`preview-table.ts`** (50 lines). Draws at most five rows under the columns
  it is handed; decides nothing about which columns those are.
- **`index.ts`** (28 lines). The barrel.
- **`tests/proposal-fixture.ts`**, **`tests/view-model.test.ts`**,
  **`tests/confirm-payload.test.ts`**, **`tests/preview.test.ts`** —
  17 tests.

Changed:

- **`popup/index.html`** and **`sidepanel/index.html`** — the button inside
  `recorderView`, and the `#extractionPanel` sheet. The two files were
  byte-identical before this change and are byte-identical after it
  (`md5sum` matched; `diff` is empty). The side panel loads the same script
  (`sidepanel/index.ts` is `import "../popup/index";`) and the same stylesheet,
  so Chrome/Edge and Firefox get one implementation by construction.
- **`popup/styles.css`** — 68 lines appended. `sidepanel/styles.css` imports it
  and needed no change.
- **`popup/index.ts`** — five lines: the import, the mount, and one line in
  `renderStatus` that tells the panel whether a recording is running.

### One deliberate deviation from the plan

The plan put `<section id="extractionPanel">` *inside* `recorderView`. I made it
an absolutely-positioned sheet over the shell instead, a sibling of the pairing
and recording-lock overlays, for two reasons. `recorderView` is
`.recorder-console`, which is `align-content: center; justify-items: center` and
sized for the 132px record button; a tall scrolling panel inside it either
overflows or fights that layout. And `applyLayoutMode()` in `popup/index.ts`
rewrites `recorderView.hidden` on every tab switch, so a panel nested in it
would vanish whenever the user looked at the Events tab mid-pick. As a sheet it
owns its own visibility and scrolls at 380px (Firefox popup) and at side-panel
width alike. The ids the plan named are unchanged.

### Entry point availability

The button is enabled only while connected, recording, and on a recordable
page; otherwise it is disabled and its tooltip says why ("Start recording
first." / "This page cannot be recorded."). Extraction is recorded *into* a
recording, so offering it outside one would be an entry point to nothing.

## D12, concretely

D12 says an excluded column is never recorded at all. What the UI does:

1. A field the proposal marks `handling: "exclude"` opens excluded, marked
   `sensitive` and `stale`, with a visible reason line ("FluxIQ pre-selected
   Exclude because this looks like a password or another sensitive field. You
   can include it.").
2. The Exclude control carries the hover D12 specifies: *"Exclude a column of
   private information — a password, a card number, personal details you don't
   want collected. An excluded column is never read from the page, so it is in
   no dataset, no preview, no export and no saved run."* It is focusable, so the
   explanation is reachable without a mouse.
3. Excluding a column **deletes its values from the object the panel holds**,
   before the next render. It is not hidden, and not masked. Un-excluding brings
   nothing back, because there is nothing left; the column stays out of the
   preview until the extraction runs.
4. The confirm message carries the excluded column *as excluded* — present, so
   detection does not propose it again, with `handling: "exclude"` so the page
   never reads it.
5. No preview row can reach the confirm message. The rows live beside the
   draft, and `extractionConfirmPayload` is never given them.
6. Encrypt (D13) is not offered anywhere in the UI.

### The tests were checked against mutations

Passing tests prove nothing about a guard until the guard is removed. I copied
the four pure modules into an ignored scratch directory inside the package,
weakened the copies, and ran the copied tests against them (the repository's own
files were never modified; the scratch directories were deleted afterwards):

| Mutation applied to the copy | Result |
| --- | --- |
| Drop `&& !field.stale` from `extractionPreviewColumns` | Caught by *"a column read differently since the preview was taken shows nothing until the extraction runs"* |
| `stale: field.stale \|\| handling === "exclude"` → `stale: handling === "exclude"` | Caught by *"excluding a column marks it stale for good, so un-excluding shows no previewed value"* |
| Write `attribute` unconditionally instead of only under `kind === "attribute"` | Caught by *"attribute and header are written only under the kind that reads them"* |

## Commands run and observed results

**`pnpm --filter @fluxiq-web-extension/extension check`** — first run, fully
green, no output past the two `tsc` invocations.

A later re-run failed, in a file that is not mine and that another worker was
writing at that moment:

```
src/background/tests/extraction-control.test.ts(165,26): error TS2339: Property 'actionType' does not exist on type 'never'.
```

The first half of `check` (`tsc -p tsconfig.json --noEmit`, which excludes
`src/**/tests/**`) still passed; the error is in the background worker's new,
untracked test file. No error has at any point named a file under
`popup/extraction/`, `popup/index.ts`, or either HTML file.

**`node apps/extension/scripts/test-extension.mjs`** —

```
# tests 595
# pass 595
# fail 0
```

The 17 new rows, by name:

```
ok 443 - record keys are derived from the labels the user settled on
ok 444 - two columns renamed the same way still get distinct keys
ok 445 - an excluded column is sent, marked excluded, so detection does not propose it again
ok 446 - attribute and header are written only under the kind that reads them
ok 447 - following pages is sent only when the user asked for it
ok 448 - no value read from the page reaches the confirm message
ok 449 - a column the picker pre-excluded is dropped from the rows, not hidden in them
ok 450 - excluding a column deletes its values, and un-excluding does not bring them back
ok 451 - a column read differently since the preview was taken shows nothing until the extraction runs
ok 452 - a missing value stays a missing value rather than becoming an empty string
ok 453 - a field the picker marked sensitive opens excluded, and says why
ok 454 - renaming a column changes the name and nothing else
ok 455 - excluding a column marks it stale for good, so un-excluding shows no previewed value
ok 456 - changing what a column reads marks it stale; re-choosing the same kind does not
ok 457 - removing a column takes it out of the draft entirely
ok 458 - only the kinds the proposal supplied an attribute or header for are offered
ok 459 - reading one page is the default, and the proposed control is what following pages uses
```

**`pnpm --filter @fluxiq-web-extension/extension build`** — the first attempt
failed inside another worker's in-flight edit:

```
src/background/connection/gateway-payloads.ts(34,22): error TS2304: Cannot find name 'recordedExtraction'.
```

Re-run a few minutes later, after that worker's file compiled again: succeeded,
building both browser targets.

```
build\popup\index.js       72.4kb
build\sidepanel\index.js   72.4kb
```

Both targets carry the UI:

```
apps/extension/dist/chrome/popup/index.html:1        (matches "extractionPanel")
apps/extension/dist/firefox/popup/index.html:1
apps/extension/dist/chrome/sidepanel/index.html:1
apps/extension/dist/chrome/popup/styles.css:2        (matches "extraction-field-handling")
apps/extension/dist/firefox/popup/styles.css:2
```

**`node scripts/structure-audit.mjs`**, with my work staged first (`git add` of
my paths only; `git ls-files` confirmed all fourteen `popup/extraction/` files
were visible to it) —

```
FAIL  [working-docs] docs/working/README.md is out of date with the documents'
      header blocks. Run "pnpm structure:baseline" to regenerate it.

structure-audit: 1 violation(s) across 1 rule(s).
```

One violation, and it is not mine. I touched no document under `docs/`
(`git status --short docs/` is empty), and the finding is about the working-doc
index being stale against committed header blocks. No finding names any file I
wrote or changed. `apps/extension/src/popup/index.ts` appears only as a
pre-existing advisory warning (519 lines, past the 400-line advisory threshold,
not a failure; it was 514 before my five lines).

## What was not verified

- **No browser was opened.** I did not load the unpacked extension in Chrome,
  Edge or Firefox. Nothing in this report is evidence about live behaviour: not
  the pick flow, not the overlay, not the side panel's layout at its real width,
  not the Firefox popup surviving the click that closes it, not Escape, not
  whether the background actually answers the four messages.
- **The background half does not exist yet at the time of writing.** Nothing in
  the repository handles `fluxiq.extractionStart`, `extractionConfirm`,
  `extractionCancel` or `getExtractionSession`; X4.3 was being written beside
  this. Until it lands the panel will open, send `start`, and show its
  "background worker did not answer" notice. The payload shapes the panel sends
  and reads are the inherited `messages.ts` declarations, which are the panel's
  *expectation* of that contract, not an agreement with the code that will
  serve it.
- **The preview is filtered panel-side, not re-read.** The background's
  `session-store.ts` says in its own comment that the preview is "re-read rather
  than re-filtered when the user changes an Include/Exclude choice". The four
  committed runtime messages give the panel no way to ask for a re-read, so what
  the panel does instead is delete the excluded column's values from memory
  immediately and never display them. That satisfies D12 — nothing durable is
  written, and the value is not shown — but it is a different mechanism from the
  one that comment describes. See the open question below.
- **No accessibility or visual review.** The CSS follows the existing design
  tokens but no one has looked at it.
- **`apps/extension/build/` is now dirty with someone else's work.** Running
  the package build refreshed the tracked `build/` output, which at that moment
  included another worker's in-flight `background/index.ts` and
  `gateway-payloads.ts`. I staged none of it. It should be regenerated by
  running the build again once the concurrent workers are finished, before the
  supervisor commits.

## Open questions and contradictions found

1. **Who re-reads the preview after an Include/Exclude change?**
   `background/extraction/session-store.ts` documents re-reading, keyed by
   `previewKey`; `EXTRACTION_RUNTIME_MESSAGES` has no message the panel could
   use to ask for it. Either the background needs a fifth runtime message (or
   `getSession` needs to accept the included key set), or the session store's
   comment should be corrected to describe what actually happens. This is a
   contract question between X4.3 and X4.4 and should be settled by whoever owns
   the seam, not silently by either side.
2. **A re-used sensitive column can never be previewed.** By design, a column
   the picker pre-excluded is `stale` from birth, so including it shows a column
   with no sample values until the extraction runs. I think that is correct —
   the value was never read — but the user sees a column that looks empty. The
   panel says so in a note under the preview; whether that is enough is a
   product judgement.
3. **The dataset defaults to the name "Extracted data."** Nothing in the plan
   fixes a default. Anything derived from the page (its title, a heading) would
   be a page value, so I used a fixed string the user can rename.
4. **Re-rendering rebuilds every field row**, so a radio button loses focus
   after it is clicked. Harmless, slightly rough; fixing it needs per-row
   patching rather than `replaceChildren`.

## Amendment, written at hand-off

Two things changed after the section above was written.

**`check` is now green.** Re-run once more at the end of the task, the full
command produced no output past its two `tsc` invocations:

```
> @fluxiq-web-extension/extension@0.1.0 check
> tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json
```

The `extraction-control.test.ts` error quoted earlier was the concurrent
background worker's, and it fixed it.

**The supervisor committed this work while the task was still running.** I
staged my paths for the structure audit, as the brief instructed, and the
supervisor's commit picked them up; `git ls-files` now lists all fourteen
`popup/extraction/` files in `HEAD`, along with both HTML files, the stylesheet
and the five wiring lines. I did not commit and did not push.

**The structure audit's remaining findings are both working-document ones**, and
neither is mine:

```
FAIL [working-docs] docs/working/mvp-week2-automation-loop-plan.md: 1 Work Ledger
     entry does not record a validation result
FAIL [working-docs] docs/working/README.md is out of date with the documents'
     header blocks. Run "pnpm structure:baseline" to regenerate it.

structure-audit: 2 violation(s) across 1 rule(s).
```

No audit finding names any source file I wrote or changed. The note about
`apps/extension/build/` still applies: it should be regenerated once the
concurrent background work settles.
