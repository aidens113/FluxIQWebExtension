# f-upload-validation-names — the upload post-condition quotes no file name (extension)

Worker report, 2026-09-13, at `HEAD 5bad6c3`. Brief: `briefs/finish-week1.md`,
thirty-second dispatch.

## Outcome

**Partial.** The owned work is done and tested.
- The upload validation's `expected` and `actual` say how many files there are and
  whether their names match. They quote no name.
- A refusal's `expected` quotes no name either.
- Pass and fail outcomes are unchanged.

One clause cannot be finished inside the owned files. A refusal's `actual` is the
reason `setInputFiles` gives, passed on verbatim. Two of those reasons quote the file
name: `apps/extension/src/content/action-runtime/file-input.ts:42` and `:44`. That
file is not in Owns (see Open questions 1).

## What changed and why

**`apps/extension/src/content/actions/upload.ts`**
- `fileNameList` (the names joined with `, `) is replaced by `describeFiles(count, named)`.
- The texts it produces:
  - `no files`;
  - `1 file, named as requested` or `N files, named as requested`;
  - `1 file, not named as requested` or `N files, not named as requested`.
- `expected` is `describeFiles(requested.length, true)`. `actual` is
  `describeFiles(held.length, matched)`.
- **The status no longer comes from comparing the two strings.** It comes from
  `sameNames(held, requested)`: the same length and the same name at every position.
  - That keeps the old outcome. The old string comparison was also exact and
    order-sensitive.
  - One degenerate difference: a single name containing `, ` used to equal a two-name
    list after joining. It now fails, correctly, because the counts differ.
- The rejection passes the new, name-free `expected`.
- The header comment is corrected. It said only names appear. It now says the
  validation compares names but quotes none, and why: the Lab found W17's name at
  rest in Core's saved command attempt.

**`apps/extension/src/content/actions/tests/upload.test.ts` (new).** No unit test
existed for the verb. The file has six rows, run in Node with fake dependencies:
- one file, a match: `passed`;
- two files in order: `passed`;
- a different name at the same count: `failed`;
- fewer files held than requested, and none held: `failed`;
- the requested names in another order: `failed`;
- a refused target: `upload_rejected`, with the name-free `expected` and the reason
  as `actual`.

Every row pins the exact texts with `deepEqual`. Every row also runs
`assertQuotesNoName` over each text handed to a result builder, against every
requested and held name. That second check holds whatever the wording becomes.

**`apps/extension/e2e/content/tests/upload-dialog.spec.ts`.** Only the two rows that
read the upload's validation text changed.
- Row 1 (`:27`) expects `1 file, named as requested` on both sides. It also asserts
  that the JSON of `message` and `validation` does not contain `UPLOAD_NAME`.
- Row 3 (`:64`) expects `1 file, named as requested` as `validation.expected` and
  `failure.expected`. It also asserts that the JSON of `message`, `validation` and
  `failure` does not contain `UPLOAD_NAME`.
- The W17 echo row and the dialog rows are unchanged.

**Task 3: nothing reads the upload validation's text as names.** Found by searching
for `validation.expected` and `validation.actual`, the destructured `{ expected, actual }`,
and `comparisonStatus`:
- **Domain.**
  - `domain/src/runtime/failure/classify.ts:105-107` copies `expected` and `actual`
    into the failure comparison, as opaque text.
  - `domain/src/runtime/adapter.ts:97,113,230-248,300-316` replaces both with
    `WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT`, but only when the target descriptor is
    sensitive. A file input is not, which is why the names reached Core.
  - `producerDeclaredRedaction` (`:258-262`) compares against that marker constant,
    never against names.
- **Extension.** `runtime/action-results.ts:81-82` and
  `action-runtime/validation-outcome.ts:81-82` only bound the length.
  `action-runtime/results.ts:157,184-202` puts the texts into the failure record and
  the message `Action rejected: <actual>`.
- **Core.** No match for `validation?.expected` or `validation?.actual` in
  `F:\!FluxIQ\packages\*\src`. Core's `comparisonStatus` is
  `attempt.transitionComparison?.status` (`runtime/adaptive-orchestrator.ts:66`,
  `runtime/service/summaries/conversions.ts:160`), not the client's validation text.
- **Runner and bench.** `packages/test-runner/src` reads `comparisonStatus` only
  (`flow-lane/persisted-flow-run.ts:191-217`). W17's expectation is an action and an
  outcome (`apps/scenario-lab/src/scenarios/file-transfer/manifest.ts:49`).
- **Docs and other specs.** `docs/architecture/` quotes no upload validation wording.
  `waits.spec.ts`, `scroll.spec.ts` and `redaction.spec.ts` read validation text for
  other verbs only.

## Commands run and observed results

All from `F:\!FluxIQWebExtension\apps\extension` unless noted. Each ran alone, with its
exit status captured to a file.

1. `pnpm check` -> `exit=0`: `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`.
2. `EXTENSION_TEST_BUILD_LABEL=fuvn pnpm test` -> `exit=0`:
   `# tests 468`, `# pass 468`, `# fail 0`. The new rows are `ok 239` to `ok 244`.
3. **Names mutation.**
   - `expected = requested.join(", ")` and `actual = outcome.fileNames.join(", ")`,
     with the status still from `sameNames`.
   - The same test command -> `exit=1`: `# pass 462`, `# fail 6`. `not ok 239` to
     `not ok 244`, every new row.
   - Row 239: `+ actual: 'expense-receipts.csv'` / `- actual: '1 file, named as requested'`
     (and the same for `expected`).
   - Row 244: `+ expected: 'expense-receipts.csv'` / `- expected: '1 file, named as requested'`.
   - Restored from a scratch copy. SHA-256
     `8396E57A73586E8BFF06AABC8736CE057184657E0CA334230E8F158761B83050`, identical
     before and after.
4. **Outcome mutation.**
   - `status: "passed"` always.
   - The same test command -> `exit=1`: `# pass 465`, `# fail 3`. Rows `241`, `242`
     and `243` failed, the three mismatch rows: `+ status: 'passed'` / `- status: 'failed'`.
   - Restored. SHA-256 identical to the value above.
5. `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 upload-dialog.spec.ts`,
   run once, alone -> `exit=0`, `6 passed (2.9s)`. Upload rows `:27`, `:51` and `:64`
   passed, as did the three dialog rows.
6. **Structure audit.**
   - Run from the repository root as `node scripts/structure-audit.mjs`, with
     `GIT_INDEX_FILE` pointing at a scratch copy of the index that holds the new test
     file.
   - Result: `exit=0`, `structure-audit: passed (40 warning(s), 17 baselined).`
   - No warning names an upload file (0 matches for `upload`). No baseline entry needs
     to change.
   - The scratch index was deleted afterwards.
7. **Cleanup.** `apps/extension/.test-build-scratch/fuvn` was removed:
   `fuvn exists after removal: False`. The content harness removes its own
   `.harness-build/run-*` directory on teardown (`e2e/content/global-setup.ts:25-27`).
8. `git status --short -- apps/extension` shows only the three owned paths.

No failure needed a faulty-RAM rerun. Every gate above is a single observation.

## Not verified

- **The mutation proof failed on the exact-text `deepEqual`,** which runs before
  `assertQuotesNoName`. The name scan is a second guard that holds if the wording
  changes. It was not itself seen failing.
- **No Lab run.** A Lab run must show all of this, on the Flow lane ×3:
  - **Run:** W17 `file-transfer` `upload` passes, with `web.dom.upload` succeeded and
    `validation.status=passed`.
  - **Kept-workspace search:** the manifest's `UPLOAD_NAME` appears **0 times** in
    every file and SQLite cell.
  - **The saved attempt:** the upload's `attempt.json` reads
    `1 file, named as requested` at `$.attempt.result.payload.result.validation.expected`
    and `.actual`.
- **Not run by this brief:** `pnpm build`, so the tracked
  `apps/extension/build/content/index.js` still holds the old `fileNameList` until the
  supervisor's build. Also not run: root `pnpm check`, `pnpm test`, Firefox, and a
  manual browser run.
- **The element descriptor and snapshot** of a file input that already holds a file
  before the upload were not examined. Evidence is captured before `setInputFiles`, and
  Run 4 found the name only at the two validation paths.
- The Task 3 search matches spellings. A read by some other spelling, such as a
  computed key, would not be found.

## Open questions or contradictions found

1. **The refusal reasons still quote a name, outside Owns.**
   - `apps/extension/src/content/action-runtime/file-input.ts:42`:
     `the content of ${file.name} is not valid base64`.
   - `apps/extension/src/content/action-runtime/file-input.ts:44`:
     `${file.name} is N bytes, over the ...-byte file limit`.
   - Either reason becomes `validation.actual`, `failure.actual` and the rejection
     `message`.
   - Through Core's gateway both are unreachable: the domain refuses bad base64 and
     oversized files before dispatch (`domain/src/client/tests/gateway-command-parameters.test.ts:104-109`).
     A command sent straight to the content script can still produce them.
   - **Suggested fix, in `file-input.ts`:** name the file by position, for example
     `file 2's content is not valid base64` and `file 1 is N bytes, over the ...`. Also
     correct that file's header (line 11), which says "only names and sizes leave this
     module". A unit row would need a DOM, so the content harness is the place to test
     it.
   - The brief should have owned `file-input.ts` for the clause "the rejection path
     quotes no name either".
2. The brief said "and its test", but no unit test existed, so
   `actions/tests/upload.test.ts` is new.
