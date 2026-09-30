# t192 Core build speed: lane report

Status: **Ready to commit**, as a paired change.

| Side | Tree | Changed |
| --- | --- | --- |
| Core | `C:/Users/osrs_/FluxStuff/fxwork/t192/!FluxIQ`, branch `task/t192-core-build-speed` | `scripts/build-cache/**` (new), and the `scripts` values of the root, `packages/{contracts,fluxiq,client-gateway-websocket}` and `apps/web` `package.json` |
| Downstream | `C:/Users/osrs_/FluxStuff/fxwork/t192/!FluxIQWebExtension` | `scripts/worktree/{cache-delegation.mjs (new), core-build.mjs, pnpm-command.mjs, index.mjs, tests/core-build.test.mjs}` |

Nothing is committed. No product source changed on either side.

These worker reports sit beside this one:

| Report | What it holds |
| --- | --- |
| `t192-bench-before.md` | Baseline timings. |
| `t192-bench-after.md` | After-change timings. |
| `t192-core-cache.md` | The Core port. |
| `t192-core-cache-2.md` | The check prefix, parallel restore and registry-completeness test. |
| `t192-core-build-deferral.md` | Downstream `buildCore` deferring to Core's cache. |

## What was slow, and what changed

Before, Core rebuilt everything on every run:

- Every library build was `tsc -b --clean && tsc -b` plus the declaration rewrite. `fluxiq` alone took 60 s under
  load.
- `next build` ran on every root `build`, taking 98-198 s.
- The `tsc --noEmit` checks were not incremental: `fluxiq` 53 s, web 15 s.

What changed, all following section 5 of the t187 report:

1. **Core `scripts/build-cache/`** is a port of the downstream content-fingerprint cache. Registered steps:
   - builds: `contracts`, `fluxiq`, `client-gateway-websocket`, `web`;
   - checks: the same four `tsc --noEmit`, now with `--incremental` build info under `node_modules/.cache`;
   - the structure audit, run plain only.

   A step is reused only when the sha256 of its inputs, its metadata and its outputs all match the stamp. On a miss
   it runs **byte-for-byte today's command**, `--clean` and the rewrite pass included. So a real change produces
   exactly today's output, and a reuse leaves the output untouched. Tests are never skipped.

   Core-specific rules:
   - **Inputs are git-visible files** (`git ls-files -co --exclude-standard`) plus named ignored inputs: dependency
     `dist`, `apps/web/.env*`, `.next/types` for the web check, and pnpm's installed lock. Runtime data that tests
     write into ignored package directories therefore invalidates nothing.
   - **The web build fingerprints the packages' `src`,** because `transpilePackages` and the tsconfig `paths` point
     `next build` at source. It also fingerprints `NODE_ENV`, every `NEXT_*` variable and every variable
     `next.config.ts` reads.
   - **A reuse does not touch outputs** unless an input is newer than them. The downstream Lab's Core guards read
     `dist` mtimes: a needless touch would read as "Core rebuilt during a run", and a missing one as "stale Core".
   - **Shared store** at `%LOCALAPPDATA%/fluxiq-build-cache`, Core-namespaced, with digest-verified restores that
     copy only the files that differ, 16 at a time. A fluxiq restore into an empty `dist` (4,148 files) went from
     43.6 s to 3.6 s. `.next` embeds the tree's absolute path, so it is stored for its own tree only; a revert there
     still restores it.
   - **Stamps live in `node_modules/.cache/fluxiq-core-build/`,** so they cannot collide with downstream's stamps in
     `fluxiq-build/`.
   - **`prove-inputs.mjs`** runs `tsc --listFilesOnly` for all 8 projects, and reads Next's `.nft.json` traces for
     web. Every file those read must be fingerprinted, or sit in a `node_modules` that a lockfile covers.
   - **Root `build` and `check` run the steps in-process,** in dependency order, with the checks in parallel. The
     three test suites are one `node --test`. A registry test fails if a workspace package's `build`/`check` is
     unregistered or missing from the root lists.
2. **Downstream `buildCore`** (`scripts/worktree/core-build.mjs` with `cache-delegation.mjs`) runs Core's own command
   and lets Core's cache decide, whenever that Core checkout's package script goes through Core's CLI. It notes
   `"build-cache":"delegated"`. There is then one fingerprint of a Core build rather than two, and downstream no longer
   touches Core's `dist` on a reuse. Checkouts on an older Core keep today's path; the decision is made per checkout.

## Before and after

Both columns use the same harness (`C:/Users/osrs_/FluxStuff/fxwork/t192-bench/harness/bench.mjs`, through
`heavy.sh`) on the same disposable pair: Core `f0dbbd6`, downstream `68ec2f80`. The raw data is in
`t192-bench/{before,after}/results.jsonl`.

**Load differed between the phases.** The before phase ran beside 2-4 live Lab lanes (L3-4); the after phase mostly
beside 0-1. The forced full rebuild after the change (`FLUXIQ_BUILD_FORCE=1`, store off) took 124 s, which is the
honest reference for a build with everything changed.

| Command | Pass | Before s | After s |
| --- | --- | --- | --- |
| Core `pnpm build` | first run after the change | 218.4 (cold clone) | 109.7 (libraries restored from the store; web built once for this tree) |
| Core `pnpm build` | no change | 132.4 | **3.1** |
| Core `pnpm build` | edit `packages/fluxiq/src/index.ts` | 146.1 | 133.4 (fluxiq and web rebuilt; contracts and gateway reused) |
| Core `pnpm build` | revert | 210.3 | **3.3** (fluxiq and web restored) |
| Core `pnpm build` | forced full, then no change | not measured | 124.3, then 5.6 (all reused) |
| Core `pnpm check`, which is what Core `task finish` runs | no change | 45.1 | **25.0** |
| Core `pnpm check` | first run | 76.7 | 29.6 |
| Core `pnpm check` | edit-one | 49.4 | 88.9 at first; 89.5 in steady state (see below) |
| Core `pnpm check` | revert | 65.0 | **33.1** (all restored) |
| downstream `task start --worktree --core` | 1 / 2 | 95.2 / 101.2 | 69.3 measured; about **67** composed (see below) |
| Core half of `task start` (3 library builds, fresh worktree) | | 23-37 (the fluxiq store restore alone) | **10.5**, delegated, all restored from Core's store |

**Invalidation, proved three ways:**

- **Unit tests** in `scripts/build-cache/tests/`, on a scratch Core-shaped checkout. An edit to fluxiq `src` rebuilds
  fluxiq and web only, and the revert restores both. Runtime files in ignored directories invalidate nothing. A
  deleted or edited output is rebuilt. Reuse touches nothing.
- **On the real tree:** an edit rebuilt exactly fluxiq and web, with contracts and client-gateway-websocket reused.
  The revert restored them, in 3.3 s on the bench. `git diff` was empty afterwards.
- **By tamper:** I appended to a file in `packages/contracts/dist`. It was restored from the store byte-identical
  (`cmp` confirmed), and its dependents were reused.

**Composing `task start`.** The hook blocks the commit that would let a bench `task start` branch a Core worktree from
the new scripts, so I composed it from measured parts. `task start` took 69.3 s, of which its Core half via the old
downstream path was 12.9 s. The delegated Core half in that same fresh worktree took 10.5 s, with all three packages
restored from Core's store. `diff -rq` against the bench's own `dist` found 0 differences. So 69.3 - 12.9 + 10.5 ≈
**67 s**. The rest of `task start` is two worktree adds, two installs (Core's alone is about 16 s) and the
downstream store restores.

**Edit-one `pnpm check` is not faster, and is noisy:**

| Part | First edit-one run | Steady-state edit-one run |
| --- | --- | --- |
| Structure audit (re-runs on any edit) | 13 s | 20 s |
| `fluxiq:check` | 39.7 s (no incremental build info yet: earlier checks had been restored from the store) | 11.4 s (incremental works) |
| `web:check` | 10.5 s | 16.7 s |
| Combined `node --test` prefix | ≈20 s (estimated) | 37.6 s |

The prefix now includes the cache's own 61 tests. They spawn real git and node processes: about 20 s alone, 59 s at
`--test-concurrency=2`. Before this change the prefix was about 7 s. Two further cuts would need a decision:
- run the node tests in parallel with the package checks;
- make the scratch-git tests cheaper.

Parallelism gave no wall-time gain while the machine was CPU-bound, and moving the audit off "first" would contradict
Core's `AGENTS.md`. So I left both as proposals.

## Validation (observed)

- **Core `pnpm check`** (t192 tree, through `heavy.sh`): exit 0 in 30 s. 263 tests passed, 0 failed. All five cached
  steps were reused, and the audit replayed "passed at fingerprint 528a3fd51218".
- **Core `pnpm build`:** reused all four steps in 4 s. The newest output mtime was identical before and after
  (no-touch verified).
- **Downstream `pnpm check`** (t192 tree): exit 0 in 170 s, with 478 pass, 0 fail, and the audit passed. It was slow
  because Core's rebuilt `dist` changed downstream's inputs.
- **Downstream worktree and task tests:** 131 of 131 pass. A real delegated `buildCore` left `dist` mtimes unchanged.
- **Core `build-cache:test`:** 61 of 61 pass. `prove-inputs` exits 0.
- **Core `pnpm test`: exit 1, and none of the failures comes from this change.**
  - After: 52 fluxiq tests in 27 files failed, all timeouts, EBUSY/ENOTEMPTY cleanup errors on temp SQLite files, or
    one wall-clock budget (870 ms against 500 ms). Before, on the unmodified base: 27 tests in 18 files, of the same
    kinds.
  - I re-ran the 27 failing files at `--maxWorkers=2`: 23 passed. The 4 that still fail all failed on the unmodified
    baseline too: `runtime-stream-store` (the million-event 60 s timeout cascading into EBUSY),
    `service-bootstrap/adaptation`, `service-flows/instruction-readiness` and `service-recordings/proposals`.
  - `@fluxiq/web` never runs under `pnpm -r test`, which stops at the first failure. Run on its own it has one
    failure that already exists on `dev`: `architecture-contract.test.ts` "keeps top-level feature taxonomy explicit
    and closed" does not list `onboarding`, which was added in `eba99aa`. 1626 of 1627 pass.

## Not verified

- **`task start` and `task finish` with the change on `dev`.** The start figure is composed from measured parts.
  Core `task finish` is its `pnpm check` plus the merge; the merge was not timed.
- **Two processes contending for one step's lock.** Only unit tests cover it.
- **The downstream Lab's Core guards against a delegated Core build.** They were not exercised live, because no Lab
  runs were allowed.
- **An idle-machine measurement.**

## For the supervisor

- **Line endings.** Core has no `.gitattributes` and checks out with `core.autocrlf=true`, so its working copies are
  CRLF. Fingerprints hash working-copy bytes. I restored the five edited `package.json` files to CRLF, as git would
  write them. The new `scripts/build-cache/*.mjs` files are LF in this tree, but a fresh checkout will be CRLF; that
  only means this tree's store entries will not match fresh checkouts until the tree is gone.
- **Documentation not updated** (outside the owned paths):
  - Core `AGENTS.md` Validation and `docs/architecture` should describe the cache: `FLUXIQ_BUILD_FORCE`,
    `FLUXIQ_BUILD_CACHE_DIR`, `pnpm build-cache:prove`, and that the audit is cached.
  - The audit prints "1 baseline entries can be lowered". That is informational: `pnpm structure:baseline` would
    record it.
- **The first `pnpm build` after the merge** misses in every tree once, because the cache sources are an input.
  `.next` costs about 190 MB per tree in the store, within the 5 GB cap.
- **Disposable leftovers:** `C:/Users/osrs_/FluxStuff/fxwork/t192-bench/`. It holds the clone pair, bench worktrees
  t191, t192 and t193, their bench-only branches, and `after/t193-dist-aside`. Every push URL is `DISABLED`. Delete it
  when the numbers are no longer needed.
