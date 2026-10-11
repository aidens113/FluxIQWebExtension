# t437: a finished Lab run always publishes its evidence, and the guards read it truthfully

Worker report. Worktree `C:/Users/osrs_/FluxStuff/fxwork/t437-lab-bundle-publish`, branch
`task/t437-lab-bundle-publish`. Nothing committed. No Lab or browser run.

## Outcome

Done. All four items in the brief are implemented and covered by the tests beside each
changed file. On this Windows machine, a real open read handle on `events.ndjson` inside
staging blocked the rename, and the bundle was still published, by the copy fallback.

## What changed and why

1. **Publication survives a reader** (`packages/test-evidence/src/publication/`, new).
   - `publish-bundle-directory.ts`: `publishBundleDirectory(staging, destination, hooks)`.
     - The staging rename retries on EBUSY, EPERM and EACCES. The waits are 10, 25, 50,
       100, 200, 400, 800 and 1600 ms, then 6 × 2000 ms: 15 attempts and 15.2 s in total.
       The old budget was 3 retries over 85 ms.
     - If a transient code still blocks the rename, the folder is copied to
       `.publishing-<runId>`, a folder nobody has open. The copy is then renamed into
       place with the same back-off, so the bundle appears whole or not at all.
     - The staging folder is removed afterwards when it can be. If it cannot, it is left
       beside the bundle and the result says so (`stagingLeftBehind: <errno>`).
     - The "Evidence bundle already exists" refusal is unchanged.
   - `publication-error.ts`: `EvidenceBundlePublicationError`. It carries `code` (the
     errno), `stage` (`rename-staging`, `copy-staging` or `rename-copy`), `renameCode`,
     `attempts`, `stagingPath` and `destination`.
     - Its message is built only from those fields. Example: `Evidence bundle could not be
       published (stage bundle.publish, rename-copy): rename EPERM, then rename of the
       copy EPERM after 15 attempts; the sealed bundle stays at <staging>`.
     - It is thrown only after `bundle.complete.json` is written. Its `code` keeps the
       runner's classification as `environment.missing` / `path.denied` + errno.
   - `bundle.ts`: `finalize` calls `publishBundleDirectory` and returns `publication`
     (`method`, `attempts`, optional `stagingLeftBehind`). The old
     `renameEvidenceBundleWithRetry` and `pathExists` were removed. Test hooks gained
     `copyDirectory` and `removeDirectory`.
   - `index.ts` exports the new barrel. It was not named in the brief, but it is the
     package barrel the new module needs.
   - I created a directory rather than adding to `bundle.ts` because of the
     one-exported-class-per-file and filename-prefix rules.
2. **The command line prints the real cause and stage**
   (`facility-failure/projected-facility-error.ts`).
   - An `EvidenceBundlePublicationError` is printed as runner-authored text, the same way
     a `RunnerFailure` is: redacted by `boundedRunnerMessage`, bounded at 640 characters
     so the staging path is never cut.
   - Any other error still never prints its own text. It now appends the closed
     diagnostic, for example `Scenario attempt failed outside a finalized bundle at
     bundle.publish (path.denied EPERM)`. Before, it printed the bare sentence.
3. **The live guard reads a sealed staging folder as finalized**
   (`scripts/lab/live-guards/run-outcomes.mjs`).
   - A `.staging-run-*` counts as sealed when its `bundle.complete.json`
     `artifactIndexSha256` equals the sha256 of its `artifact-index.json`.
   - A sealed folder is read by the same `finalizedOutcome` as a published bundle: verdict
     from `run.json`, cost and per-build spend from `snapshots/live-llm.json`, and the
     facility-failure check. It is marked `unpublished: true` and not `killed`.
   - Only for an unpublished run, a missing sidecar or cost falls back to the step log, so
     an empty balance still stops later launches.
   - Only an unsealed folder, or one whose marker does not match its index, is a kill.
4. **Steps are linked and named when publication fails.**
   - `run-scenario.ts`: if `finalize` throws `EvidenceBundlePublicationError`, the local
     sidecars are written into the sealed staging folder. `labRun.close({ verdict,
     bundlePath: error.stagingPath })` then links `steps`, copies the key files and reads
     the cost, and the error is rethrown.
   - The playback line now prints the absolute `labRun.stepsDirectory` instead of
     `steps/`.
   - The sidecar line was unpacked into a `writeSidecars` closure. `await
     bundle.finalize(` is kept literally, because the source-order tests pin it.
     `run-scenario.ts` is now 796 lines (budget 800).
   - `lab-runs/lab-run-record.ts`: `close` writes the given `bundlePath` (the staging
     folder when publication failed) into `entry.json`. Every close also logs
     `[lab runs] this run's N step(s) are in <lab-runs/.../steps>`, so the full steps path
     is named on every live run, with or without a bundle.

## Commands run and observed results

All commands were run in the worktree.

- `packages/test-evidence`: `pnpm run check`: `{"build-cache":"build","step":"test-evidence:check",...}`, exit 0.
- `packages/test-evidence`: `node --test tests/evidence.test.mjs` after the build: `# tests 19 # pass 19 # fail 0`.
  - This includes the new test "a real open handle inside the staging folder does not stop publication". It asserts `publication.method === "copy"` on win32, and it passed here.
- `packages/test-runner`: `pnpm run check`: `core-build: ... current`, `test-runner:check` exit 0.
- `packages/test-runner`, after `test-runner:build`:
  - `node --test dist/facility-failure/tests/*.test.js dist/lab-runs/tests/*.test.js dist/run-evaluation/tests/runner-wiring.test.js dist/run-evaluation/tests/single-run-evaluation.test.js dist/run-scenario/tests/playback-skips-wiring.test.js dist/tests/cli*.test.js`: `# tests 93 # pass 93 # fail 0`.
  - The tests that finalize bundles: `exploration-failure-evidence`, `write-provider-failure-sidecar`, `runner-wiring`, `single-run-evaluation` and `browser-evidence`: `# tests 44 # pass 44 # fail 0`.
- `scripts/lab/live-guards`: `node --test tests/*.test.mjs`: `# tests 42 # pass 42 # fail 0`. `killed-run.test.mjs` alone gave 7 of 7, 4 of them new.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (184 warning(s), 651 baselined)` and `1 baseline entries can be lowered`.
  - This is most likely `statement-packing` for `run-scenario.ts`, since I unpacked the sidecar line.
  - I did not run `pnpm structure:baseline`, because `.structure-baseline.json` is a shared file I do not own.

## Not verified

- No Lab or browser run, as the brief says. The live path is unexercised: `runScenario`
  catching the publication error, the stderr lines, and the guard reading a real sealed
  run.
- The copy fallback against an antivirus scanner or an indexer. Only an open Node read
  handle was exercised. A reader that opens files without share-read would also block the
  copy, and that case ends in the typed `copy-staging` error.
- Full package suites were not run (narrow checks only, per AGENTS.md).

## Open questions or contradictions found

- `close-launch.mjs` (not mine) carries `killed` into the ledger but not `unpublished`.
  An unpublished run's finish entry is now an ordinary finish with its real verdict and
  cost. Recording `unpublished: true` in the ledger would need a one-line change in
  `close-launch.mjs` and the `FinishEntry` typedef in `ledger.mjs`.
- A copy-published run whose staging folder could not be removed leaves a sealed
  `.staging-<runId>` beside the bundle. The guard ignores it because the final folder
  exists, but nothing removes it later. `pnpm task prune` or a later run could.
- Not done: the report's defect 2 item 3, the final line of `scripts/lab/run-lab.mjs`.
  The brief did not name that file. Every close now logs the full steps path from the
  runner instead.
