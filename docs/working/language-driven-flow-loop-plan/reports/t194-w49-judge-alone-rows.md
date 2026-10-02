# t194-w49: the judge sees the rows a condition removed by itself

## Outcome

Done. For each `where` condition, the judge's read account (`resultSummary.reads[].conditions[]`) now has a
`removedByItself` member. It lists the label of every row that condition removed by itself. A label is the
row's first text column, whole. This works for a Flow playback, which is the read the judge actually judges.
It is information only: no new refusal, and the read keeps and stores the same rows as before.

Using run 15's data, the accessory rule's account now reads:

```yaml
- condition: name not contains ["ear tips", "charging case"]
  rejected: 16
  alone: 5
  removedByItself:
    - Lumo Audio Drift Pro Wireless Earbuds, ... Wireless Charging Case, Touch Control, White
    - Aurelle Pods Fit Wireless Earbuds, ... Ivory with Wireless Charging Case
    - Trevio T5 Wireless Earbuds, ... Wireless Charging Case, Built-in Mic, Rose Gold
    - (the two accessories)
```

The re-author's full sentence also names the rows: `..., 5 of them by itself (removed by itself: "Lumo ...", "Aurelle ...", ...)`.
The brief sentence used in the failure record (1,024-character limit) is unchanged and still gives counts only.

## What changed and why (the path end to end)

1. **Domain dispatch** (`domain/src/output-nodes/extract-list/dispatch.ts`). When a Flow's extract_list node has
   `where` conditions, its dispatched parameters now include `rejectedSamples: "alone"`. The Flow's stored
   parameters are not changed. A node whose parameters already set `rejectedSamples` is sent as they say.
   This is the path every executor playback takes: the native runtime goes through this dispatch, then the
   gateway, then the command's `options`. The exploring node run is unchanged. It still sends `true` through
   its own `webNodeDispatchParameters`.
2. **Domain constant** (`domain/src/actions/extraction/rejected-samples.ts`). Added
   `WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_ONLY = "alone"` and updated the header's "asked for" rule.
   I updated the header comment in `summary.ts`. Its wire copy already admitted `rejectedSamples` and
   `rejectedSamplesAlone`, so no logic changed there.
3. **Extension** (`apps/extension/src/content/actions/extract-list.ts`). This file was owned "only if needed".
   It was needed because the page only accepted `=== true`. Now `"alone"` makes the page collect rows the
   same way `true` does. Then `summaryOf` cuts each list down to its leading alone rows, and
   `rejectedSamplesAlone` becomes each list's length. I did not need to touch `list-reader.ts` or
   `content/extraction/rejected-samples.ts`. If an alone-only read gets no leads from the page, it sends no rows.
4. **Core extraction summary** (`runtime/service/summaries/extraction-summary.ts`). When both
   `rejectedSamples` and `rejectedSamplesAlone` arrive, it adds `conditions.aloneRows`. That is one list per
   condition, with one `{ column: label }` record per row from the lead of that condition's list.
   - The label is the first value in field order that contains a letter and is not an address (a URL, or a
     path starting with `/`). If no value qualifies, it falls back to the first non-empty value.
   - The column is kept so the label can be screened against denied keys later.
   - Rows past the lead were also rejected by another condition. They are never kept.
   - Malformed rows or leads drop the whole summary, which is the file's existing rule.
   - Samples without leads (an older page build) are ignored.
5. **Core read account**:
   - New `read-account/alone-rows.ts`. It screens each label the same way the stored rows the judge sees are
     screened (`screenAutomationStudioLlmEvidence`). A label from a denied column, or one shaped like a
     credential, becomes `"(withheld)"` but still counts as a row.
   - `accounts.ts` carries `removedByItself` per condition. Like the condition wording, it is only carried
     when the domain declared its keys.
   - `sentence.ts` names the rows in the full sentence.
   - `index.ts` barrel updated.
6. **Core contract** (`runtime/result-verification/contracts.ts`). **This is outside my owned paths.** I added
   one optional member, `removedByItself?: string[]`, to the condition element type of
   `AutomationStudioResultReadAccount`, and updated its doc lines. The account type lives there, and the
   member could not be typed without it. The change only adds a member.

## Commands run and observed results

- Core `npx vitest run .../result-verification/read-account .../service/summaries` -> 11 files, 81 tests passed.
- Core `npx vitest run .../result-verification .../recovery/refuted-result` -> 24 files, 230 tests passed.
- Core `heavy.sh "t194-w49 core check" pnpm check` -> exit 0, tsc printed no errors.
- Old-source check for Core: I put the HEAD versions of `accounts.ts`, `sentence.ts` and `extraction-summary.ts`
  back temporarily (the edited files were backed up in my scratchpad and restored afterwards) and ran the new
  tests -> 3 failed (both alone-rows tests that use run 15's data, and the extraction-summary test), 23 passed.
  The restored files were checked with grep.
- Downstream `heavy.sh ... npx tsc -p domain/tsconfig.json --noEmit`, `-p domain/tsconfig.test.json --noEmit` and
  `-p apps/extension/tsconfig.json --noEmit` -> no output (clean).
- `narrow-tests.mjs domain t194-w49 output-nodes/extract-list actions/extraction` -> 18 files, 120 pass, 0 fail,
  including the 3 new dispatch tests.
- `narrow-tests.mjs domain t194-w49 output-nodes client` -> 22 files, 195 pass, 0 fail.
- `narrow-tests.mjs domain t194-w49 runtime/llm-evidence/node-run` -> 24 files, 134 pass, 0 fail. Another
  worker (w50) was editing files in this directory at the same time.
- `narrow-tests.mjs apps/extension t194-w49 content/actions` -> 14 files, 113 pass, 0 fail, including the new test.
- Old-source check downstream: I put the HEAD versions of `dispatch.ts` and `extract-list.ts` back temporarily,
  then restored them -> `not ok 20 - a read with conditions is sent asking for the rows each removed by itself`
  and `not ok 62 - a playback that asks for the alone rows ...`. Each run had 1 failure.
- `node scripts/structure-audit.mjs` -> passed in both repositories. The only advisory warnings on touched files
  were already there: `domain/.../summary.ts` is now 436 lines and Core `result-verification/contracts.ts` is
  now 472 lines (each grew by 2-4 comment lines).

## Not verified

- No live run or Lab run was done (the brief excluded them). I have not seen the field reach a real judge
  request. The Core tests show the account and sentence. The domain and extension tests show the command and
  the wire.
- The judge's instruction text is not updated. `llm/diagnosis-instructions.ts` and the pinned system prompt still
  describe `reads` as "each of its conditions as written with the rows that condition rejected". Those files are
  not mine, and the member name is meant to be self-explanatory.
- I did not check Core's io-policy for an allowlist on dispatched parameter keys. The scaled `timeoutMs` already
  travels the same way, so I expect the new key to pass.
- Run size: an alone-only playback adds every alone row (all declared fields) to the result payload, and the
  run record keeps only the labels.

## Open questions or contradictions found

- `domain/src/runtime/llm-evidence/node-run/tests/rejected-rows.test.ts` (not mine) has a test named "the samples
  are never in what the Flow keeps, and a playback of it asks for none". At lines 115-118 it asserts that the
  playback's dispatch has no `rejectedSamples`. It still passes, but only because its `kept` parameters carry a
  structure `handle` that `webAutomationExtractListDispatch` cannot parse. A parsed read with `where` now asks
  for `"alone"`. The test name and its comment should be updated by whoever owns that file.
- The draft replay through node-run (`replay: "step"`) still asks for nothing. This is correct for the judge,
  whose account is built from executor attempts. I am noting it in case someone expects the replay to name rows too.
- I edited `result-verification/contracts.ts`, which was not on my owned list (see item 6 above).
