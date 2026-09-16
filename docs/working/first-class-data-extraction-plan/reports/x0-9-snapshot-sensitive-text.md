# x0-9-snapshot-sensitive-text: no element descriptor quotes a sensitive control's contents

## Outcome

**Done.** Every item in the brief is finished and checked.

- **The leak is closed.** No element descriptor quotes a sensitive control's contents through `text`, `visibleText` or `accessibleName`. A container's text leaves those contents out.
- **The narrowed scans are restored.** All three specs x0-page narrowed scan the whole reply again, and all three pass.
- **Tests added.** There are 7 new unit tests and 1 new content-harness case, all on the sensitive-input fixture.
- **Documentation updated.** `docs/architecture/sensitive-values.md` is updated.
- **Checks pass.** The extension check, the labelled unit tests, the harness for `actions` and `extract-list`, and the structure audit all pass on the final tree.
- **Mutations.** Six were tried. All six were observed red and reverted byte-identical. None was refused by the permission classifier.

**A separate leak was found outside this brief** (open question 1). The forms evidence in the snapshot names a form control with `accessibleNameFor` unfiltered. So a control named through `aria-labelledby` by an element holding a sensitive textarea quotes that textarea's text in `evidence.forms[].controls[].label`. The fix belongs in `identity/accessible-name.ts` or `content/evidence/forms.ts`, both outside my ownership. In the new harness case, only that one string is scanned in the element descriptors rather than the whole snapshot, with a comment naming the defect. Every other string is scanned across the whole snapshot and reply.

## What changed and why

### New helper: `apps/extension/src/content/sensitive-text.ts`

It has one export, `textOutsideSensitiveControls(element, extent = "all" | "own")`. Both of its rules ask the shared rule through `isSensitiveFormControl`; neither restates it.

- **Inside a sensitive control.** An element that is, or sits inside, a sensitive control gives `""`. The check walks up `parentElement`. This covers:
  - a sensitive textarea itself;
  - an `<option>` inside a sensitive select, which a listbox renders and a snapshot can describe on its own;
  - anything inside a `data-sensitive` editable region.
- **Containers.** Any other element's text leaves out every subtree rooted at a sensitive control inside it. The walk is iterative over `childNodes`, in document order.
- **`extent`.** `"all"` reads as `textContent` does. `"own"` reads only the element's own text nodes, joined by a space; that logic moved here from `directVisibleText`.
- **Cost.**
  - Text with no non-whitespace character is returned before any scan.
  - When no text-bearing sensitive descendant exists, native `textContent` is returned unchanged.
  - The descendant scan asks the rule only of descendants that have children, because a childless control such as a password `<input>` holds no text.

**Why a new helper rather than reusing x0-page's `readableText`.**

- It is not exported through the `action-runtime` barrel.
- Importing `./action-runtime/extract` directly would be a new ratcheted `imports` finding.
- Importing through the barrel would create a cycle, because `action-runtime/execute-action.ts` imports `describe-element`.
- `action-runtime/**` is on the must-not-touch list.

So the rule now has two copies (open question 3).

### `apps/extension/src/content/describe-element.ts`

- **`visibleText` and `directVisibleText`** now read through the helper (`"all"` and `"own"`), then collapse, trim and cap at 500 characters as before.
  - The descriptor's `text` and `visibleText` are these two readers.
  - So are the snapshot's ranking and admission in `dom-snapshot.ts`, which that file reaches by importing them unchanged.
- **`accessibleName`** is now set from a private `accessibleNameOutsideSensitiveControls(element)`:
  - **References.** If any element listed in `aria-labelledby` (other than the element itself) has text that changes when sensitive contents are left out, the name is withheld. All listed ids are judged, which is at least as many as `identity/` reads, so its joining rule is not copied.
  - **Own text.** If the element's own text changes when filtered, and the name equals `boundedText(textContent, name.length)`, the name came from that text. It is replaced by `boundedText(filteredText, name.length)`. `boundedText` is imported from the identity barrel rather than re-implemented. For an element inside a sensitive control, the replacement is nothing.
  - **Everything else.** A name from `aria-label`, an associated `<label>`, `title` or `placeholder` is kept. So the sensitive textarea keeps the name "Recovery note" that its label gives it.
- **Header comment** now has a paragraph on the text rule.

### Unit tests

- **New `apps/extension/src/content/tests/stub-page.ts`.** This is test support. It is a hand-built node tree with the few DOM members the readers use, plus the `Node` and `HTML*Element` globals, installed per test and put back afterwards. Exports: `element`, `input`, `withStubPage`. The precedent is `background/connection/tests/active-recording-test-harness.ts`.
- **New `apps/extension/src/content/tests/sensitive-text.test.ts`**, with 5 tests:
  - a container leaves out a sensitive textarea's text and a sensitive select's option labels, and keeps an ordinary select's;
  - the shared rule reaches a text-bearing element whose `autocomplete` is the multi-token `billing cc-number`;
  - an element that is, or sits inside, a sensitive control gives `""` for both extents;
  - a label wrapping a password input reads exactly as `textContent`;
  - own text is the element's own text nodes joined by a space.
- **`apps/extension/src/content/tests/describe-element.test.ts`** now uses the shared stub. Its two file-input tests are unchanged in substance. Two tests are new:
  - `visibleText` and `directVisibleText` give nothing for a sensitive textarea, or for an option inside a select marked by `autocomplete="one-time-code"`;
  - a label wrapping a sensitive textarea reads "Recovery note", and an ordinary label and select read "Contact time Mornings".

### Content harness (the specs x0-page narrowed)

- **`e2e/content/tests/actions.spec.ts`**
  - Both container extract cases, text and HTML, scan the whole reply again for the fixture's secrets and the injected strings. The narrowing comment is gone.
  - **New case:** "capture_snapshot: no descriptor quotes a sensitive control's contents, and a container's text leaves them out".
    - It uses `addContentBearingControls` plus a new helper, `addSnapshotOnlyRoutes`. That helper adds a sensitive listbox (`size="2"`), a sensitive editable region with `aria-label`, and a button named through `aria-labelledby` by a span holding a sensitive textarea.
    - It scans both `harness.capture()` and a `web.dom.capture_snapshot` reply, whole, for every secret except the `aria-labelledby` one.
    - That one is scanned in `interactiveElements` of both, with a comment naming the forms-evidence defect.
    - Positive assertions:
      - the sensitive textarea keeps `accessibleName` and `label` "Recovery note" and has no `text` or `visibleText`;
      - the editable region keeps `accessibleName` "Private note" and has no `text`;
      - the labels wrapping each of the three sensitive controls read exactly their own words in `text`, `visibleText` and `accessibleName`;
      - the ordinary select's label keeps "Contact time Mornings";
      - the button keeps `text` "?" and has no `accessibleName`.
- **`e2e/content/tests/extract-list.spec.ts`**: the case "a text field skips the contents of sensitive controls inside it" scans the whole reply again.

### `docs/architecture/sensitive-values.md`

- **Capture, "Element descriptors" bullet.** A new paragraph: a descriptor does not quote what a sensitive control holds as text. It names the helper and states:
  - the rules for a sensitive control, anything inside one, and a container's text;
  - the `accessibleName` filter;
  - the effect on snapshot admission.
- **"Not a rule about page text" bullet**, rewritten:
  - The rule reaches into text in two places only: the selection, and a sensitive control's contents, covering descriptors and extraction.
  - Unmarked page text is still ordinary content.
  - It lists the strings not yet filtered: a descriptor's `label` for marked elements that are not form controls, the `context` heading, legend and column header, and page evidence names, with the forms example.
  - The obsolete sentence saying the display rule "is not built" is removed.

## Commands run and observed results

Every command ran from `F:\!FluxIQWebExtension`, one at a time, never beside another check, test, harness run or audit. The harness always ran with `--workers=1`. No crash or uniform timeout occurred, so nothing needed a rerun for hardware reasons.

1. **Pre-fix harness.** Specs restored and the new case added; `describe-element.ts` still unchanged.
   - Command: `pnpm --filter @fluxiq-web-extension/extension test:content -- actions extract-list --workers=1`
   - Result: exit 1, `4 failed`, `31 passed (18.9s)`.
   - The failures were exactly the four intended cases, each at a whole-reply scan on the injected textarea string: `actions.spec.ts:249` (text read), `:263` (HTML read), `:307` (new snapshot case), and `extract-list.spec.ts:319`.
2. **Extension check after the fix.** `pnpm --filter @fluxiq-web-extension/extension check`: exit 0. Both `tsc` passes printed nothing.
3. **Unit tests.** `EXTENSION_TEST_BUILD_LABEL=x0-9 node apps/extension/scripts/test-extension.mjs`
   - Result: exit 0, `# tests 523`, `# pass 523`, `# fail 0`, `# cancelled 0`. The count was 516 in x0-page's report; 7 are new.
   - Rows confirmed ok: 370 and 371 (file input), 372 and 373 (new describe-element tests), 383 to 387 (sensitive-text).
4. **Harness after the fix:** exit 1, `1 failed`, `34 passed (13.5s)`.
   - The three restored scans passed.
   - The new case failed on the `aria-labelledby` string. The printed snapshot showed it only in `evidence.forms[0].controls[]` for selector `[data-testid="hint"]`, `controlType: "button"`, as `label: "Hint <string>"`.
   - That traced to `content/evidence/forms.ts:83`, `const label = accessibleNameFor(element)`. That is outside the descriptor and outside my ownership, so that one string's scan was narrowed to `interactiveElements`, as described above.
5. **Harness rerun:** exit 0, `35 passed (11.9s)`.
6. **Extension check:** exit 0.
7. **Structure audit.** `node scripts/structure-audit.mjs`: exit 0. The warnings touching my paths:
   - `warn [directory-files] apps/extension/src/content/: 17 source files is past the 15-file advisory threshold.`
   - `warn [file-lines] apps/extension/e2e/content/tests/extract-list.spec.ts: 438 lines is past the 400-line advisory threshold.` x0-page reported 441.
8. **Mutations.** Each was applied, run and reverted in one command by a scratch script, `x0-9-mutate.mjs`, kept in the scratchpad outside the repository. The script requires the target text to occur exactly once, backs the file up to the scratchpad, restores it, and checks the result is byte-identical. All six printed `identical to backup: true`.

   | # | Mutation (real source) | Run | Observed |
   | --- | --- | --- | --- |
   | M1 | `hasTextBearingSensitiveDescendant` never finds one (`&& false`) | harness | exit 1, `4 failed`, `31 passed`; the same four cases as the pre-fix run, each on the injected textarea string |
   | M2 | `isWithinSensitiveControl` never matches (`&& false`) | unit | exit 1, `# fail 2`: `not ok 372` (describe-element "give nothing…") and `not ok 385` (sensitive-text "is, or sits inside…") |
   | M3 | the `accessibleName` own-text filter always keeps the name (`\|\| true`) | harness | exit 1, `4 failed`, `31 passed`; the injected textarea string was found 4 times inside `accessibleName` values in the printed output |
   | M4 | the `aria-labelledby` withholding never fires (`&& false`) | harness | exit 1, `1 failed`, `34 passed`; failed at `actions.spec.ts:326`, the descriptor scan for the `aria-labelledby` string |
   | M5 | the subtree walk stops skipping sensitive subtrees | unit | exit 1, `# fail 3`: `not ok 373`, `not ok 383`, `not ok 384` |
   | M6 | `visibleText` reads raw `textContent` | unit | exit 1, `# fail 2`: `not ok 372`, `not ok 373` |

   M5 also printed `mutated text absent: false`. That is expected: its replacement text is a prefix of the original line. The byte-identical check is the proof for M5.
9. **After the reverts.**
   - A Grep of `sensitive-text.ts` and `describe-element.ts` for `&& false`, `|| true` and a raw `(element.textContent ?? "").replace` found no matches.
   - No `x0-9-backup-*` file remains.
   - `git status --short` lists exactly: modified `actions.spec.ts`, `extract-list.spec.ts`, `describe-element.ts`, `tests/describe-element.test.ts` and `docs/architecture/sensitive-values.md`; untracked `sensitive-text.ts`, `tests/sensitive-text.test.ts` and `tests/stub-page.ts`.
   - `git diff --stat`: 5 files changed, 220 insertions and 92 deletions. Tracked build output is unchanged.
10. **Final unit tests:** exit 0, `# tests 523`, `# pass 523`, `# fail 0`, `# cancelled 0`.
11. **Final harness:** exit 0, `35 passed (11.9s)`.
12. **Final extension check:** exit 0.

## Not verified

- **Other specs.** Only `actions` and `extract-list` were run, as the brief names. `visibleText` and `directVisibleText` feed snapshot ranking and admission everywhere, so any other spec whose page has a text-bearing sensitive control, or a container around one, could see different descriptors or admission. That includes `selection-redaction.spec.ts`, and recorder and snapshot specs. None were run.
- **Recorded events.** `dom-events.ts` and `recorder.ts` call the same `describeElement`, but no harness case records an event on or around a sensitive textarea or select.
- **Browsers.** Only the harness's Chromium ran, in the page's main world. Firefox, a loaded unpacked extension and the isolated world were not exercised.
- **Performance.** Not measured. When an element's text is non-empty, each `visibleText` call now also walks its ancestors and scans its descendants. The snapshot calls it for every element in its sweep of up to 50,000 and several times per candidate. The order is the same as x0-page's extraction read, but large pages were not timed.
- **The name filter at unit level.** `accessibleNameOutsideSensitiveControls` is private, so M3 and M4 were observed only through the harness.
- **Shadow DOM.** The ancestor walk stops at a shadow root, where `parentElement` is null. It was not tested.
- **Repository-wide gates.** `pnpm check`, `pnpm test` and `pnpm build` were not run.

## Open questions or contradictions found

1. **Separate leak in page evidence (recommend a brief).**
   - **What happens.** `content/evidence/forms.ts:83` sets each form control's `label` from `accessibleNameFor(element)` unfiltered, so a control named through `aria-labelledby` by an element holding a sensitive textarea quotes that textarea's text. This was observed in harness run 4.
   - **Other callers.** The same unfiltered `accessibleNameFor` is called in `evidence/dialogs.ts:61`, `overlays.ts:100`, `regions.ts:34` and `loading.ts:63`. `loading.ts:63` also falls back to raw `textContent`.
   - **The cleaner fix.** Filter in `identity/accessible-name.ts` itself, in `nameFromContent` and `labelledByName`, using `textOutsideSensitiveControls`. That covers every caller at once. The post-filter in `describe-element.ts` could then be removed, and the narrowed scan in the new `actions.spec.ts` case restored to the whole snapshot.
2. **Other unfiltered strings.** I read these; none was observed leaking on the fixture.
   - `identity/label.ts`: the collector skips nested form controls but not other marked elements, such as a `data-sensitive` span inside a label. `nearbyLabelText` reads a sibling's `textContent`.
   - `identity/context.ts`: `fieldsetLegend`, `nearestHeading`, `columnHeader` and a landmark's `aria-labelledby` text read `textContent`.
   - `evidence/repeating.ts:82`: the representative text reads `textContent`.
   - All of these are outside my ownership. The doc now names them as not yet filtered.
3. **Two copies of the subtree rule.**
   - `action-runtime/extract.ts` keeps its own private `readableText` walk, which uses a TreeWalker and does not judge the element itself.
   - Recommendation: have it import `textOutsideSensitiveControls` from `../sensitive-text`, as it already imports `../element-traits`, and delete the private copy.
   - I could not make that change because `action-runtime/**` is on the must-not-touch list.
4. **Snapshot admission changed.**
   - A sensitive control whose only identity was its contents is no longer listed in the snapshot. That means one with no id, test id, name, `aria-label`, title or placeholder.
   - Example: the unlabelled injected textarea in the `extract-list` case.
   - Recording still describes such an element directly. Please confirm this is acceptable.
5. **How the name filter decides where a name came from.**
   - It compares the name with the element's own collapsed text cut to the name's length, so it assumes `identity/`'s content name is `boundedText(textContent, cap)`.
   - A coincidental `aria-label` that equals a prefix of text containing sensitive contents is conservatively replaced with the filtered text.
   - A name drawn through `aria-labelledby` is withheld rather than recomputed, which drops a legitimate name in that rare case.
   - Moving the filter into `identity/` (item 1) removes this inference.
6. **Documentation.**
   - The doc header still says "verified against source on 2026-09-13". My paragraphs were checked against source on 2026-09-15, but I did not re-verify the rest.
   - The page-text bullet now also states extraction's D2 behaviour, which W7's documentation work may overlap.
7. **Ownership reading.** I treated the shared unit-test support file `content/tests/stub-page.ts` as part of "their unit tests". The old inline stubs in `describe-element.test.ts` moved into it.
8. **Line endings.** Git warns "LF will be replaced by CRLF" for the five modified files; the content is unaffected.
