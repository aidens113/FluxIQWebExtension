# Report: w1-host-esm

Worker: `w1-host-esm` · Repository: FluxIQ Web Extension · Date: 2026-09-11

## Outcome

Done, with one validation caveat.

All four brief items are implemented:
- the host imports Core only through public entry points;
- it is built as an ES module (`.mjs`);
- its path has one source of truth, `fluxiqHostModule` in
  `domain/package.json`, which all five former copies read;
- `docs/architecture/repository-layout.md` is updated.

Every named check passes:
- `host:build`;
- loading through Core's loader (native runtime bound);
- domain `check` and `test` (26/26);
- test-runner `check` and `test` (355/355);
- the structure audit (no new finding).

The caveat: the literal command
`FLUXIQ_TEST_TARGET=isolated pnpm lab run basic-form --target isolated` cannot
pass on this machine. `.env.local` also configures an existing install, which
the runner refuses with the isolated target, and I may not edit `.env.local`
(item 8). The same run without the `.env` merge passed, with Core's panel
loading the new host (item 8a).

## What changed and why

1. **Public import (decision D11).** `domain/src/web-panel-host.ts` imports
   `AutomationStudioNativeNodeRuntime` from `fluxiq/automation-studio`, merged
   with the two type imports already taken from that entry point. The deep
   `../../../!FluxIQ/packages/fluxiq/dist/...` import and its six-line comment
   are gone. No other domain source imports a Core `dist` path (grep of
   `domain/src` for `!FluxIQ/packages`: the host line was the only hit).
2. **ES module host.** `domain/scripts/build-web-panel-host.mjs` builds with
   `format: "esm"`; FluxIQ packages stay external. It reads the output path
   from `domain/package.json` and refuses a declaration that is not a `.mjs`
   path. The built host has exactly one external runtime import,
   `import { AutomationStudioNativeNodeRuntime } from "fluxiq/automation-studio";`.
   It has no `!FluxIQ` path and no `require`, and it exports
   `registerFluxIQHost`, `mapWebRecordingObservation`, and `default`.
3. **One source of truth for the host path.** `domain/package.json` declares
   `"fluxiqHostModule": "./dist/host/web-panel-host.mjs"`, relative to the
   domain package. All five former copies now read it:
   - `domain/scripts/build-web-panel-host.mjs` (the producer) reads its own
     `package.json`.
   - `scripts/run-fluxiq-web.mjs` reads `domain/package.json` and resolves the
     field against `domain/`.
   - `packages/test-runner/src/environment.ts` has a new
     `webPanelHostModulePath(repositoryRoot)`. It is also the default in
     `buildFluxIQEnvironment`.
   - `coordinator.ts` and `demo-workspace/core-process.ts` call
     `webPanelHostModulePath`.

   Two placement decisions:
   - **Where the reader lives.** `packages/test-runner/src` holds 50 tracked
     files and `src/tests` holds 51, both exactly at their baselined
     `directory-files` budgets. A new file would grow a violation. So the
     reader lives in `environment.ts`, which already owned the host default,
     and its test is a new case in the existing `tests/environment.test.ts`.
     The existing cases are unchanged.
   - **Where the reader reads from.** The existing environment tests pass a
     fake root (`C:/extension`). The reader therefore takes the declaration
     from this checkout's manifest (`new URL("../../../domain/package.json",
     import.meta.url)`, the same depth from `src/` and `dist/`) and resolves
     it under the given `repositoryRoot`. Nothing bundles test-runner source;
     scripts import its `dist/` directly.
4. **Docs.** `docs/architecture/repository-layout.md` has four changes:
   - a new "Web Panel Host" section: ES module, public entry points only,
     Core's `import()`, why CommonJS cannot work, the `fluxiqHostModule`
     declaration, and its readers;
   - a `domain/dist/` row in the tracking table;
   - the `pnpm dev` description;
   - `domain/scripts/` and `src/web-panel-host.ts` in the package tree.

   Nothing else outside `docs/working/` names the host file. `README.md:33`
   and `docs/architecture/testing-facility.md:209` mention "the domain host"
   without naming its file or format.

Unrelated lines in the diff of files I touched: the 139-line diff of
`web-panel-host.ts` is mostly w1-domain-mappings' earlier uncommitted work.
`domain/package.json`'s `check` script change belongs to
w1-domain-test-typecheck. My edits there are lines 1–9 of the host and the one
`fluxiqHostModule` line.

## Commands run and observed results

1. `pnpm --filter @fluxiq-web-extension/domain host:build` → exit 0.
   - Output: `dist\host\web-panel-host.mjs  88.6kb`.
   - `[FluxIQ Web Automation] Built web panel host module: F:\!FluxIQWebExtension\domain\dist\host\web-panel-host.mjs`.
   - Greps of the output: external imports = line 2 only (above); `!FluxIQ` 0;
     `__require` 0; `require(` 0.
2. Loading the host through Core's loader, in my own scratch folder
   `...\scratchpad\w1-host-esm\`:
   - `build-loader.mjs` bundles Core's working-tree
     `apps/web/src/lib/fluxiq.ts` (read-only) with `fluxiq` external.
   - `prove.mjs` gets the host path from the built test-runner's
     `webPanelHostModulePath`, checks it against a direct read of
     `domain/package.json`, then calls `loadFluxIQHostModule()` and
     `createFluxIQWebInstance()`.
   - A junction `node_modules\fluxiq → F:\!FluxIQ\packages\fluxiq` was created
     for the loader's bare `fluxiq` import. Afterwards only the link was
     removed: `link still present: False`, `Core target intact: True`.

   Output on Node v22.11.0:

   ```text
   declared=./dist/host/web-panel-host.mjs
   test-runner reader=F:\!FluxIQWebExtension\domain\dist\host\web-panel-host.mjs
   readers agree=true
   loadFluxIQHostModule() -> F:\!FluxIQWebExtension\domain\dist\host\web-panel-host.mjs
   {"activeDomainId":"web-automation","nativeRuntime":{"bound":true,"definitionCount":11,"recordingMapperCount":1},"recordingDomains":["web-automation"],"ioInputs":9,"ioOutputs":11}
   RESULT: loaded
   ```

   These are the same numbers as the Core report's scratch proof.
3. `pnpm --filter @fluxiq-web-extension/domain check` → `tsc -p tsconfig.json
   --noEmit && tsc -p tsconfig.test.json`, exit 0.
4. `DOMAIN_TEST_BUILD_LABEL=w1-host-esm pnpm --filter @fluxiq-web-extension/domain test`
   → exit 0, `# tests 26`, `# pass 26`, `# fail 0`. `domain.test.ts` imports
   `mapWebRecordingObservation` from the host, so the test bundle now imports
   `fluxiq/automation-studio` natively.
5. `pnpm --filter @fluxiq-web-extension/test-runner check` → exit 2 on the
   first three runs.
   - Every error was in `src/cli.ts` or `src/commands.ts`, which w1-bench owns
     and was editing. The counts changed between runs (11+1, then 12, then
     4+3).
   - `npx tsc -p tsconfig.json --noEmit` filtered:
     `errors outside cli.ts/commands.ts: 0`.
   - A background wait until tsc passed ended with `test-runner compiles
     (after 2 retries)`. Rerun: `check exit=0` (`tsc -p tsconfig.json --noEmit`).
6. While `check` was failing, the affected tests ran directly from the `dist/`
   tsc emitted anyway.
   - Command: `node --test dist/tests/environment.test.js dist/tests/coordinator-existing.test.js dist/tests/coordinator-persistent.test.js`
   - Result: `# tests 8`, `# pass 8`, `# fail 0`.
7. `pnpm --filter @fluxiq-web-extension/test-runner test` → exit 0.
   - `# tests 355`, `# pass 355`, `# fail 0`.
   - Includes `ok 249 - resolves the web panel host from the domain package's one declaration`.
   - The coordinator startup-failure tests with fake roots also pass (`ok 120`,
     `ok 122`).
8. `FLUXIQ_TEST_TARGET=isolated pnpm lab run basic-form --target isolated`
   cannot pass on this machine as configured. Both attempts built everything,
   then stopped at target resolution before starting any topology:
   - As briefed, exit 1:
     `{"status":"failed","category":"unknown","message":"isolated target cannot use existing-install configuration: FLUXIQ_TEST_BASE_URL, FLUXIQ_TEST_GATEWAY_URL"}`.
     `.env.local` defines `FLUXIQ_TEST_BASE_URL`, `FLUXIQ_TEST_GATEWAY_URL`,
     `FLUXIQ_TEST_USERNAME`, `FLUXIQ_TEST_PASSWORD`, `FLUXIQ_TEST_PIN`,
     `FLUXIQ_TEST_RUNS_DIR` and `FLUXIQ_TEST_TARGET` (key names only, read by
     grep; values not read).
   - With those keys blanked in the process environment, exit 1:
     `{"status":"failed","category":"unknown","message":"FLUXIQ_TEST_BASE_URL must not be empty"}`.
     `loadTestEnvironment` spreads the process environment over the file values,
     and `optionalText` sends any defined value to `nonEmpty`. So the process
     environment can override a `.env.local` key but cannot make it absent.
     Only editing `.env.local` would, and that is outside my permissions.

8a. The same run without the `.env` merge. `scratchpad\w1-host-esm\lab-run-isolated.mjs`
    calls test-runner's exported `resolveTargetConfiguration({ env: process.env,
    cliTarget: "isolated" })`, which gives `{"mode":"isolated"}`. It then calls
    `runScenario({ repositoryRoot, fluxiqRepositoryRoot: "F:/!FluxIQ",
    runsDirectory: test-runs, scenarioId: "basic-form", environment, target })`.
    That is the CLI's `run` path, minus `loadTestEnvironment`, so it runs the
    same `startTopology`: host build, Core's web panel with
    `FLUXIQ_HOST_MODULE`, extension, and recording lane.
    - First run, `run-mtxgrki2-77882289` (21:24:01–21:25:41Z): `failed`,
      `recording.persistence`, "The extension recording did not start".
      - It failed before any step (`steps: []`, `automationFailure: null`).
      - The host had loaded and was serving: host build `.mjs` exit 0,
        `✓ Compiled instrumentation Node.js`, and the gateway bound to the
        shared runtime.
      - Core also initialized the automation tab and dispatched two Core
        actions through the production gateway (`execute-client-action` 200
        ×2).
    - Rerun once per the brief, `run-mtxguvft-9777186d` (21:26:36–21:27:29Z):
      **`passed`**.
      - Host build `web-panel-host.mjs  88.7kb`, `[exit] code=0`.
      - Core log: `✓ Compiled instrumentation Node.js in 3.7s`, then
        `[FluxIQ] Client gateway WebSocket bound to shared runtime ...`, with no
        `ERR_` or error lines.
      - 17 events ending `16 runtime.settle | Core persisted the completed recording`,
        `17 final | Scenario completed`.
      - `firstFailure: null`.
    - Why I attribute the first failure to concurrency and not to the host
      (an inference, not proven):
      - All three `basic-form` failures on the `.mjs` host overlapped other
        Lab activity. Mine overlapped another worker's `basic-form` run
        `run-mtxgrqk4-91a1d715` (21:24:09–21:25:41Z), which failed the same
        way in the same second. `run-mtxgozcf-06ddf2fc` (21:22:01–21:23:00Z,
        not mine) failed the same way while `pnpm lab` invocations were
        rebuilding shared outputs.
      - The same host passed `basic-form` on rerun.
      - It passed `iframe-checkout` twice, including recording persistence.
      - It served Core actions in the failing run.
      - A mechanism I did not verify: every `pnpm lab` invocation rewrites the
        shared e2e extension build and the Scenario Lab `dist` that running
        runs have loaded.

8b. Supplementary evidence from another worker's run: `run-mtxgqaz3-e6c49275`
    (`iframe-checkout`, isolated, most likely w1-bench's), which I did not start.
    - Its `logs/host-build.log`:
      `domain\dist\host\web-panel-host.mjs  88.7kb`, then `[exit] code=0`.
    - Its `logs/core.log`: `✓ Compiled instrumentation Node.js in 8.1s`, then
      `[FluxIQ] Client gateway WebSocket bound to shared runtime ...`. That line
      prints only after the host has been applied. No host or `ERR_` error lines.
    - Its `summary.json`: `"verdict":"passed"`. A second such run,
      `run-mtxgtu3z-fdb0da95`, also passed.
9. `node scripts/structure-audit.mjs`, before, after, and at the end:
   `structure-audit: passed (27 warning(s), 19 baselined)`, with
   `1 baseline entries can be lowered` each time.
   - `--json` names the lowerable entry: `imports` /
     `domain/src/client/index.ts`, recorded 2 → 1. It was lowerable before my
     change and is not in my files.
   - `domain/src/web-panel-host.ts: 2` is unchanged.
   - I added no new tracked-path files, so the audit's tracked-files blind
     spot does not apply.
10. `node --check` on `scripts/run-fluxiq-web.mjs` and
    `domain/scripts/build-web-panel-host.mjs` → syntax ok.
11. Grep outside generated directories and `docs/working/` for
    `web-panel-host\.(cjs|mjs)`: hits are only the `fluxiqHostModule`
    declaration, the doc row, and the build-script filename
    (`build-web-panel-host.mjs`, which is not the host path).

## Not verified

- The literal `pnpm lab run basic-form --target isolated` could not pass
  (item 8). The equivalent in 8a skips only the `.env`/`.env.local` merge.
- `pnpm dev` (`scripts/run-fluxiq-web.mjs`) was not run: panel management was
  not authorized. It was syntax-checked only, and its field read was not
  executed.
- The demo topology (`demo-workspace/core-process.ts`) was not run live. It
  needs the persistent demo identity. It was type-checked and shares
  `webPanelHostModulePath` with the isolated topology.
- The cause of the first `basic-form` failure is not proven (8a).
- Only Node v22.11.0 on Windows was exercised.

## Open questions or contradictions found

1. **Current State contradiction (supervisor).** Current State says
   `FLUXIQ_TEST_TARGET=isolated` is enough for isolated lanes. It is not:
   `.env.local` also sets `FLUXIQ_TEST_BASE_URL`, `FLUXIQ_TEST_GATEWAY_URL` and
   credentials, and the runner refuses them with `--target isolated`. A process
   variable cannot unset a file key (item 8). Integration step 3 of Current
   State will fail the same way.
   Options:
   - move the existing-install keys out of `.env.local`;
   - have the runner treat an empty override as unset;
   - use the 8a runner.
2. **`basic-form` under concurrent Lab runs.** Three recording-start failures
   overlapped other runs or rebuilds, while an uncontended rerun passed.
   Parallel workers sharing `apps/extension/dist` and Scenario Lab `dist` may
   need run-scoped build outputs.
3. **Stale `domain/dist/host/web-panel-host.cjs`** (ignored, 208,730 bytes,
   built 13:38 local) is still on disk and nothing references it. I left it
   because a concurrent run whose test-runner `dist` predates this change would
   still require it. There is one risk: `pnpm dev` honours an inherited
   `FLUXIQ_HOST_MODULE`, so a shell that still points at the `.cjs` would load
   a stale host. Suggest deleting the file after integration.
4. **No mechanical guard against a sixth copy.** The new test pins the
   declaration and the reader, not the absence of hard-coded host paths
   elsewhere. A structure-audit rule could enforce it.
5. **Core docs still say CommonJS** (Core report open question 2:
   `docs/operations/data-and-state.md:45-46`,
   `docs/integrations/automation-studio-importing-repos.md` ~656). They are
   Core-owned and untouched.
6. **Pre-existing lowerable baseline entry** (`domain/src/client/index.ts`,
   imports 2 → 1), for the supervisor's `pnpm structure:baseline`.
