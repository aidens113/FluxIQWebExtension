# Report: tasks-social-network-feed (t703)

Worker: `tasks-social-network-feed`. Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t703-breadth-social-network-feed`. Nothing committed.

## Outcome

Done. I added four live tasks for `social-network-feed`. Each has a workflow whose recording completes the task and an exact expected result: a record-by-record dataset plus a final-state fact over everything the account did. All 46 social-network-feed tests pass, the four browser walk-throughs among them. All four provider-free dry runs return `"status":"ready"`. The only scenario-lab failures that remain are shared-list assertions, quoted below. Three are in the files the brief named. The fourth is in a third shared file the brief did not name (`src/tests/recording-descriptions.test.ts`).

## The four tasks

| id | kind | judgeBy | permissionPoint | what a correct run does |
| --- | --- | --- | --- | --- |
| `social-network-feed-recent-group-posts` | navigate-and-extract | expected-dataset (`extract-recent-group-posts`) | none | (a) Reads the home feed down to "You're all caught up" and keeps the three posts written in Maya's own groups on or after Sat 19 Sep 2026 (Elena, Sofía, Oliver), each once, with the full text behind See more. It leaves out Kim Tran's suggested Urban Growers post, the recap repeat, and the older Tom and Dev group posts. |
| `social-network-feed-hide-suggested-posts` | navigate-and-extract | expected-dataset (`extract-hidden-suggestions`) | none | (b) Notes and then hides the two "Suggested for you" posts above the end of the feed (Urban Growers Network, Kettle & Crumb), and nothing else. The final state is `hidden: [g_3a5e17, g_d40f52]`. |
| `social-network-feed-delete-stranger-requests` | navigate-and-extract | expected-dataset (`extract-removed-requests`) | `{ consequence: "delete", control: "Delete" }` | (c) Opens the full request list past the four-card preview and deletes only Diego Alvarez, the one request with no mutual friends. It reads back the removed rows (`name`, `url`). The final state is `requests: {rq_3d6b28: deleted}`, with nobody confirmed. |
| `social-network-feed-claim-found-key` | navigate-and-extract | expected-dataset (`extract-found-items-post`) | `{ consequence: "send_or_publish", control: "Post" }` | (d) Opens Harbourside Runners and reads Dev Patel's found-items post (`author`, `posted`, `text`). It then posts the claim word for word in that group, pressing Post twice to get past the swallowed first press. The final state is exactly one pending post in `harbourside-runners`. |

None of them has a `variantId`. Every dataset column is named in its instruction, and every dataset lists its records.

## Exact entries for the shared tests

`scenarios/tests/realistic-site-live-tasks.test.ts`, test "qualification additions preserve the complete ordered original 57 tasks":
- Add these four ids to the sorted additions list:
  `"social-network-feed-claim-found-key"`, `"social-network-feed-delete-stranger-requests"`, `"social-network-feed-hide-suggested-posts"`, `"social-network-feed-recent-group-posts"`
- `REALISTIC_SITE_LIVE_TASKS.length` goes up by 4 for this site.

`scenarios/tests/live-instructions.test.ts`, permission map ("every consequential task declares its permission point"):
```ts
"social-network-feed-delete-stranger-requests": { consequence: "delete", control: "Delete" },
"social-network-feed-claim-found-key": { consequence: "send_or_publish", control: "Post" },
```
`ASKS_NOTHING` ("every realistic-site task either declares its permission point or is recorded as asking nothing"):
```ts
"social-network-feed-recent-group-posts": "a read",
"social-network-feed-hide-suggested-posts": "hides suggested posts in the account's own feed, nothing deleted or sent",
```
A third shared file, which the brief does not list but which also asserts a count: `apps/scenario-lab/src/tests/recording-descriptions.test.ts` line 21, `assert.equal(count, 42)`. That count goes up by 4 for this site (it read 46 with only my changes).

## What changed and why

- `oracle/account-changes.ts` (new) and `oracle/account-changes-subject.ts` (new): `accountChanges(state)` writes every lasting act as one canonical JSON. Order-free lists are sorted, so two runs that hid the same posts in a different order read the same. The overlay answers and the rate-limit counter are left out. The function is self-contained, so the page script carries it as source, as the existing request-answer oracle does. The subject is `social-account-changes`.
- `markup/shell.ts`: every page now renders `<script type="text/plain" data-testid="social-account-changes">`, after the existing oracle elements, so the "one test id before the first script" check still holds. The page's `mutate` wrapper now rewrites that element after every change.
- `oracle/index.ts`, `qualification/index.ts`: barrels updated.
- `qualification/steps/` (new): `overlaySteps`, `feedToCaughtUpSteps`, `pressPostTwiceSteps`, plus a barrel.
- `qualification/{recent-group-posts,hide-suggested-posts,delete-stranger-requests,claim-found-key}/` (new), each with `workflow.ts`, `expected.ts` and `index.ts`. Each `expected.ts` holds literal data (records and the account JSON) that I worked out by reading `content/units.ts` and `content/requests.ts`. The unit test checks those literals against a fresh derivation from the content.
- `manifest.ts`: the four workflows are appended after `requestAuditWorkflow`, and the doc comment is extended.
- `live-tasks.ts`: four instructions and four task rows, with a doc comment.
- `tests/scenario.test.ts`: the workflow-id list and the selections list now include the four, and the test title says eight workflows.
- `qualification/tests/breadth-expected.test.ts` (new): checks each expected dataset against the content, and the positions in each recording against the feed plan. It drives each final state through the server's own `mutate` for the honest path and for the wrong paths. Wrong paths covered: an extra hide (a share, or a post below the end of the feed), a missed hide, an undo; deleting Tom Becker #2 as well, confirming instead of deleting, confirming someone else; the wrong group, a poll, a filled trap field, posting twice, a swallowed single press.
- `tests/breadth-paths.test.ts` (new, Playwright): each of the four recordings reaches its dataset and its final account. The wrong paths fail. An unfiltered group read gives 5 rows; a read without See more leaves the text cut short; hiding a friend's share as well changes the account; deleting Tom Becker too reads him back and changes the account; posting in Riverside names the wrong group; one press of Post leaves `pending: []`.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` (apps/scenario-lab): no output, exit 0 (`TSC-OK`).
- `node scripts/structure-audit.mjs`: first run `FAIL [statement-packing] ... breadth-paths.test.ts: 5 lines hold more than one statement`. I fixed the packed lines. Re-run: `structure-audit: passed (202 warning(s), 639 baselined).`
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab test` (full): `# tests 717 / pass 692 / fail 17 / cancelled 8`. The failures were:
  - Four shared-list assertions:
    - live-instructions.test.js:144 (permission map): `+ 'social-network-feed-claim-found-key': { consequence: 'send_or_publish', control: 'Post' }, + 'social-network-feed-delete-stranger-requests': { consequence: 'delete', control: 'Delete' }`
    - live-instructions.test.js:229 (ASKS_NOTHING): `+ 'social-network-feed-hide-suggested-posts', + 'social-network-feed-recent-group-posts'`
    - realistic-site-live-tasks.test.js:64 (additions list): `+ 'social-network-feed-claim-found-key', + 'social-network-feed-delete-stranger-requests', + 'social-network-feed-hide-suggested-posts', + 'social-network-feed-recent-group-posts'`
    - recording-descriptions.test.js:6: `46 !== 42`
  - Browser tests that timed out or were cancelled during the full parallel run. They were in auction-marketplace, bigbox-retail, crossborder-marketplace, job-board and local-classifieds, plus this site's `variant-and-naive-paths` ("test did not finish before its parent and was cancelled"). I re-ran them on their own:
    - `node --test --test-concurrency=1` on the five other sites' browser test files: `# tests 67 / pass 67 / fail 0`.
    - `node --test dist/scenarios/social-network-feed/tests/*.test.js dist/scenarios/social-network-feed/qualification/tests/*.test.js` after a rebuild: `# tests 46 / pass 46 / fail 0 / cancelled 0`.
- Dry runs, each with `FLUXIQ_TEST_TARGET=persistent-isolated` and the brief's command line, all exit 0:
  - `social-network-feed-recent-group-posts`: `{"status":"ready","providerCallCount":0,"lane":"created-flow",...,"workflowId":"recent-group-posts",...,"judgement":{"judgeBy":"expected-dataset","stepId":"extract-recent-group-posts","stepIndex":22}...}`
  - `social-network-feed-hide-suggested-posts`: `{"status":"ready","providerCallCount":0,...,"workflowId":"hide-suggested-posts",...,"stepId":"extract-hidden-suggestions","stepIndex":20}...}`
  - `social-network-feed-delete-stranger-requests`: `{"status":"ready","providerCallCount":0,...,"workflowId":"delete-stranger-requests",...,"stepId":"extract-removed-requests","stepIndex":11}...}`
  - `social-network-feed-claim-found-key`: `{"status":"ready","providerCallCount":0,...,"workflowId":"claim-found-key",...,"stepId":"extract-found-items-post","stepIndex":7}...}`

## Not verified

- No live (paid) run. I don't know how a model handles the date filter, the hide boundary, or the permission stops.
- How the created-Flow judge compares `url` values for `delete-stranger-requests` (a relative path, the same as the existing audit task) when a model returns an absolute URL.
- I did not run the e2e Playwright spec (`test:e2e`).

## Open questions or contradictions found

- `apps/scenario-lab/src/tests/recording-descriptions.test.ts` asserts a total workflow count (42) across the realistic sites. It is a shared file the brief does not list, so every site worker's new workflows will break it. The supervisor needs to update it to the merged count.
- Under machine-wide load, the full scenario-lab suite times out browser tests on several sites. Those failures came from load: each failing file passed on its own. My new browser suite takes about 110 s per describe under load, and I set its timeout to 300 s.
- `hide-suggested-posts` treats "down to where it says I'm all caught up" as a hard boundary. A run that also hides the suggestions after the marker fails the final state. The instruction says so explicitly.
