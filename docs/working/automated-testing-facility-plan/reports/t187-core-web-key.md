# t187-core-web-key report (findings 2 and 3)

## Outcome

Done. `tsc -p packages/test-runner/tsconfig.json` exits 0, the 29 core-web-build tests pass, and the 8 cli-llm tests pass.

## What changed and why

Task A (finding 2): the Core web build key no longer depends on Core's HEAD.
- `core-web-build/inputs.ts`: dropped `readHead`/`git rev-parse`; `collectCoreWebBuildInputs(root)` now takes one argument. It adds `lockfileHash`, the sha256 of Core's `pnpm-lock.yaml`. Each built package's hash now covers its `dist` tree plus its `package.json`. Both files are required paths, so a missing one fails as `environment.missing`.
- `types.ts`: `coreHead` became `lockfileHash`, and `packageDistHashes` became `packageHashes` (dist plus manifest).
- `key.ts`: `BUILD_LAYOUT_VERSION` is now 2 and the key material uses `lockfileHash` and `packageHashes`. `cache-root.ts`: comment only, it now says "lockfile" instead of "HEAD".

What the key covers now, checked against what `workspace.ts` stages and `next build` reads:
- The whole `apps/web` tree the staged workspace copies. It excludes `.next`, `node_modules`, `playwright-report`, `test-results` and Core's `next.config.ts`, and includes `src`, `tsconfig.json`, `package.json`, `next-env.d.ts`, `e2e` and any `public/`. `tsconfig.base.json` is also in the key.
- The generated `next.config.mjs` text, which replaces `next.config.ts`.
- The installed Next version.
- The `dist` trees of fluxiq, contracts and client-gateway-websocket. The web app imports only `fluxiq/*` subpaths, all of which resolve into `dist` through `exports`.
- New: each of those packages' `package.json`. **This was a real gap.** The `exports` map decides which dist file each `fluxiq/...` import resolves to, and before this change only HEAD covered it.
- New: `pnpm-lock.yaml`. It is the only input that names the versions of third-party dependencies: React, `@xyflow/react`, `lucide-react`, sqlite3, and the root `@types/node` the workspace links. `node_modules` itself is deliberately not hashed.
- The environment: `build-environment.ts` already strips inherited `FLUXIQ_*`, `NEXT_PUBLIC_*`, `NODE_ENV` and `PORT`, and sets fixed FluxIQ values.

Why dropping `coreHead` is safe: the staged workspace is built only from the inputs listed above. The packages directory is linked, but the build resolves only the three packages' manifests and dists. The web app's own `src` is copied and hashed, and a Core `packages/*/src` change reaches the build only through a rebuilt `dist`, which changes its hash. A commit that changes only Core docs, tests or unbuilt sources now reuses the published build.

Two risks remain, and HEAD never covered either of them:
- An install that has drifted from the lockfile.
- Inherited env vars other than the dropped prefixes, for example `NODE_OPTIONS`.

Task B (finding 3): the dry run reports the Core web build decision.
- New `core-web-build/decision.ts` exports `inspectCoreWebBuild(root, env)` through the barrel. It uses the same `collectCoreWebBuildInputs`, `coreWebBuildKey`, `coreWebBuildCacheRoot` and `readPublishedCoreWebBuild` as the real preparation, and only reads: no mkdir, no lock, no build. It returns `{ key, cached }`.
- `cli.ts`: the dry-run JSON now includes `coreWeb`. For an `existing` target it is `null`, because that target serves no Core web build. For every other target it is the result of `inspectCoreWebBuild(fluxiqRepositoryRoot, env)`. `providerCallCount` is still 0.
- Behaviour change: a Core missing a key input, such as the lockfile, a manifest or a dist, now makes the dry run fail with `environment.missing`, the same way the real run would. Before, the dry run said "ready".

Tests:
- `key.test.ts`: the `coreHead` variant became a lockfile variant, and the field was renamed to `packageHashes`.
- `prepare.test.ts`: the fixture fields were renamed.
- `inputs.test.ts`: the fixture gains a lockfile, package manifests, docs, Core src and tests, and a root `package.json`. New cases:
  - Changing the lockfile or a manifest changes the key.
  - **"two Core commits that differ only outside the build's inputs share one key"**: changes to docs, Core `src` and tests, and the root `package.json` keep the key. That checkout is not a git repository, which shows HEAD is never read. The same commit plus a lockfile change moves the key.
  - A missing lockfile or manifest fails as `environment.missing`.
- `tests/cli-llm.test.ts`: `stubLab` now creates a stub Core and sets `FLUXIQ_CORE_ROOT`. The new test covers three things:
  - A cold dry run prints `coreWeb: { key, cached: false }` with the expected key and creates no cache directory and no test-runs.
  - After a stub build is published for that key, the dry run prints `cached: true`.
  - With the lockfile removed, the dry run exits 1 with `environment.missing`.

## Commands run and observed results

- `mkdir C:/Users/osrs_/FluxStuff/build-slots/b1`: b1 and b2 were both held at first. The loop claimed b1 at 2026-09-30T01:33:11Z, wrote an owner file for t187-core-web-key, and released it at 01:34:20Z.
- `npx tsc -p packages/test-runner/tsconfig.json`: exit 0, no output.
- `node --test --test-concurrency=2 packages/test-runner/dist/core-web-build/tests/*.test.js`: `# tests 29 # pass 29 # fail 0`.
- `node --test --test-concurrency=2 packages/test-runner/dist/tests/cli-llm.test.js`: `# tests 8 # pass 8 # fail 0`, including test 6, "a dry run reports the Core web build it would serve...".
- Read-only check against the real Core: `inspectCoreWebBuild('C:/Users/osrs_/FluxStuff/!FluxIQ')` printed `{"key":"334f47d4c368b77e61eb3a83","cached":false}`. The build is not cached because layout v2 makes every key new.

## Not verified

- No Lab run, browser run or real `next build`, as the brief required. So it is unconfirmed that a v2 key builds and serves.
- I did not run `pnpm lab run ... --dry-run` end to end, which would go through the run-lab prelude.
- I did not run `pnpm check`, the structure audit, or the rest of the test-runner suite.

## Open questions or contradictions found

- The first Lab run after this merges does one full `next build`, because layout v2 invalidates every v1 key. v1 directories under `<core>/.tmp/core-web-build` stay until they are pruned.
- `prepareCoreWebBuild` resolves the default cache root from `process.env`, while the dry run uses the `env` passed to `runCli`. They are the same object in real use, but not in tests.
- The dry run now refuses when Core inputs are missing, for example when Core packages are not built yet. If the prelude normally builds them first, this is fine. If not, the supervisor may prefer a non-fatal report.
- The `cache-root.ts` comment still mentions the runs directory in its history section. That is intentional: it describes the old design.
