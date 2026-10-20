# t743-x-splits report

## Outcome

Done. All three files are back under the 800-line budget. The structure audit passes, and the same 445 tests pass as before the split.

## What changed and why

### list-reader.ts: 826 lines down to 739

Reading one list item into a record is now its own module, `apps/extension/src/content/extraction/item-record/`. It holds everything that works on a single item or record rather than on the read loop:
- `field-readers.ts`: the `FieldReaders` type and `fieldReaders` (normalizes the request's included fields).
- `read-record.ts`: the `ItemRead` type and `readRecord` (the `"visible" | "complete"` read).
- `assert-disclosed.ts`: `assertDisclosed`, the check that a kept item's text is fully shown (from s5a).
- `content-key.ts`: `contentKey`.
- `record-gaps.ts`: `recordGaps`.
- `index.ts`: the barrel.

`list-reader.ts` imports all of these from `./item-record`. The function bodies and their doc comments moved word for word, and every file has a header note saying it moved on 2026-10-20. The list-reader header keeps all its notes, plus one added line pointing to `item-record/`.

`item-record/` is a subdirectory rather than new files in `extraction/` because `extraction/` already has 25 source files. It is not exported from `extraction/index.ts`, since nothing outside `extraction/` uses it. The new files import `ExtractedListRecord` from `../list-reader` with a type-only import, the same way `filtered-answer.ts` and `rejected-samples.ts` already do, so there is no runtime cycle.

### list-reader.test.ts: 834 lines down to 775

Four disclosure tests moved to `extraction/item-record/tests/assert-disclosed.test.ts` (71 lines): the existing "incomplete field refuses the entire list" test, plus s5a's `readComments` helper, `refusedIncomplete` and its three tests. They still run through `extractList`, because the place the check runs (after `where`, on kept items) is the reader's loop. The `fakeShadowDom` import is gone from list-reader.test.ts because nothing there uses it now. The new file imports it from `../../tests/fake-shadow-dom`. `extraction/tests/` stays at 25 files.

### click.test.ts: 847 lines down to 445

`actions/tests/` already had 25 source files, so a new test file could not go directly in it. The click test fixtures moved into a shared support directory, `actions/tests/click/`, with no fixture code copied:
- `page.ts`: `PAGE`, `LINK_HREF`, `PageBehaviour`, `FakePage`, `installMouseEvent`, `fakePage`.
- `watches.ts`: `fakeWatch`, `fakeNoticeWatch`, `fakeCheckWatch`, `fakeIgnoredWatch` and their record types.
- `dependencies.ts`: `dependencies`, `PRESSABLE`, `COVER_DETAIL`, `notPressable`.
- `press.ts`: `CLICK`, `click`, `PressOptions`, `FIRST_PRESS`, `SECOND_PRESS`, `IGNORED`.
- `index.ts`: the barrel.

The settled-look tests moved as one group to `actions/tests/click/tests/settled-look.test.ts` (119 lines). That covers the t517 certain-no-effect rows and the t743 page-reported-failure rows (`NOTICE_ONLY_ACTUAL`, the six tests that use it, and `SETTLE_MS`), with their comment blocks unchanged. `click.test.ts` stays in `actions/tests/`, imports the fakes from `./click`, keeps `EXPECTED` and `WINDOW_MS` (only it uses them), and has a three-line header note pointing to `click/`. Exports were moved without edits: lines that started with `function`, `const` or `type` gained an `export` prefix. `actions/tests/` now has 25 files (the old 25, with click.test.ts still among them).

## Commands run and observed results

Before the split:
`cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t743-x node scripts/test-extension.mjs content/extraction/tests actions/tests`
-> `# tests 445 / # pass 445 / # fail 0 / # cancelled 0 / # skipped 0`

After the split. I added the fragment `extraction/item-record/tests` because `content/extraction/tests` does not match the new folder; `actions/tests` already matches `actions/tests/click/tests`:
`EXTENSION_TEST_BUILD_LABEL=t743-x node scripts/test-extension.mjs content/extraction/tests extraction/item-record/tests actions/tests`
-> `# tests 445 / # pass 445 / # fail 0 / # cancelled 0 / # skipped 0`; there were no `not ok` lines.

`node scripts/structure-audit.mjs` (from the repo root). Before the split it showed 3 FAIL `[file-lines]` lines, one for each file, and ended with `structure-audit: 3 violation(s) across 1 rule(s).` After the split it shows no FAIL lines and ends with `structure-audit: passed (217 warning(s), 618 baselined).` The touched files now give only advisory warnings: `actions/tests/` at 25 files (advisory threshold 15), `click.test.ts` at 445 lines and `list-reader.ts` at 739 lines (advisory threshold 400).

## Not verified

- I ran no typecheck, as the brief forbids it. The esbuild bundle used by the test runner strips types, so a wrong type import in the new files would not show up in these runs. I checked the imports by hand against how each file uses them.
- I did not compare per-file test counts. Only the totals were compared (445 before, 445 after).

## Open questions or contradictions found

- The brief asked for the click split "in actions/tests/". That was not possible without going over the 25-file limit, because the directory was already at 25. The new test is therefore in a nested `tests/` folder under a support directory. The repo has one precedent for this layout: `domain/src/runtime/llm-evidence/tests/result-observation/tests/`.
- The rule is "one exported thing per file", but the support modules group related fixtures, with up to 6 exported values each (the audit warns at 8 and fails at 15). Each of `item-record/field-readers.ts` and `read-record.ts` exports one function plus the type it returns or takes. Splitting the click fixtures one per file would have meant about 17 tiny files. If the stricter reading is wanted, that is a mechanical follow-up.
