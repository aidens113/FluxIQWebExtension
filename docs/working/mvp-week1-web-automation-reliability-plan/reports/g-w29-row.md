# g-w29-row: the save-and-exit negative row in the bench, and honest distribution labels

Worker report, 2026-09-13. The brief is `briefs/finish-week1.md` "g-w29-row". I
built on `8325107` (`g-bench-coverage`), while other workers edited the tree at
the same time.

## Outcome

**Done.** Both items are in place, and each has a mutation proof.

1. **The W29 row.** The week1 bench corpus now has a 29th row, W29. It runs
   identity-drift's `save-and-exit` variant on the Flow lane and expects the
   failure category `target_not_found`. A week1 bench now plans **67 runnable
   results per repeat**, up from 66:
   - 23 on the recording lane;
   - 44 on the Flow lane: 23 unarmed workflows and 21 variants (was 20).

   The row resolves against the built Scenario Lab registry, and the plan test
   reads its expected category as `target_not_found`.
2. **Distribution labels.** In `report.md`, the distributions section is now
   headed `## Distributions, all lanes`. Its table has a `Lane` column that
   reads `all lanes` on every row. A sentence under the heading says an action
   latency there is not Flow-lane latency. The truncation count line reads
   `Truncation count, all lanes: N`. The rates table is unchanged and still names
   one lane per row.

   The label is true. `corpusMetrics` computes every distribution and the
   truncation count over all runs of both lanes
   (`aggregate-report.ts:227-238`), while rates go through
   `benchResultsByLane`.

**Tests passed.** Test-runner `check` exit 0. The full test-runner suite passed
484 of 484 from a private build, up from 483 by the new render test.

## What changed and why

Four files changed. Three were listed under Owns, and the fourth is a new test:

| File | Change |
| --- | --- |
| `packages/test-runner/src/bench/corpus/week1.ts` | `:58` adds `variantOnly("W29", "identity-drift", null, ["save-and-exit"])` after W28. The header comment at `:7` and the `description` at `:27` now say "W01 to W29". `:12-14` names W29 among the variant-only rows and says what it is. `:15-16` updates the count to 67 runnable, 44 Flow-lane results, and 21 variants. |
| `packages/test-runner/src/bench/tests/week1-corpus.test.ts` | `PLAN_NEGATIVE_VARIANTS` gains `"W29 identity-drift/primary/save-and-exit": "target_not_found"` (`:27`). The row-list test title and length change from 28 to 29 (`:43-44`). The count test title and assertion change from `[66, 23, 0, 23, 20]` to `[67, 23, 0, 23, 21]` (`:82`, `:91`). The comment at `:90` no longer calls W29 hypothetical. |
| `packages/test-runner/src/bench/render-markdown.ts` | A module-private `ALL_LANES = "all lanes"` constant, with a comment giving the reason (`:13-21`). The distributions heading, an explanatory sentence, a `Lane` column on the distributions table, and the truncation line all use it (`:148-154`). Nothing is exported, so the barrel is unchanged. |
| `packages/test-runner/src/bench/tests/render-markdown.test.ts` (**new**) | `render-markdown.ts` had no test before. The brief says to name its test, so this is it. The fixture is one W01 run per lane: a recording-lane run with a 40 ms click and 30 s duration, and a Flow-lane run with a 900 ms click and 50 s duration. It renders through `aggregateBenchReport`, `benchExecutionCoverage` and `renderBenchMarkdown`, the same path `run-bench.ts:123-129` uses. It asserts the exact distributions table rows, each starting `\| all lanes \|`: latency 2 samples, p50 40, p95 900; duration 30000 and 50000. It also asserts the `Lane \| Metric` header, the `Truncation count, all lanes: 0.` line, and that every rates row names exactly `recording` or `flow`. |

Other changes the drift report listed:
- **Plan's corpus table.** `g-identity-drift-mode` also listed a W29 row in the
  plan's "FluxBench Week 1 Corpus" table. That is the shared plan document,
  which workers do not edit, so it is not applied. See Open questions.
- **Other files.** No other file needed a change. The only other places that
  quote "W01 to W28" or the 66 count are historical reports, briefs and an
  archived ledger.

## Commands run and observed results

Exit statuses were captured by redirecting to a file, never through a pipe.
Builds went into `packages/test-runner/dist-g-w29-row`, which is at `dist`'s
depth so the corpus test's `../../../../../` still reaches the repository root.
That folder was deleted afterwards (`Test-Path` printed `False`).

| Step | Command | Observed |
| --- | --- | --- |
| Type check | `pnpm --filter @fluxiq-web-extension/test-runner check` | `exit=0` |
| Private build | `npx tsc -p tsconfig.json --outDir dist-g-w29-row` (in `packages/test-runner`) | `build exit=0` |
| Focused tests | `node --test dist-g-w29-row/bench/tests/week1-corpus.test.js dist-g-w29-row/bench/tests/render-markdown.test.js` | `test exit=0`, `# tests 5 # pass 5 # fail 0`. Diagnostics: `rows with every result resolved: W01, …, W28, W29`; `unresolved results: none`; `runnable: 67 (23 recording; 44 flow, 23 unarmed and 21 variants); skipped: 0`; `flow-lane results with an expected failure: 11 (… W29 identity-drift/primary/save-and-exit=target_not_found)` |
| Full suite | `node --test "dist-g-w29-row/**/*.test.js"` | `full exit=0`, `# tests 484 # pass 484 # fail 0` |
| SHA-256 before mutating | `Get-FileHash -Algorithm SHA256` | `week1.ts` `E89A526ED93B6734C4F60E86D2A6250E91C518023C2B8592D5392F594019C782`; `render-markdown.ts` `D9AF7CD4A463BFB11DD7B354B3641F1D5E95950556D713FC7E637CA0EC483A59` |
| Mutation (two files, independent subjects) | Removed the W29 row from `week1.ts`. Removed the `Lane` column and its `ALL_LANES` cell from the distributions table in `render-markdown.ts`. Rebuilt privately and reran both tests. | `build exit=0`, `test exit=1`, `# pass 1 # fail 4`. `not ok 1 - report.md labels every distribution and the truncation count all lanes…` (AssertionError, `expected: true actual: false`, the `\| Lane \| Metric \|` header check). `not ok 2 - week1 lists W01 to W29 once each…` (diff `- 'W29'`). `not ok 3 - every week1 row resolves…` (`+ undefined - 'target_not_found'`). `not ok 5 - week1 plans 67 runnable results…` (`+ 66 - 67`, `+ 20 - 21`), with `# runnable: 66 (23 recording; 43 flow, 23 unarmed and 20 variants)`. |
| Restore | Both edits reverted with Edit, then hashed again | Both hashes identical to the values above: byte-identical |
| Restored rebuild | Same private build and focused tests | `build exit=0`, `test exit=0`, `# tests 5 # pass 5 # fail 0` |
| Structure audit, new file staged | Copied `.git/index` to a scratch `GIT_INDEX_FILE`, `git add` of the new test into it only, then `node scripts/structure-audit.mjs` | `audit exit=1`. One violation: `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`. No line names any `bench/` file (grep of the output for `bench/`, `render-markdown`, `week1`). |
| Structure audit, real index | `node scripts/structure-audit.mjs` without the scratch index | `audit exit=1`, the same single `working-docs` failure. That failure exists without my file and is not caused by this change. |

The full suite ran before the mutation, but the restored sources hash identical
to the ones it ran against, so its result stands.

## Not verified

- **No Lab run** (no `pnpm lab` in this dispatch). A Lab week1 bench must show
  the following:
  - `runs.json` plans 67 runnable results per repeat, with W29
    `identity-drift/primary/save-and-exit` on the `flow` lane and no W29 run on
    the recording lane.
  - Once `g-resolver-corroboration` lands, W29's Flow-lane run fails the click
    with `target_not_found` and counts as a correct classification in
    `failureClassificationAccuracy`. It must not report `Saved and exited: …`
    as a pass. Before then, scoring W29 as a miss is expected (brief), not a
    defect.
  - `report.md` prints `## Distributions, all lanes`, with a `Lane` column
    reading `all lanes`, and `Truncation count, all lanes: N`. The rates table
    names `recording` and `flow` per row.
- **No `pnpm build`, no repository-wide `pnpm check` or `pnpm test`.** Only
  test-runner `check`, a private build, the test-runner suite and the structure
  audit ran.
- **Extension and domain tests** were not run; nothing in them changed.
- **Built dependencies.** The corpus tests read
  `apps/scenario-lab/dist/registry.js`. I did not rebuild it; its built
  `identity-drift/manifest.js` already contains `save-and-exit`. The render test
  reads `packages/test-contracts/dist`, whose built `bench-report.js` already
  carries `ratesByLane`.

## Open questions or contradictions found

1. **The plan's corpus table still ends at W28.** `g-identity-drift-mode` listed
   a W29 row there as a companion change: identity-drift, variant
   `save-and-exit`, negative, `target_not_found`. It is in the shared plan
   document, which I do not own. The supervisor should add it so that the header
   comment in `week1.ts`, "as the plan's corpus table lists them", stays true.
2. **The comparison verdict also mixes lanes.** `compare-reports.ts:48` compares
   `run-duration-p95` from `metrics.runDurationMs`, which is over all lanes. That
   is the comparison output, not `report.md`, so it is outside this brief and I
   left it alone. If the "all lanes" rule should hold everywhere a duration is
   shown, the comparison's `run-duration-p95` line needs the same label, in
   `compare-reports.ts`.
3. **Structure baseline:** no entry needs to change for this work. The audit's
   only failure is the pre-existing `docs/working/README.md` index staleness,
   which the supervisor regenerates.
