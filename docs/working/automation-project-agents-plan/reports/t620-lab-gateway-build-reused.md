# t620 lab-gateway-build-reused — worker report

## Outcome

Done. Both Lab defects behind the A8 canary `run-mv93ywox-9b5aa220` `process.startup` failure are fixed in the t620 worktree. Nothing is committed.

## What changed and why

1. **The gateway server is reused when its receipt is current** (`core-web-build/server-adapter.ts`).
   `serverAdapterBuild.prepare` now calls `expectedServerAdapterIdentity(root)` first. This is the same strict check that `validateCopy` and every run already make: the receipt must name exactly the current source inventory, every source's SHA-256 must match, `sourceInputsDigest` must match, and the normalized artifact digest must match. If the check passes, the generator is not run. The step appends `[reused] ...` to `<log>.gateway-server.log` and returns `"reused"`. If the check fails (stale or missing), the generator runs and the strict check runs again afterwards, as before, and the step returns `"generated"`.
   - This is safe to reuse because Core's generator (`build-client-gateway-server.mjs` with `stampServerBuildIdentity`) refuses to stamp a bundle that reached any non-`node_modules` source outside that inventory. `pnpm-lock.yaml` is in the inventory and covers `node_modules`, and `fluxiq/*` is external to the bundle.
   - Cache-key collection is unaffected: the key already uses the source digest (`gateway-sources.ts`), not the artifact.
   - `validateCopy`, `hasArtifacts` and `expectedServerAdapterIdentity` are unchanged.
2. **Startup builds are bounded by progress, not by a fixed limit** (new file `core-web-build/build-step.ts`, `runBoundedBuildStep`).
   - It uses `supervisor.start(spec)`, so the child stays registered and the run's cleanup stops it. Because of that, `process-supervisor.ts` did not need a progress hook and is untouched.
   - Every stdout or stderr chunk restarts a quiet bound. A ceiling backs it up.
   - A timeout raises `RunnerFailure("process.startup", "Lab startup failure: build step <name> printed nothing for N s ... after M s in all; the run's cleanup stops it")` with details `{ process, step, bound: "quiet"|"ceiling", limitMs, elapsedMs }`.
   - A non-zero exit still fails at once.
   - The function is exported from the barrel.
3. **The `supervisor.run(..., <ms>)` build steps in `core-web-build/`** (there are only two):
   - `gateway-server-build` (`server-adapter.ts`) was a fixed 60 000 ms. It is now quiet 5 min with a 15 min ceiling, exposed as `serverAdapterBuild.bound`. esbuild runs with `logLevel: "silent"`, so it prints nothing until it finishes. In practice the quiet bound is therefore its whole limit.
   - `core-web-build` (`next build --turbopack`, `prepare.ts`) was a fixed `BUILD_TIMEOUT_MS` of 600 000 ms. It is now quiet 10 min with a 30 min ceiling (`buildBound`).
     - The dependency changed from `buildTimeoutMs: number` to `buildBound: BuildStepBound`, and `runBuild` now receives the bound.
     - `WAIT_TIMEOUT_MS` is now ceiling + 2 min, which is 32 min.
     - The wrapper "Core web panel production build did not succeed" now appends the timeout sentence and carries its details.
   - `CoreWebBuildDependencies.prepareAdapter` is now typed `(options) => Promise<unknown>`, so test stubs that return `undefined` still fit.
4. **Docs** (`docs/architecture/testing-facility.md`): the paragraph on waiters ("twelve minutes" is now "thirty-two"), a new paragraph on the startup-build bounds, and the gateway paragraph near line 3802 now describes reuse.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check` printed `{"build-cache":"build","step":"test-runner:check","reason":"no stamp; stored in the shared store ...` with no tsc errors.
  - The first two attempts failed: one on an unterminated string I had introduced, one on the `prepareAdapter` type. I fixed both.
- `pnpm run build` (test-runner), then `node --test dist/core-web-build/tests/*.test.js`: `# tests 51  # pass 51  # fail 0`. This includes the new tests:
  - `a receipt that matches every current source skips the generator; a changed source generates it again`
  - `a missing artifact is generated, and a generator that leaves a stale receipt still fails the identity check`
  - `a slow generator that keeps making progress past a minute is not failed`: 6 min of fake time, output every 30 s.
  - `a silent, hung generator fails as a Lab startup failure naming the step, its limit and the elapsed time`: details `{ step: "gateway-server-build", bound: "quiet", limitMs: 300000, elapsedMs: 300000 }`.
  - Three tests in `build-step.test.ts`: progress restarts the quiet bound, the ceiling, and a non-zero exit.
  - `a silent, hung next build fails naming the step, the bound it hit, its limit and the elapsed time, and is not published` (in `prepare.test.ts`).
- `node --test dist/run-scenario/browser-session/server-adapter-identity/tests/*.test.js`: `# pass 15  # fail 0  # skipped 2`. The two skips are the existing opt-in real-Next probes.
- `pnpm structure:check`: `structure-audit: passed (195 warning(s), 639 baselined)`.
  - The first run failed `statement-packing` in `build-step.test.ts`. I fixed it.
  - It gives two new advisory warnings, which do not fail the check: `core-web-build/` has 21 source files (the advisory threshold is 15), and `tests/prepare.test.ts` has 411 lines (the advisory threshold is 400).

## Not verified

- No live Lab run (the brief forbids one), and no run of the real Core generator through the new reuse path. The fake-Core fixture mirrors Core's stamping, but this run never confirmed that a real receipt is accepted as current.
- I did not measure real `next build` or esbuild durations. The bounds are judgement, not measurement.
- I did not run the full test-runner suite, by the narrow-checks rule.

## Open questions or contradictions found

- The same fixed-limit risk exists outside my ownership: `coordinator.ts` runs `host-build` (`build-web-panel-host.mjs`) with `supervisor.run`'s default limit of 120 000 ms. `demo-workspace/core-process.ts` runs `demo-host-build` and `demo-domain-setup` with that same default. All three could use `runBoundedBuildStep`, which is now exported from `core-web-build`.
- The quiet bound for `next build` assumes Turbopack's silent compile phase stays under 10 min. If a loaded machine exceeds that, raise `quietMs`. The 30 min ceiling still bounds the build.
- The timeout message rounds to whole seconds, so a sub-second test bound reads "0 s". This is cosmetic.

## Follow-up: the host build and domain setup steps (coordinator request)

### Outcome

Done. I moved all three steps onto `runBoundedBuildStep`. None of them is a readiness limit: each runs a script that bundles with esbuild, and domain setup then runs a one-off setup. The 120 s they ran under was `supervisor.run`'s default, not a limit anyone chose for them.

### What changed

- New directory `packages/test-runner/src/startup-build/`, which defines each step once so the Lab and the demo share it:
  - `host-build.ts`: `hostBuildStep`, with `bound` and `run(supervisor, { name, repositoryRoot, logPath, env? })`.
  - `domain-setup.ts`: `domainSetupStep`, with `run(supervisor, { name, repositoryRoot, fluxiqRoot, logPath, env? })`. It sets `FLUXIQ_WEB_AUTOMATION_ROOT` as before.
  - `index.ts` (barrel) and `tests/startup-build.test.ts`.
- `coordinator.ts`: `host-build` now calls `hostBuildStep.run`. The name, script, cwd, env and log path are unchanged.
- `demo-workspace/core-process.ts`: `demo-host-build` and `demo-domain-setup` now call the two steps. I dropped the `executable` import, which is no longer used. The existing source-text test that guards these steps under `reusePreparedWorkspace` still passes unchanged.
- `docs/architecture/testing-facility.md`: one sentence added to the startup-bounds paragraph.

### How I chose the bounds

All three get a 5 min quiet bound and a 15 min ceiling, the same as the gateway generator:

- `build-web-panel-host.mjs` bundles with esbuild at `logLevel: "info"`, which prints only a summary when it finishes, and then stamps the result.
- `setup-fluxiq.mjs` bundles with esbuild at `logLevel: "silent"`, then runs the setup CLI once, which prints one JSON summary at the end.

Both scripts are therefore silent while they work. The quiet bound is in effect each step's whole limit, so it has to be well above a slow machine's build time: a bundle of this size takes seconds normally. I did not measure their real durations.

### Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check` exited 0: `{"build-cache":"build","step":"test-runner:check",...}` with no tsc errors.
- I ran test-runner `pnpm run build`, then `node --test` on `dist/startup-build/tests/*.test.js`, `dist/demo-workspace/tests/core-process.test.js`, `dist/tests/coordinator-existing.test.js`, `dist/tests/coordinator-persistent.test.js` and `dist/core-web-build/tests/*.test.js`: `# tests 81  # pass 81  # fail 0  # skipped 0`.
- After renaming two test titles, I rebuilt and reran the startup-build tests: `# tests 7  # pass 7  # fail 0`. They cover:
  - For each of `host-build`, `demo-host-build` and `demo-domain-setup`: a run that prints for 7.5 min of fake time passes, and a silent one fails at 300 s. The failure details are `{ process, step: <name>, bound: "quiet", limitMs: 300000, elapsedMs: 300000 }`.
  - Domain setup passes the FluxIQ root it is given.
- `pnpm structure:check`: `structure-audit: passed (195 warning(s), 639 baselined)`.

### Not verified

- No live Lab run or demo start, so the real scripts were not run under the new bound.
- I did not run `demo-workspace/tests` beyond `core-process.test.js`, and did not run the full test-runner suite.

### Open questions

- I created `startup-build/`, a new directory not named in the follow-up, so that both callers share one definition of each step and the tests can call the steps directly.
