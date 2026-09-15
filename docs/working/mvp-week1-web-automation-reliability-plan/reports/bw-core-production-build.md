# bw-core-production-build: serve Lab Core from a cached production build

Worktree: `F:\fxlab\fxlab-prod-core` (detached at `3d6ecd6`). Core worktree read
only: `F:\fxlab\!FluxIQ` (`19468b7`, Next 15.5.23). Nothing was committed.
`F:\!FluxIQWebExtension` and `F:\!FluxIQ` were not touched.

## Outcome

Done, with one limit. No `next build` or `next start` was run, because the brief
forbids them, so nothing here proves that the real build succeeds or that a
real server comes up from it.

What is done and checked:

- Isolated topology and the persistent demo start Core with
  `next start --hostname 127.0.0.1 --port <port>`. They serve a production build
  that is cached per build key and shared read-only by every run in one runs
  directory.
- The build is staged, locked, marked complete and published atomically. A
  failed, interrupted, or half-written attempt is never reused.
- A startup failure's process logs now reach the evidence bundle.

The package's own type check passes. 54 of 55 focused tests pass. The one
failure is environmental: `apps/scenario-lab/dist` is not built in this
worktree. All 19 mutation proofs were caught, and every mutated file was
restored byte for byte.

Premise correction noted (from the supervisor). The W14 `project.select`
timeout was the first `selectProject` during topology startup, which was the
first request to that route on a fresh dev server, before any browser. That is
a first-hit compile on a dev server, which a production build removes.

## What changed and why

New directory `packages/test-runner/src/core-web-build/`. Each file exports one
thing and has a barrel; its tests are in `tests/`.

- `types.ts`: `CoreWebBuildInputs` and `CoreWebBuild`.
- `key.ts`: `coreWebBuildKey(inputs)` hashes every input with SHA-256 and keeps
  24 hex characters. Package order does not matter. The hash includes a layout
  version, so a change to the build layout invalidates old builds.
- `inputs.ts`: `collectCoreWebBuildInputs(root)` collects these inputs:
  - Core `HEAD`, from `git rev-parse --verify HEAD`.
  - A content hash of the `apps/web` entries the staged copy takes, plus
    `tsconfig.base.json`.
  - A content hash of each of `packages/{client-gateway-websocket,contracts,fluxiq}/dist`.
  - The generated `next.config.mjs` text.
  - The installed `next` version.

  A missing path fails as `environment.missing`, as before.
- `content-hash.ts`: a deterministic directory hash. Paths are sorted, and each
  file contributes its path, size and bytes. The copy filter prunes entries at
  any depth.
- `next-config.ts`: `generatedNextConfig`, the config text moved unchanged out
  of `coordinator.ts`.
- `workspace.ts`: `prepareWebWorkspace` and `isCopiedWebEntry`, moved from
  `coordinator.ts` with the same layout and behaviour. The build is now its only
  caller.
- `required-paths.ts`: `requireTopologyPaths`, with the same
  `environment.missing` message as before.
- `build-environment.ts`: `coreWebBuildEnvironment(fluxiqRoot)`. The build gets
  its own FluxIQ root inside the attempt and `FLUXIQ_CLIENT_GATEWAY_ENABLED=false`.
  Provider secrets are dropped, along with any inherited `FLUXIQ_*`,
  `NEXT_PUBLIC_*`, `NODE_ENV` and `PORT` values. Nothing the key does not cover
  can reach the build, and prerendering can neither bind a port nor touch a
  run's data.
- `publication.ts`: the publication protocol.
  1. The attempt directory `b-<12 hex>` is created create-only and never moved.
  2. After `next build` exits 0 and `.next/BUILD_ID` is valid, the attempt
     receives `build-complete.json` (`{schemaVersion, key, buildId}`).
  3. Only then does the key directory receive `published.json`
     (`{schemaVersion, key, attempt}`).

  Both records are written to a temporary file (`wx`), synced, and renamed into
  place. A reader accepts a build only when the pointer's key and attempt name,
  the marker's key and `buildId`, and `BUILD_ID` all agree.
- `prepare.ts`: `prepareCoreWebBuild(options)`. The cache lives in
  `<runsDirectory>/.core-web-build/<key>/`.
  1. If a valid build is published, reuse it.
  2. Otherwise, take `.operation.lock` through `workspace-lock.ts`. Stale-owner
     recovery comes from that module; liveness is observed through its
     `isProcessAlive` hook.
  3. If a live owner holds the lock, poll every 1 s for the publication, for at
     most 12 minutes.
  4. With the lock held, check the publication again, then stage, build,
     verify, mark, publish, and release.

  Two further rules:
  - If the lock cannot be read, keep polling for up to 10 s. This covers
    `workspace-lock.ts`, which creates the file before writing the owner record.
    After 10 s, fail closed; the lock is never reclaimed.
  - The build runs through the run's `ProcessSupervisor` with
    `next build --turbopack`, `cwd` set to `<attempt>/apps/web`, a new 10-minute
    bound, and output only to the building run's log.

  Every failure is a closed `RunnerFailure` whose message names no process
  output. A build failure is `process.startup` "Core web panel production build
  did not succeed".
- `server-process.ts`: `coreWebServerProcessSpec` returns the `next start`
  `ProcessSpec`, with `cwd` set to the build's `webDirectory` and the run's own
  port, environment and log path.

`packages/test-runner/src/coordinator.ts`:

- Replaced the per-run `prepareWebWorkspace` call with `prepareCoreWebBuild`,
  at the same point in startup. Its log is `logs/core-web-build.log`.
- `fluxiq-web` now uses `coreWebServerProcessSpec`. The env from
  `buildFluxIQEnvironment`, the `core.health` readiness wait, the snapshot probe
  and `logs/core.log` are unchanged.
- Added `TopologyDependencies.prepareCoreWebBuild?`, for tests.
- Item 6: added `TopologyOptions.copyStartupFailureLogs?(logsDirectory)`. Both
  startup catches, isolated and existing, call it after `supervisor.cleanup()`
  and before `removeAllocatedRunRoot`. Its errors are swallowed, so the primary
  failure is kept.
- Removed `prepareWebWorkspace` and `mirrorNodeModules`, which moved to
  `workspace.ts`.

`packages/test-runner/src/demo-workspace/core-process.ts`:
`withPersistentDemoCore` calls
`prepareCoreWebBuild({ runsDirectory: config.runsDirectory, ... })`, logging to
`<sessionId>-core-web-build.log`. It starts `demo-fluxiq-web` through
`coreWebServerProcessSpec`. Its env, readiness wait, snapshot probe, gateway
wait and log path are unchanged.

`packages/test-runner/src/run-scenario.ts`: one line changed, line 160, the
`topology = await startTopology({ ... })` call. I inserted
`copyStartupFailureLogs: logsDirectory => copyProcessLogs(bundle, logsDirectory), `
immediately after `hostModulePath: labPaths.hostModulePath, `. Nothing else in
the file changed.

A startup failure's logs now go through the same `copyProcessLogs` path as a run
that started, which is `bundle.writeText`: `redactText` plus
`assertNoSensitiveText`. They are also covered by the same redaction
attestation, `attestRunRedaction` over the bundle staging path, which is not
gated on `topology`. The existing ordering assertions in `runner-wiring.test.ts`
(`indexOf("await copyProcessLogs(bundle, ")`) are unaffected, because the new
call site has no `await`.

Tests:

- `core-web-build/tests/key.test.ts`: key derivation, one test per input.
- `core-web-build/tests/inputs.test.ts`: real files. Each input moves the key,
  excluded entries do not, and a missing dist fails as `environment.missing`.
- `core-web-build/tests/prepare.test.ts`:
  - three concurrent callers build once, with nothing published during the
    build and the lock released;
  - reuse of a published build;
  - a failed build that left a `BUILD_ID` is not published, and the next call
    uses a fresh attempt;
  - no `BUILD_ID` means rejection;
  - five partial or mismatched records are not reused, and a complete one is;
  - a dead-owner lock is reclaimed;
  - a live-owner wait is bounded;
  - an empty lock is waited out, and a lock that stays unreadable fails closed;
  - through a real `ProcessSupervisor` with a fake spawn: the `build --turbopack`
    args, `cwd` and build env, and raw stderr that stays in the log and out of
    the failure.
- `core-web-build/tests/server-process.test.ts`: the `next start` spawn spec.
- `core-web-build/tests/build-environment.test.ts`: the build env.
- `tests/coordinator-existing.test.ts`: two new tests.
  - An isolated startup that fails at `core.health` hands `core.log` and
    `scenario-lab.log`, with their content, to the caller before the run root is
    removed. Core is spawned as `start --hostname 127.0.0.1 --port <PORT>`, in
    the build's `webDirectory`, with the per-run `FLUXIQ_ROOT`.
  - A source assertion that `run-scenario.ts` wires `copyStartupFailureLogs` to
    `copyProcessLogs(bundle, ...)`.
- `demo-workspace/tests/core-process.test.ts`: a source assertion that the demo
  uses `prepareCoreWebBuild` with `config.runsDirectory` and
  `coreWebServerProcessSpec`, and never `"dev"`, `--turbopack` or
  `prepareWebWorkspace`.

`docs/architecture/testing-facility.md`:

- Rewrote the isolated topology paragraph and tree.
- Added the subsection "Core web panel production build": the key, the layout,
  the publication records, the lock and wait bounds, runtime writes, and
  startup-failure logs.
- Updated the persistent-isolated tree.
- Updated the demo prose about the Core process and `.sessions`.

## Answers to item 5 (Next 15.5.23, `F:\fxlab\!FluxIQ\node_modules\.pnpm\next@15.5.23_...\node_modules\next\dist`)

### Does `next start` write into `.next` at runtime?

Yes, but only through two features, and Core's panel currently uses neither.

1. **The incremental cache.**
   - `server/next-server.js:660-680`: `getIncrementalCache` builds an
     `IncrementalCache` with
     `flushToDisk: !this.minimalMode && this.nextConfig.experimental.isrFlushToDisk`.
   - `server/config-shared.js:168` sets the default `isrFlushToDisk: true`.
   - `server/lib/incremental-cache/index.js:103-108` selects `FileSystemCache`
     when `fs` and `serverDistDir` are present.
   - `server/lib/incremental-cache/file-system-cache.js:233-289` (`set`) writes
     through `MultiFileWriter`. App routes go to `.next/server/app/<key>.body`
     and `.meta`; app pages to `.html`, `.rsc` or `.prefetch.rsc`, `.meta`, and
     segment files. Fetch entries go to `.next/cache/fetch-cache/<key>`, per
     `getFilePath` at `:291-296`.
   - `get` of a fetch entry whose tags changed also calls `set`
     (`file-system-cache.js:96-116`).
2. **The image optimizer.** `server/image-optimizer.js:664` uses the cache
   directory `.next/cache/images`. Writes are at `:739`, through
   `writeToCacheDir` (`:246-257`, `mkdir` then `writeFile`), and deletions at
   `:283-284`.

Not written by `next start`:

- **Trace file.** `trace/report/to-json.js` (`reportToLocalHost`) returns unless
  both the `distDir` and `phase` trace globals are set. `distDir` is set only in
  `build/index.js:401`, `cli/next-dev.js:210`, `server/dev/next-dev-server.js:242`
  and `server/lib/router-utils/setup-dev-bundler.js:146`.
- **Telemetry storage.** It is created only under `opts.dev`
  (`server/lib/router-server.js:122-127`). Telemetry could write
  `_events.json` into `.next` via `telemetry/storage.js:169-172`, but that
  object is never created under `next start`.
- **Route type files.** `server/lib/router-utils/route-types-utils.js` is called
  only from `build/index.js`, `cli/next-typegen.js` and `setup-dev-bundler.js`.
- **Start-up flushes.** `server/lib/start-server.js`: the `flushAllTraces` at
  `:240` sits inside `if (isDev)` at `:233`.
- **Entry preload.** Production preloads entries (`next-server.js:535`,
  `preloadEntriesOnStart` defaulting to true at `config-shared.js:153`), which
  only reads.

Core usage: a grep of `F:\fxlab\!FluxIQ\apps\web\src` found no `revalidate`,
`force-cache`, `next: {revalidate}`, `unstable_cache`, `"use cache"`,
`revalidatePath` or `revalidateTag`, `generateStaticParams`, `next/image`,
`export const dynamic`, or `NEXT_PUBLIC_`. The only `await fetch(` sites are the
client components `AuthShell.tsx` and `GlobalClientGatewayPairing.tsx`. So no
runtime writes into `.next` are expected. This was not observed on a live
server.

### Are two concurrent servers from one build directory safe?

Yes for Core's panel as it is today. Not in general.

- **Reads are safe.** The manifests and chunks are only read. `next start` takes
  no lock on the build directory: a grep for `lockfile`, `.lock` and `lock(`
  across `cli/next-start.js`, `server/lib/start-server.js`,
  `server/next-server.js` and `server/lib/router-server.js` found nothing.
- **Writes are not coordinated.**
  - `lib/multi-file-writer.js` calls `fs.mkdir` and then `fs.writeFile` directly
    on the final path, with no temporary file and no rename.
  - `file-system-cache.js:242` writes whenever `flushToDisk` is set.
  - Two servers regenerating the same page, or caching the same fetch, can
    interleave their writes. Another process can read a partly written file, and
    the image cache has the same exposure.

  This becomes unsafe as soon as Core adds revalidated pages, cached `fetch`, or
  `next/image`.
- **Mitigations, not applied.**
  - `experimental: { isrFlushToDisk: false }` in the generated config. `set`
    then returns before writing (`file-system-cache.js:242`); reads of
    prerendered app pages and routes still use disk, since only fetch reads are
    gated, at `:96`. The image cache is unaffected. This would change the key
    and depart from Core's own config.
  - A per-run copy of `.next`.

## Commands run and observed results

All commands ran one process at a time. Tests used `--test-concurrency=1`.

1. `pnpm check` in `packages/test-runner`. Its `domain:dist` step built
   `domain/dist`, which was absent: `clean-dist: removed 0`, then
   `rewrite-dist-specifiers: 394 specifier(s) in 121 file(s)`. `tsc` then exited
   2, with only `TS2307: Cannot find module '@fluxiq-web-extension/test-evidence'`
   (and dependent `TS7006`) in `browser-evidence.ts`,
   `effective-evidence-policy.ts`, `inspect.ts`, `process-supervisor.ts`,
   `create-run-manifest.ts`, `run-scenario.ts` and `tests/inspect.test.ts`. The
   cause was missing test-evidence dist declarations. No error was in a file I
   changed.
2. `npx tsc -p tsconfig.json` in `packages/test-evidence`: `exit=0`.
3. `pnpm check` in `packages/test-runner`: `exit=0`.
4. `npx tsc -p tsconfig.json` in `packages/test-runner`, to build dist:
   `exit=0`.
5. Focused tests, first run:
   `node --test --test-concurrency=1 dist/core-web-build/tests/*.test.js dist/tests/coordinator-existing.test.js dist/tests/coordinator-persistent.test.js dist/demo-workspace/tests/core-process.test.js dist/run-evaluation/tests/runner-wiring.test.js dist/tests/workspace-lock.test.js`.
   Result: 7 passed. Six files failed to load with `ERR_MODULE_NOT_FOUND` for
   `@fluxiq-web-extension/test-contracts/dist/index.js`; that package's `import`
   export targets `dist`, which was not built.
6. `npx tsc -p tsconfig.json` in `packages/test-contracts`: `exit=0`.
7. The same focused tests: `tests 55, pass 54, fail 1`.
   - The failure was `runner-wiring.test.js`, "a Flow-lane run of a workflow
     whose script records no action is refused as fixture.invalid...", with
     `actual 'environment.missing'`, `expected 'fixture.invalid'`.
   - The probe `node <scratchpad>/bw-core-build-probe.mjs refusal` printed
     stage `scenario.load`, reason `path.missing`, and the chain
     `RunnerFailure: Scenario Lab build is missing: F:\fxlab\fxlab-prod-core\apps\scenario-lab\dist\registry.js`.
   - That is an unbuilt fixture in this worktree, reached before any code I
     changed. Every other test passed, including all new tests and
     `coordinator-persistent`, `workspace-lock` and `core-process`.
8. `node --version`: `v22.11.0`.
9. Mutation proofs, `node <scratchpad>/bw-core-build-mutations.mjs`. Each
   mutation edits one guard, runs the test file that must catch it, restores
   the original bytes and checks the SHA-256. Mutations M1-M17 edit compiled
   `dist`; M18 and M19 edit `.ts` sources that the tests read. Every line
   reported `CAUGHT ... restored=true`, and the run ended
   `all mutations caught and restored`, `mutation-exit=0`.
   - M1: the key leaves out the Next version.
   - M2: the contracts dist is not hashed.
   - M3: the lock is bypassed. 4 tests fail.
   - M4: a failed build is swallowed.
   - M5: the `BUILD_ID` guard is removed.
   - M6: the completion marker is skipped.
   - M7: the publication key check is removed.
   - M8: dead owners are reported alive.
   - M9: the wait deadline is removed. See step 10.
   - M10: the settle window is removed.
   - M11: the build gateway is enabled.
   - M12: prefix stripping is removed.
   - M13: `build` becomes `dev`.
   - M14 and M15: `start` becomes `dev --turbopack`, in the unit test and in the
     coordinator test.
   - M16: the log hook is removed.
   - M17: the run root is removed before the copy.
   - M18: the `run-scenario.ts` wiring is removed (source).
   - M19: the demo uses `workspaceDirectory` (source).
10. M9 first ran `CAUGHT exit=SIGTERM`: with the deadline removed, the live-lock
    test hung until the 90 s harness timeout. I changed the test so the fake
    owner stops being alive after a bounded number of checks; an unbounded wait
    then builds and fails the assertion instead of hanging. The rebuild
    (`tsc-exit=0`) and `prepare.test.js` (`tests 9, pass 9, fail 0`) passed, and
    the full mutation run again reported all 19 caught and restored. M9 then
    reported `exit=1 failingTests=0`, which is a 5 s test-timeout cancellation
    rather than an assertion failure. The threshold was lowered from 400 to 100
    checks; the rerun result is recorded below.
11. `node <scratchpad>/bw-core-build-probe.mjs inputs`, read-only against
    `F:\fxlab\!FluxIQ`:
    `{"firstMs":564,"secondMs":159,"key":"76b9eef1eff77fd76e29a1fe","stableKey":true,"coreHead":"19468b72c4472fd5cc58940737702d5e4d72c985","nextVersion":"15.5.23","packages":["client-gateway-websocket","contracts","fluxiq"],"nextExecutable":"next.cmd"}`.
12. `node scripts/structure-audit.mjs`: `5 violation(s) across 3 rule(s)`. None
    is in a file I changed.
    - `directory-files packages/test-runner/src/tests/: 50` against a baseline
      of 49. The directory already held 50 files at `3d6ecd6`; I added none.
    - `imports` in `bench/shard-merge.ts`, `bench/tests/shard-merge.test.ts` and
      `facility-failure/project-facility-failure.ts`.
    - `working-docs docs/working/README.md` out of date.

    No finding names `core-web-build`, `coordinator` or `core-process`.
13. `git diff -U0 -- packages/test-runner/src/run-scenario.ts`: a single hunk,
    `@@ -160 +160 @@`, as described above.

14. Final verification after lowering the M9 threshold from 400 to 100 checks:
    - rebuild: `tsc-exit=0`;
    - focused set: `tests 55, pass 54, fail 1, cancelled 0`, where the one
      failure is the same environmental `runner-wiring` refusal test and "waiting
      on a live builder is bounded..." passes in 69 ms;
    - full mutation rerun: every one of M1-M19 reported
      `CAUGHT exit=1 ... cancelledTests=0 restored=true`, M9 now as
      `failingTests=1 cancelledTests=0`, ending `all mutations caught and restored`,
      `mutation-exit=0`;
    - `git status --short` afterwards showed only my files plus the other
      agent's `machine-slots` files.

## Not verified

- **The real build and server.** No `next build` or `next start` was run
  (forbidden). Unverified:
  - that `next build --turbopack` succeeds in the staged attempt layout, and how
    long it takes against the new 10-minute bound;
  - that `next start` from `<attempt>/apps/web` resolves server externals such
    as `sqlite3` through the mirrored `node_modules` junctions;
  - that nothing in the build output depends on the attempt path;
  - whether build-time prerendering constructs the FluxIQ runtime at all (the
    build env is defensive).
- **The production login cookie.** With `NODE_ENV=production`, Core's login
  sets a `secure` cookie (diagnosis §3). Neither the runner's Node-side cookie
  handling nor the browser panel over `http://127.0.0.1` was verified under
  `next start`. The first live run should check login and panel pairing.
- **Real multi-process concurrency.**
  - Tests use in-process concurrency (one PID) and injected liveness. Separate
    shard processes contending for the lock were not run.
  - When several waiters reclaim a stale lock at once, `workspace-lock.ts`'s
    quarantine and restore could, in rare interleavings, admit two owners. Two
    complete attempts would then build. The last publication wins, and both are
    valid.
- **The demo path.** `withPersistentDemoCore` is covered only by the source
  assertion and the shared unit tests; it was not executed.
- **The default HEAD reader.** `readGitHead`, the default `git rev-parse`, is
  not unit-tested. It was exercised only by the read-only inputs probe.
- **Atomic record writes.** Temporary-file-then-rename is atomic by
  construction, but no unit test can observe it, so it has no mutation proof.
- **Broader suites.** The full `packages/test-runner` suite, the root `pnpm
  check` and the Windows build-path lengths of a real build were not run or
  measured.
- **Core's live logs.** I read no log from a failing run. W14's cause is taken
  from the diagnosis and the supervisor's correction.

## Open questions or contradictions found

1. **Another agent is editing this worktree.** `git status` shows changes I did
   not make:
   - modified: `packages/test-runner/src/bench/campaign/machine-slots/acquire-machine-cell-slot.ts`,
     `machine-slots/index.ts` and `machine-slots/tests/acquire-machine-cell-slot.test.ts`;
   - new: `machine-slots/cached-owner-liveness.ts`, `machine-slots/pid-presence.ts`
     and their tests.

   I did not touch them. My check, builds and tests ran with those in-progress
   edits present. Mutations M18 and M19 briefly edited `run-scenario.ts` and
   `core-process.ts`, for about 2 s each, and restored them with verified
   hashes, while that agent may have been compiling.
2. **New bounds.** The brief says "no widened timeouts". These bounds are new
   rather than widened, and the supervisor should confirm the values:
   - build: 10 min;
   - waiter: 12 min (build plus 2 min);
   - unreadable-lock settle: 10 s;
   - lock poll: 1 s.
3. **Two cache locations.**
   - `isolated` and `clone` runs pass `<runs>/.work` to `startTopology`, so
     their cache is `<runs>/.work/.core-web-build`.
   - `persistent-isolated` and the demo use `<runs>/.core-web-build`.

   A machine using both builds twice per key. `run-scenario.ts` could pass one
   shared location through a new topology option; that is not done, since it is
   outside item 6.
4. **`workspace-lock.ts` limits.** It creates the file and then writes the
   owner, so concurrent waiters can see an empty, "malformed" lock. That is
   handled with the 10 s settle window. Two cases remain:
   - A crash between create and write leaves an empty lock that fails every
     later run for that key closed until someone removes it by hand.
   - Its error messages say "Persistent workspace". They surface only as the
     `cause`.

   A lock that writes the record before linking it into place would remove both
   issues. `workspace-lock.ts` is outside my paths.
5. **No cleanup of failed attempts.** Failed and unpublished attempts are never
   removed automatically, so disk use grows with each failure: a web copy plus
   `.next`, per attempt.
6. **Package barrel change.** `prepareWebWorkspace` left `coordinator.ts`, so
   `src/index.ts` (not mine) no longer exports it. The only consumer found was
   `core-process.ts`, now migrated. `core-web-build` is not re-exported from the
   package barrel.
7. **Extra rebuilds.** The web source hash covers everything the copy takes,
   including untracked `coverage/` or `.turbo/` under Core's `apps/web`. Tooling
   that writes there changes the key and causes a rebuild, never stale reuse.
   Live campaigns need a clean Core anyway.
8. **Concurrent-server safety depends on Core.** Serving one build from several
   servers is safe only while Core's panel uses no revalidated pages, cached
   `fetch` or `next/image` (see the answers above). Adding
   `experimental.isrFlushToDisk: false` to the generated config is the cheap
   guard, if wanted.
9. **Leftover empty directories.** `allocation.ts` (not mine) still creates an
   empty `core-workspace/apps/web` per run, and the demo still creates its empty
   `c/a/w`. Both are harmless.
10. **Stale comment.** `removeDemoSession`'s comment mentions junctions inside a
    session. Sessions no longer contain any, but the safety property it
    describes still holds.
11. **Refusal-test failure in this worktree.** `runner-wiring`'s refusal test
    fails only because `apps/scenario-lab/dist` is unbuilt here. It was not
    rerun against the unchanged code; the failure chain stops at
    `Scenario Lab build is missing`, before `startTopology`.

## Supervisor change 1: one Core web build cache for every mode

### Outcome

Done. `isolated` and `clone` runs now share `<runs>/.core-web-build`, the same
cache `persistent-isolated` runs and the demo use. This resolves open question
3 above.

- Allocation and `.work` semantics are unchanged: the topology still allocates
  runs below `<runs>/.work`.
- The demo still passes `config.runsDirectory`.
- As instructed, nothing changed for the bounds (provisionally approved),
  `isrFlushToDisk`, pruning failed attempts, or `workspace-lock.ts`.

### What changed

- **`packages/test-runner/src/coordinator.ts`**
  - New option `TopologyOptions.coreWebBuildRunsDirectory?: string`, documented
    as the runs directory whose `.core-web-build/` holds the build every mode
    shares. It defaults to `runsDirectory`.
  - The `prepareCoreWebBuild` caller in `startTopology` now passes
    `runsDirectory: options.coreWebBuildRunsDirectory ?? runsDirectory`.
- **`packages/test-runner/src/run-scenario.ts`** — the exact change is still on
  line 160, the `topology = await startTopology({ ... })` call. After
  `runsDirectory: topologyRunsDirectory, ` I inserted
  `coreWebBuildRunsDirectory: options.runsDirectory, `, before `runId, seed`.
  `git diff -U0` still shows one hunk, `@@ -160 +160 @@`. That line now carries
  both inserted options, this one and `copyStartupFailureLogs` from item 6.
  Nothing else in the file changed.
- **`packages/test-runner/src/tests/coordinator-existing.test.ts`**
  - The isolated startup-failure test now calls `startTopology` the way
    `lab run` does: `runsDirectory` is `<root>/owned-runs/.work`, and
    `coreWebBuildRunsDirectory` is `<root>/owned-runs`. The stubbed
    `prepareCoreWebBuild` records the `runsDirectory` it receives, and the test
    asserts it equals `[<root>/owned-runs]`. The run-root and `FLUXIQ_ROOT`
    assertions now use the `.work` path.
  - The source test also asserts that `run-scenario.ts` passes
    `runsDirectory: topologyRunsDirectory, coreWebBuildRunsDirectory: options.runsDirectory,`.
- **`docs/architecture/testing-facility.md`**
  - The isolated tree entry is now `test-runs/.core-web-build/<key>/`,
    "production build shared by every mode".
  - The cache-location prose now says every mode shares
    `.core-web-build/<key>/` below the user-visible runs directory (`test-runs`,
    or `FLUXIQ_TEST_RUNS_DIR`). `lab run` passes that directory to the topology
    as `coreWebBuildRunsDirectory`, because `isolated` and `clone` topologies
    allocate below `test-runs/.work`.
  - The persistent tree and demo prose already named `test-runs/.core-web-build`.
- **Mutation script** (`<scratchpad>/bw-core-build-mutations.mjs`): added two
  proofs.
  - M20 edits `dist/coordinator.js`, turning
    `runsDirectory: options.coreWebBuildRunsDirectory ?? runsDirectory,` into
    `runsDirectory,`.
  - M21 removes `coreWebBuildRunsDirectory: options.runsDirectory, ` from
    `src/run-scenario.ts`.

  Both are checked by `dist/tests/coordinator-existing.test.js`.

### Commands run and observed results

One process at a time.

1. `pnpm check` in `packages/test-runner`: `check-exit=0`.
2. `npx tsc -p tsconfig.json`: `tsc-exit=0`.
3. The focused set (the same command as step 5 above), with
   `--test-concurrency=1`: `tests 55, pass 54, fail 1, cancelled 0`.
   - The one failure is the same environmental `runner-wiring` refusal test:
     `apps/scenario-lab/dist` is not built in this worktree.
   - Both "an isolated startup failure hands every process log to the
     caller..." and "lab run sends a startup failure's process logs..." passed.
4. `node <scratchpad>/bw-core-build-mutations.mjs`: 21 mutations. Every line
   reported `CAUGHT exit=1 ... cancelledTests=0 restored=true`.
   - `M20 coordinator builds under coreWebBuildRunsDirectory: CAUGHT exit=1 failingTests=1`.
   - `M21 run-scenario passes its runs directory (source): CAUGHT exit=1 failingTests=1`.
   - The run ended `all mutations caught and restored`, `mutation-exit=0`.
5. `git diff -U0 -- packages/test-runner/src/run-scenario.ts`: one hunk,
   `@@ -160 +160 @@`, whose `+` line contains
   `runsDirectory: topologyRunsDirectory, coreWebBuildRunsDirectory: options.runsDirectory, runId, ...`.
6. `grep -rn "\.work/\.core-web-build"` over `docs/architecture/testing-facility.md`
   and `packages/test-runner/src`: `none`.
7. `node scripts/structure-audit.mjs`: the same 5 pre-existing violations as
   before, none naming `core-web-build`, `coordinator` or `core-process`.

### Not verified

- **Real runs.** No `lab run` was executed, so the shared location is proven
  only by the coordinator test with a stubbed build and by the source assertion
  on `run-scenario.ts`.
- **`clone` runs.** They reach `startTopology` through the same line 160 call
  with an isolated topology target, so they pass the same option. No
  clone-specific test covers it.
- **Two build logs.** A run that builds still logs to its own
  `logs/core-web-build.log`, which is copied into its bundle. Runs that only
  wait or reuse have no build log. That is unchanged by this move.

### Open questions or contradictions found

- **Moved caches.** A cache already created under `<runs>/.work/.core-web-build`
  by this branch's earlier code is no longer read. None should exist, since no
  real Lab run used this worktree.
- **Callers other than `lab run`.** They get the default: `runsDirectory` is
  used when `coreWebBuildRunsDirectory` is omitted. `interactive-session`, the
  bench, or any direct `withTopology` caller passing a `.work`-style directory
  would still get a cache below it. `run-scenario.ts` is the only caller found
  that passes `.work`; I did not audit other `startTopology` callers, because
  the brief confined this change to `run-scenario.ts`.
- **Other worker.** The other agent's `machine-slots` changes were still present
  in `git status`, and I did not touch them. M21 briefly edited
  `run-scenario.ts` and restored it with a verified hash.
