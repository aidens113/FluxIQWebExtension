# w2x-extract-across-pages (plan step P15, task t064)

Worktree `F:\fxwork\t064-extract-across-pages`, branch `task/t064-extract-across-pages`, on the
shared read-only Core. All changes are uncommitted.

## Outcome

**Done, with one live lane still unproven in the Lab.** A paginated `web.dom.extract_list` now
continues when Next loads a new document. It also waits for the next page's records to render
before reading them, and it returns each record once, in order.

| Lane | Result |
| --- | --- |
| bigbox-retail `pickup-towels` (Next loads a new document) | Before the fix: 0 of 9, "message channel closed". After: 9 of 9 records and 36 of 36 fields, 2 pages, 0 provider calls. This held in three runs. |
| professional-network `people-search` (numbered pages, skeleton, security check, repeated result) | Before the fix: 10 of 23. After, in the content harness on the same fixture and page script: 23 of 23, 3 pages. The Lab recording lane could not reach the extraction (see below). |
| product-catalog `paginated-extraction` (established) | Passed twice: 23 of 23, 92 of 92 fields, 3 pages. |

All three bigbox runs still end with the verdict `failed: recording.persistence`. That is Core's
known recording-finalization stall, not the extraction. The professional-network recording lane
failed six times at its first step, `Accept` cookies, because the site's 2.5-second "better on the
app" modal intercepted the click. The unmodified baseline code fails the same way
(`run-mubwbikt-d633aa4a`), so that failure is environmental.

## What changed and why

### The page's side (extraction engine)

- **`content/extraction/list-reader.ts`** takes two new options:
  - `checkpoint`: a callback that receives the records, pages, scrolls and missing fields read so
    far. It is awaited just before any pagination control is followed. A Next that destroys the
    document therefore never takes records with it that nothing else holds.
  - `resume`: a new document goes on from a checkpoint. Its records count toward `maxItems` and
    its pages toward `maxPages`. The reader first waits for the page to render its records.

  One de-duplication rule changed. In `next` and `numbered` mode, a record that repeats, field for
  field, one an earlier page yielded is not read again. Element identity cannot express this across
  a document load. Without the rule, in-place and reloaded pages behaved differently, and the
  shifted-index repeat (professional-network page 3 opens with page 2's last person) was read twice.
  - Two equal records on the same page are still two records.
  - Records a resume carries are never re-read, in any mode.
  - `scroll` (D16) and `loadMore` within one document are unchanged.
- **`content/extraction/page-render.ts`** (new): after the list changes, and on arrival in a
  resumed document, the reader waits until the page has rendered its records:
  - It waits until the page shows an item the read has not taken.
  - Otherwise, a page that has shown its pagination controls with no such item for 2 s counts as
    arrived and is read as holding none. The controls are what distinguish that page from a
    skeleton or a check page, which draw none.
  - Otherwise, the page is read as it stands after 10 s.

  The command deadline bounds all of it. This is the professional-network fix: its skeleton has
  neither items nor pager, so the old read ended on page 1.
- **`content/extraction/pagination.ts`** makes four changes:
  - It calls `beforeFollow` (the checkpoint) before each click in `next`, `numbered` and `loadMore`.
  - A document that fires `beforeunload` or `pagehide` after the click gets a second 10 s window
    rather than "the list did not change".
  - The followed control detaching now counts as a change. A pager redrawn with its results
    detaches, and this is the only signal a page that showed no matching item can give.
  - The wait for rendered records follows every change.
- **`content/extraction/list-wait.ts`** (new) holds the shared `waitUntil` poller, moved out of
  `pagination.ts`.

### The worker's side and the wiring between them

- **`runtime/extract-list-continuation.ts`** (new): for a paginated `extract_list`, the worker
  sends the command with a random token and temporarily listens for checkpoints under that token,
  from that tab and frame.
  - When the reply is lost (the document went away), it waits for the tab to settle, readies the
    content script, and re-sends the same command. The resend carries the last checkpoint and the
    remaining `timeoutMs`, at least 1 ms, so that a read out of time answers `timed_out` with its
    records.
  - A reply lost before any checkpoint pressed nothing, so the read restarts from scratch.
  - At most 3 documents in a row may go away without a checkpoint.
  - Only the top frame is continued. A closed tab rethrows.
  - The result's `startedAt` is the first document's.
  - Frame messaging (`sendToTab`, `ensureContentScript`) is injected by the runner, which the
    structure audit's barrel rule required.
- **`runtime/action-runner.ts`**: `sendAction` routes a paginated `web.dom.extract_list` to the
  continuation. This is a single branch; the blocked-action classification is untouched.
- **`shared/extraction-continuation.ts`** (new): the checkpoint message name, the
  checkpoint/continuation types, and `readExtractionCheckpoint`, which both ends use to validate
  what they receive.
- **`content/action-runtime/extraction-continuation.ts`** (new), **`execute-action.ts`** and
  **`content/message-handler.ts`**: the `extraction` field that rides beside the action becomes the
  list read granted to the verbs. That read resumes and sends checkpoints; a missing receiver is
  tolerated, and a malformed resume is refused rather than restarted.

No domain contract changed. No closed failure code was needed.

### Tests

- `src/runtime/tests/extract-list-continuation.test.ts`: 8 tests covering resend with the
  checkpoint, the latest checkpoint winning, a restart from scratch, foreign checkpoints ignored,
  the stall bound, a closed tab or child frame, the budget, and runner routing.
- `src/shared/tests/extraction-continuation.test.ts`: 2 tests.
- `e2e/content/tests/extraction/tests/extract-list-continuation.spec.ts`: 6 content-harness specs,
  including the real professional-network people search.

## Commands run and observed results

Every Lab run used `FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run <site> --workflow <w>
--target persistent-isolated --workspace <ws>`, sequentially, with LLM `disabled` and 0 calls.

### Reproduction, before any change

| Run | Result |
| --- | --- |
| `run-mubt9b20-4ccc8c46` (bigbox) | `run_failed` "A listener indicated an asynchronous response by returning true, but the message channel closed…"; 0 of 9 |
| `run-mubtd0cz-b8953e8e` (people-search) | observed 10, expected 23 |

### After the change

| Run | Result |
| --- | --- |
| `run-mubu0qh6-39ccb8ad` (bigbox, workspace `t064-bigbox-b`) | 9/9 matched, 36/36 fields, `pagesFollowed` 2, 1327 ms |
| `run-mubva73c-abb24c33` (bigbox) | 9/9 matched, 2 pages, 1190 ms |
| `run-mubvjsdh-d6ee7748` (bigbox) | 9/9 matched, 2 pages, 1115 ms |
| `run-mubw1t9i-830eefe6` (bigbox, final build) | 9/9 matched, 36/36 fields, 2 pages, 1150 ms; run verdict `recording.persistence` ("Core was still writing the run's recording after 90000 ms") |
| `run-mubuqc7a-6aa0a7a2`, `run-mubvobey-75f3409f` (product-catalog) | verdict `passed`, 23/23, 3 pages |
| `run-mubveglg-fdc8c459` (property-listings `area-search`) | `run_failed. List extracted.`: a pre-existing field-optionality mismatch, see open question 3 |
| People-search, six runs in fresh workspaces (`run-mubuaqri`, `mubumfyq`, `mubut4xl`, `mubv0023`, `mubv76eq`, `mubw7s5x`) | Failed at step 1: the `artdeco-modal-outlet` intercepts the Accept click |
| `run-mubwbikt-d633aa4a` (baseline code, restored temporarily) | Failed identically |

### Focused checks

- **Unit tests.** My focused runner, `scratchpad/t064/run-focused.mjs`, uses the same esbuild
  settings as `scripts/test-extension.mjs`. Over the continuation, action-runner, click-landing,
  pagination, list-reader and shared tests it printed `# tests 62 # pass 62 # fail 0`. After the
  final edit: continuation 8/8, and the set without click-landing 45/45.
- **Content harness, Chromium.** `playwright test -c e2e/playwright.content.config.ts
  --workers=2 extraction/tests/` printed `50 passed (32.5s)`. The new spec alone printed
  `6 passed (26.8s)`.
- **Content harness, Firefox.** Not run: "Executable doesn't exist … firefox-1475".
- **`pnpm check`** exited 0 with `structure-audit: passed (84 warning(s), 122 baselined)`.
  - An earlier run failed on the barrel-import rule, "../background/tabs". That was fixed by
    injection.
  - A later run failed on a test typing error in `tsconfig.test.json`. That was fixed, and
    `node scripts/check-extension.mjs` then exited 0.

## Not verified

- **The professional-network Lab recording lane** did not reach its extraction (the environmental
  modal race above). The numbered-page fix was verified on that fixture only through the content
  harness.
- **Firefox.** Not exercised.
- **Flow-lane replay.** No `--flow` run, so a created Flow's replay of a paginated extraction
  across documents was not exercised.
- **A worker restart mid-read** loses the checkpoint, which is held in service-worker memory.
- **A navigating `loadMore` or `scroll`,** and **a check page that reloads itself during a
  resume** (bigbox's check did not fire during pagination), are handled in code and unit-tested
  only.

## Open questions or contradictions found

1. **Stale extension service worker in reused Lab workspaces. This matters for every lane.** A
   `persistent-isolated` workspace keeps running the background service worker from its first
   launch, even after the Lab rebuilds `dist/e2e-chromium`.
   - Three bigbox runs in workspace `t064-bigbox` showed none of the new background code, although
     the built bundle contained it: `run-mubtjm7q`, `run-mubtpsuh` and `run-mubtvr97`.
   - A fresh workspace matched 9/9.
   - A direct probe (`scratchpad/t064/stale-sw-probe.mjs`) confirmed it. A build with a marker
     answered with the marker. After a rebuild without the marker, the same profile still answered
     with it, while a fresh profile did not.
   - Any lane that reuses a workspace after a code change may be measuring old code. The fix belongs
     in the Lab (`run-scenario.ts:637` launches the persistent profile), which is outside my
     ownership.
2. **The de-duplication semantics changed** for `next` and `numbered`: a cross-page repeat is
   dropped field for field.
   - This is required for "each record once" in both load styles.
   - The risk is a read whose fields have few distinct values (for example `price` alone). It would
     drop genuinely distinct records that happen to be equal across pages.
   - Please accept or reject this. The `Pagination` row in `docs/architecture/web-capabilities.md`
     needs updating either way, and I do not own that document.
3. **property-listings `area-search` cannot pass its recording lane, before or after this change.**
   - `packages/test-runner/src/scenario-steps/extract-intent.ts` sends field specs without
     `required` and claims that means optional.
   - The extension treats a missing `required` as `true` (`content/extraction/field-spec.ts:80`),
     and the domain reader keeps it absent (`read-request.ts:141`). So cards without a floor area
     fail validation, even though the read itself is right: 57 records from 6 pages, checked in the
     harness.
4. **E1 lane E's 13-versus-12 is not this code.**
   - local-classifieds `bike-search` has no `pagination` in its extract step, so it is a
     single-page read.
   - The feed repeats one listing as the first card of a later batch (`catalog/feed.ts:13-17`),
     leaving two equal elements on one page. The new rule deliberately keeps those.
   - Reaching 12 would need the step to read by `scroll`, plus a decision to extend the repeat rule
     to appending modes. That contradicts D16's wording as it stands.
5. **Ownership.** I edited the content message handler and action-runtime wiring, the runner's
   `sendAction` routing, and a new shared wire file. Carrying the read across documents needs a
   channel outside the content script, and the brief named no such path. Please confirm these fall
   under "extraction engine and pagination".
6. **Workspaces and bundles left behind.** Lab workspaces `test-runs/persistent-isolated/t064-*`
   and the run bundles remain in the worktree (ignored).
