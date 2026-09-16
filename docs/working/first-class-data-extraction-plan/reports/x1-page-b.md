# x1-page-b: the page share of X1.2 and X1.3, plus the supervisor's D2 amendment

## Outcome

**Done.** Every definition-of-done item in this brief's ownership is met, with one exception outside it.

- **Extension type check:** passes. The five errors `x1-domain-contracts` left at `list-extraction.ts:117,119,147,155,167` are gone.
- **Unit tests** (labelled `x1-page-b`): 539 of 539 pass.
- **Content harness** (`extract-list` and `upload-dialog`): 28 of 28 pass.
- **Mutations:** all seven were observed red and reverted. No permission refusal occurred, so no scratch copy was needed.
- **Exception, the structure audit:** it exits 1 on two `working-docs` violations in shared documents I may not edit:
  - `first-class-data-extraction-plan.md` is 821 lines, past the 800-line compaction limit;
  - `docs/working/README.md` is out of date.

  My files add only two line-count advisories.

**`dialog.promptText` is the value the prompt was answered with, not the page's message.** `page-world/dialog-override.ts:104,111-112` records the answer the prompt returned:

- the Flow-supplied `promptText`;
- or the page's default value when none was supplied;
- or, for a prompt nothing armed, whatever the person typed.

The page's text travels separately as `message`. So `promptText` is now withheld the way a sensitive typed value is (D2), and the tests cover it.

## What changed and why

### X1.2 page guard (`content/action-runtime/list-extraction.ts`)

- **New `supportedRequest(request)`.** It runs in `extractList` before anything on the page is read, and narrows the request to what the page reads until X3: string-grammar fields and `next` pagination. Anything else is refused with a NOT_IMPLEMENTED record (`web.action.not_implemented`, `blocked_by_capability_or_policy`), which `actionFailure` lifts:
  - **Structured field spec** (any non-string field value, whatever its `handling`):
    - expected: `structured field specs to be implemented`
    - actual: `field <key> is a structured field spec, which the page does not read until the extraction engine lands`
  - **A `paginate.mode` other than absent or `"next"`:**
    - expected: `pagination mode "<mode>" to be implemented`
    - a non-string mode sent straight to the page reads `a pagination mode that is not a string`
  - The record names the field key or the mode, never a selector.
- **Type narrowing.** `isNextPagination` is a type predicate. The loop now uses the narrowed `paginate`, which is what fixes the five type errors.
- **Header comment** updated to describe the guard.

### Supervisor D2 amendment: a field inside a sensitive control

- **New `withinSensitiveControl(element)`.** It asks the one shared rule, `isSensitiveFormControl`, about the element and every ancestor up to the document root.
- **Where it applies.** `readField` and `readColumn` use it in place of the element-only check. An option of a sensitive `<select>` is therefore refused the same way as the select itself:
  - as a field selector (`option`, `option@value`);
  - as the item itself.
- **What is unchanged:**
  - The refusal record's wording.
  - `content/action-runtime/extract.ts` was not touched; the single-value path belongs to `x0-11`.
- **Header comment** updated.

### X1.3 page share

**`content/action-runtime/results.ts`**
- `ActionResultEvidence` gains `extraction?: BrowserActionResult["extraction"]` and `dialog?: BrowserActionResult["dialog"]`. They are indexed types, because `content/types.ts` does not re-export the domain names and that file is not mine.
- `buildResult` copies both when present.
- The type's doc comment says `extracted` holds only what a read took off the page.

**`content/actions/extract-list.ts`**
- Every read that returns now passes `extraction`, on success and on timeout alike. It carries `{ recordCount, pagesRead, truncated, missingFields, fieldNames }`.
- `fieldNames` holds the declared keys in declaration order, with every `handling: "exclude"` field left out (D12).
- The validation's `expected` field list uses the same included keys. For string-grammar requests it is byte-identical to before.
- A read the capability threw carries no summary.

**`content/actions/dialog.ts`**
- The handled dialog now rides on `dialog`, built field by field, and never on `extracted`.
- `promptText`, when present, becomes `describeFieldValue(promptText, true)`: "a withheld value of N characters", or "an empty value" for an empty answer.
- The page's `message` is kept.
- The header comment explains why. There is no element whose sensitivity could clear the answer, so it is always withheld. `content/evidence/dialogs.ts` already drops `promptText` from snapshot evidence for the same reason.

### Tests

**`action-runtime/tests/list-extraction.test.ts`**, three new rows:
- **Field specs refused.** Eight spec shapes: each kind, plus optional, include and exclude. Each is refused with the exact NOT_IMPLEMENTED record, and no selector sentinel appears in the message or record.
- **Pagination modes refused.** `loadMore`, `scroll` and `numbered` are refused, naming the mode; so is a number mode sent past the lift.
- **Today's shapes pass the guard.** String fields with no pagination, `next` without `mode`, and `next` with `mode: "next"` all run to the end against a minimal stub `document` and return an empty outcome.
- The stub saves and restores any existing global `document` descriptor; see command 3.

**New `actions/tests/extract-list.test.ts`**, fake dependencies, no DOM:
- the summary counts the read and leaves excluded fields out of `fieldNames`;
- the summary survives the domain's `webAutomationActionResultPayload` whole;
- string-grammar field names come out in declaration order;
- a timed-out read carries the summary;
- a read that threw carries no summary.

**New `actions/tests/dialog.test.ts`**, fake dependencies:
- dialog evidence is on `dialog` with no `extracted`, including through the wire copy;
- a prompt answer is withheld to its length while `message` is kept, and the sentinel is absent from both the evidence and the wire payload;
- an empty answer reads "an empty value", and a dismissed prompt carries no `promptText`;
- a refused arming reports the same withheld dialog;
- before any dialog is handled, there is no `dialog` key.

**`e2e/content/tests/extract-list.spec.ts`**
- **Header:** bullets added for the summary, the guard, and the amendment.
- **Page one:** asserts `extraction: { recordCount: 8, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["name","price","rating","url"] }`.
- **`maxPages`:** asserts `{ recordCount: 16, pagesRead: 2, truncated: true, missingFields: [] }`.
- **Missing field:** asserts `missingFields: ["sku"], fieldNames: ["name","sku"]`.
- **Timeout:** asserts the summary with `truncated: false`.
- **New, "a structured field spec is refused until the engine lands":** `web.action.not_implemented`, no `extracted`, no `extraction`, and no selector in the message or failure.
- **New, "a pagination mode other than next is refused until the engine lands, and nothing is clicked":** `loadMore` gives `pagination mode "loadMore" to be implemented`, and the page still shows `Page 1 of 3`.
- **New, "a field that resolves inside a sensitive control, such as one of its options, refuses the whole read":**
  - The test injects a `<select data-sensitive="true">` with a sentinel option.
  - Three reads: `option`, `option@value`, and the option as the item.
  - Each is `web.action.rejected` / `blocked_by_capability_or_policy`, with no `extracted`.
  - Neither the fixture secrets nor the option sentinels appear anywhere in the reply, snapshot included.

**`e2e/content/tests/upload-dialog.spec.ts`**
- **Existing accept case:** reads `next.dialog` and asserts no `extracted`.
- **New, "dialog: a prompt's answer is reported by its length, never its content":**
  1. Arm `accept` with a sentinel `promptText`.
  2. `window.prompt()` in the page's world returns the sentinel, which proves the override answered it.
  3. The next dialog reply has `dialog` equal to `{ kind: "prompt", message, response: "accept", promptText: "a withheld value of 23 characters", at: <number> }` and no `extracted`.
  4. The sentinel is in neither reply, snapshots included.

## Commands run and observed results

All commands ran from `F:\!FluxIQWebExtension`, one at a time, with the harness always at `--workers=1`.

1. **Baseline check.** `pnpm --filter @fluxiq-web-extension/extension check` before any edit: exit 2, exactly the five TS errors at `list-extraction.ts(117,111)`, `(119,88)`, `(147,61)`, `(155,107)`, `(167,122)`.
2. **Check after the X1 edits:** exit 0.
3. **First labelled unit run.** `EXTENSION_TEST_BUILD_LABEL=x1-page-b node apps/extension/scripts/test-extension.mjs`: exit 1, `# tests 539`, `# pass 537`, `# fail 2`.
   - The failures were `not ok 392` and `not ok 393` in `content/tests/landmark-role.test.ts`, with `Cannot read properties of undefined (reading 'querySelectorAll')` at `evidence/regions.ts:31`.
   - **Cause: my own new row.** That file installs a global `document` stub (`landmark-role.test.ts:113-114`). Every bundle shares one Node process, and my first version of the stub row deleted `globalThis.document` in `finally`.
   - Fixed by saving the prior property descriptor and restoring it. All 12 of my new unit rows were green in this run.
4. **Check after the amendment:** exit 0.
5. **Second unit run:** exit 0, 539 of 539; `ok 392` and `ok 393` restored.
6. **First harness run.** `pnpm --filter @fluxiq-web-extension/extension test:content -- extract-list upload-dialog --workers=1`: exit 0, `28 passed (9.9s)`. The list output confirmed each new or changed case ran ok: page one, `maxPages`, missing field, timeout, both guard cases, the inside-sensitive case, armed accept, and the prompt answer.
7. **Mutations.** Each was applied alone, run, then reverted.

   | # | Mutation | Command | Observed |
   | --- | --- | --- | --- |
   | M1 | `if (false && typeof field !== "string")` in `supportedRequest` | harness `extract-list --grep="structured field spec is refused"` | exit 1, `1 failed`; received `"code": "web.action.failed"`, not `web.action.not_implemented` |
   | M3 | `if (false && evidence.extraction)` in `buildResult` | harness `extract-list --grep="page one"` | exit 1, `1 failed`; `Expected - 12 / Received + 0`, the `"extraction"` object missing |
   | M4 | dialog evidence put back on `extracted` in `dialog.ts` | harness `upload-dialog --grep="armed accept deletes"` | exit 1, `1 failed`; `received value must be a non-null object` at `upload-dialog.spec.ts:130` (`next.dialog`) |
   | M6 | exclude filter disabled (`true \|\| ...`) in `extract-list.ts` | full labelled unit run | exit 1, `# pass 537`, `# fail 2`: `not ok 287` (summary names the declared fields, excluded left out) and `not ok 289` (timed-out summary) |
   | M5 | raw `promptText` in `dialog.ts` | harness `upload-dialog --grep="prompt's answer"` | exit 1, `1 failed`; expected `"a withheld value of 23 characters"`, received `"SYNTHETIC_PROMPT_ANSWER"` at `:151` |
   | M7 | `withinSensitiveControl` checks the element only (`current = null`) | harness `extract-list --grep="resolves inside a sensitive control"` | exit 1, `1 failed`; `an option's text`: `"status": "succeeded"` instead of `"failed"` at `:397` |
   | M2 | `if (false && paginate !== undefined && ...)` | harness `extract-list --grep="pagination mode other than next"` | exit 1, `1 failed`; `"status": "succeeded"`, a `loadMore` read misread as next-mode, instead of `not_implemented` at `:282` |

8. **Mutation leftovers.** A Grep of the four owned source files for `false &&`, `true ||`, `current = null`, `extracted: observedDialogEvidence` and `observed.promptText ??` found no matches.
9. **Final check:** exit 0.
10. **Final labelled unit run:** exit 0, `# tests 539`, `# pass 539`, `# fail 0`, no load failures.
11. **Final harness run** (same command): exit 0, `28 passed (10.1s)`.
12. **Structure audit.** `node scripts/structure-audit.mjs`: exit 1, `2 violation(s) across 1 rule(s)`.
    - `FAIL [working-docs] docs/working/first-class-data-extraction-plan.md: 821 lines exceeds the 800-line compaction`
    - `FAIL [working-docs] docs/working/README.md is out of date`
    - My advisories: `extract-list.spec.ts: 526 lines` and `results.ts: 429 lines`, both past 400 and under 800. `list-extraction.ts` is 342 lines.
13. **`git status --short -- apps/extension`.**
    - Mine: the 7 modified files plus the 2 new `actions/tests/{extract-list,dialog}.test.ts`.
    - Other workers': `actions.spec.ts`, `evidence.spec.ts`, `extract.ts`, `describe-element.ts`, `accessible-name.ts`, their tests, `sensitive-text.ts`, and `stub-page.ts`.
    - Tracked `build/` output is unchanged.

No crash or uniform timeout occurred, so nothing needed a rerun for hardware reasons. No failure appeared in another worker's files, apart from the one my own test caused and I fixed.

### Resumed after the Claude Code process crash

The work above, this report included, was complete before the crash. After restarting I checked and reran everything, one command at a time.

1. **Files re-checked.** A Grep of each owned file confirmed every change is present:
   - `list-extraction.ts`: `supportedRequest`, `isNextPagination`, and `withinSensitiveControl` walking `parentElement`, applied at the field reader (`:250`) and the column reader (`:273`);
   - `results.ts:84-85,425-426`: the two evidence fields and their copies;
   - `extract-list.ts:49,71`: the summary and the exclude filter;
   - `dialog.ts:44,67`: `dialog:` evidence and the withheld `promptText`;
   - the new spec cases, and the test's `document` descriptor restore.

   No `false &&`, `true ||`, `current = null`, or unwithheld `promptText` was found. `git status` shows the same owned files as before.
2. **Extension check:** exit 0.
3. **Labelled unit run:** exit 1, `# tests 540`, `# pass 539`, `# fail 1`.
   - The failure was `not ok 403 - isWithinSensitiveControl: an element that is, or sits inside, a sensitive control -- and not one that only holds one`.
   - It sits in `content/tests/sensitive-text.test.ts:57`, another worker's file, with `TypeError: isWithinSensitiveControl2 is not a function` at `:68`.
   - The test imports a helper that `sensitive-text.ts` does not export yet, so it is an edit still in progress.
   - Every row in my files passed.
4. **Harness** (`test:content -- extract-list upload-dialog --workers=1`): exit 0, `28 passed (10.9s)`.
5. **Structure audit:** exit 1, now `1 violation(s)`: `[working-docs] docs/working/README.md is out of date`. The plan document's line-count failure is gone. My files still carry only the same two advisories.
6. **The one unit rerun for the other worker's failure:** exit 1, `# tests 547`, `# pass 539`, `# fail 8`.
   - All eight are in files other workers own and are still editing, since the test count keeps rising:
     - `identity/tests/context.test.ts` and `identity/tests/label.test.ts`: `not ok 339-342` and `351-353`;
     - `content/tests/sensitive-text.test.ts`: `not ok 410`, still `isWithinSensitiveControl2 is not a function`.
   - No row in my files failed, so I did not touch these files.

## Not verified

- **Mutations were observed at one level only.**
  - The unit rows for M1, M2, M5 and M7 were not run under their mutations; only the harness was.
  - M6 was observed only in the unit suite.
  - Under M7, only the first of the three reads (`an option's text`) was observed red, because the loop stops at the first failure. `option@value` and the option-as-item reads were not individually observed red.
- **Column cells inside a sensitive control.** `readColumn`'s ancestor check has no fixture or harness case, as in x0-page.
- **Browsers.** Only the harness's Chromium ran. Firefox and a loaded unpacked extension were not tested. The prompt case calls `window.prompt` from Playwright's main-world `evaluate`, not from a page script.
- **Repository-wide gates.** `pnpm check`, `pnpm test` and `pnpm build`, and the domain package, were not run.
- **The domain summary copy** was exercised only through `webAutomationActionResultPayload` in the new unit rows, not over a real gateway.
- **Performance.** The cost of the ancestor walk per field per record was not measured. The 1,000-item cap case still passed inside the 10-second run.

## Open questions or contradictions found

1. **`promptText` shape (judgement call).** It still exists on the wire but holds the length marker, not the answer. The alternative is dropping it, as `evidence/dialogs.ts` does. I kept the marker because it is the typed-value precedent (`value-redaction.ts`) and tells a Flow whether an answer was empty. A Flow can no longer read back the answer; it supplied it, or a person did. `docs/architecture/sensitive-values.md` (W7) should record it.
2. **The ancestor walk reaches the document root, not just the item.** `isSensitiveFormControl` reads `data-sensitive` and `autocomplete` on any element, so a field inside any wrapper carrying the signature is refused too. That is broader than options. Stop the walk at the item if a marked container should not refuse its contents.
3. **Refusal wording.** For a descendant of a sensitive control, the record still says `resolved to a sensitive control`. I did not change it, to avoid drifting quoted strings.
4. **`expected` now lists only included fields.** This is identical today, because the guard refuses every spec field. It matters once X3 reads specs.
5. **Ordering.** `missingFields` is sorted alphabetically, while `fieldNames` is in declaration order. The domain requires only a subset.
6. **Shared test globals.** `landmark-role.test.ts` sets a module-scope global `document` stub, which any other bundle can clobber. Any test that stubs a global should restore the prior descriptor.
7. **Structure audit.** The two `working-docs` failures (plan document over 800 lines; README drift) are the supervisor's to clear, by compaction and `pnpm structure:baseline`.
8. **Harness file size.** `extract-list.spec.ts` is now 526 lines. D16 already directs new harness specs to `e2e/content/tests/extraction/`, and X3 may want to split this file there.
9. **Line endings.** Git warns "LF will be replaced by CRLF" for the seven modified files; the content is unaffected.
10. **A second copy of the ancestor rule is coming.** Another worker is adding `isWithinSensitiveControl` to `content/sensitive-text.ts` ("an element that is, or sits inside, a sensitive control"). That is the same question my private `withinSensitiveControl` in `list-extraction.ts` answers.
    - Once theirs is exported and green, `list-extraction.ts` should import it rather than keep its own loop, so there is one rule.
    - The swap is serial after that worker finishes, and it must keep the inside-sensitive harness case green. I did not import it because it does not exist yet and the file is not mine.
