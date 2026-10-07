# Report: s6-docs-downstream (worker, read-list S6)

Tree `fxwork/t290/!FluxIQWebExtension`, branch `task/t290-read-list-s6-migration`. No commits.

## Outcome

Done. The five `docs/architecture/` files now describe the one-page read, Next page, Core's do-while repeat, per-step
collection with run-end processing, the `paginate` refusals, the picker without "Read every page", and the Lab's
paged-step exclusion. Where a doc describes the extension's own paged read loop, it now says the loop is still in
the extension, that no Flow reaches it, and that a later stage retires it.

## What changed and why

- **build-loop.md**
  - "Which List A Read Read": `paginate` taken out of the list of things the read code ignores. Added that page 1
    and page 5 sharing a code is what a page loop needs.
  - "The Model's Instructions": the version is now `web-5`, and the section quotes the Lists line's page-loop
    sentence. The build runs Next page once live and states the loop.
  - Replaced "Bounded extraction feedback", which described paginationBound, maxPages/maxScrolls and page_limit,
    with "Paged lists". It covers:
    - `nextPageNote` and the `nextPage: {list | control | literal}` forms;
    - Next page's outputs and the `repeat {through, while, most}` loop;
    - the handle-form refusal `web.handle.malformed` with hint `web.handle.expected.extract_list.next_page`;
    - the dispatch refusal `web.extract_list.paginate_retired` with its sentence;
    - a one-page `paginate` being dropped;
    - per-pass appends and run-end processing (`maxItems` to `limit`, `minItems` to `minRows`);
    - readers, exports, the Lab and run judges reading the answer;
    - the build test replaying pass by pass to `ended`, bounded by `most`.
- **web-capabilities.md**
  - Recovery: the `paginate` read-only rule is restated. A Flow read never carries `paginate`. `web.dom.next_page`
    faults are not retried.
  - Request reader: a readable multi-page `paginate` is refused at dispatch.
  - Structured extraction row: the timeout is now one page's wait.
  - Repeating-list row: `maxItems` is no longer a page bound and moves into `process`.
  - Pagination row: rewritten around `web.dom.next_page` and the Repeat loop. It covers:
    - the ways forward and `by`;
    - the `ended` stop words and the faults with their codes;
    - the 10 s list-change wait;
    - the cross-document mark resend;
    - 429/503 reloads (8.5 s, then 17 s, at most two);
    - the per-origin pace;
    - detection never proposing `scroll`;
    - run-end dedupe;
    - `paginate_retired`;
    - the paged loop's files still being present until retirement.
  - "Partial and wide list answers":
    - removed the claim about page-advance faults returning earlier pages;
    - added `answer: "kept"` for Flow reads and the paragraph on moving the ordering into `recordOutput.process`;
    - the checkpoint paragraph now says it belongs to the read's own paged loop, which no Flow reaches.
  - Counts: the action types go from eighteen to nineteen and the alias-only list from seven to eight (adds
    `web.dom.next_page`). The safety classification's review count goes from twelve to thirteen. Recorded
    extraction timeout: one page.
- **extension-client.md**
  - Added `web.dom.next_page` to the Action Surface list.
  - Confirm section: the timeout bullet is rewritten without the maxPages/maxScrolls scaling.
  - New paragraph "The pick records one page". It covers the panel's "Current page only" sentences, the confirm
    payload having no `paginate`, recording the loop not being built, and how a recorded multi-page `paginate` is
    refused or a one-page one dropped.
  - "An Extraction's Dataset And Budget":
    - `writeMode: "append"` now means pass appends plus run-end processing;
    - the scaled-`timeoutMs` bullet now says one page's wait.
- **testing-facility.md**
  - Manifest list: the `extract` step's `pagination` is now described as the reference reader's data and the
    oracle's description. Paged workflows are not run on the recording and Flow lanes.
  - Recordable actions: the paragraph that said `flowLaneExclusion` excludes no `week1` workflow is replaced. It
    now covers:
    - both exclusion reasons;
    - `pagedExtractExclusion` and its new path under `lane-exclusion/`;
    - the recording-lane refusal;
    - W05 and W07;
    - paging being judged on the created-Flow lane.
  - Extraction catalog: "only paginated extraction a week1 bench measures is W05's next" is replaced. W05 and W07 are
    skipped, and the catalog's paged workflows are refused by the extraction intent. Three rows no longer say "in
    one read" or "the read returns the first page".
  - Recording lane: the measurement's pages are now one.
  - Recording lane, extraction intent: the paragraph that said FluxIQ follows pagination up to `maxPages` is
    replaced by the `fixture.invalid` refusal and the bench skip.
  - Flow lane: `paginationAccuracy` stays a recording-lane measure and publishes no rate until a loop is
    recordable. The bench metrics sentence is changed to match.
  - week1 corpus: 67 runnable results and 0 skipped becomes 62 and 5 skipped (21 recording; 41 Flow, of which 21
    unarmed and 20 variants). This matches the assertion in `bench/tests/week1-corpus.test.ts`.
  - e2e list: added Next page (`everything-store-next-page.spec.ts`).
  - Playback step write-up: "why paging stopped" now notes that a Flow's paging shows in its Next page steps.
- **page-evidence.md**
  - Line 401 ("record (one item, no pagination)") is still true and was left alone.
  - The detection paragraph now says that a list that continues carries `nextPageNote` and that the packet states
    no page bound.

The claims were checked against these sources:
- domain:
  - `structure/packet.ts`;
  - `system-instructions/instructions.ts` (`web-5`);
  - `actions/extraction/{retired-paging,request}.ts`;
  - `output-nodes/extract-list/dispatch.ts`;
  - `plan-resolution/extraction/slot.ts`;
  - `actions/safety.ts` and `types.ts` (19 types; 13 review, 6 safe);
- extension:
  - `content/actions/next-page.ts`;
  - `content/extraction/page-advance/{move-page,refused-page,list-change}.ts`;
  - `runtime/extract-list-continuation.ts`;
  - `content/action-runtime/recovery/fault.ts`;
  - `panel/extraction/{panel,confirm-payload}.ts`;
- Core t290: `nodes/control-flow/repeat.ts` (default 50, ceiling 500) and `flow-draft/amendment/schema.ts`;
- Lab: the uncommitted diffs to `lane-exclusion/*`, `extract-intent.ts`, `expand-corpus.ts` and
  `week1-corpus.test.ts`.

## Commands run and observed results

- `git -C <tree> diff --stat -- docs` lists exactly the five files: build-loop.md 53 changed lines,
  extension-client.md 46, page-evidence.md 5, testing-facility.md 85, web-capabilities.md 58 (177 insertions,
  70 deletions).
- Sweep: `grep -i "Read every page|unpaginated|paginated read"` over the five files. The only hit is the new
  sentence saying the picker no longer offers it.
- `node scripts/structure-audit.mjs` (tree root) printed "structure-audit: passed (176 warning(s), 118 baselined)"
  and exited 0.

## Not verified

- No build or test was run; the brief did not ask for one.
- The Core t290 sibling (522584ed) holds S1 and S2 but not S3's build-test processing. I did not find
  `processAutomationStudioRecordRows` used under the build test. So build-loop.md says the run judges read the
  answer, and does not claim the build-test judge does.
- The claim that the created-Flow lane judges paging comes from the brief and the week1 test comment. I did not
  check it against `flow-lane/expectations.ts`.

## Open questions or contradictions found

- The plain `git diff --stat` also lists packages/test-contracts and test-runner files I did not touch. Those are
  other workers' uncommitted changes in the same tree, among them `extraction-metrics.ts`, which is probably the
  `collectedRecords` change the brief said not to describe. The docs-only diff stat contains only my five files.
- web-capabilities.md: the Navigate row still calls 8.5 s "the pagination's first retry wait". That is still true,
  since the Next page reload uses the same wait, so I left it.

Outcome: Done
