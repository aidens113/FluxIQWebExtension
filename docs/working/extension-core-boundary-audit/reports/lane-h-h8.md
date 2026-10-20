# Lane H, brief H8 (t727): Core owns the keyed web panel build

## Outcome

Done. Core's own `web:build` now ships a panel that resolves Core's packages from their stamped `dist`.
It also fails the step when the server output still holds the identity placeholder. Core has a new
importable seam, `scripts/web-build/`, that builds the panel into an immutable, content-keyed
directory. The downstream `packages/test-runner/src/core-web-build/` duplicate is deleted. What stays
downstream is only what belongs to the Lab: environment scrubbing, the supervised and bounded build
children, the log, and the `next start` process spec. Every caller now goes through the Core seam, in
the same unit.

All validation the brief names was run; outputs are quoted below. One real keyed build was made
through the seam from EXT, and a second call reused it.

## What changed and why

### 1. Core identity defect (fixed)

- `apps/web/next.config.ts` is now a phase function. Only `PHASE_PRODUCTION_BUILD` sets
  `typescript.tsconfigPath: "tsconfig.build.json"`, so `next dev` keeps the source aliases.
- `apps/web/tsconfig.build.json` (new) is the web project with the base merged in, minus `baseUrl`
  and `paths`. It deliberately **extends nothing**.
  - Measured: a first version that extended `tsconfig.json` and overrode `"paths": {}` still
    embedded the placeholder.
    - The log printed `Using tsconfig file: tsconfig.build.json`.
    - `grep -rl fluxiqRuntimeIdentityPlaceholder .next/server` still matched
      `chunks/ssr/_61c17158._.js` and others.
    - So Turbopack honours `tsconfigPath`, but it merges `paths` through `extends`.
  - The standalone file fixed it.
  - A registry test now holds this file equal to the base merged with web, minus `baseUrl` and
    `paths`, so it cannot drift.
- Post-build check: `scripts/web-build/identity/assert-stamped-identity.mjs`, moved from EXT
  `stamped-identity.ts`, with the CLI `check-web-build.mjs`. `web:build`'s command now ends
  `&& node ../../scripts/web-build/identity/check-web-build.mjs`. `apps/web/package.json` `build`
  changed to match, because the registry test requires the command and the script to agree.
- The registry entry (`scripts/build-cache/steps.mjs`, `web:build`):
  - `tsconfigs: ["tsconfig.build.json"]`;
  - the new command;
  - an `ignoredInputs` walk of `../../scripts/web-build/identity` (shallow, `*.mjs`), so the
    module beside the CLI is fingerprinted and its tests are not.
- Two registry tests were added in `scripts/build-cache/tests/registry.test.mjs`:
  - "the production web build resolves Core's packages from their stamped dist, not from source";
  - "web:build ends with the runtime identity check, whose modules are inside its fingerprint".

### 2. Core publication seam: `scripts/web-build/` (new, .mjs, 999 source lines and 673 test lines)

- `prepareWebBuild(options, overrides)` takes these options:
  - `repoRoot`;
  - `cacheRoot`, which defaults to `<core>/.tmp/web-build`, or `FLUXIQ_CORE_WEB_BUILD_CACHE`;
  - `env`;
  - `run(command)`;
  - `log(line)`;
  - `signal`;
  - `waitTimeoutMs`.
- It returns `{ key, directory, webDirectory, buildId, nextExecutable, reused }`.
- `inspectWebBuild` is the dry run. It returns `{ key, cached }` and creates nothing.
- How a build is made:
  1. It refuses a cache root that cannot hold a build. These are environment errors:
     - one inside `node_modules`;
     - a path over the Windows budget;
     - a cache root on another drive than Core. This check is new: Turbopack's root must hold both.
  2. It makes the gateway artifact current **in place** (`gateway/`). Core's own receipt check
     decides. It reuses a current artifact, and otherwise runs the generator through the caller's
     `run`.
  3. It computes the key: `webBuildKey` takes Core's own `web:build` fingerprint (`fingerprintStep`)
     plus the staged config text and a layout version. A test asserts it equals `decideStep`'s
     fingerprint.
  4. It reuses a published attempt when its gateway copy is byte-identical. Otherwise it takes the
     key's create-only lock. This is the build cache's `acquireStepLock`, with a 40-minute staleness,
     a wait deadline and an abort signal, both checked through the lock's `isAlive` hook.
  5. It checks again under the lock, then builds an attempt (`build-attempt.mjs`):
     - stage a snapshot (`staging/`);
     - check that the gateway copy is byte-identical;
     - `next build --turbopack` with an isolated FluxIQ root and the gateway disabled
       (`build-environment.mjs`);
     - require a build id;
     - assert the stamped identity;
     - **re-key and refuse to publish if Core's inputs changed during the build**. This is new: it
       closes the window in which a `dist` rebuilt mid-build was published under the old key;
     - mark the attempt complete and publish atomically (`publication/`).
- Staging lays out `<attempt>/{tsconfig.base.json, packages -> core/packages, apps/web}`:
  - `apps/web` is a copy without `.next`, `node_modules`, test reports or `next.config.ts`;
  - `node_modules` are links;
  - Core's `next.config.ts` is copied as `next.config.core.ts`;
  - a generated `next.config.ts` wrapper calls it and adds only `turbopack.root`.
  - The `packages` link is required, as measured on one attempt that varied one thing at a time:
    - without the link, the staged build's worker crashed with exit 3221225477 (access violation)
      every time, three runs;
    - with the link and the downstream-style layout, it built (exit 0);
    - adding `tsconfigPath`, it built (exit 0);
    - with Core's base config verbatim plus the link, it built, and there was no placeholder;
    - the final seam layout built through the real path (below).
- Errors are `webBuildError(kind, message, details)` with `kind` `environment` or `build`, so callers
  can classify them.
- Tests, all passing:
  - `scripts/web-build/tests/prepare-web-build.test.mjs` (14), which ports the downstream
    `prepare.test.ts` cases and adds the key-changed, gateway-mismatch, abort and drive cases;
  - `web-build-key.test.mjs` (2, against the real checkout);
  - `publication/tests` (5);
  - `staging/tests` (4);
  - `gateway/tests` (4);
  - `location/tests` (5);
  - `identity/tests` (5).

### 3. EXT: callers switched, duplicate deleted

- Deleted: `cache-root.ts`, `content-hash.ts`, `gateway-sources.ts`, `inputs.ts`, `key.ts`,
  `next-config.ts`, `node-modules-root.ts`, `path-budget.ts`, `publication.ts`, `required-paths.ts`,
  `staged-tsconfig.ts`, `stamped-identity.ts`, `workspace.ts` and `server-adapter.ts`.
  - Also deleted were their tests: `cache-root`, `inputs`, `key`, `node-modules-root`,
    `path-budget`, `staged-tsconfig`, `server-adapter`, and `server-adapter-fixture.ts`.
  - `server-adapter.ts`'s `prepare` and `hasArtifacts` duplicated what Core now does: the
    generator-currency check and the copy check. `validateCopy` was only `expectedServerAdapterIdentity`
    on the copy, so its two callers call that directly.
- Kept and rewritten:
  - `prepare.ts` is now a thin wrapper:
    - it loads the seam from the target Core;
    - it maps Core's commands to supervised `ProcessSpec`s with the existing bounds: gateway 5/15
      min, build 10/30 min, wait = ceiling + 2 min;
    - it keeps the existing timeout sentences;
    - it writes Core's log lines synchronously to the run log;
    - it maps `webBuildError` to `environment.missing` or `process.startup`.
  - `decision.ts` wraps `inspectWebBuild` over the same scrubbed base environment, so the dry run
    names the real run's key.
  - `build-environment.ts` is scrubbing only. Core now adds the isolated FluxIQ root.
  - `core-seam.ts` (new) is `loadCoreWebBuildSeam`, a runtime URL import. A Core without the seam
    gets `environment.missing` and is told to merge Core's dev.
  - `types.ts` holds `CoreWebBuild` and the seam types.
  - `index.ts` is the barrel.
  - `build-step.ts` and `server-process.ts` are unchanged.
- Callers:
  - `cli.ts`, `coordinator.ts`, `demo-workspace/core-process.ts`, `extension-chat-check/cli.ts` and
    `startup-build/*` keep the same API (`prepareCoreWebBuild`, `inspectCoreWebBuild`,
    `coreWebServerProcessSpec`, `runBoundedBuildStep`), so their source is unchanged.
  - `identity.test.ts` and `next-probe.test.ts` were switched off `serverAdapterBuild`.
  - `tests/cli-llm.test.ts`: the stub Core can no longer be keyed, since Core fingerprints its own
    git checkout. Its dry-run tests now name the Core this package links (`import.meta.resolve("fluxiq")`)
    with a cache of their own (`FLUXIQ_CORE_WEB_BUILD_CACHE` in the temp lab). The "missing input"
    case is now "a Core without `scripts/web-build`", which gives `environment.missing`.
  - `scripts/worktree/core-build.mjs`: comment only.
  - `scripts/lab/live-campaign/lab-run/tests/ram-fault.test.mjs` only quotes the process name
    `core-web-build`, which is kept. No change.
- `.structure-baseline.json` was lowered: every `core-web-build` entry is gone, with 7 removed and
  none added.

### Lines removed and added

- EXT `core-web-build/` source: +147, −850. Tests: +125, −949. The directory is now 355 source
  lines, down from about 1,060.
- EXT total across 35 files: +314, −1,854. This includes `cli-llm.test.ts` (76 lines changed), the
  identity tests, the comment and the baseline.
- Core: `scripts/web-build/` is +999 source and +673 test lines. On top of that:
  - `apps/web/tsconfig.build.json`: +36;
  - `next.config.ts`: +22/−5;
  - `steps.mjs`: +13/−5;
  - `package.json`: +1/−1;
  - `registry.test.mjs`: +29.

### Merge-order consequence

- **Core must merge first, and both `dev` branches must be pushed together.**
  - EXT loads `<core>/scripts/web-build/index.mjs` at run time. An EXT tree whose Core lacks it
    refuses every isolated Lab run, demo and dry run with `environment.missing`, telling the user to
    merge Core's dev.
- **One-time rebuilds.**
  - `steps.mjs` is a build-cache source, so it changes every Core step's fingerprint: every Core
    library rebuilds once. I rebuilt this tree's libraries: `fluxiq:build` took 235 s.
  - EXT's `domain:build` and `test-runner:*` also rebuild once.
  - The panel cache moved to `<core>/.tmp/web-build/` with a new key format, so the first Lab run
    does one full panel build, about 7.5 min here.
  - Old `<core>/.tmp/core-web-build/` directories are unused leftovers that `pnpm task prune` or a
    manual delete can reclaim. They hold `node_modules` junctions, so delete them with
    `cmd /c rmdir /s /q`, never with a junction-following `rm -rf`.
- Lane S owns `packages/test-runner/src/live-llm/**` and Core `apps/web/src/**`. Neither was touched.

## Commands run and observed results

- CORE `node --test scripts/web-build/{identity,location,publication,staging,gateway}/tests/*.test.mjs`
  and `node --test scripts/web-build/tests/*.test.mjs` printed `# pass 5 # fail 0`, `# pass 5`,
  `# pass 5`, `# pass 4`, `# pass 4` and `# pass 16 # fail 0`. The last run includes the 2
  real-checkout key tests, which took 48 s cold.
- CORE `node --test scripts/build-cache/tests/registry.test.mjs` printed `# pass 10 # fail 0`.
  `node --test "scripts/build-cache/tests/*.test.mjs"` printed `# tests 73 # pass 73 # fail 0`.
- CORE `node scripts/structure-audit.mjs` printed `structure-audit: passed (409 warning(s), 1152 baselined).`.
  None of the warnings is on a changed file. The first run had 5 failures (naming prefixes, a
  failure-as-empty, a swallowed failure, statement packing), all fixed.
- CORE real `web:build` through its CLI (`pnpm --filter @fluxiq/web build`) exited 0 in 5m25s. It
  printed `Using tsconfig file: tsconfig.build.json` and
  `Runtime build identity is stamped: no placeholder in 1107 server files.`.
  Then `grep -rl fluxiqRuntimeIdentityPlaceholder apps/web/.next/server` printed nothing (exit 1).
  That run was not stamped ("inputs changed while it ran"), because I normalised line endings in
  `steps.mjs` during it.
- CORE rerun of the same command, after the library rebuild, exited 0 in 6m40s. It printed
  `Runtime build identity is stamped: no placeholder in 1107 server files.` and
  `{"build-cache":"build","step":"web:build","reason":"no stamp; stored in the shared store for this tree only, ..."}`.
  The stamp `apps/web/node_modules/.cache/fluxiq-core-build/web-build.json` is written. The
  placeholder grep again printed nothing (exit 1).
- CORE `pnpm --filter @fluxiq/web check` (`tsc --noEmit` over `apps/web`, including the reshaped
  `next.config.ts`) passed:
  `{"build-cache":"build","step":"web:check","reason":"no stamp; stored in the shared store ..."}`.
- CORE `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
  rebuilt all three: "inputs changed: scripts/build-cache"; fluxiq took 235065 ms.
- Real keyed build through the seam from EXT, provider-free. The driver was
  `scratchpad/h8/keyed-build.mjs`, which calls dist `prepareCoreWebBuild` twice, then
  `inspectCoreWebBuild`:
  - `inspect before: {"key":"53e5cb9e3f3404936e29f6b3","cached":false}`
  - `first {... "directory":"...\\.tmp\\web-build\\53e5cb9e3f3404936e29f6b3\\b-edc4b95c1cd3", "buildId":"I0HV82XZWl85X65AhPxKe","ms":443832}`
  - `second {... same directory and buildId ...,"ms":7761}`, which is the reuse.
  - `inspect after: {"key":"53e5cb9e3f3404936e29f6b3","cached":true}`
  - In the published attempt, the placeholder appears in 0 server files and the stamped identity
    protocol in 6. The gateway artifact is byte-identical to Core's (`cmp`).
  - Two earlier attempts failed with exit 3221225477 before the `packages` link was added (see 2).
    I deleted those attempts with `rmdir /s /q`.
- EXT `pnpm --filter @fluxiq-web-extension/test-runner check` passed (`test-runner:check ... stored`).
  - One earlier run crashed tsc with exit 2147483651. That happened while the machine was out of
    commit memory; see "Not verified".
- EXT `pnpm --filter @fluxiq-web-extension/test-runner build`, then
  `node --test dist/core-web-build/tests/*.test.js dist/run-scenario/browser-session/server-adapter-identity/tests/*.test.js dist/tests/cli-llm.test.js dist/tests/coordinator-existing.test.js dist/demo-workspace/tests/core-process.test.js dist/startup-build/tests/*.test.js`,
  printed `# tests 68 # pass 66 # fail 0 # skipped 2`. The 2 skipped are the opt-in Next and server
  probes.
- EXT `node scripts/structure-audit.mjs` printed `structure-audit: passed (211 warning(s), 627 baselined).`,
  after `--update` lowered the baseline.
- EXT `node scripts/check/core-mirror.mjs` printed
  `core-mirror: 1 mirror set(s) match FluxIQ Core at ...\t727\!FluxIQ: structure-audit (58 files).`.

## Not verified

- No Lab run, live run or full suite was run, as the brief directs. Serving the keyed build with
  `next start` and the Lab's identity gate against it were not exercised. The opt-in
  `next-probe.test.ts` was not enabled.
- `next dev` was not run, so its continued use of the source aliases is asserted by the config and
  the registry test, not observed.
- Core's root `check` script's `node --test` globs do not list `scripts/web-build/**/tests`, so these
  tests do not run in `pnpm check` yet. The root `package.json` is outside this brief's files; see
  the open questions.
- Machine state: during this work the machine ran out of commit memory.
  - `OneDrive.Sync.Service` held about 14-16 GB of commit, and bash forks failed with 0xC000012D.
  - The tsc crash above happened then.
  - The staged-build crashes were **not** memory: they reproduced with 2.8 GB free, and stopped once
    the `packages` link was added.

## Open questions or contradictions found

1. Add `"scripts/web-build/tests/*.test.mjs"` and the five `scripts/web-build/*/tests/*.test.mjs`
   globs to Core's root `check` `node --test` list. I recommend it; it is the root `package.json`,
   which this brief did not give me.
2. EXT `run-scenario/browser-session/server-adapter-identity/` (`inventory.ts`, `expected.ts`,
   `normalize.ts`) still re-implements Core's `apps/web/scripts/gateway-server-identity` inventory
   and normalisation. That is the same kind of duplicate. It is Lab identity gating, so I left it.
   It is a candidate for the next boundary brief.
3. Documentation still describes `<core>/.tmp/core-web-build/` and EXT-side staging:
   `docs/architecture/testing-facility.md` (lines ~310, 334-339, 461, 908) and Core's architecture
   docs, which have no entry for `scripts/web-build/`. These docs are outside this brief.
4. The cache root was renamed from `.tmp/core-web-build` to `.tmp/web-build`, keeping the
   `FLUXIQ_CORE_WEB_BUILD_CACHE` override name. If continuity of the directory name matters more
   than the clean break, it is one constant in `location/cache-root.mjs`.
5. Core's `.gitignore` already ignores `.tmp/`. Workers have reported that vitest picks up test files
   inside staged copies under `.tmp/core-web-build/*`. The staged copy still includes `apps/web`'s
   tests, so the same will happen under `.tmp/web-build/*`. Excluding `tests` from the copy, or
   excluding `.tmp/**` in Core's vitest configs, would end it.
6. Index: I used `git rm` for the deletions and `git add -N` for `core-seam.ts`, so the EXT index
   holds those staged deletions and one intent-to-add. Nothing was committed.
