# t187 build and Lab startup speed: lane report

Status: **Ready to commit**, with the gaps listed under "Not verified". The tree is
`C:/Users/osrs_/FluxStuff/fxwork/t187/!FluxIQWebExtension` (branch `task/t187-lab-startup-speed`, behind `dev`), and
nothing in it is committed. Core is untouched; the Core-side changes are proposals only.

These worker reports sit beside this one and hold the detail:

| Report | What it holds |
| --- | --- |
| `t187-bench-before.md` | Baseline timings. |
| `t187-bench-after.md` | After-change timings. |
| `t187-history.md` | When each costly step was added. |
| `t187-build-cache.md` | The cache design, the registry and the input-coverage proof. |
| `t187-build-store.md` | The cross-tree store, the step lock, Core builds and the check prefix. |
| `t187-lab-prelude.md` | The Lab prelude and finding 1. |
| `t187-core-web-key.md` | Findings 2 and 3. |
| `t187-core-proposal.md` | The Core-side causes and a proposed Core change. |

## 1. Why building became slow (measured)

**Method.** The baseline ran on a disposable clone pair: downstream `05b6606a`, Core `af385f7`. The harness is
`C:/Users/osrs_/FluxStuff/fxwork/t187-bench/harness/bench.mjs`. Other lanes held the second build slot during most
steps, so the timings reflect contention rather than an idle machine.

**Where the time went.** These are warm runs with nothing changed, taken from `t187-bench-before.md`:

- **Core `pnpm build`: 162 s.**
  - `next build` alone takes 98 s. It runs on every build, with no key.
  - `fluxiq` takes 21 s under `tsc -b --clean`.
- **Downstream `pnpm build`: 75-83 s.** It reuses nothing.
  - test-runner takes 22 s (clean, then a full tsc).
  - scenario-lab takes 17 s, and that includes a second build of test-contracts.
  - The extension takes 17 s: a full `tsc --noEmit`, then esbuild.
  - domain takes 7 s (clean, then tsc).
- **`pnpm check`: 181-271 s.** Every package type check is a full, non-incremental tsc:
  - the extension, 32 s;
  - scenario-lab, 19 s;
  - test-runner, 18 s;
  - domain, 15 s.

  On top of those comes a serial test prefix: task:test 24 s, structure:test 6.5 s, lab:test 6 s, and the audit 8.6 s.
  `task finish` runs the same check at concurrency 1, which measured 314 s.
- **Lab prelude: 78-81 s per run, even with nothing changed.** It spawns four `pnpm` builds, and `test-runner...`
  rebuilds domain and test-contracts again. After a domain edit, the prelude refused the run as stale in 1.9 s instead
  of rebuilding (finding 1).
- **`task start --worktree --core`: 139 s.** It does two installs, then builds Core's packages with `--clean` (about
  30 s), then runs a full `pnpm build` in a tree that has nothing built.
- **`task finish`: 142 s,** most of it the serial `pnpm check`.

**What made it slower recently** (`t187-history.md`):

1. **Growth, multiplied by builds that cannot be incremental.** Core's `packages/fluxiq/src` grew from 386 to 1479
   files between 09-08 and 09-29. Downstream `apps` and `packages` grew from 166 to 2025 files over the same weeks.
   Clean-first builds pay for all of that on every run:
   - Core's `tsc -b --clean`, `6368574` (08-06);
   - domain's `clean-dist`, `11d2ed32` (09-12);
   - test-runner's `clean`, `1c5c7adc` (09-21).
2. **Redundant builds layered on in September:**
   - run-lab's four builds, `ab736a1e` (09-12);
   - the second test-contracts build, `f205e0db` (09-22);
   - `test:e2e:build = pnpm build`, which type-checks again, `5e9d97e7`;
   - a full `pnpm -r build` in every `task start`, `ba54eff3` (09-17);
   - a serial `pnpm check` in every `task finish`, `22c39751` (09-17).
3. **`coreHead` in the Lab's `next build` key,** `878fbd5c` (09-14). Any Core commit, including one that changes only
   docs, forced a fresh `next build`.

## 2. What changed

1. **`scripts/build-cache/`** (new) is a content-fingerprint stamp-and-skip cache for every downstream package's
   `build` and `check`. A step is reused only when all of these match its stamp:
   - a sha256 over the bytes of every input file;
   - the step metadata;
   - a sha256 of the outputs.

   The input roots are the package, its transitive workspace dependencies including their outputs, the linked Core
   packages, the lockfiles, the root configs and the cache's own sources. The stat cache follows git's racy-index
   rule.

   `prove-inputs.mjs` runs `tsc --listFilesOnly` and an esbuild metafile for every project, and fails if any file read
   lies outside the fingerprinted roots or a lockfile-covered `node_modules`. The static tests run in `pnpm check`.
   `FLUXIQ_BUILD_FORCE=1` always builds. Tests are never skipped.
2. **Every package's scripts go through the cache,** and the nested `pnpm` calls are gone. test-contracts is built
   once. `tsc --noEmit` checks are now `--incremental`, with their tsbuildinfo under `node_modules/.cache`.
3. **A shared store** at `%LOCALAPPDATA%/fluxiq-build-cache` lets another tree restore outputs or check-pass records.
   - Set `FLUXIQ_BUILD_CACHE_DIR` to move it, or `=off` to disable it.
   - An output that embeds the tree's absolute path in any spelling is refused.
   - A restore is verified against the stored digest.
   - A per-step lock means two processes never build the same step at once.
4. **The Lab prelude** (`scripts/lab/run-lab.mjs`, `scripts/lab/prelude/build-phase.mjs`) runs the steps in-process
   with `runStep`, so it spawns no `pnpm`. It keeps the build lock, the host-before-domain order and a step timer.
   Finding 1 is fixed: the repository staleness guard runs after the build, and the extension's output root is its
   real output directory. An edited domain is now rebuilt instead of refused.
5. **`scripts/worktree/core-build.mjs`** builds Core's three library packages through the same fingerprint and store.
   On a miss it runs exactly today's command.
6. **The `pnpm check` test prefix** is one combined `node --test`: 27 s against 36-42 s for the four separate runs. The
   same 475 tests run.
7. **Finding 2:** the Core web build key uses a hash of Core's `pnpm-lock.yaml` and the package manifests instead of
   `coreHead`. `BUILD_LAYOUT_VERSION` is now 2.
   **Finding 3:** `--dry-run` reports `coreWeb: {key, cached}` without building.
8. **The `cli-llm.test.ts` import past the barrel.** The test now imports the publication helpers from the
   `core-web-build` barrel; this was the root `pnpm check` blocker.

## 3. Before and after

Both columns use the same harness and the same commands. The before rows come from
`t187-bench/before/results.jsonl` and the after rows from `t187-bench/after/results.jsonl`. No after row is distorted.

The before runs were more contended. A full forced rebuild after the change (`FLUXIQ_BUILD_FORCE=1`, store off) took
36 s, against a 74 s cold build before. So compare the no-change rows for the effect of the change; the cold rows mix
the change with load.

| Command | Pass | Before s | After s |
| --- | --- | --- | --- |
| downstream `pnpm build` | cold / no change / edit-one | 74.4 / 82.6 / 100.2 | 50.4 / **4.5** / 35.4 |
| downstream `pnpm check` | cold / no change / edit-one | 245.0 / 180.7 / 270.9 | 82.6 / **34.2** / 53.6 |
| `pnpm check` at concurrency 1 (what finish runs) | no change | 313.6 | **35.6** |
| downstream `pnpm test` | 1 / 2 | 541.1 / 224.6 | 180.8 / 182.2 |
| Lab prelude (`pnpm lab run everything-store --dry-run`) | 1 / 2 | 77.9 / 81.0 | **6.4 / 7.0** |
| Lab prelude, edit-one | 3 | 1.9 (refused as stale) | 9.0 (rebuilt, restored from the store) |
| `task start --worktree --core` | first on this Core commit | 138.7 | 112.9 |
| `task start --worktree --core` | second (Core packages in the store) | not measured | 72.0 |
| `task start`, composed with the change committed | warm store | not measured | about 45 (see below) |
| finish's validation in a fresh worktree | first check there | not measured | **35.9** |
| `task finish` | 1 | 142.2 | 103.2 (worktree still held the BASE scripts) |
| Core `pnpm build`, `check`, `test` | | 162 / 45-90 / 450 | unchanged: no Core edit (see section 5) |

Notes on the table:

- **Exit codes match the baseline.**
  - `pnpm test` fails on the same two deterministic test-runner tests on both sides: `runner-wiring.test.js:142` and
    `demo-workspace.test.js:53`. Both are test drift that already existed at BASE, not this change.
  - The prelude rows end on the runner's argument refusal, which comes after the prelude has run, on both sides.
- **The cold `pnpm build` costs more than a forced rebuild: 50 s against 36 s.** That is the one-off cost of hashing
  every input into an empty stat cache and saving the outputs to the store. A warm edit-one pays almost none of it:
  35 s, about the cost of the three steps it rebuilt.
- **Why `task start` and `task finish` are only partly measured.** The hook blocks commits and branch changes in the
  bench clone too, so the bench `dev` stayed at BASE, and a new worktree holds BASE package scripts. I measured the
  parts instead, in worktree t186:
  - `task start` with the Core packages restored from the store: 72.0 s;
  - the BASE `pnpm build` it contains: 34.8 s;
  - the t187 `pnpm build` in that same fresh worktree: 7.8 s, with all 11 steps restored from the store;
  - so `task start` with the change committed comes to about 72.0 - 34.8 + 7.8 = **45 s**.

  `task finish` refuses a dirty worktree, which is correct. Its validation, run directly in the fresh worktree, took
  35.9 s: 475 tests passed and all 10 checks were restored from the store. The same command with BASE scripts took
  110.3 s, but that row is marked `distorted` because a live run claimed slot-1 while it ran. Finish's merge and
  worktree removal were not timed separately.
- **To re-measure after the supervisor commits:** clone the committed branch into a fresh pair and run
  `pnpm task start bench --worktree --core`, then `pnpm task finish <id>`, through `bench.mjs`. Plan:
  `t187-bench/harness/plan-after.md`.

## 4. Remaining costs after the change

- **The `pnpm check` floor is about 34 s:** the combined test prefix takes 28 s and the structure audit 6.5 s. Tests
  are not skipped by design. The audit is mirrored from Core, so its speed-up belongs in Core first (section 5).
- **`pnpm test` takes about 181 s,** all of it test execution. Every build in front of the tests is reused.
- **The first build in a tree whose content no tree has built yet** pays full compilation plus the stat-cache and
  store tax, about 50 s downstream.
- **`task start` on a Core commit nobody has built through `core-build.mjs`** rebuilds `fluxiq` (29.5 s). The shared
  and main Core checkouts are built by Core's own `pnpm build`, which does not feed the store. It would, if Core
  adopted the proposal below.

## 5. Core-side causes and proposed change (not applied; for a paired Core branch)

These are from `t187-core-proposal.md`. Every saving is an estimate, and the structure-audit profile was not taken
because slot-1 was busy.

1. **The package builds run `tsc -b --clean && tsc -b`.** The `--clean` came in with `6368574` with no stated reason.
   Proposal: drop it and add a prune of orphaned outputs, keeping a cold clean build for `package:validate`.
   Estimated saving: about 22 of the 162 s.
2. **`next build` runs on every root `build`.** Proposal: gate it on a content key, the same inputs as the Lab's key.
   Estimated saving: about 97 s.
3. **The package `tsc --noEmit` checks are not incremental.** Proposal: add `--incremental --tsBuildInfoFile
   node_modules/.cache/...`. Estimated saving: 20-25 s of the check.
4. **The structure audit parses 2598 files (16.7 MB) and makes about ten AST walks on one thread.** Proposal: a
   per-file cache keyed by content, plus a whole-run cache. Estimated saving: 8.5-43 s down to about 1 s.

The combined estimate for a no-change run: Core build 162 s down to about 5-8 s, and Core check 45-90 s down to about
8-15 s. Adopting `scripts/build-cache` in Core would also feed the shared store from Core's own builds.

I do not endorse one part of that report: its idea of caching `structure:test` and `task:test` results. Tests should
stay un-skipped, as they are downstream.

## Validation (observed)

- **`pnpm check` in the t187 tree**, run through `build-slots/heavy.sh`: exit 0 in 58 s, with 475 pass, 0 fail,
  1 skipped, and `structure-audit: passed`. It ran after the last edit, which normalized three worker-written files to
  LF.
- **`node --test "scripts/build-cache/tests/*.test.mjs"`:** 28 of 28 passed in my own run, before the store work.
  With the store work, the worker reports 176 of 176 across all suites.
- **`pnpm build` twice:**
  - The first run rebuilt only test-runner, 21 s, because I had edited its source.
  - The second run reused all 11 steps, in 4 s.
- **Tamper tests:**
  - An appended byte in `test-contracts/dist` gave `outputs changed since they were stamped` and a rebuild.
  - A deleted `index.d.ts` gave `required output missing` and a rebuild.
- **`node scripts/build-cache/prove-inputs.mjs`:** `inputs proved complete for 33 project(s)`, exit 0.
- **Core-web-key tests:** `node --test` over `dist/core-web-build/tests/*.test.js` and `dist/tests/cli-llm.test.js`
  gave 37 pass, 0 fail.
- **Cross-tree reuse on real trees:** the t186 worktree, at a different path, restored all 11 build steps from the
  store, and all 10 check steps in its finish-style check.

## Not verified

- **The prelude for interactive or instanced Lab runs**, that is `domain:host-build` and the host copy. This is
  covered by unit tests only.
- **`task start` and `task finish` with the change committed.** The start figure is composed from measured parts, as
  above; finish's merge and removal were not timed on their own.
- **Two OS processes contending for the per-step lock.** Only the scratch-tree unit tests cover it.
- **Timings on an idle machine,** and any Core after-numbers, since Core was not changed.

## Notes for the supervisor

- **Behaviour changes:**
  - The first Lab run after the merge does one full `next build`, because `BUILD_LAYOUT_VERSION` is now 2.
  - A dry run fails with `environment.missing` when Core's key inputs are absent.
  - The Lab rebuilds a stale domain instead of refusing it.
- **Documentation:** `docs/architecture/repository-layout.md` should gain a paragraph on
  `scripts/build-cache`. It needs to cover the stamps under `node_modules/.cache/fluxiq-build`, the shared store and
  its environment variables, `FLUXIQ_BUILD_FORCE`, and `pnpm build-cache:prove` after an import-shape change. That
  file was outside my brief.
- **Disposable leftovers under `C:/Users/osrs_/FluxStuff/fxwork/t187-bench/`:**
  - the old clone pair `!FluxIQWebExtension`, `!FluxIQ` and `fxwork`, which the permission classifier refused to let
    a worker delete;
  - the after pair `a/`, including the t186 worktree and the bench-only Core branches `task/t185-bench` and
    `task/t186-bench2`;
  - the harness.

  Nothing in them can push, because every push URL is `DISABLED`. Delete the whole directory when the numbers are no
  longer needed.
