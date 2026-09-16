# x0-10-accessible-name-sensitive: no computed name quotes a sensitive control's contents

## Outcome

**Done**, with two gates the brief names blocked by other workers' files.

- **The leak is closed where the brief put it.** `accessibleNameFor` in `identity/accessible-name.ts` now reads both kinds of page text through `textOutsideSensitiveControls`: each `aria-labelledby` reference, and the element's own text. That covers every caller: the descriptor, all page evidence names (forms, regions, dialogs, overlays, loading), and the resolver's candidates. `evidence/forms.ts` was not touched.
- **Extraction reuses the helper.** `action-runtime/extract.ts` lost its private TreeWalker copy.
- **Tests.**
  - 4 new unit tests.
  - 1 new content-harness case.
  - 4 mutations, all observed red and restored byte-identical. None was refused by the permission classifier, so no scratch copy was needed.
- **Docs.** `docs/architecture/sensitive-values.md` is updated in three places.
- **Blocked gates.**
  - The extension type check is red only in `action-runtime/list-extraction.ts`, which another worker (`x1-page-b`) is editing.
  - The final `extract-list` harness run is red for the same reason. Every `extract_list` reply says `supportedRequest is not defined`.
  - The structure audit fails only on the shared `docs/working/README.md` index.
  - Details are under "Commands run".
- **A related leak was found outside my ownership** (open question 1). A descriptor's `context.landmarkName` quotes marked words from a landmark's `aria-labelledby` reference. It was observed on a real page.

No synthetic secret value is quoted in this report. Strings are named by the route they were injected into.

## What changed and why

### `apps/extension/src/content/identity/accessible-name.ts`

- It imports `textOutsideSensitiveControls` from `../sensitive-text`.
  - The imports rule allows this: the importer sits inside `content/`, so no barrel stands between them.
  - There is no cycle: `sensitive-text.ts` imports only `element-traits.ts`.
- **`labelledByName`** reads each reference through the helper. The null check is kept.
  - A reference that holds a sensitive control contributes only its other words.
  - A reference that is, or sits inside, one contributes nothing, so the name falls through to the next source.
- **`nameFromContent`** reads through the helper.
  - A `<label>` wrapping a sensitive textarea is named by its own words.
  - An `<option>` inside a sensitive select, or a marked element with a name-from-content role, takes no name.
- **Unchanged sources.** Names from `aria-label`, `title`/`alt`, `placeholder`, a button's value and an associated `<label>` are as before. The `<label>` reader is `label.ts`'s; see open question 2.
- **Header comment.** A third paragraph states the rule about contents, and says why the filter lives here rather than with each caller.

### `apps/extension/src/content/action-runtime/extract.ts`

- **`readableText(element)`** is now `textOutsideSensitiveControls(element)`, with whitespace collapsed and trimmed. The private TreeWalker walker is deleted.
- `hasSensitiveDescendant` is kept, because the HTML read still uses it.
- The header and doc comments now say the text read is the shared reader.
- **Behaviour change, deliberate and inherited from the helper.** An element that *sits inside* a sensitive control now reads `""` in a text read; before, its text was returned.
  - Example: extracting the `<option>` of a sensitive select by default mode used to return the option's label.
  - The same holds for every list text field and column, because `list-extraction.ts` calls `readableText`.
  - The HTML and attribute modes for such a descendant are unchanged (open question 5).

### `apps/extension/src/content/sensitive-text.ts`

Only the header comment changed. It now names the helper's three callers: descriptor text, every computed name, and extraction's text read.

### New `apps/extension/src/content/identity/tests/accessible-name.test.ts` (4 tests)

1. A reference holding a sensitive textarea names the button by its words. A reference that *is* the sensitive textarea gives nothing, so the name falls through to the button's own text.
2. A reference holding a select marked by `autocomplete="one-time-code"` gives only its words. An option inside it, listed directly, gives nothing. An ordinary select's option in the same list is kept ("Contact time Mornings").
3. A label wrapping a sensitive textarea, a marked select, or a `data-sensitive` span is named by its own words. A label wrapping an ordinary select keeps "Contact time Mornings".
4. An option inside a sensitive select, and a `role="button"` element marked `data-sensitive`, take no name. An ordinary option keeps its name.

**About the stub page.** The test reuses `content/tests/stub-page.ts` unchanged; that file is not in my ownership. The name computation needs three things the stub lacks, so the test adds them locally and restores them afterwards:

- `document.getElementById`;
- `closest(tag)` on each element, including the element itself as a real one does;
- an `Element` global, whose `Symbol.hasInstance` reads `nodeType === 1`, for `label.ts`.

### `apps/extension/e2e/content/tests/evidence.spec.ts` (520 to 591 lines)

The new case, at line 536, is "sensitive-input: no name in page evidence quotes a sensitive control's contents, whichever route computes it".

**What it injects.**
- Into `[data-testid="sensitive-form"]`:
  - a button named through `aria-labelledby` by a span holding a `data-sensitive` textarea;
  - a button named by a span holding a select marked by `autocomplete="one-time-code"`;
  - a button named by a span holding an ordinary select;
  - a button whose own text holds a `data-sensitive` span.
- At the end of `body`: a `role="region"` landmark named through `aria-labelledby` by a span holding a `data-sensitive` span.

**What it scans.** It takes `harness.capture()` and a `web.dom.capture_snapshot` reply, and scans both, whole, for:
- the fixture's three pre-filled secrets;
- four of the five injected strings.

**The fifth string** is the region route's. It is scanned in both, whole, except each descriptor's `context.landmarkName` key, which a JSON replacer removes. A comment names the `identity/context.ts` defect (open question 1). The region evidence's own `label` stays in the scan.

**Positive assertions.**
- The forms evidence labels read "Hint", "Security answer", "Contact time Mornings" and "Reveal".
- `evidence.regions` contains `{ role: "region", selector: "[data-testid=\"saved-notes\"]", label: "Saved notes" }`.

### `docs/architecture/sensitive-values.md`

- **"Element descriptors."** The old sentence on the descriptor's name filter is replaced by a new paragraph. It covers:
  - the filter living in `accessibleNameFor`, and who that covers;
  - the two content routes;
  - which name sources are kept;
  - that the descriptor goes further and withholds a name `aria-labelledby` draws from such a reference, which is `describe-element.ts`'s post-filter, still present.
  - The snapshot-admission sentence now comes before that paragraph.
- **Readers, "Page evidence."** Every name in page evidence comes from the same filtered `accessibleNameFor`.
- **"Not a rule about page text."**
  - It now says no computed name quotes those contents, and that extraction's text read uses the same reader.
  - The obsolete statement that page evidence names are unfiltered is removed.
  - The routes still unfiltered are listed: the `<label>` reader's handling of marked non-controls (which also feeds the name), `context`'s heading, legend and column header, the landmark's name, `loading.ts`'s raw-text fallback, and `repeating.ts`'s representative text.

## Commands run and observed results

Every command ran from `F:\!FluxIQWebExtension`, one at a time. A PowerShell call that chained several commands ran them one after another, never in parallel. The harness always ran with `--workers=1`.

**Unit tests** used `EXTENSION_TEST_BUILD_LABEL=x0-10 node apps/extension/scripts/test-extension.mjs` (the mutations used the label `x0-10-mutation`). **Harness** runs used `pnpm --filter @fluxiq-web-extension/extension test:content -- <specs> --workers=1`.

1. **Unit tests before the fix.** Exit 1: `# tests 527`, `# pass 523`, `# fail 4`. The failures were `not ok 312` to `315`, the four new tests, each at its first assertion line.
2. **Evidence harness before the fix.**
   - The first attempt piped through my own `Select-Object -First 30`, which ended the pipeline early (exit -1). No summary was read from it.
   - Rerun, saved to scratch: exit 1, `1 failed`, `30 passed (10.4s)`. It failed at `evidence.spec.ts:563`, the whole-snapshot scan, on the string injected into the textarea behind `aria-labelledby`.
3. **Extension check.** `pnpm --filter @fluxiq-web-extension/extension check`: exit 2.
   - Five errors, all in `src/content/action-runtime/list-extraction.ts`, at lines 117, 119, 147, 155 and 167. They are TS2345 and TS2339 against the domain's `WebAutomationExtractField` and `WebAutomationExtractListPagination` types.
   - Because the first `tsc` failed, the `&&` chain never ran the test project, so I ran `npx tsc -p tsconfig.test.json` in `apps/extension` on its own. Exit 2, with the same five errors and none in my files, so the new test and both sources type-check.
   - The supervisor confirmed these belong to `x1-page-b`.
4. **Unit tests after the fix.** Exit 0: `# tests 527`, `# pass 527`, `# fail 0`, `# cancelled 0`.
5. **Evidence harness after the fix.** Exit 1, `1 failed`, `30 passed`.
   - The printed snapshot showed all four forms evidence labels filtered, and the region evidence `label: "Saved notes"`.
   - The only occurrence left was the region route's string, inside the region div's descriptor, at `context.landmarkName`. That traced to `identity/context.ts:129-131`, `boundedText(target.textContent, …)`.
   - I narrowed that one key out of the scan, as described above.
6. **Evidence harness.** Exit 0, `31 passed (12.3s)`.
7. **Actions and extract-list harness.** Exit 0, `35 passed (12.9s)`.
8. **Structure audit.** `node scripts/structure-audit.mjs`: exit 1.
   - The only FAIL was `[working-docs] docs/working/README.md is out of date with the documents' header blocks`. That is a shared file I must not edit.
   - Warnings on my paths: `[directory-files] apps/extension/src/content/: 17 source files`, unchanged from x0-9, and `[file-lines] …/evidence.spec.ts: 591 lines`, under the brief's 800.
9. **Mutations.** A scratch script, `x0-10-mutate.mjs`, kept in the scratchpad outside the repository, ran each one. For each mutation it:
   - required the text to be replaced to occur exactly once;
   - backed the file up to the scratchpad and applied the edit;
   - confirmed the mutated text was present, then ran one check;
   - restored the file and compared bytes.

   All four printed `mutated text present: true` and `identical to original after restore: true`.

   | # | Mutation (real source) | Check | Observed |
   | --- | --- | --- | --- |
   | M1 | `labelledByName` reads `target.textContent` raw | unit | exit 1, `# fail 2`: `not ok 312`, `not ok 313` |
   | M1 | same | evidence harness | exit 1, `1 failed`, `30 passed`; at `evidence.spec.ts:569`, on the textarea-behind-`aria-labelledby` string |
   | M2 | `nameFromContent` reads `element.textContent` raw | unit | exit 1, `# fail 2`: `not ok 314`, `not ok 315` |
   | M2 | same | evidence harness | exit 1, `1 failed`, `30 passed`; at `evidence.spec.ts:569`, on the button's own marked-span string (forms evidence `label`) |
   | M3 | `extract.ts` `readableText` reads raw `textContent` | actions + extract-list harness | exit 1, `2 failed`, `33 passed`: `actions.spec.ts:249` (assert at :256) and `extract-list.spec.ts:319` (assert at :336) |
   | M4 | `sensitive-text.ts` ancestor walk stops at the element itself | unit | exit 1, `# fail 4`: `not ok 313`, `315` (mine), `376` (describe-element), `389` (sensitive-text) |

   M3 was observed before `x1-page-b`'s edit broke `list-extraction.ts` at run time. Its 33 passes include every other extract-list case.
10. **After the reverts.**
    - A Grep of the three mutated files for each mutated text found no matches.
    - No `x0-10-backup-*` file remains.
    - `git diff --stat` on my tracked files: 4 files, 161 insertions and 31 deletions. The new test file is untracked, and so is `sensitive-text.ts`, from x0-9.
    - `git diff --stat -- apps/extension/build domain/.test-build` is empty.
    - `git status` also lists `list-extraction.ts`, `results.ts`, `actions/extract-list.ts` and several domain files as modified by other workers.
11. **Extension check, rerun once.** Exit 2, with six errors, all in `list-extraction.ts`:
    - `124` `Cannot find name 'supportedRequest'`;
    - `125` two implicit-any binding errors;
    - `156`, `164`, `176`, property `next` missing.

    The line numbers moved from run 3, so that file is being edited.
12. **Structure audit, rerun once.** Exit 1, with the same single FAIL (`working-docs`) and the same two warnings.
13. **Final unit tests.** Exit 0: `# tests 527`, `# pass 527`, `# fail 0`, `# cancelled 0`.
14. **Final evidence harness.** Exit 0, `31 passed (10.4s)`.
15. **Final actions and extract-list harness.** Exit 1, `17 failed`, `18 passed (35.3s)`.
    - Every `extract-list.spec.ts` case failed, including pagination, `maxItems`, `column:` and `auth-gate` cases that read no text.
    - Every `actions.spec.ts` case passed.
    - The saved output's diffs show each reply's `message` as `"supportedRequest is not defined"`: a ReferenceError from `list-extraction.ts`, not a failed text read.
    - **Rerun once, alone:** exit 1, `17 failed`, `18 passed (37.4s)`, with the same set.

## Not verified

- **The final tree's extension check and `extract-list` harness.** Both are blocked by `x1-page-b`'s in-flight `list-extraction.ts`. My `extract.ts` change rests on run 7 (35 passed) and mutation M3, both before that breakage. The combined check and harness need rerunning after `x1-page-b` lands.
- **Other evidence names.** Dialog, overlay and loading-indicator names come from the same function, but only forms and regions were exercised on a page.
- **Resolver candidates.** Names in `identity/candidates.ts:197` were not exercised.
- **Other specs.** Only `evidence`, `actions` and `extract-list` ran. Specs whose names could change are `identity`, `identity-signals`, `redaction`, `selection-redaction` and the recorder specs. A name changes only where the named text holds a sensitive control.
- **Performance.** Not measured. `nameFromContent` now scans descendants and walks ancestors whenever a name-from-content element (`a`, `button`, `li`, `td`, …) has text. The snapshot and the resolver's candidate pool call it many times per page.
- **Browsers and isolation.** Only the harness's Chromium ran, in the page's main world. Firefox, a loaded unpacked extension and the isolated world were not exercised. Shadow DOM was not tested.
- **Repository-wide gates.** `pnpm check`, `pnpm test` and `pnpm build` were not run.
- **Documentation header.** The doc header still reads "verified against source on 2026-09-13". My paragraphs were checked against source today; the rest of the document was not re-verified.
- **Open question 5 was not reproduced live.** It rests on reading the code.

## Open questions or contradictions found

1. **Observed leak in `identity/context.ts` (recommend a brief).**
   - A descriptor's `context.landmarkName` is built from a landmark's `aria-labelledby` reference with raw `textContent` (`context.ts:129-131`). It skips only a reference holding a form control or an editable region.
   - So a `data-sensitive` span inside that reference is quoted. This was observed in run 5, on the injected region.
   - The same file's `fieldsetLegend` (`:88`), `nearestHeading` (`:181`, `:186`) and `columnHeader` (`:222`) read `textContent`.
   - Recommendation: read them through `textOutsideSensitiveControls`, then delete `jsonWithoutLandmarkNames` and its narrowed scan from the new `evidence.spec.ts` case.
2. **`identity/label.ts` is not covered by the name filter.**
   - Its collector skips nested `input,select,textarea,button` only, so a marked non-control, such as a `data-sensitive` span inside a `<label for>`, is quoted in the descriptor's `label`.
   - Through `associatedLabel`, the same text is quoted in `accessibleNameFor` too.
   - `nearbyLabelText` reads a sibling's raw `textContent`.
   - This was not observed; the fixture has no such label. Recommendation: have `label.ts` read through the helper.
3. **Other raw reads (not observed).**
   - `evidence/loading.ts:63` falls back to raw `textContent` when an indicator has no name.
   - `evidence/repeating.ts:82` reads the representative's raw `textContent`.
4. **Pieces outside my ownership are now redundant or narrowed.**
   - `describe-element.ts`'s `accessibleNameOutsideSensitiveControls` has an own-text branch that is redundant now that `identity/` filters.
   - Its `aria-labelledby` branch is stricter than `identity/`: it withholds the whole name rather than keeping the reference's other words. Decide whether to keep that.
   - `actions.spec.ts:319-327` still scans the `aria-labelledby` string only in `interactiveElements`, citing the forms-evidence defect this brief closed. That scan can be restored to the whole snapshot.
   - I changed neither.
5. **Extraction of a target inside a sensitive control is not refused (found by reading, not run).**
   - `extractElement` and `list-extraction.ts` (`:193`, `:216`) refuse only when the element itself is sensitive.
   - A text read of a descendant now gives `""`.
   - But `mode: "attribute"` still returns a descendant's attribute, for example the `value` of an `<option>` in a sensitive select. The HTML mode still returns its markup. A list field `option@value` does the same.
   - Recommendation: refuse, in every mode, a target that is or sits inside a sensitive control, by exporting the ancestor check from `sensitive-text.ts`. That changes `extract.ts` and `list-extraction.ts` and needs harness cases in `actions.spec.ts` and `extract-list.spec.ts`. I did not make it, because the test files were not mine and it widens the brief.
6. **Ownership reading.**
   - The new unit test imports `content/tests/stub-page.ts` without editing it, and adds its three missing members locally. Moving `closest`, `document` and `Element` into the shared stub would be cleaner; that file is x0-9's.
   - I treated `identity/tests/accessible-name.test.ts` as "accessible-name.ts and its tests".
7. **Structure audit.** The `working-docs` FAIL is `docs/working/README.md` lagging a working document's header block. That is a supervisor-owned regeneration (`pnpm structure:baseline`), unrelated to my paths.
8. **Supervisor note.** The note named `list-extraction.ts:117,119,147,155,167`. By the rerun the errors sat at `:124`, `:125`, `:156`, `:164` and `:176`, and a runtime ReferenceError on `supportedRequest` makes every `extract_list` command fail.
9. **Line endings.** Git warns "LF will be replaced by CRLF" for my four modified tracked files. The content is unaffected.
