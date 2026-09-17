# w2-split-live-campaign: report

## Outcome

Done. `scripts/lab/live-campaign.mjs` (601 lines) is now a 44-line entry point.
The campaign itself is in `scripts/lab/live-campaign/`, split by
responsibility, with a barrel in every directory. `pnpm lab:campaign` is
unchanged: it still runs `node scripts/lab/live-campaign.mjs`. Its output is
byte-for-byte identical before and after for the three dry runs in the brief
and for nine more cases (help text, error paths, pass-through options). All 15
tests moved without a single line of any test body changing. The one test file
(493 lines) is now seven test files, each beside what it covers. `pnpm check`
exits 0, and the structure audit reports nothing under `scripts/lab`.

One change outside the literal ownership list: the root `package.json`
`lab:test` glob. See "Open questions" for why it was required.

## What changed and why

Layout (40 new files; the largest is 124 lines):

| Path under `scripts/lab/live-campaign/` | Holds |
| --- | --- |
| `index.mjs` | Barrel: the 7 names the old file exported, plus `runCommandLine` for the entry point |
| `arguments.mjs` | `parseCampaignArgs`, `CAMPAIGN_USAGE` (was `USAGE`; the string is identical) |
| `selection.mjs` | `selectTasks` |
| `catalog.mjs` | `loadCatalog` (build under the lock, import both lists, refuse misfiled or repeated ids) |
| `runner.mjs` | `runCampaign` (one task at a time, RAM-fault retries, summary after each task) |
| `command-line.mjs` | `runCommandLine`; the old `main` is its private `campaignCommand` |
| `distinct.mjs` | `distinct`, used by `row/`, `summary/` and `catalog.mjs`, so it lives in their nearest common directory |
| `lab-run/` | One Lab child: `command.mjs` (`labRunArguments`, `displayCommand`, private `REPAIR_LIMITS`), `profiles.mjs` (`DEFAULT_PROFILES`), `environment.mjs`, `spawn.mjs` (`spawnLab`, `runNode`), `output.mjs` (`parseLabResult`, `parseRunnerRefusal`), `ram-fault.mjs` |
| `row/` | A finished run read into one judged row: `bundle.mjs` (`readRunBundle`, `EMPTY_BUNDLE`), `summarize-task.mjs`, `reported-spend.mjs`, `created-flow-shape.mjs`, `dataset-judgement.mjs`, `repair-outcome.mjs` (with the private Lab-verdict reader), `repair-judgement.mjs`, `issue-code.mjs` |
| `summary/` | `totals.mjs`, `markdown.mjs`, `write-summary.mjs` |

- **Code moved as-is.** A script compared every old code line with the new
  files. The only differences are these:
  - import paths;
  - `export` added to helpers that are now called across files;
  - `USAGE` renamed to `CAMPAIGN_USAGE` (the text is unchanged);
  - `main` split into `campaignCommand` and `runCommandLine`, with the same
    body and the same error handler;
  - one filter expression that appeared twice,
    `typeof code === "string" && code.length <= 120 && ISSUE_CODE.test(code)`,
    moved into `row/issue-code.mjs` as `isIssueCode` and passed to `.filter`
    unchanged.
- **Entry point.** `scripts/lab/live-campaign.mjs` keeps its shebang, its
  full header comment, and the `import.meta.url` guard. It adds one paragraph
  saying where each part now lives. It no longer re-exports the API; nothing
  imported it except the test file that moved.
- **Tests** are in `live-campaign/tests/` unless a test has a single subject in
  a subdirectory:
  - `lab-run/tests/ram-fault.test.mjs` and
    `row/tests/summarize-task.test.mjs` each cover one module.
  - Tests that also use `parseCampaignArgs` or `renderSummaryMarkdown` cover
    more than one directory, so they sit in `live-campaign/tests/`:
    `arguments`, `selection`, `lab-run-command`, `repair-rows`,
    `creation-rows`, `runner` and `command-line`.
  - Shared fixtures are in `live-campaign/tests/`: `tasks.mjs`,
    `recovery-records.mjs`, `attempts.mjs` and `temp-directory.mjs`. They
    are split so that no file exports more than 8 values.
  - `command-line.test.mjs` now finds the entry point at
    `../../live-campaign.mjs`.
- **`package.json`.** `lab:test` changed from
  `"scripts/lab/tests/*.test.mjs"` to `"scripts/lab/**/tests/*.test.mjs"`.
- **Deleted.** `scripts/lab/tests/live-campaign.test.mjs`, removed from the
  working tree only and not staged. The deletion shows in `git status` as `D`.

## Commands run and observed results

All dry runs used `FLUXIQ_LAB_INSTANCE=w2-split-campaign`. That builds into a
private, git-ignored output directory, so no other worker's Lab build could
change the catalog between the two captures. The instance label does not
appear in dry-run output.

- **Baseline tests.** Before any change,
  `node --test scripts/lab/tests/live-campaign.test.mjs` printed
  `tests 15, pass 15, fail 0`.
- **Dry runs with the build step.** Before and after the change I ran:
  - `pnpm -s lab:campaign --dry-run`
  - `pnpm -s lab:campaign --kind repair --dry-run`
  - `pnpm -s lab:campaign --kind extract --dry-run`

  All exited 0 both times. `cmp` of stdout and stderr: all 6 identical. That
  is 51, 15 and 15 lines of stdout (50, 14 and 14 tasks); stderr was empty.
  The build step printed nothing.
- **Pinned comparisons.** 12 cases were run with
  `node scripts/lab/live-campaign.mjs ... --no-build` against the same compiled
  catalog. A SHA-256 over that catalog's compiled files matched before and
  after the change, and still matched after the final rebuild. The cases were:
  - the three dry runs;
  - `--kind form,repair --limit 4 --llm-profile custom --llm-model m2 -- --llm-max-cost-usd 0.1 --target "persistent isolated"`;
  - two task ids;
  - `--help`;
  - `--target x`, `--kind scrape`, `-- --flow` and `--max-attempts 9`;
  - an unknown task id;
  - no selection.

  Result: 0 of 36 files differ (stdout, stderr and exit code for each case).
- **Moved tests unchanged.** A script extracted each `test(...)` block and each
  helper from `git show HEAD:scripts/lab/tests/live-campaign.test.mjs` and
  searched the new test files for it. It printed
  `15 tests in the old file; 0 not found verbatim`, and all 13 helpers were
  found verbatim, each exactly once.
- **`pnpm -s lab:test`.** Printed `tests 30, pass 30, fail 0`, exit 0. That
  is the 15 moved tests plus 15 already in `core-build-watch` and
  `lab-instance`. A comparison by test name found all 15 campaign tests
  present, and there were 0 `not ok` lines.
- **`node scripts/structure-audit.mjs`.** Exit 0, and it printed
  `structure-audit: passed (59 warning(s), 17 baselined)`. No line mentions
  `scripts/lab`. `git ls-files --others --exclude-standard -- scripts/lab`
  lists all 40 new files, so the audit saw them. The report file was added
  after this run; see the note at the end of this section.
- **`pnpm check`.** Exit 0. Inside it: `structure:test` gave
  `tests 105, pass 105`; `lab:test` gave `tests 30, pass 30, fail 0`; the
  audit passed; and every workspace `check` finished `Done`.
- **Audit rerun.** After writing this report I ran the structure audit again.
  The supervisor should read that result in the return contract.

## Not verified

- **No live campaign run** (the brief forbids one). The live path was
  exercised only by the existing command-line test, which runs a stub Lab
  through the entry point, and by the injected-executor runner tests. Both
  pass.
- **Without an instance label.** The dry runs were not repeated with no
  `FLUXIQ_LAB_INSTANCE`, which builds into the shared
  `apps/scenario-lab/dist`. I avoided that to keep clear of other workers'
  Lab runs. The code path is the same apart from the output directory.
- **Older Node versions.** The `**` glob in `lab:test` was checked only on
  Node 22.11, which is this machine's version. The repository declares no
  `engines` field.

## Open questions or contradictions found

1. **`package.json` was changed, though the brief allowed it only if the
   entry point moved.** The entry point did not move. But the brief also said
   to move the tests into `scripts/lab/live-campaign/tests/`. The old
   `lab:test` glob only matched `scripts/lab/tests/*.test.mjs`, so after the
   move `pnpm check` would have silently stopped running all 15 tests. That
   breaks the brief's "none was dropped" condition. The fix is a one-line
   glob change, and the diff to `package.json` is only that line.
   - If the supervisor prefers explicit per-directory patterns, as
     `structure:test` uses, the equivalent is
     `"scripts/lab/tests/*.test.mjs" "scripts/lab/live-campaign/tests/*.test.mjs" "scripts/lab/live-campaign/*/tests/*.test.mjs"`.
   - The recursive glob was chosen so that a future `tests/` folder under
     `scripts/lab/` cannot be skipped by accident.
2. **Old paths in dated reports.** `reports/w2-live-campaign-catalog.md`,
   `reports/w2-campaign-repair-tasks.md` and
   `reports/w2-plan-handle-identity.md` still name
   `scripts/lab/tests/live-campaign.test.mjs`. They are dated records, so I
   left them as they are. None of those mentions is a Markdown link, so the
   docs-links rule is unaffected. No architecture document names the old
   test path.
3. **Deletion not staged.** The old test file was deleted with `rm`, not
   `git rm`. The commit needs `git add -A scripts/lab package.json` (or
   equivalent) so that the deletion and the 40 new files are recorded
   together.
