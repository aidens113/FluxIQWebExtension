# t268-extraction-ui

Worker report for the brief "t268-extraction-ui" (UX design Unit 6, t224's held extraction units).
Tree: `C:/Users/osrs_/FluxStuff/fxwork/t268/!FluxIQWebExtension`, branch `task/t268-ux-early-units`. No commits.

## Outcome

Done. All three Unit 6 extraction units are implemented with fail-first tests: caret ownership, preview table
semantics, preview feedback. Changed and existing extraction tests pass (227/227); `extension check`, `extension build`
and the structure audit exit 0. Nothing was exercised in a browser.

## What changed and why

All edits are under `apps/extension/src/panel/extraction/`. The files use LF line endings.

1. **Caret unit** (`dialog-focus.ts`). `render` now records whether focus repair found the redrawn copy of the same
   control (`matched`). Only a matched, enabled text input gets the captured selection. A neighbouring field, the
   previous field or the initial control (the dataset-name input) still receives focus under the unchanged policy,
   but its own caret is left alone. Before this change, removing column A moved A's selection range into column B's
   name, or into the dataset name when no column was left. The selection is now captured only from text-like inputs
   (helper `textLike`, not exported). Other sources yield none, so there are no fake numeric defaults.
   - New test file: `tests/dialog-focus-selection.test.ts` (9 tests). Every input's own `setSelectionRange` is wrapped
     per instance, so the tests assert which control was handed a selection. They cover:
     - same-field redraw (delegated exactly once);
     - next-field fallback, previous-field fallback and initial-control fallback;
     - a same-row redraw without the original control, and a disabled redrawn copy;
     - deliberate focus movement during the redraw;
     - an unfocused or hidden document;
     - a non-text control.
2. **Table unit** (`panel-elements.ts`, `preview-table.ts`).
   - The table is built once as `#extractionPreviewTable` with `aria-label="Extraction preview"` and exposed as the
     new `previewTable` element. The class, the `thead`/`tbody` ids and the dialog's own `aria-labelledby` are
     unchanged.
   - An empty cell (missing key, `null` or `""`) now reads "No value" instead of "--". The `extraction-preview-empty`
     class is kept because the Lab's `field-review.ts` reads empty cells by that class.
   - New test file: `tests/preview-accessibility.test.ts` (4 tests). It covers the table name and note attributes,
     native `th scope=col` headers, the three empty forms, and page text kept as text. It also checks that the five-row
     cap holds, that the renderer does not mutate its inputs, and that an excluded key is never drawn.
3. **Feedback unit** (`panel-elements.ts`, `panel.ts`, `read-recovery/createExtractionReadRecovery.ts`).
   - `recovery.state()` gains two additive fields, `previewPending` and `previewFailed`. Both are fenced to the current
     epoch, identity and selection key. The existing `ticket` and `pending` fields are unchanged.
   - `#extractionPreviewNote` now has `role=status`, `aria-live=polite` and `aria-atomic=true`.
   - `panel.ts` writes the note from `drawRecovery`, so every recovery `onChange` reaches it, not only table redraws.
     The text is rewritten only when it changes. The table also gets `aria-busy` while a read is pending.
   - The note's wording by state:
     - **Pending:** "Refreshing preview..." followed by "The N rows below are from the last read." when rows are shown.
     - **Failed:** "The preview was not refreshed. ..." The existing alert and the "Retry preview" action stay.
     - **Settled:** the existing "Showing N of M items." or "No preview was read for these columns." The
       excluded-column sentence follows in all three states.
   - `renderPreview` was folded into `drawPreviewNote` and `previewSentence`, both module-private. Editing, Confirm,
     raw typing, the D12 erasure, receipts, cancel and polling are untouched.
   - New test file: `tests/preview-feedback.test.ts` (6 tests). It mounts the real panel and real recovery and covers:
     - the pending, busy, then settled sequence;
     - an unchanged count going through pending and back;
     - a true empty result;
     - a failure with the alert and Retry preview, then a retry going pending and then settled;
     - an older selection's failure fenced from the newer read;
     - removing every shown column, which erases the sample at once.

## Commands run and observed results

- **Fail-first check.** The five source files were temporarily swapped for their `HEAD` versions and the three new
  test files were run with the bundling runner (label `t268-extraction`). Result: 13 of 19 failed. The failures were
  the 5 fallback and disabled-copy caret tests, the table name and "No value" tests, and all 6 feedback tests. The
  sources were then restored; `git status` shows only the intended files.
- **New and existing dialog-focus tests.** Command: runner plus `node --test` on `dialog-focus-selection`,
  `dialog-focus`, `preview-accessibility` and `preview-feedback`. Result: `# tests 24 # pass 24 # fail 0`.
- **All extraction tests.** Command: runner plus `node --test` on every `src/panel/extraction/tests/*.test.ts`,
  `read-recovery/tests/*.test.ts` and `src/background/tests/extraction*.test.ts`. Result:
  `# tests 227 # pass 227 # fail 0`.
- **Typecheck.** Command: `pnpm.cmd --filter @fluxiq-web-extension/extension check`. Result: exit 0.
  `core-build: FluxIQ Core's build at ...fxwork\t268\!FluxIQ is current with its source.`
- **Build.** Command: `pnpm.cmd --filter @fluxiq-web-extension/extension build`. Result: exit 0, and chrome, firefox
  and e2e-chromium each reported "verified 22 files".
- **Structure audit.** Command: `node scripts/structure-audit.mjs`. Result: exit 0,
  `structure-audit: passed (170 warning(s), 118 baselined)`. It raised two advisory warnings in this area:
  - `panel.ts` is 446 lines, against a 400-line advisory threshold. It was already 424 lines before this change.
  - `panel/extraction/tests/` holds 17 files, against a 15-file advisory threshold.
- **Stray first run, harmless.** My first runner invocation passed a relative package directory, so the runner threw
  and the bare `node --test` that followed began discovering every test in `apps/extension`, including content e2e
  specs on local fixtures. I stopped it, and a process check afterwards found no node or browser process left under
  `fxwork/t268`. It made no Lab, provider or network-service call. Its partial results are not part of this report.

## Live check (to run in Phase 4's live round)

Unit 6, as stated in the design:

1. Start Extract (Unit 1's entry) on a realistic list page.
2. Edit a column name, and while typing confirm the caret stays in that field across redraws.
3. Remove a column. Focus should move to the neighbouring column's name with that field's own caret, not the removed
   one's.
4. Change a column's handling so the preview re-reads. The note under Preview should say "Refreshing preview..." and
   then the new "Showing N of M items." count.
5. Screen reader, if one is available: the table is announced as "Extraction preview", empty cells read "No value",
   and the note's change is announced politely.

Per unit:

- **Caret:** steps 2 and 3.
- **Table:** the accessibility tree shows the name "Extraction preview" and "No value" cells.
- **Feedback:** step 4. To see the failed state, make the re-read fail, for example by reloading the page while the
  read is pending. The note should say "The preview was not refreshed..." with Retry preview visible.

## Not verified

- No live browser, keyboard session, screen reader or accessibility tree. The fake DOM proves local DOM and focus
  contracts, not native announcements or caret clamping.
- Chrome side panel and Firefox popup rendering of the new wording were not checked.
- The Lab journey `packages/test-runner/src/ui-e2e/journeys/field-review.ts` was not run. It reads empty cells by the
  kept class and does not read the "--" text, so it should be unaffected.
- No full suite was run, per the brief.

## Open questions or contradictions found

- The wording is a product choice and may change:
  - "No value" follows the audit's proposal.
  - The pending and failed sentences are new: "The N rows below are from the last read." and "The preview was not
    refreshed...".
- This was not in scope, but I noticed it: when every shown column is removed, the panel can keep empty rows with
  zero columns. After the read settles, the note could then say "Showing N of M items." over rows with no cells. The
  earlier accessibility audit described the same behaviour. The new test only covers the pending phase of that case.
- `panel.ts` is now 446 lines and keeps growing. Splitting the note and preview presentation into its own module would
  clear the advisory warning; that is a supervisor call.
