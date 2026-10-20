# Lane H, brief H5 (t727, audit finding 5): Core owns the build-cache engine

## Outcome

Partial. The work itself is complete and every check the brief names passes, with one exception: three
tests in a consumer file I may not edit, `scripts/lab/prelude/tests/build-phase.test.mjs` ("the real
cache"), now fail. Their scratch workspace is not a git repository and has no `.gitignore`. The fix is
four lines (given below) and has to come from the lead.

Core's `scripts/build-cache` now takes a repository configuration (root, step registry, resolver,
store namespace, optional proof listings), with Core's own `steps.mjs` and `repository-root.mjs` as the
default. EXT's `scripts/build-cache` loads Core's engine through `importCoreScript`, binds it to its
own configuration, and keeps only that configuration: its registry, its resolver, the Core-package
resolution layer and the esbuild proof listing. The forked engine and its generic tests are deleted
(2,290 lines removed, 226 added in EXT). EXT now gets Core's later fixes:
- output replay (stamps and entries);
- git-visible-file fingerprinting;
- output timestamps touched only when an input is newer;
- rooted store entries;
- bounded parallel scheduling, plus `--parallel` and multi-step CLI calls.

**Merge-order consequence:** EXT needs a Core with this change beside it. Merge Core's half first. Then
sync each EXT worktree's Core, and update the main checkout's Core (`C:\Users\osrs_\FluxStuff\!FluxIQ`)
to Core's `dev`, before EXT's `dev` takes this. With an older Core, every EXT build-cache entry point
fails at once. The failure comes through `importCoreScript`, which asks for
`scripts/build-cache/build-cache-for.mjs` (a file that exists only after this change), and its message
says to merge or update Core. Push both `dev` branches in one unit.

## What changed and why

### Core (`C:/Users/osrs_/FluxStuff/fxwork/t727/!FluxIQ/scripts/build-cache/`)

- `repository/` (new): `core-repository.mjs` defines `CORE_REPOSITORY` (name, root, steps,
  `resolveStep`, `storeNamespace: "core"`) and documents the repository shape. `resolve-for.mjs`
  defines `resolveFor(step, options)`: a resolved step passes through, and a name goes to
  `options.repository.resolveStep` against the repository's root and steps, unless the caller
  overrides `repoRoot` or `steps` (as tests do).
- `build-cache-for.mjs` (new): `buildCacheFor(repository)` checks the configuration and returns these
  functions bound to it, frozen:
  - `resolveStep`, `fingerprintStep`, `decideStep`, `runStep`, `scheduleSteps`;
  - `buildOrder`, `storeDirectory`, `tsconfigReferences`;
  - `runCli`, `proveInputs`.
- `decide-step.mjs`, `fingerprint-step.mjs`, `run-step.mjs` and `schedule-steps.mjs` resolve through
  `resolveFor`. `run-step.mjs` uses the repository's store namespace. It also accepts a runner that
  resolves to a bare exit code, because EXT's `scripts/worktree/core-build.mjs` passes
  `run: async () => { ...; return 0; }`.
- `store/store-directory.mjs`: `storeDirectory(env, namespace = "core")`. `null` means the store's
  top. Any namespace that is not a plain name, or is `tmp` or `v<n>`, is refused, so one repository's
  part can never sit inside the other's layout.
- `fingerprint/list-root-files.mjs`: a walk root may carry `labelBase`, so a root in another checkout
  (a linked Core, the engine) is labelled by its place in its own tree. Without it, behaviour is
  unchanged.
- `fingerprint/list-step-inputs.mjs` (new): `listStepInputs(resolved)`, the exact set a fingerprint
  hashes. Used by the proof.
- `build-order.mjs` (new): the generic `buildOrder`, moved from EXT.
- `entry/run-cli.mjs` and `entry/prove-inputs.mjs` (new): the CLI and the coverage proof as functions
  of a repository. The proof also takes the repository's `proofListings` and the resolved step's
  `installRoots`. `cli.mjs` and `prove-inputs.mjs` are now two-line wrappers. Core's arguments, JSON
  lines and exit codes are unchanged.
- `workspace/tsconfig-references.mjs`: an optional `{ repoRoot }` selects whose TypeScript parses the
  config. `workspace/resolve-step.mjs` documents the resolved-step contract.
- `index.mjs` also exports `buildCacheFor`, `buildOrder`, `CORE_REPOSITORY`, `resolveFor`,
  `listStepInputs`, `runCli` and `proveInputs`. Nothing was removed. The EXT Lab's Core lease and its
  fixtures still use `resolveStep`, `acquireStepLock` and `runStep` from a copy of this directory.
- `tests/repository.test.mjs` (new, 9 tests): namespaces, pruning isolation, namespace refusal,
  `labelBase`, `resolveFor`, CLI, `buildOrder`, proof hooks, and the bare-exit-code runner.

### EXT (`C:/Users/osrs_/FluxStuff/fxwork/t727/!FluxIQWebExtension/scripts/build-cache/`)

- `core-engine.mjs` (new): loads `build-cache-for.mjs`, then `index.mjs`, from the Core sibling
  through `importCoreScript`.
- `repository.mjs` (new): `WEB_EXTENSION_REPOSITORY` (root, STEPS, `resolveExtensionStep`,
  `storeNamespace: null`, `proofListings: bundleListings`).
- `bound-engine.mjs` (new): the engine bound to this repository, by name, plus the repository-free
  parts from Core.
- `bundle-listings.mjs` (new): esbuild inputs per entry, for the proof. Moved out of the old
  `prove-inputs.mjs`.
- `workspace/resolve-step.mjs`: rewritten as `resolveExtensionStep`, in Core's root model:
  - the package and its dependencies through git;
  - dependencies' generated directories (default `dist`) walked, minus outputs no dependant reads;
  - linked Core packages, Core root files and Core's structure audit walked, with `labelBase`
    `core:...`;
  - the installed lockfile walked.

  It also adds `packageName`, `dependencies`, `traces`, `replayOutput` and `installRoots`. Stamp paths
  are unchanged.
- `workspace/engine-sources.mjs` (new): every fingerprint covers EXT's `scripts/build-cache` and Core's
  engine `scripts/build-cache`, both walked and neither including tests.
- `workspace/resolve-core-library.mjs`: walk roots with `labelBase`, and the engine sources added
  (labels `build-cache:...`). The unused `repoRoot` option is dropped. `core-packages.mjs` reads
  workspaces through Core's `readWorkspacePackages`.
- `cli.mjs` and `prove-inputs.mjs`: two-line wrappers. `index.mjs` re-exports everything consumers
  use: `runStep`, `buildOrder`, `isProcessAlive`, `resolveCoreLibrary`, `pathSpellings`,
  `REPOSITORY_ROOT`, `STEPS`, `resolveStep`, `decideStep` and more.
- Deleted: the engine (`build-order`, `decide-step`, `fingerprint-step`, `run-command`, `run-step`,
  `touch-outputs`, `fingerprint/`, `lock/`, `stamp/`, `store/`, `workspace/tsconfig-references`,
  `workspace/workspace-packages`) and the tests Core now covers (`list-and-digest`, `stat-cache`,
  `step-lock`, `store`, `run-step`, `scratch-workspace`).
- Tests kept or added:
  - `registry.test.mjs`: now uses Core's `coversPath` with `git check-ignore`, so an ignored path
    counts only when a walked root covers it, and it asserts EXT stamp paths.
  - `structure-audit-inputs.test.mjs`: scratch now runs `git init` and has a `.gitignore`.
  - `resolve-step.test.mjs` (new, 9 tests): dependants and generated dirs, ignored run data, linked
    Core labels, output-base stamps, stale-only touching, store top versus `core/` plus a cross-tree
    restore, `buildOrder`, and Core-library fingerprints identical across two Core locations.
  - `check-prefix.test.mjs`: unchanged.

### Store safety

- **Paths:** EXT entries go to `<store>/v1`, `<store>/tmp`. Core's go to `<store>/core/v1`,
  `<store>/core/tmp`. Pruning each part reads only its own `v1/` and `tmp/`, verified by a Core test.
  The EXT run above wrote `test-matrix:check` to
  `%LOCALAPPDATA%/fluxiq-build-cache/v1/<fp>`, with no `core/` entry.
- **One-time rebuild:** fingerprints change (new labels and engine sources), so every EXT stamp
  rebuilds once.
- **Old EXT data under the new engine:** old stamps read as "inputs changed". Old entries
  (no `root`, `output` or `sha256`) restore correctly: missing fields are handled.
- **Old engine meeting new data:** an old EXT engine (an unmerged checkout) ignores the new fields.
  It can never find a rooted entry, whose key is sha256(fingerprint + root).
- **Shared formats:** the lock and stat-cache formats are byte-compatible between the two engines.

## Commands run and observed results

Core, in `C:/Users/osrs_/FluxStuff/fxwork/t727/!FluxIQ`:
- Baseline before edits: `node --test "scripts/build-cache/tests/*.test.mjs"` gave `# tests 62`,
  `# pass 62`.
- After edits, the same command gave `# tests 71`, `# pass 71`, `# fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (409 warning(s), 1152 baselined).` One
  new advisory warning: `scripts/build-cache/tests/: 16 source files is past the 15-file advisory
  threshold` (the limit is 25).
- `node scripts/build-cache/cli.mjs contracts:check`, first run:
  `{"build-cache":"build","step":"contracts:check","reason":"no stamp; stored in the shared store (0 file(s), 0 bytes)",...,"source":"command"}`,
  exit 0.
- The same command, second run: `{"build-cache":"reuse",...,"reason":"inputs and outputs match the
  stamp",...,"source":"stamp"}`, exit 0.

EXT, in `C:/Users/osrs_/FluxStuff/fxwork/t727/!FluxIQWebExtension`:
- Baseline before edits: `node --test "scripts/build-cache/tests/*.test.mjs"` gave 54 tests, 53 pass.
  The one failure was `check-prefix.test.mjs` "pnpm check builds what its tests import": root
  `package.json` (the lead's uncommitted edit) now runs `node scripts/check/core-mirror.mjs` before
  test-contracts:build, and the test's `BUILD_FIRST` does not list it.
- After edits, the same command gave `# tests 25`, `# pass 24`, `# fail 1`. The failure is the same
  `check-prefix` test.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (213 warning(s), 635 baselined).` No
  warning names `scripts/build-cache` or `scripts/core-scripts`.
- `node scripts/check/core-mirror.mjs`: `core-mirror: 1 mirror set(s) match FluxIQ Core at
  ...\t727\!FluxIQ: structure-audit (58 files).`, exit 0.
- `node scripts/build-cache/cli.mjs test-matrix:check`, first run:
  `{"build-cache":"build",...,"reason":"inputs changed: core:scripts/build-cache, package.json, scripts/build-cache; stored in the shared store (0 file(s), 0 bytes)",...}`,
  exit 0.
- The same command, second run: `{"build-cache":"reuse",...,"reason":"inputs and outputs match the
  stamp",...,"source":"stamp"}`, exit 0.
- `pnpm --filter @fluxiq-web-extension/test-matrix check`: one reuse line, exit 0.
- `node scripts/build-cache/prove-inputs.mjs test-matrix:check`:
  `ok   test-matrix:check  tsc tsconfig.json  179 files, 9 fingerprinted, 0 own outputs, 170 installed`
  and `inputs proved complete for 1 listing(s)`, exit 0.
- Extra check, `node scripts/build-cache/prove-inputs.mjs` over every step: 31 listings, all `ok`
  (tsc for every project, plus esbuild background, content, page-world, popup and sidepanel for both
  extension steps), `inputs proved complete for 31 listing(s)`, exit 0. This is the evidence that
  git-visible listing covers everything the registry's compilers and bundlers load.
- Consumer tests:

  ```text
  node --test scripts/lab/prelude/tests/build-phase.test.mjs scripts/worktree/tests/core-build.test.mjs "scripts/lab/live-guards/tests/*.test.mjs" "scripts/lab/stop-run/tests/*.test.mjs" "scripts/lab/core/build-lease/tests/*.test.mjs" "scripts/lab/core/build/tests/*.test.mjs" scripts/task/tests/builds-through-cache.test.mjs
  ```

  - First run: 105 tests, 97 pass. Four `core-build.test.mjs` failures came from the bare-exit-code
    runner and are fixed in Core's `run-step.mjs`.
  - Rerun: 105 tests, 101 pass. The three remaining failures are under build-phase "the real cache":
    - "a second pass with nothing changed reuses every step and spawns no build";
    - "a reused build satisfies the staleness guard...";
    - "an edited domain is rebuilt with its dependants...".

## Not verified

- No full suites, no Lab runs, no `pnpm build` or `pnpm check`, as the brief says.
- Only `test-matrix:check` (EXT) and `contracts:check` (Core) were run through a real CLI build.
  Other EXT steps (domain, extension, test-runner, scenario-lab) were resolved, decided and proved, but
  not built under the new engine. A step that writes a git-visible untracked file into its own package
  while running would report "not stamped, inputs changed while it ran". The proof and a check of
  which tools write there found none.
- `packages/test-runner/scripts/domain-dist.mjs` and `scripts/lab/run-lab.mjs` were not executed. They
  use only `runStep` and `buildOrder`, which the tests cover through the same exports.
- The "Core predates" error path was not run against a real old Core. It relies on the lead's
  `importCoreScript` and its tests.

## Open questions or contradictions found

1. **Fix needed in a lead-owned consumer** (`scripts/lab/prelude/tests/build-phase.test.mjs`). Core's
   engine runs a checkout git cannot list uncached, and treats git-visible files as inputs. In
   `describe("the real cache")` `beforeEach`, after the package loop, add:

   ```js
   await put(".gitignore", "node_modules/\nruns.log\n");
   execFileSync("git", ["init", "-q"], { cwd: repo, stdio: "ignore" });
   ```

   Also add `import { execFileSync } from "node:child_process";`. I did not edit it: the brief allows
   consumer edits only when an export name changes, and no export name changed.
2. **Root package.json and test globs: no change needed.** All new tests sit in existing
   `scripts/build-cache/tests/` folders in both repositories.
3. **Byte-identical mirrors for `core-mirror/mirrors.mjs`: none.** No EXT file is a copy of a Core file
   any more; EXT holds only its configuration.
4. **Host and server-adapter identity inventories.** `domain/scripts/host-build-identity/inventory.mjs`
   and `packages/test-runner/src/run-scenario/browser-session/host-identity/inventory.ts` hash EXT
   `scripts/build-cache/*.mjs` into the host bundle's identity. The engine now lives in Core's
   `scripts/build-cache`, so an engine change no longer reaches that identity, only EXT's config does.
   If the identity is meant to cover the cache engine, those inventories need Core's directory too.
   This is outside my paths.
5. **Pre-existing failure.** `scripts/build-cache/tests/check-prefix.test.mjs` fails on the lead's root
   `package.json` edit (`core-mirror.mjs` added to `check`). Either the test's `BUILD_FIRST` for
   `check` needs that step, or the step should move. The intent is the lead's call; I left the test
   alone.
6. **Docs.** EXT `index.mjs` still points at the t187 reports for design. `docs/architecture/`
   (repository layout, testing facility) may describe `scripts/build-cache` as this repository's own
   engine and should say Core owns it. I edited no docs (not in my paths).
7. **Behaviour change worth stating.** EXT reuses no longer move every output's timestamp to now. Only
   required outputs move, and only when an input is newer than every output (Core's rule, which keeps
   the Lab's mtime-based staleness guard satisfied). The prelude's staleness test (item 1) checks
   exactly this once its fixture is a git repository.
8. **Core advisory warning.** Core's `scripts/build-cache/tests/` now holds 16 files (advisory
   threshold 15, limit 25). It is a warning, not a failure.
