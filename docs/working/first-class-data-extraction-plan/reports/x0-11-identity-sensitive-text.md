# x0-11-identity-sensitive-text: no identity context, label, value or extract reply carries a sensitive control's contents

## Outcome

**Done.** Every item in the brief is finished and checked on the final tree.

- **The three named paths are closed.**
  - `identity/context.ts` reads every page string through the shared helper: the landmark reference, the fieldset legend, both heading lookups and the column header.
  - `identity/label.ts` leaves marked elements out of an associated label, gives nothing for a label inside a sensitive control, and filters the text beside an unlabelled control.
  - `web.dom.extract` refuses a target inside a sensitive control in every mode.
- **A fourth leak was found by the new harness case and fixed in an owned file.** A descriptor's `value` quoted the words of a span inside an editable region marked `data-sensitive`. The fix is in `readElementValue` in `describe-element.ts`; see "What changed".
- **The name post-filter in `describe-element.ts` is removed.** The narrowed scans in `actions.spec.ts` and `evidence.spec.ts` scan the whole reply again.
- **Tests.**
  - 9 new unit tests: 4 context, 3 label, 1 for the exported check, 1 for the value reader.
  - 2 new harness cases, and 2 restored scans with new positive assertions.
- **Mutations.** 7 mutations, all observed red and restored byte-identical. None was refused by the permission classifier, so no scratch copy was needed.
- **Documentation.** `docs/architecture/sensitive-values.md` is updated.
- **Final checks.**
  - Extension check: exit 0.
  - Unit tests: 548 of 548 pass.
  - Harness (`actions`, `evidence`, `identity-resolution`): 73 passed.
  - Structure audit: exit 1, only on the supervisor's `docs/working/README.md` index.

No synthetic secret value is quoted in this report. Injected strings are named by the route they were placed in.

## What changed and why

### `apps/extension/src/content/sensitive-text.ts`

- **`isWithinSensitiveControl` is now exported.** It is the existing ancestor walk, unchanged, and reads no text, so an empty element inside a marked region still counts as inside. Callers that must refuse rather than read, or that walk text themselves, need it on its own.
- **Header comment.** It now lists every caller: context, label, and extraction's refusal.
- **Structure audit.** The file now exports 2 values, under the audit's warning threshold of 8.

### `apps/extension/src/content/identity/context.ts`

- **New private `contextText(element)`.** It is `boundedText(textOutsideSensitiveControls(element), 200)`.
- **Where it is used.**
  - `fieldsetLegend`.
  - Both `nearestHeading` returns: the sibling itself, and the last heading inside a preceding sibling.
  - `columnHeader`.
  - `labelledByText` for the landmark name.
- **Kept.** The stricter `holdsInput` refusal of a reference that is a form control or an editable region.
- **Comments.** The header and the `landmarkName` doc comment say why: `context` rides on every descriptor, a sensitive control's included.

### `apps/extension/src/content/identity/label.ts`

- **`labelElementText`** returns `""` when `isWithinSensitiveControl(label)`.
- **`collectLabelText`** also skips a subtree rooted at an element for which `isSensitiveFormControl(node)` is true, as it already skipped nested controls.
- **`nearbyLabelText`** reads through `textOutsideSensitiveControls`.
- **Why the collector asks the rule directly** rather than calling `textOutsideSensitiveControls`: it has its own walk. That walk also skips nested ordinary controls and joins text nodes with a space. Replacing it with the helper's `textContent`-style join would change label spacing, for example `First<b>Name</b>`, for every identity signal.
- **Effect on names.** The associated-label text is also `accessibleNameFor`'s associated-label source, so the name and forms-evidence labels follow.

### `apps/extension/src/content/action-runtime/extract.ts`

- **The refusal** is now `isWithinSensitiveControl(element)` instead of `isSensitiveFormControl(element)`. That covers the live value, attribute and HTML modes alike. The refusal value is unchanged (`sensitive_value`), so the verb in `actions/extract.ts`, which is not mine, reports `web.action.rejected` / `blocked_by_capability_or_policy` as before.
- **Kept.** `readableText` and the export surface: `extractElement`, `readableText`, `ExtractedElementValue`.
- **Comments.** The header and the `readableText` doc comment are updated.

### `apps/extension/src/content/describe-element.ts`

- **Post-filter removed.** `accessibleNameOutsideSensitiveControls`, `labelledByTargets` and `holdsSensitiveContents` are deleted. `accessibleName` is now `accessibleNameFor(element)` as computed. `boundedText` and `isSensitiveFormControl` are no longer imported.
  - **Behaviour change.** A button named through `aria-labelledby` by a span holding a sensitive textarea is now named by the span's other words ("Hint"). Before, the name was withheld. The harness asserts the new behaviour.
- **Value reader (new finding).** `readElementValue` now returns `undefined` when `isWithinSensitiveControl(element)`.
  - **Where it showed.** Harness run 5 below found a span's words in the `value` of the element descriptor inside the extract refusal reply.
  - **Cause.** A span inside a marked `contenteditable` region is itself `isContentEditable`, and is not marked itself, so the old self-only rule read its `innerText`.
  - **Wider reach.** The same reader feeds the recorder's `dom.input`, the `dom.change` listener, and snapshot ranking and admission.
- **Same rule applied to two siblings,** for consistency: `checkedState`, and the select option-list guard. A select inside a marked element no longer lists its options. Neither is exercised by a test; see "Not verified".
- **Header comment.** It says `identity/` does the text filtering.

### Unit tests

- **`identity/tests/context.test.ts`**
  - The 11 existing tests are unchanged in substance. Each now runs under `withStubPage`'s globals, because the text readers call the shared rule, which names `HTMLInputElement`. The stub gained `querySelectorAll`, `childNodes`, `previousElementSibling` and `firstElementChild`.
  - All 11 passed before the source fix, so the wrapper changes nothing by itself.
  - **4 new tests** cover the legend, the heading found both ways, the landmark reference (holding marked words, and sitting inside a marked region, where it falls back to `aria-label`), and the column header. The column header test adds local `HTMLTable*Element` globals.
- **New `identity/tests/label.test.ts` (3 tests).**
  1. An associated label leaves out a nested marked span, and a sensitive textarea keeps "Recovery note".
  2. A label inside a marked region gives nothing, whether associated or beside.
  3. The text beside an unlabelled control skips a marked sibling, and reads a sibling holding a marked element by its other words.

  It imports `content/tests/stub-page.ts` unchanged, and adds `labels`, `matches`, `querySelector`, `previousElementSibling` and an `Element` global locally.
- **`content/tests/sensitive-text.test.ts`, 1 new test.** `isWithinSensitiveControl` is true for:
  - a select marked by an `autocomplete` token, and its option;
  - a marked region, and an empty element in it;
  - a password input.

  It is false for a label holding such a select, and for an ordinary option.
- **`content/tests/describe-element.test.ts`, 1 new test.** `readElementValue` gives nothing for a span in a marked editable region, or a text input in a marked group. An ordinary editable span is still read.

### Content harness

- **`e2e/content/tests/actions.spec.ts`**
  - **Snapshot case.** The `aria-labelledby` string joins `SNAPSHOT_SECRETS` and is scanned across the whole snapshot and reply. The narrowing comment is gone. The hint button now asserts `accessibleName: "Hint"`.
  - **New case,** "extract: an element inside a sensitive control is refused in every mode, as the control is".
    - It injects a marked `contenteditable` region holding a span with its own words and a `value` attribute.
    - It extracts, in all three modes, the sensitive select's `<option>` and that span.
    - Each reply must be rejected with no `extracted`. The whole reply is scanned for the fixture secrets, the injected textarea and select strings, and both span strings.
    - Positive check: an ordinary select's option still extracts `mornings`.
  - The file has 349 non-blank lines, and the audit gives it no warning.
- **`e2e/content/tests/evidence.spec.ts`**
  - **Naming case.** `jsonWithoutLandmarkNames` and its narrowed scan are gone, and the region string joins `NAMING_SECRETS` in the whole scan. A new assertion requires every descriptor whose context landmark is `region` to carry `landmarkName: "Saved notes"`, and at least one to exist.
  - **New case,** "sensitive-input: no descriptor's context or label quotes a sensitive control's contents".
    - It injects into `main`: a fieldset legend, a heading before a button, a table header, a `<label for>`, and an unlabelled input with a plain and a marked span before it. Each holds a marked span.
    - It scans the whole snapshot and the capture reply for those five strings and the fixture secrets.
    - Positive assertions: `fieldsetLegend` "Delivery", `heading` "Account", `tablePosition` `{ row: 2, column: 1, columnHeader: "Card" }`, `label` and `accessibleName` "Nickname", and `label` "Alias".
  - 628 lines: an advisory warning, under the 800 limit.

### `docs/architecture/sensitive-values.md`

- **"Element descriptors."**
  - `readElementValue` now also withholds for an element inside a sensitive control, with the editable-span example.
  - The sentence on the descriptor withholding an `aria-labelledby` name is replaced: the name is taken as computed.
  - A new paragraph says `label.ts` and every `context` string read through the same helper.
- **"Not a rule about page text."**
  - Descriptors' `label` and `context` are now included.
  - Extraction refuses a sensitive control and any element inside one, in every mode.
  - The list of strings still unfiltered drops `label.ts` and `context`, keeps `loading.ts` and `repeating.ts`, and adds `identity/candidates.ts`'s raw `visibleText`, found by reading.

## Commands run and observed results

Every command ran from `F:\!FluxIQWebExtension`, one at a time, never beside another check. Several were chained in one shell command, strictly one after another. The harness always ran with `--workers=1`. Output was saved to the session scratchpad.

- **Unit:** `EXTENSION_TEST_BUILD_LABEL=x0-11 node apps/extension/scripts/test-extension.mjs`
- **Harness:** `pnpm --filter @fluxiq-web-extension/extension test:content -- actions evidence identity-resolution --workers=1`

The session was interrupted once by a process crash, after the spec edits and before the unit tests were written. On resume, `git status` and a Grep confirmed which edits had landed. The rest was redone from that point.

1. **Unit tests before the fix.** Exit 1: `# tests 547`, `# pass 539`, `# fail 8`.
   - Failing: `not ok 339`–`342` (the new context tests), `351`–`353` (the label tests), and `410` (`isWithinSensitiveControl2 is not a function`, because it was not exported yet).
   - The context and label failures were assertion diffs in which the actual value contained the marked words.
2. **Harness before the fix.** Exit 1: `4 failed`, `69 passed (29.1s)`.
   - `actions.spec.ts:302`: the descendant case, the status assertion.
   - `actions.spec.ts:371`: the `Hint` name, withheld by the old post-filter.
   - `evidence.spec.ts:567`: the region string in the whole scan.
   - `evidence.spec.ts:618`: the legend string, the first of the new case's secrets.
3. **Extension check** after the fix to context, label, extract and the post-filter: exit 0, with no `error TS`.
4. **Unit tests:** exit 0, `# tests 547`, `# pass 547`, `# fail 0`.
5. **Harness:** exit 1, `1 failed`, `72 passed (24.2s)`.
   - It failed at `actions.spec.ts:305`: a span string was found in the refusal reply.
   - The saved output shows it as the element descriptor's `"value"`, right after its `xpath`. That traced to `readElementValue`'s `isContentEditable` branch, and led to the value-reader fix.
6. **Extension check:** exit 0.
7. **Unit tests:** exit 0, `# tests 548`, `# pass 548`, `# fail 0`.
8. **Harness:** exit 1, `1 failed`, `72 passed (55.6s)`.
   - The failure was `evidence.spec.ts:250:3 › infinite-feed: repeating structures`, with `Tearing down "openHarness" exceeded the test timeout of 30000ms.` There was no assertion diff.
   - Every `actions` case passed, including both new or changed ones. All 22 `identity-resolution` lines were in the run with no other failure.
9. **Evidence spec rerun alone:** exit 0, `32 passed (11.9s)`. That row took 221ms.
10. **Structure audit.** `node scripts/structure-audit.mjs`: exit 1.
    - Only FAIL: `[working-docs] docs/working/README.md is out of date with the documents' header blocks`.
    - Warnings on my paths: `[directory-files] apps/extension/src/content/: 17 source files`, unchanged, and `[file-lines] …/evidence.spec.ts: 628 lines`.
11. **Mutations.** A scratch script, `x0-11-mutate.mjs`, kept in the scratchpad outside the repository, ran each one. For each mutation it:
    - required every text to be replaced to occur exactly once;
    - backed the file up to the scratchpad and applied the edit;
    - confirmed the mutated text was present, then ran one check;
    - restored the file and compared bytes.

    Every run printed `mutated text present: true` and `identical to original after restore: true`.

    | # | Mutation (real source) | Check | Observed |
    | --- | --- | --- | --- |
    | M1 | `contextText` reads raw `element.textContent` | unit | exit 1, `# fail 4`: `not ok 339`–`342` |
    | M1 | same | harness `actions evidence` | exit 1, `2 failed`, `49 passed`: at `evidence.spec.ts:567` (landmark) and `:618` (context case) |
    | M2 | label collector no longer skips a sensitive subtree | unit | exit 1, `# fail 1`: `not ok 351` |
    | M3 | `labelElementText` ignores `isWithinSensitiveControl` (`&& false`) | unit | exit 1, `# fail 1`: `not ok 352` |
    | M4 | `nearbyLabelText` reads raw `textContent` | unit | exit 1, `# fail 2`: `not ok 352`, `353` |
    | M5 | `extractElement` refuses only a control itself (`isSensitiveFormControl`) | harness `actions evidence` | first attempt: exit 2, the harness never ran (see below); rerun: exit 1, `2 failed`, `49 passed` (see below) |
    | M6 | `readElementValue` asks only the element itself (the old rule, through an added import) | unit | exit 1, `# fail 1`: `not ok 395` |
    | M7 | `isWithinSensitiveControl` stops at the element itself | unit | exit 1, `# fail 8`: `not ok 325`, `327`, `341`, `352`, `395`, `396`, `409`, `411` |

    **M5's first attempt.** The `test-contracts` build that `test:content` runs first failed on `packages/test-contracts/src/bench-report-validation.ts(110,5): error TS2304: Cannot find name 'checkExtractionByLane'`. That is another worker's in-flight file, not mine, and no test ran.

    **M5's rerun.** The build passed. The two failures were:
    - `actions.spec.ts:287 › extract: an element inside a sensitive control…`, at `:302` (Expected −5, Received +1: the reply succeeded instead of being refused). This is the intended red.
    - `evidence.spec.ts:250:3 › infinite-feed: forms are not invented…`, with the same `Tearing down "openHarness" exceeded the test timeout of 30000ms`, on a different row from run 8.
12. **Final extension check:** exit 0.
13. **Final unit tests:** exit 0, `# tests 548`, `# pass 548`, `# fail 0`, `# cancelled 0`.
14. **Final harness:** exit 0, `73 passed (24.0s)`: 19 `actions`, 32 `evidence`, 22 `identity-resolution`.
15. **After the reverts.**
    - `git diff --stat -- apps/extension/build domain/.test-build` printed nothing.
    - Every mutation's byte comparison was true, and the final runs are green.
    - `git diff --stat` on my tracked files: 9 files, 565 insertions and 150 deletions. That figure includes x0-9's and x0-10's uncommitted edits in the shared files (`actions.spec.ts`, `evidence.spec.ts`, `extract.ts`, `describe-element.ts`, `describe-element.test.ts`, `sensitive-values.md`).
    - Untracked and mine: `identity/tests/label.test.ts`. `sensitive-text.ts` and its test were already untracked, from x0-9.

## Not verified

- **Recorded events.** The value-reader change also affects the recorder's `dom.input` and the `dom.change` listener when the target sits inside a marked editable region or group. No recorder spec ran, and no harness case records such an event.
- **`checkedState` and the select option list.** For a checkbox, radio or select inside a marked element (not itself marked), these now withhold. That was changed for consistency, but no test, unit or harness, exercises either.
- **Other specs.** Only `actions`, `evidence` and `identity-resolution` ran. The changes that could shift other specs are: labels (marked elements skipped), context strings, names built through `aria-labelledby` (now kept rather than withheld), and value-based snapshot admission for elements inside marked regions. The specs not run include `identity`, `identity-signals` (landmark names), `identity-veto`, `extract-list`, `selection-redaction`, `redaction` and the recorder specs.
- **The teardown timeouts.** Two single observations, each on an `infinite-feed` row, each in `openHarness` teardown, and each passing elsewhere (runs 9 and 14). By the machine rule they are attributed to the environment, but that rests on those two observations. Both came after the value-reader change, which adds an ancestor walk to every `readElementValue` call in the snapshot sweep. The clean runs (24.0s for the full set, 11.9s for `evidence` alone) show no general slowdown, but performance was not measured.
- **Browsers and isolation.** Only the harness's Chromium ran, in the page's main world. Firefox, a loaded unpacked extension, the isolated world and shadow DOM were not exercised.
- **`list-extraction.ts`.** I did not read its current state. Whether a list field on an element inside a sensitive control (for example `option@value` in a sensitive select) is refused is unknown to me; x0-10 open question 5.
- **Repository-wide gates.** `pnpm check`, `pnpm test` and `pnpm build` were not run.
- **Documentation header.** The doc still says "verified against source on 2026-09-13". My paragraphs were checked against source today; the rest was not re-verified.

## Open questions or contradictions found

1. **The verb's refusal wording (`x1-page-b`'s file).** `actions/extract.ts` says "the target is a sensitive control, so its value is never read". For a descendant, "is, or sits inside, a sensitive control" would be accurate. The code path is correct; only the words are.
2. **List extraction.** `isWithinSensitiveControl` is now exported for exactly this use: `list-extraction.ts` should refuse a field element that is, or sits inside, a sensitive control in every mode (D2), with a harness case in `extract-list.spec.ts`. Both files belong to `x1-page-b`.
3. **Raw readers still outside my ownership (found by reading, not observed).**
   - `identity/candidates.ts:196`: a resolver candidate's `visibleText` is `boundedText(element.textContent)`.
   - `identity/reportable-text.ts:80`: `boundedText(element.textContent)`. That module's header says failures quote it, so a failure naming candidates may quote a marked element's words. I did not trace it.
   - `evidence/loading.ts:63` falls back to raw text.
   - `evidence/repeating.ts:82` reads the representative's raw text.

   The doc names the first, third and fourth. `reportable-text.ts` is not named, because I did not confirm it reaches the wire.
4. **Scope.** The value-reader fix, and the matching `checkedState` and option-list changes, go beyond the three paths the brief named. They sit in a file I own, and meet the brief's goal that no descriptor or extract reply carries a sensitive control's contents. The leak was observed, not inferred (run 5). Please confirm the two unexercised siblings are wanted.
5. **Structure audit.** The `working-docs` FAIL is the supervisor-owned `docs/working/README.md` regeneration (`pnpm structure:baseline`), unrelated to my paths.
6. **The test-contracts build.** It was red once, mid-run, on another worker's `bench-report-validation.ts`. It built cleanly in the final harness run, so that file was being edited.
7. **Ownership reading.** I treated the new `identity/tests/label.test.ts` as part of "label.ts and its tests". `content/tests/stub-page.ts` is imported but not edited.
8. **Line endings.** Git warns "LF will be replaced by CRLF" for the modified files; the content is unaffected.
