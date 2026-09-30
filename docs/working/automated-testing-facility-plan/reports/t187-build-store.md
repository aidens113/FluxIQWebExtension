# t187 build store: cross-tree reuse, host step, step lock, Core libraries, check prefix

## Outcome

Done. All six parts are in and every check the brief names was run and read.

- **Store.** A worktree now reuses what another tree built, through a shared store keyed by the path-independent fingerprint.
- **Fresh-tree build.** With every build output and stamp deleted from the t187 tree, `pnpm build` took **6.9 s**, with 10 of 11 steps `restored from the shared store (no stamp)`. It was 172 s before, or ~75 s inside `task start`.
- **Core libraries.** `buildCore` now runs Core's three libraries through the same cache: 31.5 s on a miss, **0.74 s** on a hit.
- **Check prefix.** The prefix is one `node --test`: ~27 s, against 36–42 s for four `pnpm` suites.
- **Gates.**
  - `pnpm check`: exit 0, 59 s.
  - `structure-audit`: passed.

## What changed and why

### `scripts/build-cache/`

- **`lock/`** (new): `acquire-step-lock.mjs` and `is-process-alive.mjs`.
  - The lock file is `<stamp>.lock`. Its content is written to a temporary file first and then `link`ed into place. `link` fails if the name exists, so the lock is create-only and never seen without an owner.
  - A lock is stale when its pid is dead or the file is more than 30 minutes old. A stale lock is broken by renaming it aside and checking its token; a lock taken in between is put back.
  - A waiter polls every 250 ms.
- **`store/`** (new):
  - `store-directory.mjs`: resolves `%LOCALAPPDATA%/fluxiq-build-cache`. `FLUXIQ_BUILD_CACHE_DIR` overrides it, and `off` disables the store.
  - `path-spellings.mjs` and `find-embedded-path.mjs`: the relocation check. Spellings cover either slash, JSON-escaped `\\` and `\/`, and `file://` URLs both plain and percent-encoded. The file is compared ASCII-lowercased, so any drive-letter or segment case matches.
  - `list-output-files.mjs`: the same walk that `outputDigest` does.
  - `entry-location.mjs`: the layout, `<store>/v1/<fingerprint>/{entry.json, files/<n>}` plus `<store>/tmp/`.
  - `save-entry.mjs`: storing.
    - It refuses an output outside the tree, or any output file holding the absolute path of the tree or of a linked Core, and gives the reason.
    - It assembles the entry in `tmp/` and renames it into place.
    - An existing entry with the same digest is only marked used. One with a different digest is replaced.
  - `restore-entry.mjs`: restoring.
    - It removes the files the digest covers, copies the blobs in, and sets their mtime to now.
    - It then re-digests from disk and requires the stored digest and every required file. Only then does it write the local stamp.
    - On any mismatch, or a missing or foreign blob, it discards the entry and whatever it copied, and the step builds.
  - `prune-store.mjs`: runs on every write.
    - Removes entries unused for 14 days (last use is the `entry.json` mtime).
    - Then removes the least recently used until the store is at most 5 GB.
    - Also removes damaged entries, and `tmp/` dirs older than 1 hour.
  - `read-entry.mjs` and `index.mjs`.
- **`run-step.mjs`** (rewritten): accepts a step name or an already resolved step.
  - The order is: local stamp → lock → re-decide if it had to wait → store restore (skipped under `FLUXIQ_BUILD_FORCE=1`) → build → stamp → store save.
  - Restore and save failures are caught and written into the reason; they never fail a build.
  - The outcome gains `source: "stamp" | "store" | "command"`. `result` stays `"reuse" | "build"`, and a restore is `"reuse"`, so the Lab prelude's contract is unchanged. The CLI line also prints `source`.
- **`decide-step.mjs`**: accepts a resolved step.
- **`workspace/resolve-step.mjs`**:
  - An env value that is an absolute path is fingerprinted as `<repository>/<relative>`. This was the one absolute path in the metadata: `extension:check` fingerprints the raw `FLUXIQ_LAB_EXTENSION_BUILD_ROOT`.
  - Adds `relocationRoots`, which is the repo plus the linked Core roots.
  - Outputs of `unreadByDependants` steps are excluded from dependants' roots.
- **`workspace/resolve-core-library.mjs`** (new): resolves a Core `packages/<dir>` as a step.
  - **Inputs:** the package's `src`, `package.json` and `tsconfig*`; each `node <script>` its build script names (`scripts/rewrite-declaration-imports.mjs`); the `dist` of its transitive Core workspace deps; Core's `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `node_modules/.pnpm/lock.yaml` and root `tsconfig*`; this repo's build-cache sources. All labels are Core-relative.
  - **Outputs:** `dist` and `tsconfig.build.tsbuildinfo`.
  - **Command:** `pnpm --filter <name> build`.
  - Its stamp, lock and stat cache live under Core's `node_modules/.cache/fluxiq-build`.
- **`steps.mjs`**:
  - Adds `domain:host-build`: command `node scripts/build-web-panel-host.mjs`, output `dist/host`, required `dist/host/web-panel-host.mjs`, stamp `host-build.json`, and `unreadByDependants: true`.
  - Why `unreadByDependants`: without it, building the host changes the `domain` root of extension, test-runner and every other dependant, and they would all rebuild.
  - Documents the naming rule: `<pkg>:build` or `<pkg>:check` is the package script, and `<pkg>:<what>-build` is anything else.
- **`build-order.mjs`**: considers only `<pkg>:build` steps. Otherwise the host step would have replaced `domain:build` in the package-to-step map.
- **`index.mjs`**: re-exports the lock, store and `resolveCoreLibrary`.
- **Tests:**
  - New `tests/scratch-workspace.mjs` (fixture), `tests/store.test.mjs` (11 tests), `tests/step-lock.test.mjs` (6) and `tests/check-prefix.test.mjs` (1).
  - `tests/run-step.test.mjs` now sets `FLUXIQ_BUILD_CACHE_DIR: "off"`, so the scratch builds never touch the real store.
  - `tests/registry.test.mjs`:
    - The step-name rule now allows `:<what>-build`.
    - Package scripts must map to `<pkg>:<kind>`.
    - New: the host script and the dependant exclusion.
    - New: no step's metadata or labels contain any spelling of the repo or Core path, with the Lab's absolute build roots set.

### `scripts/worktree/core-build.mjs`

- `buildCore` runs each of `CORE_PACKAGES` through `runStep(resolveCoreLibrary(...), { run })`. On a miss, the runner is exactly the old `runPnpm(coreRoot, ["--filter", f, "build"])`.
- `@fluxiq/web`, and anything else outside the three libraries, is run with `runPnpm` as before.
- Each package gets a progress note of the form `{step:"build-core-package", package, build-cache, source, reason, ms}`.
- `pnpm` and `step` can be injected for tests.
- A failed library build still rejects with pnpm's error, and nothing after it runs.
- Test: `scripts/worktree/tests/core-build.test.mjs` (6 tests).

### `scripts/task/`

- No source change was needed.
  - `start.mjs` builds through `buildCore` (paired Core), `applyMove` → `buildCore` (shared Core) and `runPnpm(root, ["build"])`.
  - `finish.mjs` runs `pnpm check`.
  - All three reach the cache, and the store with it: the env they pass keeps `LOCALAPPDATA`.
- New `scripts/task/tests/builds-through-cache.test.mjs` fails on any `--filter`, `tsc` or `esbuild` call, or any `runPnpm` with other than build/check/install, anywhere in `scripts/task` or `scripts/worktree` outside `core-build.mjs`.

### `package.json` (root) and `domain/package.json`

- **Root `check`:** `node --test <the six globs of structure:test, lab:test, task:test, build-cache:test> && node scripts/structure-audit.mjs && pnpm -r check`. The individual scripts are kept, and `check-prefix.test.mjs` pins the combined glob list to their union.
- **`domain` `host:build`:** `node ../scripts/build-cache/cli.mjs domain:host-build -- "node scripts/build-web-panel-host.mjs"`. Both `fluxiq:host:build` and the Lab's `pnpm --filter domain host:build` reach it.

## Commands run and observed results

**Unit tests** (no wrapper, concurrency 2):

- `node --test --test-concurrency=2 "scripts/build-cache/tests/*.test.mjs"`, after the registry and run-step edits: `# pass 30 # fail 0`.
- `node --test --test-concurrency=2 scripts/build-cache/tests/store.test.mjs scripts/build-cache/tests/step-lock.test.mjs` → `# pass 17 # fail 0`.
- `node --test --test-concurrency=2 scripts/worktree/tests/core-build.test.mjs` → `# pass 6 # fail 0`.
- `node --test --test-concurrency=2 "scripts/build-cache/tests/*.test.mjs" "scripts/task/tests/*.test.mjs" "scripts/worktree/tests/*.test.mjs"` → `# pass 176 # fail 0 # skipped 0`.

**Structure audit** (through `t187-heavy.sh`):

- `node scripts/structure-audit.mjs` → `structure-audit: passed (117 warning(s), 120 baselined)`.
- The only warnings in my directories are advisory directory-file counts: `scripts/task/` 19, `scripts/worktree/` 22, `scripts/worktree/tests/` 18.

**Check prefix** (wrapper; two rounds in alternating order, `$S/t187-store-prefix.sh`):

| Variant | Round | Exit | Time | Tests |
| --- | --- | --- | --- | --- |
| separate | 1 | 0 | 36240 ms | pass=474 fail=0 skipped=1 |
| combined | 1 | 0 | 27621 ms | pass=474 fail=0 skipped=1 |
| combined | 2 | 0 | 26875 ms | pass=474 fail=0 skipped=1 |
| separate | 2 | 0 | 41906 ms | pass=474 fail=0 skipped=1 |

The combined run was adopted.

**Round trip on the real repo** (wrapper, `$S/t187-store-roundtrip.sh`):

- `pnpm build` → `BUILD1 exit=0 ms=55866`. All 11 steps built and stored; the reasons were `inputs changed: …`, because the build-cache sources and `package.json` had changed. Selected sizes:
  - extension:build: 80 files, 29.6 MB
  - test-runner:build: 1238 files, 4.8 MB
  - domain:build: 522 files, 1.95 MB
- Cleared domain's tsc emit and stamp (`clean-dist: removed 522 emitted file(s)`) and test-evidence's `dist` and stamp. Then:
  - `pnpm --filter @fluxiq-web-extension/domain build` → `DOMAIN exit=0 ms=2186`:
    `{"build-cache":"reuse","step":"domain:build","reason":"restored from the shared store (no stamp)","ms":983,"source":"store"}`
  - `pnpm --filter @fluxiq-web-extension/test-evidence build` → `{"build-cache":"reuse","step":"test-evidence:build","reason":"restored from the shared store (no stamp)","ms":101,"source":"store"}`
- `pnpm build` → `BUILD2 exit=0 ms=4289`. All 11 steps were `reuse stamp`, so the restored bytes left every dependant's fingerprint unchanged.
- Core, through `buildCore(<t187>/!FluxIQ)` via `$S/t187-store-core-demo.mjs`:
  - First run: `CORE1 exit=0 ms=31504`. contracts took 3181 ms (89 files), fluxiq 25755 ms (3981 files, 11.8 MB) and client-gateway-websocket 2288 ms. Each was `no stamp; stored in the shared store`.
  - Cleared contracts' `dist`, tsbuildinfo and stamp, then ran again: `CORE2 exit=0 ms=995`. contracts was `"reuse","source":"store","reason":"restored from the shared store (no stamp)"`; fluxiq and the gateway were `reuse stamp`.
- **Fresh tree.** Removed every `pnpm build` output (domain's tsc emit, extension `build`/`dist`, scenario-lab `dist`, `packages/*/dist`) and every build stamp, then ran `pnpm build` → `FRESH exit=0 ms=6905`. 10 steps were `reuse store`; test-contracts was `reuse stamp` the second time it was reached.

**Host step** (wrapper, `$S/t187-store-host.sh`):

- `host:build` ×2:
  1. `{"build-cache":"build","step":"domain:host-build","reason":"no stamp; stored in the shared store (1 file(s), 429734 bytes)",…}`
  2. `"reuse","reason":"inputs and outputs match the stamp"`
- `pnpm build` afterwards → 11 of 11 `reuse`.
- Deleted `dist/host` and `host-build.json`, then ran `host:build` → `"reuse","reason":"restored from the shared store (no stamp)","source":"store"`.

**`pnpm check`** (wrapper): `CHECK exit=0 seconds=59`.

- Prefix: `# pass 475 # fail 0 # skipped 1` as printed. This file's other runs recorded that as 474 passed plus 1 skipped.
- `structure-audit: passed`.
- All 10 package checks ran; each reported `stored in the shared store (0 file(s), 0 bytes)`, the pass records.

**Store after all runs:** `%LOCALAPPDATA%/fluxiq-build-cache`, 146 MB, 42 entries. The count includes entries from the other t187 worker's runs in this tree.

`$S` is my scratchpad, `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/eb370cd2-4295-44d0-ba0e-006eba343f41/scratchpad`.

## Not verified

- **`pnpm task start/finish` for real.** Not run, as the brief forbids it. That they reach the cache is shown statically (`builds-through-cache.test.mjs`) and by `buildCore` with an injected runner. The "fresh tree" measurement stands in for a new worktree's `pnpm build`.
- **A second real worktree and a second real Core checkout.** Not created. Cross-path restore is proven in scratch trees (`store.test.mjs` and `core-build.test.mjs`, both at different temp paths) and by the metadata test on the real repo. One layout assumption: esbuild bundles embed paths relative to the package, including `../../!FluxIQ/...`, so an entry restored into a tree whose Core is not its sibling `!FluxIQ` would carry different comments. Every layout `AGENTS.md` allows has Core as that sibling.
- **Two separate OS processes contending for a lock.** The waiter test runs two `runStep` calls in one process; the dead-pid and 30-minute-old paths are tested with fake lock files. Two concurrent `pnpm build` processes were not run.
- **Pruning the real store at the 5 GB cap.** Covered by a scratch test with a small cap.
- **The host bundle's inputs.** Not checked by `prove-inputs.mjs`, which has no esbuild proof for this step. `build-web-panel-host.mjs` bundles `src/web-panel-host.ts` from `domain/src` (fingerprinted) with FluxIQ packages external. `unreadByDependants` is still held by the proof, because `dist/host` is now in the dependants' root excludes. `pnpm build-cache:prove` was not re-run.
- **Instanced Lab output bases through the store.** Not exercised on the real repo. They sit under `.lab-instances/<id>` inside the tree, so they fingerprint per instance and do store.

## Open questions or contradictions found

- **Stamps from the other worker.** Several first-run reasons omitted `scripts/build-cache` (for example `test-contracts:build` "inputs changed: package.json"). That means stamps had already been written by my new code between my runs, most likely by the other t187 worker's builds in this tree. Nothing broke; I note it because the tree was not only mine.
- **`result` for a restore is `"reuse"`.** The Lab's `build-phase.mjs` maps anything other than `"reuse"` to "rebuilt". A consumer that needs to tell a restore apart should read the new `source` field.
- **`domain/dist/host` now exists in the t187 tree.** My host-step run left it there; it was absent before. It is a gitignored build output.
