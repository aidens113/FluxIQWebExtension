# t194-w15: the judge is told what each `where` condition read

## Outcome

Done. Every list read now reports one value per `where` condition inside `conditions`, as `conditions.seen`. The value is the first one that condition's own read produced on an item the condition held of, cut to 60 characters. It is `null` when there is none, including for any condition keyed on a column. The value travels across documents in the checkpoint, like the counts. The domain admits it (it drops the summary if the value is malformed), Core's projection copies it, and Core's read account says it beside the condition's subject:

`attribute aria-label (read "Brightaisle Plus" on a row it kept) is present rejected 13 rows`

The value is left out when either screen trips or when it names a denied key.

Every new or changed test fails when my production edits are reverted.

## What changed and why

Cause (brief, debug `run-munw7ffn-fe1cecd2` row 4): the only thing Core said about a read-keyed condition was its kind and attribute (`condition.ts` `subjectOf`). Nothing reported what the read found.

**Page (extension)**
- `content/extraction/item-filter.ts`
  - `ExtractItemFilter` takes an optional third argument, `seen: (string|null)[]`.
  - When a condition holds, its own `read` (not a `field`) produced a non-empty value, and `seen[index]` is still `null`, the filter writes the value cut to 60 characters.
  - `holds` became `valueOf` so the value is read once. The header explains why.
- `content/extraction/list-reader.ts` (+2 lines, now 792):
  - `seenEach` starts from `carriedConditionCounts`, which now also carries `seen` when its length fits.
  - It is passed to the filter.
  - It is written into both the checkpoint's and the outcome's `conditions`.
- `content/extraction/filtered-answer.ts`: `ListExtractionConditionReport.seen?` is added. The "Counts only" note now names the exception.
- `shared/extraction-continuation.ts`: `ExtractionCheckpointConditions.seen?` is added. `conditionCountsValue` copies it, and refuses the checkpoint unless it has one string or `null` per condition.
- `content/actions/extract-list.ts`: `summaryOf` copies `seen` explicitly. Two comments are corrected: they said the summary was counts alone.
- I added no file to `content/extraction/` (it is at 25). The tests went into existing files.

**Domain**
- New `domain/src/actions/extraction/seen-values.ts`:
  - `WEB_AUTOMATION_EXTRACT_CONDITION_SEEN_CHARS = 60`;
  - type `WebAutomationExtractionConditionSeen`;
  - `webAutomationExtractionConditionSeenValue(value, conditions)`, which requires exactly one entry per condition, each a string or `null`, and cuts each string to 60 characters.
  - I first named it `condition-seen.ts`. The audit then failed `[naming] ... 3 files share the prefix "condition-"`, so I renamed it.
- `summary.ts`:
  - `WebAutomationExtractionConditionReport.seen?` is added.
  - `conditionReportValue` admits it: a malformed value makes it return `undefined`, which drops the whole summary.
  - The header names the second page-text exception.
  - I compressed three comments to keep the file at 400 lines.
- `index.ts`: exports the new file.

**Core**
- `runtime/service/summaries/extraction-summary.ts`:
  - `conditionReport` copies `seen` through `seenValues`, which requires the same length as `rejected`, entries that are strings or `null`, and cuts each to 60 characters.
  - Malformed drops the summary.
  - The header now states the bounded exception: this is page text in the run record.
- `runtime/result-verification/read-account/condition.ts`:
  - `automationStudioResultReadConditionText` takes an optional 4th argument, `seen`.
  - `subjectOf` now also reports whether the subject is the condition's own read. The value is said only when it is, so nothing is said for a `field` or a column-matched read.
  - `foundText` does the following:
    - trims the value;
    - refuses a value whose key-normalised form is a denied key;
    - bounds it to 60 characters;
    - requires `sayable` (both screens);
    - quotes it.
  - Otherwise it is left out, and the condition and its count remain.
- `accounts.ts`: passes `filter.seen[index]` positionally.

## Tests (each fails without the change)

- **Extension**
  - `content/extraction/tests/item-filter.test.ts` (+2 tests):
    - The first value on an item the condition held of wins, including one the price condition then rejected. It is cut to 60 characters, and a column condition gives `null`.
    - Across two documents, the checkpoint carries `["Brightaisle Plus", null]` and the next document keeps it rather than its own "Later label". The contrast (no carry) reports "Later label".
- `shared/tests/extraction-continuation.test.ts` (+1): `seen` crosses the checkpoint as a copy, and four malformed shapes refuse it.
- `content/actions/tests/extract-list.test.ts`: the filtered-read test now carries `seen` and asserts it survives the domain's wire copy.
- `content/extraction/tests/list-reader.test.ts`: 6 `deepEqual` expectations gain `seen: [null...]`.
- **Domain:** new `domain/src/actions/extraction/tests/seen-values.test.ts` (3): admitted beside the counts, absent for an older producer, cut to 60 characters, and 6 malformed shapes that drop the summary.
- **Core**
  - `service/summaries/tests/extraction-summary.test.ts` (+1): copies the value, cuts it, and refuses malformed values.
  - `read-account/tests/accounts.test.ts` (+2): the Plus condition is rendered, three column-keyed conditions are not, and no locator leaves.
  - The withholding test leaves out `.plus-badge > i`, `aria-label=Plus`, an `sk-...` key, the denied key `innerHTML`, and a number, and keeps the wording and count. A plain-value contrast shows the same condition does say a sayable value.

## Commands run and observed results

Final runs, after the last source edit:

- `bash .../heavy.sh "t194-w15 domain check" pnpm --filter @fluxiq-web-extension/domain check` -> exit 0.
- `DOMAIN_TEST_BUILD_LABEL=t194-w15 bash .../heavy.sh "t194-w15 domain test" pnpm --filter @fluxiq-web-extension/domain test` -> exit 0, `# tests 990 # pass 990 # fail 0`; new tests ok 53-55.
- `bash .../heavy.sh "t194-w15 ext check" pnpm --filter @fluxiq-web-extension/extension check` -> exit 0 (run before and after the rename).
- `EXTENSION_TEST_BUILD_LABEL=t194-w15 bash .../heavy.sh "t194-w15 ext test" pnpm --filter @fluxiq-web-extension/extension test` -> exit 0, `# tests 1496 # pass 1496 # fail 0`. New and changed tests: ok 625, 759, 760, 1460. This ran before the rename. The rename touched only domain file names, the barrel and comments, and the domain check and extension check that followed it pass.
- Downstream `node scripts/structure-audit.mjs`:
  - `FAIL [naming] domain/src/actions/extraction/: 3 files share the prefix "condition-"`; after the rename it gives `structure-audit: passed (128 warning(s), 120 baselined)`.
  - None of the warnings is new from my files (list-reader 792 and extract-list.test 737 lines are pre-existing warnings).
- Core `node scripts/structure-audit.mjs` -> `structure-audit: passed (201 warning(s), 354 baselined)`, plus `1 baseline entries can be lowered` (not from my files).
- Core `npx vitest run .../result-verification/read-account .../service/summaries/tests/extraction-summary.test.ts` -> `Tests 29 passed (29)`.
- Core `npx vitest run .../runtime/result-verification .../runtime/service/summaries` -> 184 passed, 3 failed. All 3 are `run-detail-preservation.test.ts` "Test timed out in 15000ms".
  - With my three Core source files swapped back to their `HEAD` contents, the same file still failed 2 of 3 on the same timeout. The failure is not from this change.
  - I did not root-cause it. Other workers were editing Core concurrently (llm/, recovery/refuted-result/, runtime-adaptation/).
- Core `npx tsc --noEmit -p tsconfig.json` (packages/fluxiq) -> exit 2 with one error, `llm/evidence-loop/tests/progress-trace.test.ts(65,32): TS2554`. That file is another worker's uncommitted edit. There were no errors in my files.

**Without-fix proofs.** I swapped my production files for `git show HEAD:` contents. For `list-reader.ts`, I reverted only my 4 edits and kept w13's uncommitted work. Then I restored everything and confirmed the restore.
- Domain (label `t194-w15-nofix`): `# fail 3` (all 3 new tests).
- Extension: `# fail 8`. These are the 4 new or changed tests plus the 4 list-reader `deepEqual` tests that now expect `seen`.
- Core: the rendering test and the projection test fail. The withholding test passed without the fix at first, so I added the plain-value contrast. That contrast depends on `foundText`, which `HEAD` lacks. I did not re-run the without-fix pass after adding it.

I deleted the labelled build directories (`.test-build-scratch/t194-w15*`) afterwards. Scratch copies are in my scratchpad only.

## Not verified

- No Lab or browser run (the brief forbids them). I have not checked, on the real store:
  - that a live read of the store's icon produces "Brightaisle Plus" through `readField`;
  - that the judge then stops advising the duplicate condition.
- I did not re-run the Core without-fix pass after adding the contrast assertion (see above).
- I did not re-run the extension test suite after the rename; the domain check and extension check that followed it pass.

## Open questions or contradictions found

- **The value is collected on every read, playback included** (as the brief asks), so it now reaches Core's stored run record (`metadata.extraction.conditions.seen`). Until now that record held no page text. It is bounded (60 characters × conditions, at most 64 conditions). A condition's read on a sensitive control refuses the whole read (D2), so it cannot come from one.
  - Core screens it only where it is said (`condition.ts`), not at the projection. If the supervisor wants it screened before storage too, `extraction-summary.ts` could import `automationStudioLocatorShapedText` and `screenAutomationStudioLlmEvidence` from `../../llm/index.ts` and store `null` for a value that fails either screen. I did not do that, to keep the service layer free of the llm barrel.
- Wording: I wrote `on a row it kept` rather than the brief's `on a kept row`. The value comes from an item *that condition* held of, which another condition may still have rejected. "A row it kept" is accurate; "a kept row" would claim the row was in the result.
- A condition that holds only where its value is absent (e.g. `attribute data-sponsored is absent`) always reports `null`, because the kept items have no value. For such exclusions a value from a *rejected* item would say more. The brief chose kept items, so I followed it.
- The extension restates the 60-character bound (`SEEN_CHARS`) because `domain/client` does not re-export `actions/extraction`. This is the same situation w9 reported. The fix would be to add `WEB_AUTOMATION_EXTRACT_CONDITION_SEEN_CHARS` to the re-export list in `domain/src/actions/types.ts`, a file I do not own.
