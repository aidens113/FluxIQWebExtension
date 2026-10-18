# Storage comparison: t707

Status: Complete; recommendation: keep held change unmerged

## Scope and comparison

Reviewed held commit 72abeeab, the three owning source files, the SQLite pool/repository implementation, child-process probe, whole-operation fixtures, owner-store/repository tests, and creation/index-read tests. The held change shares existing programStateConnections and wraps a whole operation in keepWhile; each transaction still commits separately. The pool closes failed connections and closes kept handles when its final active scope ends. No new transaction spans the paused child process.

A/B uses forced dist builds before each half because child probes import production dist. The test command uses maxWorkers=2/minWorkers=1 in both halves, with identical storage and creation selections. No paid runs, live browser runs, panel servers, or user state are touched.

## Results

Baseline passes; held version has two timing failures. See measured comparison and limitations below.

### With held change (first half)

- Forced production build passed: 180.327 s (including optional cache publication).
- Exact test selection: `pnpm.cmd exec vitest run src/programs/automation-studio/storage src/programs/automation-studio/runtime/service/flows/tests/creation.test.ts src/programs/automation-studio/runtime/service/projects/tests/creation.test.ts src/programs/automation-studio/runtime/tests/service-flows/tests/creation.test.ts src/programs/automation-studio/runtime/tests/service-flows/tests/flow-index-read.test.ts --maxWorkers=2 --minWorkers=1 --reporter=json --outputFile=C:/Users/osrs_/AppData/Local/Temp/t707-storage-with.json` (packages/fluxiq).
- 75 file results, 488 tests: 482 passed, 2 failed, 4 skipped; elapsed 769.924 s; exit 1.
- Failed: recording-stream store, `reports further chunks beyond the chunk-reader window`, 15.118 s (test timeout). This file does not execute the held storage wiring.
- Failed: whole-process, `actual built sql kill after flow_source preserves both-participant hold`, 29.746 s (15-second child receive timeout after setup). Whole-process file total 248.304 s; remaining 15 child-process cases passed.
- Creation/index-read files passed: flow creation 11.322 s, project creation 6.953 s, service-flow creation 16.275 s (5 tests), flow-index-read 8.905 s.
- Progress was verified through fresh child workers and probes at 21:43, 21:45, and 21:47 local time; no indefinite paused probe was assumed to be a load issue.
- Root reports no live Lab runs during the comparison. Other workers performed narrow checks/builds; this is comparable same-machine activity, not a controlled reproduction of the historical four-live-lane load.
- Source delta reversed with `git show 72abeeab --format= -- | git apply -R -` through byte-preserving Python subprocess input (no branch switch). Baseline forced rebuild underway, with process-only `FLUXIQ_BUILD_CACHE_DIR=off` to skip shared-store publication.

### Without held change (baseline)

- Forced production build passed in 143.374 s with process-only `FLUXIQ_BUILD_FORCE=1` and `FLUXIQ_BUILD_CACHE_DIR=off`. Source and production dist both exclude 72abeeab.
- Same test paths and worker limits as first half; added default reporter beside JSON solely for progress visibility. Raw report: `C:/Users/osrs_/AppData/Local/Temp/t707-storage-without.json`; progress log beside it.
- 75 file results: 73 passed, 2 skipped. 488 tests: 484 passed, 4 skipped. Duration 328.14 s, exit 0.
- All 16 whole-process cases passed (105.075 s for the file). SQL kill-after-flow_source passed in 4.824 s; file-mode equivalent passed in 5.878 s.
- Recording-stream control passed all 14 tests (11.605 s); chunk-reader-window case passed in 1.505 s.
- Creation/index-read files passed: flow creation 2.058 s, project creation 6.056 s, service-flow creation 3.216 s, flow-index-read 0.522 s.

## Recommendation and final state

**Keep 72abeeab held and exclude it from this integration.** The baseline passes every selected storage and creation test. The held version timed out once in a real production-dist SQL kill probe and once in an unrelated recording-stream control. Test paths, worker limits and source base were fixed, and neither half had a live Lab run; however unrelated control timing moved from 69.101 s to 11.605 s. This comparison cannot establish that pooling caused the child timeout, nor prove the performance improvement safe under the historical four-lane load. No unsupported attribution to machine load is made.

Pooling is an optional performance change, not required for site reset or representative live coverage. A future acceptance test should repeat the SQL kill-after-flow_source case and recording-stream chunk-reader-window control with and without the change under a genuinely held workload. The supervisor requested no third run at this stage, so none was launched. No timeout was increased and no product behavior or oracle was weakened.

The worktree deliberately retains an UNCOMMITTED reverse diff of the held commit on the existing task branch: exactly the three owned storage files, 3 insertions and 18 deletions. Production dist was rebuilt from this baseline. No branches were switched, committed, merged or pushed. No user data or live profile was touched.

## Other validation

- `pnpm.cmd --filter fluxiq check`: exit 0 both with and without the held change (matching cached typecheck restored from shared store).
- `node scripts/structure-audit.mjs`: exit 0, 400 warnings and 1154 baselined, on the held source before reversal; reversal only removes the three-file pool wiring and private wrapper method. Raw output: `C:/Users/osrs_/AppData/Local/Temp/t707-storage-structure.log`.
- Source review found no newly spanning transaction: keepWhile retains an idle connection between committed transactions; paused effects do not retain a transaction. This is review evidence, not proof against every cross-process interaction.

## Not verified

No live browser behavior was exercised by this provider-free brief. The historical four concurrent live-lane workload was not reproduced. No full Core suite was run. Held optimization acceptance remains intentionally unresolved rather than blocking live product testing.
