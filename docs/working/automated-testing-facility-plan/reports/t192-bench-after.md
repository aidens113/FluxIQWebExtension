# t192-bench-after: Core build/check timings after the build-cache change

## Outcome

Done. Every step of `t192-bench/harness/plan-after.md` ran in order, one timed step at a time, through the
unmodified `harness/bench.mjs`. `C:/Users/osrs_/FluxStuff/fxwork/t192-bench/after/results.jsonl` holds 13 rows.
Every step exited 0 except `C.test`, which exited 1 because of test failures. Those failures are load timeouts,
Windows file locks and one timing budget, the same kinds as in the baseline. No step failed because of the bench
environment, so I re-ran nothing.

## What changed and why

- Setup: I byte-copied, with `cp`, the 62 paths in `core-files.txt` from `fxwork/t192/!FluxIQ` into
  `t192-bench/!FluxIQ` (C), and the 5 paths in `ext-files.txt` from `fxwork/t192/!FluxIQWebExtension` into
  `t192-bench/!FluxIQWebExtension` (D). `cmp -s` passed for every file. In C, `git status --short` shows the 5
  `package.json` files plus `?? scripts/build-cache/`. In D, it shows the 4 modified `scripts/worktree/*` files plus
  `?? scripts/worktree/cache-delegation.mjs`. No dependency changed, so I ran no install. I did not clear the shared
  store.
- I added `t192-bench/after/run-step.sh`, a copy of `before/run-step.sh` with the output switched to
  `after/results.jsonl`. It guards against overlapping bench steps.
- For edit-one I appended `// t192 bench edit` to `packages/fluxiq/src/index.ts` in C. After each edit-one pass I
  restored the file with `git checkout --`, and C's status afterwards listed only the setup paths.
- `T.start` created the bench-local task `t193` (`t192-bench/fxwork/t193/{!FluxIQ,!FluxIQWebExtension}`, branch
  `task/t193-bench3`). For T.core-new I copied `core-files.txt` into W = `t192-bench/fxwork/t193/!FluxIQ`, and
  `cmp` passed for every file. I then moved the three `dist` directories to `t192-bench/after/t193-dist-aside/`.
- Both clones' push URLs are still `DISABLED`, which I checked with `git remote get-url --push origin`.

## (1) Timings: before against after

| label | pass | before s | after s | exit before/after | liveMax (after) | buildsMax (after) |
|---|---|---|---|---|---|---|
| C.build | 1 (before: cold clone; after: first after the change) | 218.4 | 109.7 | 0/0 | 0 | 3 |
| C.build | 2 (no change) | 132.4 | **3.1** | 0/0 | 0 | 2 |
| C.build | 3 (edit-one) | 146.1 | 133.4 | 0/0 | 0 | 2 |
| C.build | 4 (revert) | 210.3 | **3.3** | 0/0 | 0 | 1 |
| C.build.forced | 1 (full rebuild, cache off: load reference) | n/a | 124.3 | -/0 | 0 | 2 |
| C.build | 5 (after the forced build) | n/a | 5.6 | -/0 | 0 | 3 |
| C.check | 1 | 76.7 | 29.6 | 0/0 | 0 | 4 |
| C.check | 2 (no change, what Core `task finish` runs) | 45.1 | **25.0** | 0/0 | 1 | 4 |
| C.check | 3 (edit-one) | 49.4 | 88.9 | 0/0 | 1 | 4 |
| C.check | 4 (revert) | 65.0 | 33.1 | 0/0 | 1 | 3 |
| C.test | 1 | 603.9 | 781.2 | 1/1 | 1 | 4 |
| T.start | 1 (bench / bench3) | 95.2 | 69.3 | 0/0 | 0 | 4 |
| T.core-new | 1 | n/a | 10.5 | -/0 | 0 | 4 |

Load caveat: the baseline ran with 2 to 4 live Lab lanes (`liveMax`). The after runs had 0 to 1, but up to 4 build
slots were held. Free RAM before each step was 3.2 to 5.8 GB. The fair reference is C.build.forced at 124.3 s: a
full rebuild with the cache off under today's load, which is close to the baseline's 132 s no-change build. The
drop from about 130 s to about 3 s is therefore the cache, not lighter load.

## (2) build-cache lines per C.build / C.check pass

- **C.build p1:**
  - contracts, fluxiq and gateway: `reuse`/`store` (248 / 2727 / 186 ms). Reason: "restored from the shared store
    (no stamp; 0 file(s) copied)". The dist left by the baseline already matched the store entry, so the cache only
    touched 2 outputs, because `workspace-packages.mjs` or `contracts/dist/index.d.ts` was newer.
  - web:build: `build`/`command` (104,958 ms). Reason: "no stamp; stored in the shared store for this tree only,
    because apps/web/.next/required-server-files.json holds its absolute path … and is not relocatable (2389 files,
    192 MB)". This one step is almost all of p1.
- **C.build p2:** all 4 steps `reuse`/`stamp`, "inputs and outputs match the stamp" (176 / 552 / 146 / 761 ms).
- **C.build p3 (edit-one):**
  - contracts and gateway: `reuse`/`stamp`. The gateway does not depend on the fluxiq edit.
  - fluxiq: `build`/`command`, 34,282 ms, "inputs changed: packages/fluxiq; stored (4149 files, 11.9 MB)".
  - web: `build`/`command`, 97,488 ms, "inputs changed: packages/fluxiq, packages/fluxiq/dist", stored as a
    per-tree entry. The web build is 73% of this pass.
- **C.build p4 (revert):**
  - contracts and gateway: `reuse`/`stamp`.
  - fluxiq: `reuse`/`store`, 1036 ms, "restored from the shared store (inputs changed: packages/fluxiq; 2 file(s)
    copied)".
  - web: `reuse`/`store`, 744 ms, "restored from this tree's entry in the shared store (…; 8 file(s) copied)".
- **C.build.forced p1:** all 4 steps `build`/`command`, "FLUXIQ_BUILD_FORCE=1": contracts 2645 ms, fluxiq
  19,792 ms, gateway 2057 ms, web 98,277 ms.
- **C.build p5:** all 4 steps `reuse`/`stamp`, "inputs and outputs match the stamp" (316 / 799 / 219 / 1803 ms).
  The forced build left valid stamps, as required.
- **C.check p1:** all 5 steps (structure-audit, contracts, gateway, fluxiq, web) `reuse`/`store`, "restored from
  the shared store (no stamp; 0 file(s) copied)", 390 to 1140 ms each.
- **C.check p2:** all 5 steps `reuse`/`stamp`, "inputs and outputs match the stamp", 163 to 538 ms each. The
  remaining 25 s is the uncached `node --test` prefix: 263 tests, 20.6 s by its own `duration_ms`.
- **C.check p3 (edit-one):**
  - structure-audit: `build`, 13,152 ms, "inputs changed: .". Its input is the whole repository.
  - fluxiq:check: `build`, 39,732 ms.
  - web:check: `build`, 10,553 ms, "inputs changed: packages/fluxiq".
  - contracts and gateway: `reuse`/`stamp`.
  - The `node --test` prefix took 22.5 s. The steps run under `--parallel`, and the wall time is 88.9 s.
- **C.check p4 (revert):** structure-audit, fluxiq and web `reuse`/`store`, "restored from the shared store
  (inputs changed: …; 0 file(s) copied)". contracts and gateway `reuse`/`stamp`.

## (3) T.start and T.core-new

T.start p1 (`pnpm task start bench3 --worktree --core`) took 69.3 s, against 95.2 s for the baseline's p1. W is
cut from Core `dev` (f0dbbd6), which does not yet have the change, so D's `build-core-package` lines come from the
extension-side cache, not a delegation:

| package | build-cache | source | reason | ms (before p1 → after) |
|---|---|---|---|---|
| @fluxiq/contracts | reuse | store | restored from the shared store (no stamp) | 323 → 291 |
| fluxiq | reuse | store | restored from the shared store (no stamp) | 22,648 → 12,467 |
| @fluxiq/client-gateway-websocket | reuse | store | restored from the shared store (no stamp) | 182 → 103 |

The extension-side steps in the same run (domain, boundary-audit, real-site-policy, test-contracts, test-matrix,
extension, scenario-lab, agent-orchestrator, test-evidence, test-runner) were all `reuse`/`store`.

T.core-new, which runs D's `buildCore` on W with the change copied in and no dist, took **10.5 s**. All three notes
were `build-cache: "delegated"`, each wrapping Core's own line as expected:

| package | Core note | Core ms | wrapper ms |
|---|---|---|---|
| @fluxiq/contracts | reuse / store, "restored from the shared store (no stamp; 88 file(s) copied)" | 354 | 1768 |
| fluxiq | reuse / store, "restored from the shared store (no stamp; 4148 file(s) copied)" | 4206 | 6057 |
| @fluxiq/client-gateway-websocket | reuse / store, "restored from the shared store (no stamp; 20 file(s) copied)" | 442 | 2224 |

The wrapper ms includes pnpm startup, about 1.4 to 1.9 s per package. Restoring fluxiq through Core's own cache
took 4.2 s, against 12.5 s for the extension-side restore in T.start and 22.6 to 36.0 s in the baseline.

`cmp` result: `diff -rq` (byte comparison) of W's restored `dist` against C's `dist` found 0 differing files for
contracts (88/88 files), fluxiq (4148/4148) and client-gateway-websocket (20/20).

## (4) C.test failures compared with the baseline

The baseline had 18 failing files, 27 failing tests, and a vitest duration of 595.6 s. After the change there were
27 failing files, 52 failing tests, 448 of 475 files passing, and a vitest duration of 769.2 s (collect 644.9 s).
The error mix was:

- 47 × `Test timed out in 15000ms`
- 2 × `Test timed out in 60000ms`
- 11 × `EBUSY` and 2 × `ENOTEMPTY` on temp directories and SQLite files
- 1 assertion: `scale-pages.test.ts` "pages and filters 10,000 Subflow summaries within the local directory
  budget", `expected 869.85 to be less than 500`. This is a wall-clock budget, so it is also a load symptom.

None is a logic assertion, and the change touches no fluxiq source or test. `@fluxiq/contracts` passed (9 files) and
`@fluxiq/client-gateway-websocket` passed (1 file). `@fluxiq/web` tests again never ran, because `pnpm -r` stops at
the first failing package. So the known `architecture-contract.test.ts` / `onboarding` failure was **not seen**
(not reached, and in any case eba99aa is not in this f0dbbd6 base).

All files are under `packages/fluxiq/src/programs/automation-studio/`.

- **Failing in both (15):**
  - run-detail-read/flow-run-detail-reader
  - summaries/run-detail-preservation
  - service-adaptation: adaptive-loop, adaptive-retry-resume, durable-patches, failed-start, modes
  - service-bootstrap/rejections
  - service-flows: execution-digest, instruction-readiness, subflows
  - service-recordings: assets, proposal-approval, proposals
  - storage/project/runtime-stream-store
- **Baseline only (3):** service-flows/subflow-pagination, api/handlers/runs, service-bootstrap/catalog.
- **After only (12):**
  - service-bootstrap: adaptation, permission, plan-parameters, accounting
  - service-flows: scale-pages, runs, flow-map
  - service-adaptation: llm-diagnosis, llm-run-caller, iterating-recovery
  - service-recordings: task-proposals, storage

The run held a build slot while up to 3 others were held (`buildsMax` 4) and free RAM was 3.9 GB. Which files time
out shifts from run to run, which fits a load cause rather than a regression. The full log is
`after/logs/C.test.p1.log`, and an ANSI-stripped copy is `C.test.p1.clean.log`.

## (5) Failures and causes

- **C.test, exit 1:** the load timeouts, file locks and timing budget in section 4. The run got through every file
  in the fluxiq package, 448 of 475 passed, and it stopped before `@fluxiq/web`. This matches the baseline's
  failure class. It is not a bench-environment problem, so I did not re-run it.
- **No other failures.**

## Commands run and observed results

- Every timed step ran as `bash t192-bench/after/run-step.sh <label> <pass> <note> <cwd> <cmd>`, which calls
  `node harness/bench.mjs --out after/results.jsonl …`. The printed JSON rows are the ones tabulated above, and
  `wc -l after/results.jsonl` gives 13.
- The T.core-new command string, passed as one argument so that `bash -c` keeps its quoting, was:
  `node -e "import('file:///C:/Users/osrs_/FluxStuff/fxwork/t192-bench/!FluxIQWebExtension/scripts/worktree/core-build.mjs').then(m => m.buildCore(process.argv[1], { env: process.env }))" 'C:/Users/osrs_/FluxStuff/fxwork/t192-bench/fxwork/t193/!FluxIQ'`
- The build-cache lines above come from `grep '"build-cache"' after/logs/<label>.p<n>.log`.

## Not verified

- I did not re-run C.test at low load, so the flakiness is attributed to load, not proven to be load.
- The `@fluxiq/web` tests did not run in either phase.
- The before/after load differs: the baseline had 2 to 4 live lanes and this run had 0 to 1. C.build.forced is the
  in-phase reference.
- I did not run T.start pass 2, because the after plan asks for only one pass.

## Open questions or contradictions found

- `web:build` is stored "for this tree only", because `.next/required-server-files.json` embeds the absolute path.
  So a first build in any new tree or worktree still pays about 100 s for web, and an edit to fluxiq source also
  rebuilds web, which took 97 s of edit-one's 133 s.
- `pnpm check` has a floor of about 21 s from the uncached `node --test` suites (263 tests), even when every cached
  step is reused.
- `structure-audit:check` fingerprints the whole repository ("inputs changed: ."), so any edit costs about 13 s.
- structure-audit still reports "1 baseline entries can be lowered", as it did in the baseline.
- The `t193` worktrees and `after/t193-dist-aside/` remain in `t192-bench/`. The brief says not to run `task
  finish`.
