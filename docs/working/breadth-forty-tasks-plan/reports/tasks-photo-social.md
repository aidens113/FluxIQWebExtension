# tasks-photo-social (t702) report

## Outcome

Done. I added four new photo-social live tasks. Each has a hand-written oracle (dataset plus the final state of the whole account), its own workflow, and browser tests showing that the honest path passes and that plausible wrong paths fail. The package suite passes except for three shared-list assertions: the two the brief expected, plus a third in `src/tests/recording-descriptions.test.ts` that the brief did not mention (see Open questions). The provider-free dry run printed `status: ready` with `providerCallCount: 0` for all four tasks.

## Tasks

| id | kind | judgeBy | permissionPoint | What a correct run does |
| --- | --- | --- | --- | --- |
| `photo-social-priya-tags` (a) | navigate-and-extract | expected-dataset `extract-priya-tags` | none | Opens the verified studio's giveaway, loads all four comment batches (the first press of Load more is swallowed) and the replies under Priya's entry. Returns the 5 comments or replies whose text tags @priya.nair (author, comment, date), in thread order. Changes nothing. |
| `photo-social-newest-likes` (b) | navigate-and-extract | expected-dataset `extract-newest-likes` | none | Likes the studio's three most recent posts (2 Oct, 29 Sep reel, 26 Sep). These come after the three pinned posts on the grid. Returns their links newest first. The account must end with exactly those three liked. |
| `photo-social-august-over-1300` (c; positive form since `5b0d2e2f`, 2026-10-18) | navigate-and-extract | expected-dataset `extract-august-over-1300` | none | Checks every August 2026 studio post and keeps the one photo with more than 1,300 likes: 1 row `{date: "August 21", likes: "1,349"}` (date, likes), on the grid's third screen behind the rate limit and session check. The traps that would add a row: the reel's 18.3K plays, the pinned post from August 2025 (3,412), the impersonator's 11 Aug post (5,020), and Kiln Theory's 30 Aug post (1,840). Changes nothing. (Corrected 2026-10-27, t756: this row first described the earlier empty-table form, which breached "data-scraping tasks must have data".) |
| `photo-social-kiln-notes` (d, longer journey) | form | expected-dataset `extract-kiln-notes` | none | On the Saved page: New collection, name it "Kiln Theory notes", then in the picker choose the two saved Kiln Theory posts. Then reads every collection tile in Saved-page order: Kitchen 3, Studio inspo 5, Kiln Theory notes 2. Must not press the filled bookmarks, which would unsave the posts, and must not pick the studio's kiln photo. |

There are no drift variants. Every final state requires: cookies declined (essential), the account not blocked, and the full `photo-studio-account` JSON matching exactly (the untouched account plus only the task's own change).

## Exact entries for the shared tests (supervisor)

`scenarios/tests/realistic-site-live-tasks.test.ts`, in the sorted additions list:

```ts
    "photo-social-august-over-1300",
    "photo-social-extend-studio-inspo",   // existing
    "photo-social-kiln-notes",
    "photo-social-newest-likes",
    "photo-social-priya-tags",
```

`REALISTIC_SITE_LIVE_TASKS.length` grows by 4 for this site (68 -> 72 from photo-social alone).

`scenarios/tests/live-instructions.test.ts`: none of the four declares a permission point, so the permission map gets no entries. The four go into `ASKS_NOTHING`:

```ts
  "photo-social-priya-tags": "a read",
  "photo-social-newest-likes": "likes three posts, which neither pays, deletes nor publishes",
  "photo-social-august-over-1300": "a read",
  "photo-social-kiln-notes": "creates a private collection from posts already saved",
```

`src/tests/recording-descriptions.test.ts` (third shared count, not in the brief): `count` grows by 4 for this site (42 -> 46 from photo-social alone).

## What changed and why

All under `apps/scenario-lab/src/scenarios/photo-social/`:

- `breadth/` (new): one directory per task (`priya-tags/`, `newest-likes/`, `august-over-1300/` plus `cells.ts`, `kiln-notes/`), each with `workflow.ts`, `expected.ts` and `index.ts`.
  - Shared helpers: `steps/` (opening and dock-collapse steps), `untouched-account.ts` (the starting account, written out from `data/`), `account-fact.ts` and `relay-fact.ts`.
  - `tests/expected.test.ts` works out each written-out oracle again from the fixture data and state, and shows that each wrong answer differs.
- `manifest.ts`: the four workflows are added after `studioUnionWorkflow`, and the doc comment says so.
- `live-tasks.ts`: four instructions and four task rows, plus a doc comment. Every dataset column is named in its instruction.
- `tests/breadth-paths.test.ts` (new) runs in a real browser:
  - Honest path: each task's recording reaches its dataset and every final-state fact.
  - Wrong paths that fail an oracle:
    - priya-tags: no replies opened gives 3 rows; first screen only gives 0; matching any comment that links to her, author included, gives 6.
    - newest-likes: liking the first three (pinned) cells fails both the account and the table; one extra save fails the account.
    - august: counting the reel, or August of any year, gives 1 row each; the impersonator's and Kiln Theory's grids each have a matching cell.
    - kiln-notes: also picking the studio's kiln photo fails, and so does pressing a filled bookmark.
- `tests/photo-session.ts` (new): the lab and browser session helper, taken out of `honest-and-naive-paths.test.ts`, which now imports it. This avoids a duplicate copy.
- `tests/recording-driver.ts`: added a `scroll` step that works like the Lab step runner's (mouse wheel, then 500 ms), because the August task's recording scrolls the grid.
- `tests/scenario.test.ts`: workflow-id list and task list updated.
- `august-over-1300/expected.ts` declares `allowedConsoleErrors: ["the server responded with a status of 401 (Unauthorized)"]`. The grid's third screen deliberately answers 401 with the session check, and Chromium logs that as a console error; the Lab's console-error watch would otherwise fail the recording.

No fixture data was added: everything the tasks need was already in `data/`. No Core, `scenarios/tests/*` or model-guidance files were touched.

## Commands run and observed results

- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`: passed. Typecheck clean; `{"build-cache":"build","step":"scenario-lab:check",...}` and no errors.
- `node --test dist/scenarios/photo-social/tests/breadth-paths.test.js`: `# pass 8`, `# fail 0` (4 honest and 4 wrong-path tests).
  - The first attempt failed for two reasons, both fixed. The 401 console error on the honest August run (fixed by the `allowedConsoleErrors` entry above). And the 180 s suite timeout under load from parallel workers: one August wrong-path test took 163 s with other runs going, against about 35 s alone, so the suite timeout is now 600 s.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab test`: `# tests 716`, `# pass 713`, `# fail 3`. The only failures are shared-list assertions:
  - `not ok 581 - every realistic-site task either declares its permission point or is recorded as asking nothing` (`+ 'photo-social-august-over-1300'`, `+ 'photo-social-kiln-notes'`, `+ 'photo-social-newest-likes'`, `+ 'photo-social-priya-tags'`)
  - `not ok 595 - qualification additions preserve the complete ordered original 57 tasks` (same four ids in the additions list)
  - `not ok 599 - all realistic workflow recordings have separate authored demonstration descriptions` (`46 !== 42`)
- After the final comment-only edit to `manifest.ts` and the rebuild: the photo-social, breadth, qualification and three shared test files ran together, `# tests 59`, `# pass 56`, `# fail 3`, the same three shared assertions.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (202 warning(s), 639 baselined)`, with no warnings in photo-social. An earlier run failed `statement-packing` on my one-line `scroll` case; I fixed it.
- Dry runs, with `FLUXIQ_TEST_TARGET=persistent-isolated`, `pnpm.cmd lab run photo-social --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode project --llm-task create-flow --instruction-task <id> --target persistent-isolated --workspace bf-dry-<id> --dry-run`, all exit 0:
  - `photo-social-priya-tags`: `{"status":"ready","providerCallCount":0,"lane":"created-flow",...,"workflowId":"priya-tags",...,"judgement":{"judgeBy":"expected-dataset","stepId":"extract-priya-tags","stepIndex":16}...}`
  - `photo-social-newest-likes`: `{"status":"ready","providerCallCount":0,...,"workflowId":"newest-likes",...,"stepId":"extract-newest-likes","stepIndex":16}...}`
  - `photo-social-august-over-1300`: `{"status":"ready","providerCallCount":0,...,"workflowId":"august-over-1300",...,"stepId":"extract-august-over-1300","stepIndex":15}...}`
  - `photo-social-kiln-notes`: `{"status":"ready","providerCallCount":0,...,"kind":"form","workflowId":"kiln-notes",...,"stepId":"extract-kiln-notes","stepIndex":15}...}`

## Not verified

- No live run: a model has not built a Flow for any of the four.
- The recordings ran through this site's Playwright driver, which copies the Lab step runner's grammar, but not through the Lab's own recording lane (`run-scenario.ts`).
- (Moot since `5b0d2e2f`, 2026-10-18: the task now expects 1 row, `{date: "August 21", likes: "1,349"}`.) As first written, `august-over-1300` expected an empty dataset (`count: 0, records: []`, extract step `minItems: 0`), and I had not checked that Core stores a zero-row dataset for a created Flow's extract node.
- `newest-likes`: a like is sent by a fetch from the click handler, and the recording moves to the next page right after the button flips to Unlike. The browser tests passed every time, and the final account fact proves all three likes reached the server, but nothing waits for the server's reply before navigating.
- Re-running a Flow: liking is a toggle, so a Flow replayed on an account that already has the likes would unlike them unless it checks first. I did not test this; it is the same kind of concern as the existing extend-studio-inspo "repeat ensure" test.

## Open questions or contradictions found

- The brief names two shared tests, but a third, `apps/scenario-lab/src/tests/recording-descriptions.test.ts`, counts every realistic workflow (`assert.equal(count, 42)`) and fails as each site adds workflows. It is outside my ownership, so I left it; the supervisor needs to update its count (+4 here).
- The brief's required read `<site>/expectations.ts` does not exist for photo-social; the oracles live in `manifest.ts` and `qualification/`.
- Calling a like "asks nothing" is my reading: the existing photo-social tasks and the `confirm-requests` precedent treat acts that neither pay, delete nor publish as needing no permission point. If a like should count as `send_or_publish`, then `newest-likes` needs `permissionPoint: { consequence: "send_or_publish", control: "Like" }` in place of the ASKS_NOTHING entry.
