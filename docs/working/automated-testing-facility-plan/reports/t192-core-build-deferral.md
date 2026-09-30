# t192-core-build-deferral report

## Outcome

Done. When a Core checkout has its own build cache, `buildCore` now hands each package's build to that cache. The decision is made for each package in each checkout. A Core without the cache is built exactly as before.

## What changed and why

- `scripts/worktree/cache-delegation.mjs` (new): `coreCacheOwnsBuild(coreRoot, item)` returns true only when two things hold. `<coreRoot>/scripts/build-cache/cli.mjs` must exist, and the package's `build` script must contain `scripts/build-cache/cli.mjs`. The package is looked up in `packages/<dir>` first, then `apps/<dir>`. If the package's `name` is not the expected filter, it throws, the same guard the old path had. The file is named `cache-` rather than `core-` because the structure audit's naming rule fails on 3 files sharing the `core-` prefix.
- `scripts/worktree/core-build.mjs`: a delegated package runs exactly `pnpm --filter <name> build` in the Core root. Neither `resolveCoreLibrary` nor `runStep` is called, so no downstream stamp or store entry is written and no `dist` is touched. It emits `{"step":"build-core-package","package":...,"build-cache":"delegated","core":<Core's own {"build-cache":...} line, or null>,"ms":...}`. If Core prints a `{"build-cache"` line that is not JSON, the build now fails with an error that names the line (the structure audit's failure-as-empty rule rejected the first version, which ignored it). All other packages keep the previous code path unchanged, including the web panel when its script does not call the CLI.
- `scripts/worktree/pnpm-command.mjs`: `runPnpm` takes a new optional `onLine`. When it is given, stdout is piped, every chunk is still written to stderr (nothing is swallowed), and each complete line is passed to `onLine`. When it is not given, stdio is the same as before.
- `scripts/worktree/index.mjs`: exports `coreCacheOwnsBuild`, and the header comment now mentions it.
- `scripts/worktree/tests/core-build.test.mjs`: 3 new tests using an injected runner and scratch Cores:
  1. Core with the CLI and CLI-invoking scripts: the build is delegated, the injected `step` spy is never called, and every note is `delegated` carrying Core's `reuse`/`stamp` line. A second run with the real default `step` leaves no `node_modules/.cache/fluxiq-build` directory in any package and an empty downstream store.
  2. Scripts that name the CLI but no CLI file: the old path runs (the spy sees all 3 commands) and nothing is delegated.
  3. Mixed: only the contracts script calls the CLI, so contracts is delegated and the other two go through the downstream cache. A second Core checkout without the cache is not delegated.
- No caller change was needed. `task/start.mjs` and `apply-move.mjs` call `buildCore` with the same signature as before.

## Commands run and observed results

- `node --test --test-concurrency=2 "scripts/worktree/tests/*.test.mjs" "scripts/task/tests/*.test.mjs"` -> `# tests 131 # pass 131 # fail 0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (124 warning(s), 120 baselined).` Earlier runs had failed on `[naming]` and `[failure-as-empty]`, and both were fixed as described above.
- Real call: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t192-deferral buildCore" node <scratchpad>/t192-deferral-run.mjs`. The script imports `buildCore` from the worktree barrel, sets `packages` to `CORE_PACKAGES`, and runs it against `fxwork/t192/!FluxIQ`. It prints the newest file mtime under each Core package's `dist` before and after the call.
  - First call: Core's cache rebuilt all 3. Each outcome was `"build-cache":"build"`, `"reason":"inputs changed: package.json, scripts/build-cache; stored in the shared store (...)"`, `"source":"command"`, taking contracts 6743 ms, fluxiq 160986 ms and websocket 4174 ms. Core's inputs had changed since its last stamp, so the `dist` mtimes moved, from `06:20:45`/`06:25:31`/`06:20:47` to `06:28:17`/`06:29:27`/`06:31:08` (UTC, 2026-09-30).
  - Second call: every note was `"build-cache":"delegated"`, and each `core` line said `{"build-cache":"reuse",...,"reason":"inputs and outputs match the stamp","source":"stamp"}`, taking contracts 560 ms, fluxiq 1773 ms and websocket 268 ms.
    - Before: `{"contracts":"2026-09-30T06:28:17.697Z","fluxiq":"2026-09-30T06:29:27.114Z","client-gateway-websocket":"2026-09-30T06:31:08.670Z"}`
    - After: identical, and the script printed `UNCHANGED true`.

## Not verified

- A real `task start` or `apply-move` run (not allowed by the brief).
- The Lab's Core guards themselves. I checked only that `dist` mtimes stay put when Core's cache reuses.
- Delegation for the `@fluxiq/web` panel against a real Core; whether it is delegated depends on its own script.
- `runPnpm`'s `onLine` has no unit test of its own. The two real calls above exercised it and captured Core's line.

## Open questions or contradictions found

- The first real call was a full Core rebuild, not a reuse. Core's cache reported `inputs changed: package.json, scripts/build-cache`, which suggests Core's cache files changed after its last stamp, probably from concurrent Core t192 work. The rebuild was Core's own cache deciding, not the downstream wrapper.
