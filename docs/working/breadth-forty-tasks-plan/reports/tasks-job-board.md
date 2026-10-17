# Report: tasks-job-board (t699)

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t699-breadth-job-board`. Nothing committed.

## Outcome

Done. Four new job-board live tasks, one of each kind (a)-(d). Each has a workflow with a recording script, a
literal `expected` (pageFacts, finalState and records), unit checks against the catalog, and browser-path tests
(an honest path and at least one wrong path per task). The package suite passes except for the two shared-list
assertions, plus browser timeouts on two other sites that pass when rerun on their own (details below). All four
dry runs are accepted.

## The four tasks

| id | kind | judgeBy | permissionPoint | what a correct run does |
| --- | --- | --- | --- | --- |
| `job-board-remote-easy-apply` (a) | navigate-and-extract | expected-dataset `extract-remote-easy-apply` | none | Reads all 28 remote jobs (3 pages at 10, or 1 page at 50) and returns the 7 that are remote in the UK, offer Easily apply and show a salary, newest first, as title/company/salary. Changes nothing on the account. |
| `job-board-save-quillmark-remote` (b) | navigate-and-extract | expected-dataset `extract-saved-after-quillmark` | none | Saves Quillmark's 3 remote UK jobs (m1, d12, g5), not Quillmark Labs (d15) and not hybrid London (h1), and keeps the 2 already saved. Then reads the saved list (5 rows, title/company/location). Judged by the account read-out. |
| `job-board-halvard-labs-office-jobs` (c) | navigate-and-extract | expected-dataset `extract-halvard-labs-office-jobs` | none | Finds that Halvard Labs has no hybrid or on-site job (its only job, hl1, is remote). Saves nothing and returns an empty table. The board fills the page with "Jobs you might like" cards, hl1 among them, so saving or reading them fails. |
| `job-board-halvard-careers-roles` (d) | navigate-and-extract | expected-dataset `extract-halvard-careers-roles` | none | Uses the search form (What = Site Reliability Engineer, Where = Leeds), opens hv1, follows Apply on company site into a new tab, answers the cookie bar, opens "All open roles", and reads the 6 roles as title/location/link (link is the careers-site address, which only that site carries). Applies for nothing. |

## Entries for the shared tests (supervisor)

`scenarios/tests/realistic-site-live-tasks.test.ts`, in the sorted additions list (count +4 from this site):

```ts
    "job-board-halvard-careers-roles",
    "job-board-halvard-labs-office-jobs",
    "job-board-remote-easy-apply",
    "job-board-remove-closed-saved-jobs",   // existing
    "job-board-save-quillmark-remote",
```

`scenarios/tests/live-instructions.test.ts`: none of the four declares a permission point, so nothing goes in the
permission map. Add these to `ASKS_NOTHING`:

```ts
  "job-board-remote-easy-apply": "a read",
  "job-board-save-quillmark-remote": "saves jobs to the account's own list",
  "job-board-halvard-labs-office-jobs": "saves only matching jobs to the account's own list, and none matches",
  "job-board-halvard-careers-roles": "a read that stops short of applying",
```

## What changed and why

- `apps/scenario-lab/src/scenarios/job-board/breadth/` (new): one folder per task, each with `expected.ts`,
  `workflow.ts` and `index.ts`. Also `unchanged-account.ts` (the starting account, as a literal),
  `account-fact.ts` (builds a fact on the `job-closed-account` read-out), the barrel `index.ts`, and
  `tests/expected.test.ts`. That test checks every literal against the catalog and the served pages, and checks
  the wrong paths against server state.
- `job-board/qualification/facts.ts`: the account read-out now sorts `saved` and `follows`, so a save task's final
  state does not depend on the order of the saves. The existing literals for `remove-closed-saved-jobs` are
  unchanged: its keys were already in sorted order.
- `job-board/live-tasks.ts`: four instructions and four task rows, plus a doc paragraph.
- `job-board/manifest.ts`: the four workflows appended after `closedJobsWorkflow`, plus a doc line.
- `job-board/tests/scenario.test.ts`: the workflow-id list, the variant list (five empty), 13 tasks, and the dataset set.
- `job-board/tests/scenario-driver.ts` and `job-board/tests/lab-session.ts` (new): the browser Driver and the lab
  session, moved out of `browser-paths.test.ts` so the new spec can reuse them instead of copying them. I unpacked
  the Driver's 3 packed lines, so the `statement-packing` count for `job-board/tests/browser-paths.test.ts` drops
  from 3 to 0. Running `pnpm structure:baseline` will record the lower value.
- `job-board/tests/browser-paths.test.ts`: now imports Driver and `openLabSession`. `finalState(x.lab)` became
  `x.finalState()`. Behaviour is unchanged.
- `job-board/tests/breadth-paths.test.ts` (new): 8 browser specs. Each task gets an honest path, plus these wrong
  paths:
  - (a) every quick-apply card, including the one with no salary; first page only
  - (b) also saving Quillmark Labs
  - (c) recommendations read as results; saving hl1
  - (d) Rolefinch's own search read instead of the careers list

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` (scenario-lab): no output, exit 0.
- `node --test` on breadth unit + `scenario.test` + `qualification` tests: `# tests 29 # pass 29 # fail 0`.
- `node --test dist/scenarios/job-board/tests/breadth-paths.test.js` alone: `# tests 8 # pass 8 # fail 0`.
- `node --test dist/scenarios/job-board/tests/browser-paths.test.js` alone: `# tests 11 # pass 11 # fail 0`. An
  earlier run with both files in parallel, while other workers were loading the machine, failed 4 subtests in
  `browser-paths.test.ts`. Run on its own, the same file passed.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab test`: `# tests 716 # pass 697 # fail 18 # cancelled 1`.
  Both job-board browser suites passed (`ok 291 - the breadth tasks in a browser`, `ok 292 - the job board in a
  browser`). The failures:
  - Shared-list assertions (expected):
    - `not ok 580 - every realistic-site task either declares its permission point or is recorded as asking
      nothing`. The diff adds `+ 'job-board-halvard-careers-roles'`, `+ 'job-board-halvard-labs-office-jobs'`,
      `+ 'job-board-remote-easy-apply'` and `+ 'job-board-save-quillmark-remote'`.
    - `not ok 594 - qualification additions preserve the complete ordered original 57 tasks`. The diff adds the
      same four ids to the additions list.
  - Not my site: `not ok 143 - crossborder-marketplace in a browser` (15 subtests, every one
    `page.goto: Timeout 30000ms exceeded`) and photo-social `not ok 409 - honest paths ...` (`test timed out after
    120000ms`, one subtest cancelled). Rerun on their own (`node --test` on those two files): `# tests 29 # pass
    29 # fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (202 warning(s), 638 baselined)`. No job-board
  findings.
- Dry runs, each with `FLUXIQ_TEST_TARGET=persistent-isolated` and the brief's exact command (exit 0). Each
  result line read `"status":"ready","providerCallCount":0,"lane":"created-flow"`:
  - `job-board-remote-easy-apply`: workflow `remote-easy-apply`, `{"judgeBy":"expected-dataset","stepId":"extract-remote-easy-apply","stepIndex":9}`
  - `job-board-save-quillmark-remote`: workflow `save-quillmark-remote`, `stepId":"extract-saved-after-quillmark","stepIndex":17`
  - `job-board-halvard-labs-office-jobs`: workflow `halvard-labs-office-jobs`, `stepId":"extract-halvard-labs-office-jobs","stepIndex":11`
  - `job-board-halvard-careers-roles`: workflow `halvard-careers-roles`, `stepId":"extract-halvard-careers-roles","stepIndex":15`

## Not verified

- No live runs; no provider calls.
- The shared-test entries above are written but not applied: those files are the supervisor's.
- Task (d)'s final-state fact reads the account on the Rolefinch tab. That tab is not reloaded while the careers
  tab is used, so it catches saves and alerts made on Rolefinch. It does not catch an application sent from the
  careers tab's Talentloom frame. The browser spec checks the server state for `applications: []`; the Lab's
  judge does not.
- I left the old helper name `closedJobsAccountFacts` in place, though the read-out now serves every job-board
  qualification oracle.

## Open questions or contradictions found

- The dry run's authorised purse prints `"maxEstimatedCostUsd":0.1`. Phase 3 asks for `--llm-max-cost-usd 0.25`
  plus the environment variable. The live launch has to pass both, because the dry-run command in the brief does
  not.
- Salary values contain the en dash "–" exactly as the site prints it, the same as the existing
  `job-board-remote-rust-roles` dataset.
