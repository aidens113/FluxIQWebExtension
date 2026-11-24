# t1017 brief: Lab runs that share one Core hold a shared reader lease

Lead: Claude Code. Task t1017. Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t1017/!FluxIQ` and downstream `C:/Users/osrs_/FluxStuff/fxwork/t1017/!FluxIQWebExtension` (branch `task/t1017-core-reader-lease` in both).

Goal: today each Lab run takes Core's real build-step locks exclusively for its whole run (`scripts/lab/core/build-lease/lease.mjs`, called from `scripts/lab/run-lab.mjs` ~line 89, through Core's `scripts/build-cache/index.mjs` `acquireStepLock`). So lanes that share one Core checkout (`C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ`) run one at a time: on 2026-11-24 three paid lanes sat queued on the lease and had to be moved to their own Core trees. Make the run's hold a **shared reader lease**: any number of runs read one Core at once; a Core build (the writer) waits until no reader holds it and readers wait while a build writes, so a build still never replaces Core's dists under a running run.

Design constraints:
- Readers and the writer use one mechanism owned by Core's build cache (Core: `scripts/build-cache/**`); downstream imports it through the existing resolver, never a copy (AGENTS.md: the build-cache engine is Core's, imported).
- Reader holds heartbeat and go stale exactly as the existing step locks do (the 30-minute stale bound, token-owned release, synchronous exit cleanup). A dead reader can never block builds forever, and a live one is never broken.
- No writer starvation: once a build is waiting, new readers queue behind it.
- Every existing caller of `acquireStepLock` (builds, `pnpm task`, the heavy gate's builds) keeps its exclusive behaviour.
- No fixed waits or retry caps added; waits end on the lock state.

Owned paths: Core `scripts/build-cache/**` and its docs section; downstream `scripts/lab/core/build-lease/**`, the lease call in `scripts/lab/run-lab.mjs`, and the lease paragraph of `docs/architecture/testing-facility.md`. Must not touch: the shared Core checkout above, `lab-slots/`, any Lab run, `packages/**` in either repository.

Read first: downstream `scripts/lab/core/build-lease/lease.mjs` and its tests; Core `scripts/build-cache/index.mjs`, the step-lock module it exports, and their tests; Core's agent instructions for `scripts/`.

Acceptance (quote outputs):
- Core build-cache tests pass, including new ones: two readers held at once; a writer waits for both and then runs; a reader waits for a writer; a stale reader is recovered; a new reader queues behind a waiting writer.
- `node --test scripts/lab/core/build-lease/tests/lease.test.mjs` (downstream) passes, with a test of two leases held at once.
- Both repositories' `node scripts/structure-audit.mjs` pass; downstream `scripts/check/core-mirror.mjs` still passes.

Report: `C:/Users/osrs_/FluxStuff/fxwork/t1017/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/t1017-core-reader-lease.md`. No git. No `node -e`. End with the return contract.
