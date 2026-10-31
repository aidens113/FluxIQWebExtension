# t810 / w2-marks: outside marks on left-out rows, end to end

## Outcome

Partial. All code, tests and docs are written. Core `pnpm check`, Core tests of the three directories, domain
`pnpm check`, DS structure audit and model-text check passed. NOT run: the extension typecheck (`apps/extension pnpm check`)
and the extension tests (item-offer, rejected-samples, list-reader directories) -- the shared heavy-check lock was held
by other lanes' long e2e runs for over an hour and my queued extension check never got it. The new extension test
file is therefore unexecuted; run it first (see Commands to run).

## What changed and why

Extension (DS/apps/extension/src):
- New `content/extraction/item-offer/` (barrel `index.ts`): `offer-words.ts` (verbs: join, follow, subscribe,
  connect, add friend, request to join, become a member, at the start of the name on a word boundary, case-insensitive;
  refused states joined, following, unfollow, unsubscribe, leave, requested, pending, member), `control-name.ts`
  (aria-label, else words, else title), `linked-name.ts` (entity), `offer-marks.ts` (`itemOfferMarks(item)` ->
  `{kind:"outside", said, entity?}[] | null`; scans `button, [role="button"], a[href]`; same said+entity once). Entity rule:
  from the control outward, the first ancestor (item at most) holding linked names decides; headings' links if any, else
  all links with their own words (aria-hidden/icon links give nothing); exactly one distinct name is clear, 2+ means omit.
  For the social suggested post the bar has no link, so the item's one heading link ("Urban Growers Network") is the entity.
- `content/extraction/rejected-samples.ts`: Witness carries marks; `note(..., marks)`, `marks()`, carried-marks param.
  Marks are not part of the dedupe key (same row = same item).
- `list-reader.ts`: `rejectedMarks` on the outcome; `itemOfferMarks(element)` computed only when samples are asked, at the
  rejection; resumed from the checkpoint.
- `content/extraction/continued-read/read-checkpoint.ts` (not named in the brief, needed: it builds the checkpoint),
  `shared/extraction-continuation.ts`: `rejectedMarks` travels and is re-read; unreadable marks drop only the marks.
- `content/actions/extract-list.ts` `sampledRows`: sends `rejectedMarks` beside `rejectedSamples` for both `true` and
  `"alone"` asks; in the playback ("alone") filter the marks follow the kept positions (alone lead + shared rows).

Domain (DS/domain/src): `actions/extraction/rejected-marks.ts` (types `WebAutomationExtractionItemMark`,
`...RejectedMarks`, key constant, strict validator `webAutomationExtractionRejectedMarksValue`), exported from the barrel and
the client entry; `summary.ts` admits `rejectedMarks` (malformed -> only marks dropped); `runtime/llm-evidence/node-run/
rejected-rows.ts` strips `rejectedMarks` from the recorded payload with the samples. The builder evidence does NOT show
marks (only rows as before); choice: marks are page words meant for Core's verdict, not for the build model.

Core (RT = packages/fluxiq/src/programs/automation-studio/runtime): `service/summaries/rejected-marks/` (new dir, barrel +
strict validator + `aloneMarkLists`), `extraction-summary.ts` admits `rejectedMarks` as `conditions.aloneMarks` (aligned with
`aloneRows`, rows without a label are dropped with their marks) and as `marks` on each `togetherRows` set. Choice: a
bad `rejectedMarks` drops only the marks, never the summary, because marks only add evidence while every other member's
absence would cost the whole account. `result-verification/left-out-cells/left-out-marks.ts` screens (credential or locator
shaped `said`/`entity` become "(withheld)", mark kept) and `read-account/accounts.ts` / `together-rows.ts` place them as
`leftOutMarks` / together `marks`.

Docs: one paragraph in DS docs/architecture/web-capabilities.md.

## Commands run and observed results

- Core `npx vitest run` over service/summaries, read-account, left-out-cells: 41 files, 264 tests passed (includes new
  extraction-summary-marks.test.ts 9 tests, left-out-marks.test.ts 4 tests).
- Core `pnpm check` (packages/fluxiq): exit 0.
- Core libs rebuilt (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`) because the
  worktree's dist was stale; the wrapper exited 0 (its output was lost to the background shell).
- DS domain `pnpm check`: exit 0 (domain:check stamped).
- DS `node scripts/structure-audit.mjs`: exit 0 (after moving my test into item-offer/tests/ for the 25-file directory limit
  and unpacking a statement line); `node scripts/check/model-text.mjs`: ok, exit 0.
- Did not run: Core `pnpm test` whole (only the three directories, as the brief says).

## Not verified

- Extension typecheck and the extension tests (new `item-offer/tests/item-offer-marks.test.ts`: detector on a suggested-post
  tree, states refused, person card, positional marks through the collector and resume, an `extractList` read that rejects
  suggested notices and returns `rejectedMarks`, checkpoint round trip and drop-only-marks). Written against the
  `selector-page.ts` fake DOM (has matches/closest/contains/textContent/querySelectorAll); it uses
  double-quoted attribute selectors for that matcher. Expect to fix small type errors.
- Domain tests (summary.test.ts etc.) not run; no domain test for `rejected-marks.ts` written -- add one beside
  `actions/extraction/tests/rejected-samples.test.ts` if wanted.
- No browser run; the markup test is a stand-in tree shaped like social-network-feed's suggested post
  (contextBar role=button "Join group", h3 link), not the real rendered scenario.

## Q4: do playback and build-test trials send rejected samples?

- Exploring node run: `rejectedSamples: true` (node-run/rejected-rows.ts) -> every rejected row; marks sent.
- Playback / judged run: `output-nodes/extract-list/dispatch.ts` sets `rejectedSamples: "alone"` (documented in
  actions/extraction/rejected-samples.ts); the page then sends alone rows plus shared rows, and now their marks too. So marks
  reach the run-record summary Core reads.
- Build-test trial: not traced (outside my files); `result-verification/build-test/read-rows.ts` builds aloneRows from a domain
  replay and would need `aloneMarks` added by whoever owns it.

## Open questions

- `build-test/read-rows.ts` replay rows carry no marks (see above).
- Core `refuted-no/` does not yet consume `leftOutMarks`/`marks` -- that is the next brief.

## Commands to run (pending)

Extension: `pnpm check` in apps/extension; `node scripts/test-extension.mjs content/extraction/item-offer content/extraction/tests/rejected-samples content/extraction/tests/list-reader`, and
domain `node scripts/test-domain.mjs actions/extraction` (check each runner's filter syntax in the script header), all under the heavy lock.

## Follow-up (t810/w2-marks, second pass)

Outcome: Done. Everything the first pass left unrun now ran.

- Added `marks` to Core `result-verification/build-test/read-rows.ts`: an entry of `leftOutOnlyByThis` and a
  `leftOutTogether` set may carry `marks` (one entry per row, `null` or `{kind:"outside",said,entity?}`), screened by
  `automationStudioResultReadLeftOutMarks` and shown beside the rows; a list not one per row is left out and the rows stay.
  (Key is `marks`, matching a together set's; the brief said `aloneMarks`, which is the summary-side name.) New test
  `build-test/tests/read-rows-marks.test.ts` (2 tests). The domain replay sender does not yet write `marks` (not mine).
- Fixed a real bug the first extension run found: `offer-words.ts` lost its regex backslashes (shell heredoc), so "Add friend"
  never matched; now written with escaped string constants.
- Stale lock-waiter shells of mine from the first pass could not be stopped (the permission check refused Stop-Process);
  they were harmless and had all drained by this pass.

Commands and observed results:
- Core `npx vitest run` over service/summaries, read-account, left-out-cells, build-test: 65 files, 429 tests passed.
- Core `pnpm check`: exit 0, "inputs changed: packages/fluxiq" (not cache reuse; re-ran tsc, 60s).
- Core libs rebuilt (contracts, fluxiq, client-gateway-websocket): exit 0.
- Extension `pnpm check`: exit 0 (extension:check ran, 49s).
- Extension tests, directories content/extraction/{item-offer,tests,continued-read}, content/actions/tests, shared/tests: 508 run,
  506 pass, 2 fail (the offer-words bug above, both in my new file); after the fix, item-offer + rejected-samples + list-reader:
  55 tests, 55 pass.
- Domain tests `actions/extraction` + `runtime/llm-evidence/node-run`: 537 tests, 537 pass.
- DS structure audit exit 0 with no FAIL; model-text ok, exit 0.

## Follow-up 2 (stopped)

Stopped on the supervisor's request. No command of mine is running; the last one finished and released its own lock.

Finding on item 1: I found no code path that drops the marks of rows two conditions left out together. In the client, `rejectedSamplesFor.note` gives every condition in `rejectedBy` the same marks. In `extract-list.ts` the playback ("alone") filter keeps marks at the kept positions. The domain summary and Core's `togetherRowGroups` carry them to `marks`. W5's "10 together rows carried no marks" matches its own note that those rows were sponsored and page posts with no join control. I added tests that prove the path rather than changing code.

Changed (tests only, no new production code):
- `apps/extension/src/content/actions/tests/extract-list-rejected-samples.test.ts`: playback read keeps marks of alone and together rows through the domain wire copy.
- `apps/extension/src/content/extraction/item-offer/tests/item-offer-marks.test.ts`: a real `extractList` with two conditions; a notice both reject carries its mark in each list it sits in.
- Core `service/summaries/tests/extraction-summary-marks.test.ts`: page summary -> read account puts the together row's mark on `leftOutTogether[].marks`.

Ran and saw:
- Extension `pnpm check` -> exit 0. Extension tests (item-offer, extraction/tests, continued-read, actions/tests, shared/tests) -> 510/510 pass.
- Core vitest over service/summaries, read-account, left-out-cells, build-test -> 65 files, 430 tests pass.
- Core `pnpm check` -> exit 2, one error in `located-defects/tests/row-refuted.test.ts(70,78)` (TS2375, `condition: string | undefined`). That file is another worker's uncommitted, untracked work, not mine; my files typecheck. Not stamped.
- Domain `pnpm check` -> exit 1 only because Core's build is stale ("not current with its source"; needs the Core libs rebuild). Not a type error.

Unrun: domain `pnpm check` after a Core rebuild; domain tests of actions/extraction and node-run (they passed earlier, 537/537, before this pass, and I changed no domain file this pass); DS structure audit and model-text for this pass's test edits (both passed earlier).

Item 2 (domain sender writing `marks` for the build test): not mine and not done. The sender is `domain/src/runtime/llm-evidence/node-run/replay-answer.ts` (rows built at about lines 334-337), with `left-out-together/grouped-rows.ts` for together sets. Neither is in my ownership list.
