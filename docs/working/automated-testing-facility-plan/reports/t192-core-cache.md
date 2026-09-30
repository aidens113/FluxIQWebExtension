# t192-core-cache: content-fingerprint stamp-and-skip for Core's build and check

## Outcome

Done. `pnpm test` exits 1: fluxiq has 24 of 4,487 tests failing, and every one is a vitest timeout under machine load (see "pnpm test" below). This change touches no source, test or vitest config. Web's tests did not run, because pnpm stops at the first failing package.

Every required item was observed on the real Core tree (`fxwork/t192/!FluxIQ`, branch `task/t192-core-build-speed`) with the final code:

- **`pnpm build` twice.** The first was a miss after the cache sources changed (226.8 s). The second reused all four steps in **3.5 s** wall time, including the heavy-slot wrapper and pnpm start-up.
- **`pnpm check` twice.** Both exited 0. The second run reused all five cached steps, whose own time totalled about 2.3 s. The remaining ~49 s of its 51.4 s is the three test suites, which are never skipped.
- **Edit, then revert, of `packages/fluxiq/src/index.ts`.**
  - The edit rebuilt fluxiq and web; contracts and client-gateway-websocket were reused.
  - The revert restored fluxiq from the store (2 files copied) and web from this tree's rooted store entry (8 files copied), in **10.4 s**.
  - `git diff` of the file was empty after the revert, and the next build reused everything.
- **`prove-inputs`** exits 0.
- **Structure audit** passes, with no finding in `scripts/build-cache/`.
- **`build-cache:test`**: 51 passed, 0 failed.

## What changed and why

### Changed files

All in Core. No `src/`, `scripts/structure-audit*`, `scripts/task/**` or tsconfig was touched.

- `scripts/build-cache/**` (new).
- `package.json`:
  - `build` now runs `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build web:build`.
  - `check` now runs `pnpm structure:test && pnpm task:test && pnpm build-cache:test && node scripts/build-cache/cli.mjs structure-audit:check && node scripts/build-cache/cli.mjs --parallel contracts:check fluxiq:check client-gateway-websocket:check web:check`.
  - New scripts `build-cache:test` and `build-cache:prove`.
  - `structure:check` and `structure:baseline` are unchanged and uncached, so `--rule`, `--update` and `--adopt` still run straight through.
- `packages/{contracts,fluxiq,client-gateway-websocket}/package.json` and `apps/web/package.json`:
  - `build` and `check` become `node ../../scripts/build-cache/cli.mjs <dir>:<kind> -- "<command>"`.
  - The build command is byte-for-byte today's, `--clean` and the rewrite pass included.
  - The package checks gain `--incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`.
  - Web keeps `tsc --noEmit`, because its tsconfig is already `incremental`.
  - Only the script values changed. The manifests were edited textually, so their formatting and line endings are untouched.

### Design

It is ported from the downstream cache, with these Core-specific differences.

**Inputs are git-visible files.**
- `fingerprint/git-visible-files.mjs` runs `git ls-files -z -co --exclude-standard` once per fingerprint.
- Each `git` root takes the listed files under its path. A tracked file that was deleted from disk hashes as absent.
- Ignored inputs are named explicitly and walked on disk (`walk` roots):
  - each dependency's `dist/`;
  - `node_modules/.pnpm/lock.yaml`;
  - `apps/web/.env*` for `web:build`;
  - `apps/web/.next/types` for `web:check`.
- So `packages/*/recordings|indexes|storage|flows|pipeline`, `storage/*` and every other ignored path never enter a fingerprint. A test proves this.
- If git cannot list the checkout, the step runs uncached and says so.

**Registry** (`steps.mjs`):

| Step | Command | Outputs / required | Other |
| --- | --- | --- | --- |
| `contracts:build`, `fluxiq:build`, `client-gateway-websocket:build` | today's `tsc -b … --clean && tsc -b … && node ../../scripts/rewrite-declaration-imports.mjs dist` | `dist` and `tsconfig.build.tsbuildinfo` / `dist/index.js`, `dist/index.d.ts` | |
| `web:build` | `next build --turbopack` | `.next` excluding `.next/cache` / `.next/BUILD_ID` | env `NODE_ENV` plus every `NEXT_*` and `__NEXT_*`; `traces: true` |
| `*:check` (packages) | incremental `tsc --noEmit` | none | |
| `web:check` | `tsc --noEmit` | none | |
| `structure-audit:check` | `node scripts/structure-audit.mjs` | none | inputs are every git-visible file plus the installed lockfile; `replayOutput` |

Every package step's inputs are:
- its own git-visible files;
- each transitive workspace dependency's git-visible files, which include its `src`, plus its `dist`. This covers `transpilePackages` and the tsconfig `paths` into `src`.
- every `node <script>` its command names;
- the root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` and `tsconfig.base.json`;
- the build-cache sources, minus their tests;
- the installed lockfile.

`next.config.ts` reads no environment variable today. A registry test fails if it starts reading one that `web:build` does not fingerprint, or reads the environment in a way the test cannot enumerate.

**Stamps and locks.** Stamps, locks and the stat cache live in `node_modules/.cache/fluxiq-core-build/`, not `fluxiq-build/`. The downstream `resolve-core-library.mjs` already writes `packages/*/node_modules/.cache/fluxiq-build/build.json`. Sharing that file would make each layer delete and rewrite the other's stamp on every run. Only the check tsbuildinfo goes in `fluxiq-build/`, as the brief asked; it does not collide with anything.

**No touch on reuse** (`touch-stale-outputs.mjs`):
- On a reuse, and after a store restore, nothing is touched unless the newest input file's mtime is newer than the newest output file's.
- When it is, only the step's `required` files are set to now. That is enough for the downstream stale guard, which compares the newest `src` file with the newest `dist` file.
- Directories are never touched. The stat cache records the mtime each hash saw, so this costs no extra stats.

**Store.**
- It lives at `%LOCALAPPDATA%/fluxiq-build-cache/core/{v1,tmp}`, or `<FLUXIQ_BUILD_CACHE_DIR>/core`, where `off` disables it. Downstream's own entries at the top level are never touched by Core's pruning, and Core's are never touched by downstream's.
- It uses the downstream relocatability check, digest-verified restore, 14-day / 5 GB pruning and atomic writes.
- **Non-relocatable outputs.** When an output file holds the tree's absolute path, the entry is stored under `sha256(fingerprint + tree root)` with `root` recorded, and is restored only into that same root. On the real tree, `.next` is non-relocatable because `.next/required-server-files.json` embeds the root. The three library builds are relocatable.
- **Differential restore** (an addition beyond downstream):
  - Each stored file's sha256 is recorded.
  - A restore removes output files the entry lacks, keeps files already on disk with the stored hash (timestamps included), and copies only the rest.
  - The whole output digest is then verified as before.
  - I added this after measuring the first revert: a full re-copy of fluxiq's 4,149 files took 45.6 s. Differential, it copied 2 files in 4.1 s.

**Audit replay.** The plain audit is the one cached run. It is stamped only when it passed, and its printed output (stdout and stderr, tee'd live) is kept in the stamp and the store entry. On a reuse the CLI prints `build-cache: structure-audit:check passed at fingerprint <sha12> (…); replaying the output it printed then:` followed by the stored output.

**CLI and scheduling.**
- With one step and `-- "<command>"`, the CLI refuses a command that differs from the registry's.
- With several steps it runs them in order and stops at the first failure.
- `--parallel` (`schedule-steps.mjs`) starts a step once every listed step of a package it depends on has finished, at most 4 at a time, as `pnpm -r check` did. It buffers each step's output and prints it whole when the step ends.

**Tests** (`scripts/build-cache/tests/`, 51 tests). They run on a scratch git checkout shaped like Core (`scratch-workspace.mjs`): contracts ← fluxiq ← web and contracts ← gateway, plus an audit step, with Core's ignore rules.
- `invalidation`: an edit to fluxiq rebuilds fluxiq and web and reuses contracts and the gateway; the revert restores both from the store with nothing run. Runtime data in ignored dirs, including `node_modules/.cache`, invalidates nothing. An untracked, non-ignored file is an input. `.env*` is an input, and so are `NEXT_*` and `NODE_ENV`. `.next/cache` is excluded.
- `no-touch`: a reuse whose inputs are older than its outputs leaves mtimes exactly equal. A newer input touches only the required files, once. Outputs that are not required are never touched.
- `store`: namespace; path-free fingerprints; round trip across two checkouts; a rooted entry restores after a revert in its own tree and builds in another tree; differential restore; tampered and missing blobs; force; prune.
- `audit-replay`: stamp plus replay; git-visible versus ignored inputs; a failure is not stamped; a pass restored from the store replays its output.
- `run-step`: deleted or edited outputs; force; a failed build leaves no stamp; a check is stamped only when it passed; an input that changes mid-run is not stamped; a tree without git runs uncached; order and parallel scheduling.
- `stat-cache` and `step-lock`: ported.
- `registry`, on the real repo: steps resolve; tsconfig references are covered, and an ignored reference must be under a walked input or the step's own outputs; tsc projects are listed; every package script matches the registry; the root build lists every step in dependency order and the root check lists every check; next.config env; no absolute path in the metadata.

## Commands run and observed results

Heavy commands ran through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t192-core-cache <what>" …`. Logs are under my scratchpad (`$S` = `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/eb370cd2-4295-44d0-ba0e-006eba343f41/scratchpad`), `t192-final-*.log`. The machine was under load throughout, so absolute miss times are noisy.

**Unit tests and audit**
- `node --test --test-concurrency=2 "scripts/build-cache/tests/*.test.mjs"` → `# pass 51  # fail 0`.
- `node scripts/structure-audit.mjs` (wrapped) → `structure-audit: passed (194 warning(s), 354 baselined).` No finding names `scripts/build-cache`.

**Build, earlier code** (before the differential restore; kept as evidence):
- First miss: `BUILD1 exit=0 seconds=316`. Web took 208.8 s and fluxiq 90.9 s.
- Second: `BUILD2 exit=0 ms=11993`, all 4 reused.
- Revert with full-copy restore: fluxiq restore took 45,557 ms, 73 s in all.

**Final code**
- **`pnpm build` A** → `exit=0 ms=226756`. All 4 were `build`, reason `inputs changed: scripts/build-cache`, and all were stored. Web was stored "for this tree only, because apps/web/.next/required-server-files.json holds its absolute path … (2389 file(s), 192226401 bytes)".
- **`pnpm build` B** → `exit=0 ms=3534`.
  - contracts `reuse` 200 ms; fluxiq `reuse` 602 ms; client-gateway-websocket `reuse` 252 ms; web `reuse` 612 ms. Each reason was `inputs and outputs match the stamp`.
- **No touch on reuse, on the real tree.** `$S/t192-mtimes.mjs` walks each output the way the downstream guards do (every file, newest mtime and file count) over `packages/*/dist` and `apps/web/.next` minus `cache`. It was run before and after build B: `diff` printed nothing (`MTIMES UNCHANGED ACROSS REUSE`). The same held for the earlier-code build 2.
- **`pnpm check` A** → `exit=0 ms=80174`.
  - Test suites: pass 182/20/51, fail 0.
  - `structure-audit:check` build 15.1 s; checks built: contracts 2.7 s, client-gateway-websocket 3.6 s, fluxiq 9.2 s, web 14.7 s. The incremental tsbuildinfo already existed from the earlier-code run. That earlier cold run took fluxiq 48.5 s and web 74.7 s.
- **`pnpm check` B** → `exit=0 ms=51385`.
  - The audit replay line was printed, then `structure-audit: passed (194 warning(s), 354 baselined).`
  - Reuses: audit 527 ms, contracts 308 ms, client-gateway-websocket 365 ms, fluxiq 487 ms, web 595 ms.
  - An earlier-code check 2 took 35.4 s; the spread is load on the test prefix.
- **Edit.** Appended `// t192 build-cache invalidation probe` to `packages/fluxiq/src/index.ts`, then `pnpm build` → `EDITED exit=0 ms=311795`.
  - contracts `reuse`.
  - fluxiq `build`, "inputs changed: packages/fluxiq", 73.0 s.
  - client-gateway-websocket `reuse`.
  - web `build`, "inputs changed: packages/fluxiq, packages/fluxiq/dist".
- **Revert.** Copied the saved original back. `git diff --stat -- packages/fluxiq/src/index.ts` printed nothing. Then `pnpm build` → `REVERTED exit=0 ms=10446`:
  - contracts `reuse` (stamp);
  - fluxiq `reuse`, source `store`, "restored from the shared store (inputs changed: packages/fluxiq; 2 file(s) copied)", 4061 ms;
  - client-gateway-websocket `reuse` (stamp);
  - web `reuse`, source `store`, "restored from this tree's entry in the shared store (inputs changed: packages/fluxiq, packages/fluxiq/dist; 8 file(s) copied)", 2434 ms.
- **Mtimes after the revert.** The newest file in `fluxiq/dist` moved to 06:05:23.871Z (`dist/index.js`, just restored). The reverted source's mtime is 06:05:18Z, so the source is not newer than the build and the stale guard stays quiet. `.next` moved likewise. contracts and client-gateway-websocket did not move.
- **Build after the revert** → `exit=0 ms=5625`, all 4 `reuse` from the stamp.
- **`pnpm check` C, after the revert** → `exit=0 ms=57903`. All 5 cached steps reused; test suites pass 182/20/51.
- `git status --short` at the end showed only the five `package.json` files and `scripts/build-cache/`. The next build left `next-env.d.ts` and `tsconfig.json` unchanged.
- **`node scripts/build-cache/prove-inputs.mjs`** (wrapped, run with `.next` present) → exit 0, 40 s:

  | Step | Listing | Files | Fingerprinted | Own outputs | Installed |
  | --- | --- | --- | --- | --- | --- |
  | contracts:build | tsc | 201 | 22 | 0 | 179 |
  | contracts:check | tsc | 288 | 31 | 0 | 257 |
  | fluxiq:build | tsc | 1357 | 1057 | 0 | 300 |
  | fluxiq:check | tsc | 1924 | 1546 | 0 | 378 |
  | client-gateway-websocket:build | tsc | 189 | 24 | 0 | 165 |
  | client-gateway-websocket:check | tsc | 269 | 26 | 0 | 243 |
  | web:build | tsc | 2917 | 2102 | 2 (`.next/types`) | 813 |
  | web:build | 27 nft traces | 2900 | 1078 | 1077 | 745 |
  | web:check | tsc | 2917 | 2104 | 0 | 813 |

  The final line was `note structure-audit:check: runs no compiler, nothing to list`, then `inputs proved complete for 9 listing(s)`. This proof ran after the differential-restore change to the store and run-step; `prove-inputs.mjs` and the registry were unchanged after it.
- **`pnpm test`** (wrapped, run once): see "pnpm test" below.

## pnpm test

`bash heavy.sh "t192-core-cache test" pnpm test` → `TEST exit=1 seconds=629`. Log: `$S/t192-test.log`.

**How far it got:**
- contracts: 9 files and 53 tests passed.
- client-gateway-websocket: 1 file and 4 tests passed.
- fluxiq: `Test Files 17 failed | 458 passed (475)`, `Tests 24 failed | 4462 passed | 1 skipped (4487)`.
- pnpm then stopped with `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL fluxiq@0.7.0 test`, so `apps/web`'s tests did not run.

**Why the 24 failed:**
- Every failure is `Test timed out in 15000ms`, except `tails and reconnects runtime streams by sequence at a million events`, which is `Test timed out in 60000ms`.
- The accompanying `EBUSY: resource busy or locked, unlink …\*.sqlite` and `ENOTEMPTY … rmdir` lines come from a timed-out test's temp directory being removed while its SQLite files were still open. The other 4 `runtime-stream-store.test.ts` failures are exactly that: EBUSY on `project.million/project.sqlite`, left behind by the timed-out million-event test in the same file.
- There is no assertion failure anywhere in the log.
- Most failures are in `automation-studio/runtime/tests/service-*`: recordings, bootstrap, adaptation, flows. Those are the multi-second service tests.

**Whether the unmodified tree fails the same way.** I did not re-run on the unmodified tree, so this is not proven. It is very likely, because this change cannot reach these tests:
- It touches no `src/`, vitest config or `test` script.
- Vitest runs fluxiq's tests from `src`.
- The only package-level change the tests could see is the `build`/`check` script text.

The t187 Core proposal already recorded that vitest times out under load in Core (about 450 s for `pnpm test`), and the machine was loaded throughout this task. The supervisor should re-run `pnpm --filter fluxiq test` on an idle machine, or on `dev`, to confirm.

## Not verified

- **Which files the structure audit reads**, beyond reading its code. Its only listing is `git ls-files -co --exclude-standard` in `repository-files.mjs`, the same set my listing uses; it also loads `typescript`, which the installed lockfile covers. It has no compiler to ask, so `prove-inputs` cannot prove it.
- **Two real checkouts sharing the store.** Cross-tree restore of the relocatable library builds, and the refusal of rooted entries in another tree, are proven only in scratch checkouts.
- **Downstream's `buildCore` and Lab against this Core.** Not run: no Lab runs, per the brief.
- **Two OS processes contending for one step's lock.** Only in-process concurrency is covered, as ported.
- **Static-generation reads of runtime data by `next build`.** Only nft traces were proved: all traced files are inputs, outputs or installed. A page that reads ignored runtime data during prerender, through a path nft cannot trace, would be missed. None was seen, and the build output shows the routes as dynamic (`ƒ`).
- **Documentation.** Core docs that describe `pnpm build` and `pnpm check` (repository layout, validation) were not updated; they are outside my owned paths.

## Open questions or contradictions found

- **Downstream still touches on reuse.** Its `scripts/build-cache/touch-outputs.mjs`, used by `resolve-core-library.mjs` for `buildCore`, still touches Core's `dist` directory and `dist/index.js` on every downstream reuse. That contradicts requirement 3 from the downstream side. Porting `touch-stale-outputs.mjs` back (the design is meant to be mirrored) would fix it. Downstream's layer over Core's libraries is now redundant with Core's own cache, which makes its misses cheap.
- **The check prefix dominates `pnpm check`.** On a no-change run most of the time is the three `node --test` suites (structure 182, task 20, build-cache 51), launched through three `pnpm` calls. Downstream combined its equivalents into one `node --test` (about 27 s against 36–42 s). I kept Core's `pnpm structure:test && pnpm task:test && pnpm build-cache:test` literally, as the brief says to add `build-cache:test`.
- **An audit line that came and went.** One early `pnpm check` printed `structure-audit: 1 baseline entries can be lowered.` The later runs did not. I did not investigate it, since it lies outside my files.
- **`.next` in the store.** It is 192 MB per web fingerprint, rooted per tree, under the 5 GB cap for Core's namespace. Frequent web edits across several worktrees will cycle the cap faster than downstream's entries do.
