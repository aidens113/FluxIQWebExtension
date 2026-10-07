# Report: s45-b-one-page-read (W-B, contract C3)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t284/!FluxIQWebExtension` (branch `task/t284-read-list-s45-next-page`). No commits.

## Outcome

**Partial.** Everything C3 asks of my files is in place. The listed tests fail first and now pass, and the
structure audit exits 0. `pnpm --filter @fluxiq-web-extension/domain check` exits non-zero on **one** error, which
is in a file I may not touch: `runtime/llm-evidence/structure/packet.ts:291`. That file's `present<...>` total record
must now name the new optional member `answer`. Four tests in W-A's files still pin the old behaviour (listed below).

## What changed and why

- `actions/extraction/request.ts`: `answer?: "kept"` on `WebAutomationExtractListRequest`, with its documentation:
  - the Flow and replay reads answer only the rows they kept, possibly none;
  - `minItems` then counts the items seen;
  - exploration never sends it.
  - Also adds `WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT`, a paragraph on `WebAutomationExtractListPagination` saying it
    is retired in a Flow (still parseable until S7), and a note on `dedupe` that a Flow's dispatch moves these keys to
    `process`.
- `actions/extraction/read-request.ts`: `answer` is parsed. Any value other than `"kept"` is dropped and named
  `"answer"` in `dropped`, so `webAutomationExtractListRequestWhole` refuses it, and the issues layer does too through
  `unreadable`. This keeps the file's rule that a part a read can do without is dropped and named. `paginate` parsing
  is unchanged.
- `actions/extraction/schema.ts`: declares `answer` as `enum ["kept"]`. Without it, `issues.ts` would call it an
  unknown key. The `dedupe` editor description now says "over every row the read collects in the run".
- New `actions/extraction/retired-paging.ts`: `webAutomationExtractListPagesBeyondOne(paginate)`. It checks the value
  as written, so that an unreadable `{next: null, maxPages: 5}` is not silently cut to one page. It is true for:
  - any `maxPages` above 1;
  - `mode: "scroll"`;
  - any `maxScrolls`.

  Dispatch and issues both use it.
- New `output-nodes/extract-list/record-output-process.ts`: `WebAutomationRecordOutputProcess`, the stub from C3, and
  `webAutomationRecordOutputProcessValue`.
  - It is exact: unknown keys are refused, `dedupe` is `{by: non-empty string[]}` or `false`, `sort` has at most 4
    keys and the domain's orders and types, `limit` is 1..10000 and `minRows` is 0 or more.
  - A refusal carries the issue `record_output.invalid_process`.
- New `output-nodes/extract-list/one-page-read.ts`: `webAutomationExtractListOnePageRead(sent, request)`.
  - It removes `paginate`, `dedupe`, `sort`, `maxItems` and `minItems` from the page request, and puts `minItems: 0`
    back when the request had it.
  - It builds `process`: `dedupe {by}` only when `by` is non-empty, `sort` keys, `limit` from `maxItems`, `minRows`
    from `minItems`. If none of these is present, it builds no `process`.
- `output-nodes/extract-list/dispatch.ts`:
  - A multi-page `paginate` is refused before anything else with `web.extract_list.paginate_retired` and the brief's
    exact sentence. It uses the same failure-record pattern as `recordOutputRefusal`, and its outputs are
    `{error: {code}}`.
  - The page request is always the one-page read. A default or absent timeout becomes
    `WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS` and is never scaled.
  - `withFlowAsks` replaces `withAloneRowsAsked`. It adds `answer: "kept"` to any parseable `extractList`, and the
    alone-rows ask as before. `webAutomationExtractListAloneRowsAsked`, used by replay, uses it too.
  - The record output (derived, reconciled, or authored when the request is unparsed) is split from `process`, parsed
    by Core, and the validated `process` is re-attached.
  - The members derived from the read override an authored `process` member by member. An invalid authored `process`
    is refused as `record_output.invalid`.
- `output-nodes/extract-list/record-output.ts`: `maxRecords` is always Core's default of 1,000 and no longer comes
  from `maxItems`.
- `output-nodes/extract-list/declared-columns.ts` (decision, see Open questions): a helper column that an ordering
  names is now **stored**, added to `columns`. Sorting and dedupe now run over the stored rows, so a sort by an
  unstored helper would silently do nothing.
- `output-nodes/extract-list/catalog-text.ts`:
  - The paging tags are removed.
  - The description follows design 4.2(g), except that the first sentence ends "into the dataset". The design's
    sentence is 91 characters, and Core and the existing test keep 80.
  - `paginate?: false` and the `paginate` clause leave the grammar. The new last clause is "Reads this page only. Over
    every row it collects in the run: dedupe?: true|key, sort?: "key desc", minItems (default 1, 0 = none), maxItems
    <=1000." (591 of 700 characters.)
  - `paginate` leaves the example.
- `output-nodes/extract-list/issues.ts`: new code `web.extract_list.paginate_retired` for a multi-page `paginate`,
  whatever its shape. It takes precedence over the shape codes. A one-page `paginate` is judged as before.
- `output-nodes/extract-list/parameters.ts`: the `timeoutMs` text no longer says the timeout grows with pages.
- `output-nodes/payloads.ts`: **not changed.** The picker records `maxPages: 1` (design 6.3), which dispatch drops.
  A recorded multi-page definition gets the same refusal, as design 6.3 says.
- Barrels: `actions/extraction/index.ts` and `output-nodes/extract-list/index.ts` export the new modules.

### Tests

- New `output-nodes/extract-list/tests/one-page-read.test.ts` covers:
  - `paginate_retired` across 6 shapes, with and without an authored output;
  - a one-page `paginate` dropped, with an unscaled timeout;
  - `process` in the derived and the reconciled output, and not on the page;
  - no `process` when nothing asks for one;
  - `minItems: 0` kept on the page;
  - an authored `process` merged, or refused when invalid;
  - `answer: "kept"` on dispatch and on `webAutomationExtractListAloneRowsAsked`;
  - `maxRecords` fixed at 1,000.
- New `output-nodes/extract-list/tests/record-output-process.test.ts`: the validator accepts and refuses.
- Extended:
  - `actions/extraction/tests/read-request.test.ts`: `answer` parsed, other values dropped and named;
  - `catalog-text.test.ts`: no `paginate`, `maxPages`, `maxScrolls` or "one page or many", no paging tags, the exact
    new description and the collection clause;
  - `issues.test.ts`: the retired test, with the old multi-page "well-formed" cases moved into it.
- Updated where the change moves pinned behaviour:
  - `catalog-text.test.ts`: the old description and page-budget pins;
  - `declared-columns.test.ts`: one-page fixture, `dedupe` now in `process`, the ordering helper now stored, and the
    sent read drops what left the page;
  - `derived-record-output.test.ts`: `maxRecords` is 1,000;
  - `dispatch-alone-rows.test.ts`: the replay now adds `answer`;
  - `dispatch-timeout.test.ts`: rewritten for one page;
  - `domain/src/tests/web-panel-host.test.ts:297`: `maxRecords` is 200 → 1,000.

## Commands run and observed results

- Baseline before any edit, 61 files (both owned folders and every domain test naming the extract list), via
  `run-subset.mjs` then `node --test --test-reporter=tap`: `# tests 473 / # pass 473 / # fail 0`.
- Fail-first, after writing the tests and before any source edit:
  - `read-request`, `one-page-read`, `catalog-text` and `issues` tests: `# pass 26 / # fail 11`. Every new or changed
    case failed: answer parsing, catalog has no paging, retired issue, 8 dispatch cases.
  - The `record-output-process` bundle failed to build because the module did not exist.
- After the change:
  - owned folders plus `tests/web-panel-host.test.ts`: `# tests 146 / # pass 146 / # fail 0`;
  - the 63 related files: `# tests 487 / # pass 483 / # fail 4`. All 4 failures are in W-A-modified test files (listed
    below).
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` printed
  `src/runtime/llm-evidence/structure/packet.ts(291,66): error TS2345 ... Property 'answer' is missing ... required in type 'OptionalFields<WebAutomationExtractListRequest>'`
  and exit status 2. That is the only error. `npx tsc -p tsconfig.test.json --noEmit` showed no other error.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (171 warning(s), 118 baselined)`, exit 0. These
  warnings are advisory only:
  - `request.ts` has 13 exported values (it had 12);
  - `read-request.ts` is 460 lines (was 453), which was already past the threshold.

  `request.ts` was trimmed to 399 lines.

## Tests and files outside my folders that pin the old behaviour

1. **`domain/src/runtime/llm-evidence/structure/packet.ts:291`** (`runtime/**`, must-not-touch). Add `answer: undefined,`
   to the `present<WebLlmExtractionBinding["extractList"]>({...})` object, beside `sort: undefined`. This is the whole
   domain-check failure.
2. **`domain/src/output-nodes/tests/definitions.test.ts`** (W-A has it modified; I did not edit it):
   - :255: drop `"every page", "next page", "load more"` from the tags expected on `web.dom.extract_list`.
   - :271: `assert.match(firstSentence, /scrape/iu)` fails. The 4.2(g) description has no "scrape". Suggest
     `/rows of a list or table/u`.
   - :291: drop `"paginate"` and `...WEB_AUTOMATION_EXTRACT_PAGINATION_MODES` from the terms the grammar must contain.
   - :299: drop `grammar.includes(String(WEB_AUTOMATION_EXTRACT_MAX_PAGES))`.
3. **`domain/src/output-nodes/tests/native-runtime.test.ts`** (W-A has it modified; not edited):
   - :113: expected page parameters become `{ extractList: { ...extractList, answer: "kept" }, timeoutMs: 10_000 }`.
     At :99 the payload's `recordOutput` carries no `process` for that fixture, so Core still parses it.
   - :156-167 ("given one per page it may read"):
     - maxPages 3 and scroll now return `failure.code === "web.extract_list.paginate_retired"`;
     - a one-page read left at the default gets `10_000`;
     - an authored 12,000 stays 12,000.
4. Not a test: `domain/src/web-panel-host.ts:198` still proposes a scaled `timeoutMs` for a recorded multi-page
   definition, which dispatch will now refuse (design 6.3 says it should). `webAutomationExtractListTimeoutMs` is
   unchanged because the extension's `background/extraction/confirm.ts` and `web-panel-host.ts` still use it. S7
   retires it.

## Not verified

- No extension, Lab, browser or provider run. Whether the page honours `answer: "kept"` and counts `minItems` as items
  seen is W-E's.
- No Core run takes `process`, because Core's S1 is not in this tree. The payload's `recordOutput.process` would be
  refused by any Core consumer that re-parses `recordOutput` (record capture). C3 says S4 must merge after S1.
- `replay-answer.ts:327` also calls `webAutomationExtractListDispatch`, so the build test's replay now refuses
  multi-page reads as well. Its tests pass, but I did not examine that path beyond them.
- Full domain and extension suites were not run (narrow checks only, per AGENTS.md).

## Open questions or contradictions found

- **Description length.** The design 4.2(g) first sentence is 91 characters, and Core keeps 80 of a condensed first
  sentence (pinned by `catalog-text.test.ts` and `definitions.test.ts`). I shipped "...into the dataset." (79
  characters).
- **An ordering helper is now stored** (`declared-columns.ts`). Under C3, `sort` and `dedupe` run over the stored
  rows. Keeping a helper column that an ordering names out of the schema, as before, would make Core's sort or dedupe
  name a column that is not stored. I store it instead. Once Core's `process.columns` exists, the alternative is to
  store it and drop it from the answer.
- **`dedupe: false`** (the example's off value) and **`dedupe: true`** are mapped as the brief says.
  - `false` gives no `process.dedupe`, so Core's whole-row default applies.
  - `true` resolves through the reader to the link column, `{by: ["url"]}`, not to the whole row. Design P4 argues
    that the whole row should be the default for "each once". If that is wanted, the change belongs in
    `order-request.ts` `defaultKey`, which the page also uses in exploration, so I did not change it.
- **An invalid `answer`** is dropped and named rather than refusing the whole request, following the reader's rule for
  parts a read can do without. The brief's "refuses another value" is met by `...Whole` and the issues layer.
