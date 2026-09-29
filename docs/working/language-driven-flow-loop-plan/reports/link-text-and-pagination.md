# Link text and pagination stop reason (causes 3 and 4 of run-mulwm2dc-0bd95f22)

Status: Done. Validated 2026-09-28 after three machine restarts; every file was checked whole, with no NULs and LF line endings.

## Outcome

Both defects are fixed in the extension and the domain. The unit suites and the
new content specs pass. There are two scope notes the supervisor needs to act on:

1. I edited two files the brief did not name, because without them the stop
   reason could not travel: `apps/extension/src/content/actions/extract-list.ts`
   and `domain/src/actions/extraction/summary.ts`.
2. The stop reason stops at Core's run record. Getting it there needs a Core
   change, which I did not make (see Open questions).

## What changed and why

### Cause 3: a link's visible text is now a column

`content/extraction/infer-fields.ts`: an `<a href>` now proposes two sources.
- a `text` source under its path label, for example `div > h2 > a`
- a `link` source under the same label plus ` url`, for example `div > h2 > a url`

The URL suffix is "url" rather than "link" because the key function reduces a
label like `h2 > a link` to a key the model could still read as the title.

The text source is left out in four cases (`offersOwnText`):
- the link has no words (an image link);
- the page states the value more tightly elsewhere (`statedMoreTightly`);
- one descendant leaf, or an ancestor with a test id, already holds exactly the
  same words and is offered on its own. The product catalog's
  `<h3 data-testid="product-name"><a data-testid="product-link">` is this case,
  so it proposes no duplicate column;
- the link holds more than two words-holding leaves, meaning it wraps a whole
  card rather than a title.

Existing URL labels change: `product-link` is now `product-link url`.
`inference.spec.ts` is updated for that.

### Cause 4: why the run stopped on page one

The bundle shows `durationMs` of 10145 and 10135 ms for the two extractions,
each with `pagesRead: 1`, not truncated and not timed out. That matches
`LIST_CHANGE_TIMEOUT_MS` (10 s) in `pagination.ts`:

1. Next was clicked.
2. The list never changed.
3. `afterListChange` threw.
4. `list-reader.ts` absorbed the throw as `pageFault`, which the summary never
   carried.

**Why the list never changed.** The model reached the results page by
navigating straight to its URL, so it never answered the consent wall, and the
wall stays open. While the wall is open, the board cancels every click made
outside it, `element.click()` included (`scenario-lab/.../job-board/board/client-script.ts:49-57`).

**The fixture's deliberate Next bug is a different thing.** From page two on,
Next points at the page it is on (`board/results-page.ts:100-101`). Page one's
Next works, so this bug did not cause the stop in the run. A read that got past
page one would have hit it next.

### The stop reason (`paginationStop`)

It is one closed word, declared as `WebAutomationExtractionPaginationStop` in
`domain/src/actions/extraction/summary.ts`. The words are:

| Word | Meaning |
| --- | --- |
| `control_absent` | The pagination control named nothing on the page |
| `control_disabled` | The control is disabled |
| `no_following_page` | The numbered pager shows no page after the current one |
| `scrolled_to_end` | Scrolling to the bottom brought nothing new |
| `list_vanished` | The page a control led to showed no list items (a rate limit or check page) |
| `page_limit` | `maxPages` was reached |
| `item_limit` | `maxItems` was reached |
| `deadline` | The command's timeout ran out |
| `list_unchanged` | The page ignored its control |
| `page_repeated` | The page reached held only records earlier pages had |
| `control_not_clickable` | The control is not an element that can be pressed |
| `page_fault` | The move threw for any other reason |

Where each word is set:
- `pagination.ts`: `PageAdvance` is now an object that carries the word, and
  `PaginationFault` carries it when the move throws.
- `list-reader.ts`: sets it on every exit. `ListExtractionOutcome.paginationStop`
  is new.
- `content/actions/extract-list.ts`: puts the word on the summary, and a phrase
  for it in the result's `actual`, which is what the model reads. On page one,
  `control_absent` is said as "the control named nothing there -- check the
  control's selector".
- `summary.ts`: copies the word as sent, and drops the whole summary for a word
  outside the set, following the rule `listPresence` uses.
- `llm-evidence` (`read-shortfall.ts`, `refusal.ts`, `repeated-refusal.ts`,
  `tool-rejection.ts`): a failed read's refusal detail carries `paginationStop`.
  Core parses this detail as opaque JSON evidence, and none of its exact-key
  lists covers it; I checked `evidence-loop-decision.ts:64`.

**What the model reads in `actual`.** The phrase names every stop a Flow can
act on: `control_absent` on page one (said as "check the control's selector"),
`list_vanished`, `page_limit`, `item_limit`, `list_unchanged`, `page_repeated`,
`control_not_clickable`, and `page_fault` when no fault phrase already said it.
The ordinary endings (`control_absent` past page one, `control_disabled`,
`no_following_page`, `scrolled_to_end`) and `deadline` go on the field only, so
the result of a read that simply finished reads as it did before.

### A pre-existing defect fixed on the way: sensitive refusals were swallowed

`list-reader.ts` has a per-item `catch` that skips an item whose read threw. It
came in with t167 and is already in HEAD. It also caught the field reader's
sensitive-control refusal, which decision D2 requires to refuse the whole read.
The effect was that `extract-list-sensitive.spec.ts` read the rows around a
password as a successful read, and three of its specs failed. The catch now
rethrows any error that carries a `failure` record (`isRefusal`), which covers
the sensitive refusal and the `encrypt` NOT_IMPLEMENTED refusal. All three
specs pass again.

### Defensive recovery, in `pagination.ts`

- **A click the page cancelled.** The read now notices when the page cancels
  the click: a window capture listener reads `defaultPrevented` after `click()`
  returns.
  - If the control is a link to another document, the read gives the page 2 s
    to change the list. If nothing changes, it goes to the link's own address
    with `location.assign`. That is what the click would have done, and it
    answers nothing on the page's behalf.
  - A click that was not cancelled but changed nothing gets the same address
    fallback after the full 10 s.
  - If neither works, the read ends on `list_unchanged`.
- **A Next whose address is the page already showing.** The read follows the
  pager's control numbered one past the current page instead. The current page
  is the `aria-current` number, or the one number the pager draws as something
  other than a control. If no such control exists, the read follows Next anyway,
  and the new `page_repeated` check in `list-reader.ts` ends the read instead of
  looping until `maxPages`.
- **A disabled Next** is now the list ending (`control_disabled`). Before, it
  was pressed and waited on for 10 s.

## Commands run and observed results

Final runs, after the last edit:

- `node node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit`
  (extension, which covers src and e2e): exit 0.
- `pnpm check` in `domain`: exit 0.
- `EXTENSION_TEST_BUILD_LABEL=anchor node scripts/test-extension.mjs`:
  `# tests 990 # pass 990 # fail 0`. This includes
  `extract-list-paging-account.test.ts` and the new row in `pagination.test.ts`.
- `DOMAIN_TEST_BUILD_LABEL=anchor pnpm --filter @fluxiq-web-extension/domain test`:
  `# tests 861 # pass 861 # fail 0`. This includes
  `summary-pagination-stop.test.ts` and `read-shortfall-pagination.test.ts`.
- `pnpm test:content -- e2e/content/tests/extraction --workers=2` (Chromium,
  the whole extraction folder): 67 passed and 5 failed. Three of the five were
  the `page_limit` phrase, which I then reworded and whose specs I updated. The
  other two are described below the list.
- `pnpm test:content -- extract-list-catalog extract-list-pagination job-board-listing pagination-stop --workers=2`:
  26 passed and 3 failed. The three were the same two pre-existing failures
  plus one "Target page, context or browser has been closed" with no assertion
  diff.
- `pnpm test:content -- extract-list-pagination --workers=1`: 9 passed. This is
  that browser-closed spec, rerun alone.
- Earlier, `pnpm test:content -- job-board-listing inference.spec`: 8 passed,
  and `pagination-stop`: 3 passed. The new specs above cover these rows:
  - the job-board title link proposes a text column and a `url` column, and the
    titles read as words;
  - `control_absent` and `page_limit` are recorded;
  - with the consent wall open, Next is followed by its own address to `page=2`;
  - page two's self-pointing Next is replaced by the pager's page 3;
  - `page_repeated`, `control_disabled` (under 8 s) and `list_unchanged` are
    recorded.
- `node scripts/structure-audit.mjs` reports 2 violations, and neither is mine:
  `[swallowed-failure] packages/test-runner/src/network-guard.ts:129` and
  `[working-docs] docs/working/README.md is out of date`. My earlier
  `failure-as-empty` finding in `pagination.ts` is fixed.
- One extension check died with a segmentation fault (exit 139), which is the
  RAM fault; the rerun completed.

**The two remaining failures are not mine.** They are
`extract-list-catalog.spec.ts:158` ("an item selector matching nothing fails")
and `:177` ("minItems: 0 lets an empty list succeed"). Both expect the old
phrase `0 records from 1 page; ...`. They now receive the `never_appeared`
phrase, which `readSummary` already produced in HEAD before my change, and
`:158` also receives "the execution did not recover within its 1 attempts...",
which comes from `content/action-runtime/recovery/account.ts`. Neither read
paginates, so none of my changes reach them. The spec expectations are stale
against committed code.

## Not verified

- A live run. No Lab run was started.
- The whole read continuing across documents on the job board. The harness
  loses the page's script when a link loads a new document, so the specs prove
  where the page went, not the records the continued read returned. The
  worker's side is covered by the existing `extract-list-continuation.test.ts`.
- Firefox. Only the Chromium content config was run.
- A fresh `pnpm check` over the whole repository was not run; the package
  checks and the audit were run separately.
- The board's rate-limit page (every sixth results page) on a continued read. It
  should read `list_vanished`, or `deadline` if the render wait outlasts the
  budget. This is untested.

## Open questions or contradictions found

- **Core does not keep the word.** Core's `runtime/service/summaries/extraction-summary.ts`
  rebuilds the summary member by member and silently drops unknown members.
  It does not refuse them, so nothing breaks, but `paginationStop` will not
  appear in Core's run record or in the Lab bundle's `extraction` until Core
  admits it. The change would be one closed word set, published as
  `"unknown"` for a word Core does not know, the way `listWait.stoppedOn` is.
  The model already sees the word in the result's `actual` phrase and in the
  refusal detail.
- **Two files outside the stated ownership:** `content/actions/extract-list.ts`
  (adds `paginationStop` to `summaryOf` and a phrase to `readSummary`) and
  `domain/src/actions/extraction/summary.ts` (declares the word). The stop
  reason cannot reach the summary without them.
- **Specs I updated outside my new files:** `inference.spec.ts`,
  `structure-detection.spec.ts` (the link label is now `product-link url`), and
  `extract-list-catalog.spec.ts` and `extract-list-pagination.spec.ts` (three
  exact `actual` strings now include the `page_limit` phrase). The two stale
  catalog specs were left alone, because their subject is not mine.
- **Behaviour change for other Flows:** every proposed link column's label now
  ends in ` url`, so a model's column keys for links change on the next
  detection. Stored Flows keep their own keys.

## Follow-ups (after commit e7e48db9)

### 1. `paginationStop` reaches Core's run record

The edit is in Core's
`packages/fluxiq/src/programs/automation-studio/runtime/service/summaries/extraction-summary.ts`.
`extractionSummaryFromOutputs` now carries `paginationStop`. The member follows
the rule `listWait.stoppedOn` already uses, because both are sets of ways a read
can end, and such sets grow:
- a word from the twelve is copied as sent;
- a newer word Core does not know is published as `"unknown"`, so the account
  is kept and nothing the producer sent rides out;
- a value that is not a string drops the whole summary.

**Exact key lists.** Only this projection and its test name the summary's
members in Core. I grepped `F:\!FluxIQ\packages` for `listPresence`,
`stoppedOn`, `emptyRecords` and `itemsSeen`, and the only other hits were built
`.next` chunks. So there was no other list to teach. The domain's mirror
(`domain/src/actions/extraction/summary.ts`) already declares the word from the
first commit, and `evidence-loop-decision.ts:64`'s exact list covers the tool
result's own keys, not the summary.

The tests are in `summaries/tests/extraction-summary.test.ts`:
- `paginationStop` reaches `actionAttempts[0].metadata.extraction` on the run
  detail;
- all twelve words are kept;
- an unknown word is renamed `"unknown"` and the producer's text is not
  republished;
- a non-string drops the summary.

### 2. The two stale catalog specs

These are `extract-list-catalog.spec.ts:158` and `:177`. The wording they now
assert is intended, not a regression:
- **The `never_appeared` sentence** ("the item selector named nothing on the
  page, so the list never appeared, after waiting Nms for 1 item and stopping on
  the read's own render window running out -- change the selector...") is the
  documented design of `readSummary` in `content/actions/extract-list.ts`. A
  selector that names nothing deliberately pays the whole render window
  (`extraction/page-render.ts` header).
- **The recovery sentence on `:158`** ("the execution did not recover within its
  1 attempts after absorbing output_not_observed, waiting 0 ms") is
  `recoveryAccountSentence` in `action-runtime/recovery/account.ts`, commit
  260a4e17. It is appended on purpose whenever a fault was absorbed.

The specs now match these with a pattern. The wait length is a number because
it is the page's own timing, and `attempts?` tolerates the one wart I found:
"1 attempts" should be singular. That wording is in `recovery/account.ts`, which
is outside my ownership, so it is left as it is.

### Follow-up validation (after the last interruption; every file checked with no NULs and not truncated)

- `npx vitest run src/programs/automation-studio/runtime/service/summaries`
  (Core `packages/fluxiq`): `Test Files 6 passed (6)`, `Tests 46 passed (46)`.
- `pnpm --filter fluxiq check`: exit 0. An earlier run had exited 2 on errors
  only in `flow-bootstrap/` and `llm/`, other workers' files that were in
  flight.
- `pnpm test:content -- extract-list-catalog --workers=2`: `12 passed`.
- The extension `tsc -p tsconfig.test.json --noEmit` (src and e2e): exit 0.

