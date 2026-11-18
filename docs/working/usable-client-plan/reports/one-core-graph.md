# one-core-graph (t930)

## Outcome

Done. The panel server now loads Core once through Node, in every mode. A build check fails any production build that bundles a Core module more than once:

- **The check:** it fails on today's config and passes on the fix.
- **Live:** a run's activity reaches the open panel page through the stream without a reload. Before the fix, nothing reached the stream for the same run.

## Cause

Next compiles instrumentation, route handlers and pages as separate server graphs:

- Instrumentation and the routes run under one Turbopack runtime (`chunks/[turbopack]_runtime.js`) but get different module ids.
- Pages run under their own runtime (`chunks/ssr/[turbopack]_runtime.js`).

With `transpilePackages: ["fluxiq"]`, Core was bundled into each graph and evaluated once per copy. In this tree's baseline build, 1758 Core modules had 3 copies each. The activity hub had these:

| Graph | Module id |
| --- | --- |
| Routes | 318516 |
| Instrumentation | 307292 |
| Pages | 671979, in the SSR runtime |

Runs emit through the instance, which instrumentation builds, while `/api/panel/changes` subscribed to the routes' hub. The extension's host module imports `fluxiq` through Node, which made it a fourth copy.

## The choice, and why

**What does not work: `serverExternalPackages: ["fluxiq"]` on its own.** Turbopack's external plugin only externalizes a resolved file under `node_modules`. The plugin is `ExternalCjsModulesResolvePlugin`, and its condition `**/node_modules/**` is readable in the 15.5.24 binary. `fluxiq` is a pnpm workspace link whose real path is `packages/fluxiq`, so the external was silently ignored. The panel built byte-identical chunks, and the check failed it with the same 1758 modules.

**Probe app.** A minimal app built with this Next and Turbopack, with a junction-linked ESM package imported by instrumentation, two routes (one through a sub-path) and a page. "same" means the route's object is instrumentation's.

| Variant | Result |
| --- | --- |
| `transpilePackages` | `same:false` |
| `serverExternalPackages`, linked package | Bundled, `same:false` |
| `serverExternalPackages`, same package as real files under `node_modules` | Not bundled, `same:true` |
| `resolveAlias` with the `node` condition key | Never applied on server layers |
| **Unconditional alias of the package to a bridge package under `node_modules`, whose files `export *` from the real package; bridge in `serverExternalPackages`** | **Instrumentation, both routes and the page `same:true`; client component and edge middleware still work** |
| The same with `jsconfig` `paths` to the source, built and in `next dev` | Alias wins over `paths`, `same:true` in both |

**Chosen fix.**

- `apps/web/scripts/core-bridge/` writes `fluxiq-node-bridge`, one `export * from "../../packages/fluxiq/dist/<entry>"` file per Core export entry (51 of them).
  - It goes into the workspace root's `node_modules`, the nearest directory holding both `apps/web` and Core's real path. Turbopack resolves an alias target from the importing file, and `packages/ui-components` imports Core too.
  - It declares `sideEffects: false`.
  - It is generated, ignored by git, and synchronised without ever being deleted under a running server: only changed files are written, only stale ones removed.
- `next.config.ts` writes the bridge on every load (build, dev, start). It aliases every `fluxiq[/sub]` to it, names it in `serverExternalPackages`, and drops `transpilePackages: ["fluxiq"]`.
- Node imports the bridge, and through it Core's real files, once, keyed by Core's real path. The host module resolves `fluxiq` to the same real path, so it shares that one copy.
- Browser and edge bundles bundle the re-export through to Core, as before.

**Modes.**

- **`pnpm dev` from the extension** serves the production build, through `run-fluxiq-web.mjs`. It is verified live below.
- **`--dev`** runs `next dev`. The alias wins over tsconfig `paths` there too (shown by the probe), so `next dev` also loads Core's `dist` through Node, and it is one graph as well. The cost: a Core source edit shows only after `pnpm --filter fluxiq build` and a panel restart, not by hot reload. Panel source (`apps/web/src`) still hot-reloads. I did not run the panel itself under `next dev`.

## The check (`apps/web/scripts/one-core-graph/`)

**What it reads.** Production maps list no sources for code compiled from `dist`, so it does not use maps. It reads each Node server chunk's export registrations (`e.s([...names], id)`) and recognises Core modules by export-name signatures read from `node_modules/fluxiq/dist`. A signature is the sorted export names, kept only when unique to one module (3522 of 4660 modules).

**What it fails on:**

- a Core module with more than one copy, where a copy is one (runtime directory, module id) pair;
- no server output;
- no Core build;
- a chunk format it cannot read.

Edge middleware and manifest files are left out.

**Where it runs.** `next.config.ts` runs it in `compiler.runAfterProductionCompile`, so `pnpm --filter @fluxiq/web build` runs it. `scripts/build-cache/steps.mjs` is unchanged. `node scripts/one-core-graph/check.mjs [<.next>]` runs it on an existing build.

**Limit.** Scope-hoisted modules lose their own registration. 1867 Core modules were visible in the baseline. A future regression that bundles only hoisted modules could pass. Bundling the package, which is the defect fixed here, cannot.

## Commands run and observed results

All heavy steps ran through `heavy-slot.mjs`.

**The check, failing before.** `node scripts/one-core-graph/check.mjs` on the baseline (old config) build exited 1:

```
One Core graph: 1758 Core module(s) are bundled more than once into the Node server (under different module ids or Turbopack runtimes), so the panel server holds more than one copy of Core's module-level state.
  fluxiq/dist/client-gateway/service/access.js: 3 copies, chunks:995243 (chunks/packages_0075037f._.js, chunks/packages_12f38967._.js, chunks/packages_c18ed606._.js); chunks:633841 (chunks/packages_f5128fc3._.js); chunks/ssr:175148 (chunks/ssr/packages_aff227cb._.js)
  ...
```

**Build with `serverExternalPackages: ["fluxiq"]` only.** It failed inside the build with the same 1758 modules (`⨯ Failed to run runAfterProductionCompile ...`), exit 1.

**The check, passing after.** `pnpm --filter @fluxiq/web build` (bridge) exited 0:

```
One Core graph: 275 Node server files bundle 0 Core module(s), none more than once.
Runtime build identity is stamped: no placeholder in 342 server files.
```

- It compiled in 43s, against 3.2 min before. Node server files fell from 1308 to 275.
- `run-fluxiq-web.mjs` rebuilt it again after the `sideEffects` change, with the same check line.

**Web typecheck.** `pnpm --filter @fluxiq/web check` gave `WEB-CHECK-EXIT 0`. It was not stamped, because I edited a script during the run; the edit touched only an `.mjs` file outside tsc's inputs.

**Tests.** `npx vitest run scripts/core-bridge scripts/one-core-graph` in `apps/web`: 2 files, 11 tests passed.

- The bridge's identity test runs a plain `node` child process: its entries and `import("fluxiq")` give one object. Vitest's own loader does not keep Node's identity semantics, which I saw when the in-Vitest version of the test failed.

**Structure audit.** `node scripts/structure-audit.mjs` in Core gave `structure-audit: passed (549 warning(s), 914 baselined).`, with none on my files.

**Extension build.** `pnpm build` in the extension tree gave `EXT-BUILD-EXIT 0`.

**Live sessions.** All three ran headed in Chromium, on the production build, on fresh data, on port 3500 with the gateway on 5277, provider-free, with no model key.

How each session worked:

- The open panel page's own `EventSource` on `/api/panel/changes` was recorded through CDP `Network.eventSourceMessageReceived`.
- A second tab in the same session then called `create-project`, `create-flow`, `save-flow-instruction`, `run-runtime-session` (an empty Flow, which ends `failed` at once) and `get-activity`.
- Sign-in used the fresh workspace's default `admin` account, then first setup.

| Session | Hub (`get-activity`) | Stream on the open page |
| --- | --- | --- |
| **After:** `node scripts/run-fluxiq-web.mjs` | 2 events, last "Run failed" (2nd run) | `6.0s activity {"projectId":"2e609d15-...","version":1}`, `6.2s ... "version":2`. Trigger at 5.3s. 2 activity events, no reload. |
| **After, restarted** | `{"hubEvents":2,"lastLabel":"Run failed"}` | `6.8s activity {"projectId":"cf1a8bfa-...","version":1}`, `7.1s ... "version":2`. Trigger at 6.0s. |
| **Before:** the saved old-config `.next` (BUILD_ID `11iPu9vEQ9nEFitqhBnVd`), served by `next start` after the same host and setup steps as `run-fluxiq-web.mjs`, without its build | `{"hubEvents":2,"lastLabel":"Run failed"}` | `events after the trigger: 0; activity events after the trigger: 0` in 25s. The hub had the events; the stream never heard them. |

## Split singletons (baseline), each now one instance

The fixed build bundles 0 Core modules into the Node server, so every item below loads once through Node.

**Mutable state found with 3 copies or more:**

- `runtime/activity/default-hub.ts` (`automationStudioActivityHub`)
- `platform/iam/store/context/announced-changes.ts` (`iamStoreChanges` listeners)
- `framework/persistence/repository/operation-queue.ts` (`databaseOperationLocks`, the database write locks)
- `framework/persistence/program-state/state-connections.ts` (`programStateConnections`) and `state-root.ts`
- `runtime/recording/gateway-trace/installation.ts` and `framework/automation-service/service/offline-first/installation.ts` (`let installed`)
- `runtime/conversations/commands/work.ts`
- `runtime/llm/step-log/{folder,listing,answer-step}.ts`
- `runtime/models/retry/{endpoint-load,ledger}.ts`
- `runtime/project-agents/host-resources/lease-scope.ts` and `person-humanness.ts` (6 copies each)
- `trial-ports/collaborator-registry.ts`
- `panel-assistant/panel-assistant-of.ts`
- About 25 WeakMap side tables, under `answer-first/*`, `project-parts/*`, `persistence/automation/*`, `flow-authoring/*`, `result-verification/*` and `client-gateway/service/command-ledger/context.ts`.

**Also bundled per graph:** about 20 `AsyncLocalStorage` instances (activity storage and agent, conversation context, budget purses, step-log scope, domain readings, lease frames), the `performance-metrics.ts` listeners and the `schema-migrations.ts` queues.

**Not in scope:** `apps/web/src`'s own modules are still compiled per graph, and `src/lib/fluxiq.ts` keeps its state on `globalThis` for that reason. That file is t927's, and I did not audit it.

## What changed (Core tree `fxwork/t930/!FluxIQ`, uncommitted)

- `apps/web/next.config.ts`
- `apps/web/scripts/core-bridge/`:
  - `write-core-bridge.mjs`
  - `index.mjs`
  - `index.d.mts`
  - `tests/write-core-bridge.test.mjs`
- `apps/web/scripts/one-core-graph/`:
  - `core-export-signatures.mjs`
  - `core-module-copies.mjs`
  - `assert-one-core-graph.mjs`
  - `check.mjs`
  - `index.mjs`
  - `index.d.mts`
  - `tests/one-core-graph.test.mjs`

## Not verified

- **The panel under `next dev`.** Only the probe app's dev mode was run.
- **The standalone image (`FLUXIQ_WEB_STANDALONE=1`).** Docker was stopped. Output tracing of the external bridge and Core's real files is unproven.
- **A linked UI package in the probe still got a bundled SSR copy.** Its import of the core stayed bundled (`ui-same:false`, with "Package probe-core can't be external"), even with the bridge at the probe's workspace root. In the real panel the check finds 0 bundled Core modules, so `@fluxiq/ui-components`' Core imports do not leave a server copy. But I did not find out why the probe differs.
- **That the host module shares the panel's copy.** I inferred it from both resolving Core's real path; it was not observed.
- **"Legacy credential recovery was unavailable (Error)"** was logged once, on the restarted after session, whose browser held a session cookie from the earlier server run. It comes from the best-effort secret-keys recovery path (`present-panel-session.ts`), not from module loading. I did not compare it against a restarted baseline.
- **One new build warning.** `Module not found: Can't resolve <dynamic>` at `packages/fluxiq/dist/server/managed-hosts/load-launcher.js:20`. It persists after `sideEffects: false`. That code is in no output: it is absent from the edge chunks, and the client chunks are unchanged at 3.4 MB. The edge middleware bundle grew from 147,208 to 213,789 bytes. The likely reason is that the bridge's `export *` lets Turbopack shake less on the edge and browser paths. Generating named re-exports instead of `export *` would likely remove both; I did not try it.

## Open questions

- (Answered in round 2) Named re-exports: done. They won back the edge growth, but did not remove the warning, which has another cause.
- `vmmem` (WSL/Docker VM) held 3.8 GB during this session although Docker was said to be stopped. The heavy-slot gate stalled on memory for long stretches.

# Round 2 (after the `dev` merge, `@fluxiq/cloud` in the tree)

## Outcome

Done, with two fixes outside my paths named for the lead:

- **The standalone image works and carries Core.** `fluxiq-cloud up` built it from this tree, and `smoke` passed all 7 checks.
- **In the container, the panel loads Core once.** Activity reaches an open panel page's stream.
- **The new trace check** fails a build whose traces lack Core.
- **Named re-exports in the bridge** returned the edge middleware to its baseline size.

## A correction to round 1: what actually runs at run time

The server chunks import Core externally under the original specifiers: `.y("fluxiq")`, `.y("fluxiq/server")`, `.y("fluxiq/platform/profile")` and so on. They do not import `fluxiq-node-bridge/...`.

- **The bridge's only job** is to be the file Turbopack resolves, so that its `**/node_modules/**` external condition is met. Turbopack then emits the external under the request as written.
- **At run time** Node imports `fluxiq/...` itself through `apps/web/node_modules/fluxiq`, keyed by Core's real path.
- **The traces** follow the same link: the instrumentation trace alone names 4583 `packages/fluxiq/dist` files, plus Core's `package.json` and the link. The bridge is in no trace and needs not be.

## 1. Standalone image

**The trace check (`apps/web/scripts/core-trace/`)** runs after each production compile, in every build, next to the one-graph check. It collects every `fluxiq[/sub]` request:

- from the Node server chunks (`e.y(...)` and `e.x(...)`);
- from the gateway's native server (`.server-runtime/client-gateway-server.mjs`).

It requires the union of the Node server traces (the `*.nft.json` files, exactly what `output: "standalone"` copies) to contain three things:

- the `apps/web/node_modules/fluxiq` link;
- Core's `package.json`;
- the built file each request resolves to through Core's export map.

It also fails when the server imports no Core through Node, meaning Core was bundled, and when the build wrote no traces.

**Results:**

- **Current build:** `node scripts/core-trace/check.mjs` gave "Core trace: the Node server's 8113 traced files carry all 15 Core entry points it imports through Node." The in-build hook gave the same in the round 2 web build (8173 files) and inside the image's own build (8172 files).
- **The old-config build fails it, exit 1:** "lack 3 file(s) ... the link ..., Core's ...package.json, fluxiq/server -> ...dist/server/index.js (imported by ...client-gateway-server.mjs)". That build bundled Core, so nothing traced it. This is very likely why `deploy/docker/Dockerfile` ships the gateway its own Core (see below).

**Container run.** `docker desktop start`, then `fluxiq-cloud up --config <scratch copy of examples/local.config.json, project fluxiq-t930, source.root = t930's Core tree>`:

- The image built. Its in-image `pnpm build` printed "One Core graph: 277 Node server files bundle 0 Core module(s), none more than once." and "Core trace: ... 8172 traced files carry all 15 Core entry points".
- All four containers became healthy. The panel container is healthy because the standalone server started and loaded Core.

**Where Core resolves in the container** (`docker exec -w <dir> fluxiq-t930-fluxiq-1 node --input-type=module` with an `import.meta.resolve` probe):

| From | `fluxiq/server` resolves to |
| --- | --- |
| `/app/apps/web/.next/server/chunks` (instrumentation, routes and pages) | `/app/packages/fluxiq/dist/server/index.js`, and every other specifier under `/app/packages/fluxiq/dist`: **one copy** |
| `/app/apps/web/.server-runtime` (the gateway's native server, loaded into the same process) | `/opt/fluxiq-gateway-runtime/dist/server/index.js`: **a second copy of Core's server graph** |

The second copy comes from the Dockerfile's `ln -s /opt/fluxiq-gateway-runtime ./apps/web/.server-runtime/node_modules/fluxiq` and its `pnpm deploy` copy.

**Live check in the container (headed).**

- I claimed the owner at `https://app.fluxiq.localhost/setup` with the generated setup code, read from the secrets file and never printed. The log said "FluxIQ setup: the owner account was claimed; the default admin account was deleted."
- I signed in, recorded the open page's `/api/panel/changes` through CDP, and ran the same provider-free trigger.
- Result: `12.2s activity {"projectId":"8385d0f5-...","version":1}` and `12.5s ... "version":2`, with the trigger at 11.2s. `get-activity` returned `{"hubEvents":2,"lastLabel":"Run failed"}`.

**Smoke and teardown.**

- `fluxiq-cloud smoke` gave "smoke passed: 7 checks (tls, sign-up, email, isolation, payments, restart, teardown)." Its final down left "containers 0, networks 0, volumes 0, images 0".
- `fluxiq-cloud down` then removed nothing more. `docker desktop stop` ran, and the slot was released.

**The gateway's second copy: cause and fix (outside my paths).**

- **Cause.** The gateway transport (`fluxiq/server`'s WebSocket server) compares only built-in error types and keeps one WeakMap of its own (`identity-leases.ts`), which only it uses. So I found no cross-copy failure today. But the whole `fluxiq/server` graph is evaluated a second time in the panel's process, and any future shared state between the transport and the instance would split.
- **Fix, in `deploy/docker/Dockerfile`:**
  - drop `RUN pnpm --filter ./packages/fluxiq deploy --prod /opt/fluxiq-gateway-runtime`;
  - drop the `COPY --from=build /opt/fluxiq-gateway-runtime ...`;
  - drop the `ln -s ... .server-runtime/node_modules/fluxiq` (and the `mkdir` of that directory).

  Node then resolves the gateway's `fluxiq/server` up to `apps/web/node_modules/fluxiq`, the panel's copy. The trace check already guarantees that copy is in the standalone output.
- **Not tried in an image.** I did not edit the Dockerfile.

## 2. Named re-exports in the bridge

**What changed.** `apps/web/scripts/core-bridge/core-entry-names.mjs` reads each built Core entry's export names statically. It follows `export *` chains (relative paths and package exports), `export * as` and `default`, and refuses a destructured export it cannot name exactly. Each bridge file is now `export { a, b, ... } from "<Core dist file>"`.

**Correctness on the real tree.** All 52 bridge entries export exactly the names Node sees on Core's own entries: "entries whose names differ from Node's view of Core: 0". Generation takes about 1 s per config load.

**Edge middleware** is back to 147,198 bytes. The baseline was 147,208, and `export *` gave 213,789. Its string literals differ from the baseline only in layout: chunk names and export registrations of the same module.

**Middleware pulls in no Core server code.** It holds the deployment-profile code (`fluxiq/platform/profile`, which it imports) and the model-catalogue constants that module already pulled in on the baseline, and no Node APIs.

**The warning is not from the bridge.** `Module not found: Can't resolve <dynamic>` at `packages/fluxiq/dist/server/managed-hosts/load-launcher.js:20` remains:

- **Where it comes from.** With Core external, Turbopack traces Core's files for the server traces. `load-launcher.js` is in `instrumentation.js.nft.json` and the program route's trace, and its native `import()` of a run-time path can't be traced. It is in no output.
- **Cause.** The source puts `/* turbopackIgnore: true */` inside `import(...)` (`src/server/managed-hosts/load-launcher.ts:13`). Core's build (`packages/fluxiq/tsconfig.build.json`, `rewriteRelativeImportExtensions: true`) wraps the argument in `__rewriteRelativeImportExtension(...)`, which moves the hint off the `import()`.
- **Fix (outside my paths).** Core already has the mechanism for exactly this: `packages/fluxiq/tsconfig.runtime-imports.json` re-emits native importers without the rewrite, and today lists only `src/platform/panel/host-modules/import-host-module.ts`. Add `src/server/managed-hosts/load-launcher.ts` to its `include`. It imports only `node:` modules and one type-only import, as `import-host-module.ts` does.

## 3. "Legacy credential recovery was unavailable"

Not checked on a restarted baseline: that needs another slot and a swap to the baseline build. It belongs to t928's path (`present-panel-session.ts`, best-effort secret-keys recovery).

## Also fixed this round

`writeCoreBridge` used to write into the `node_modules` of whatever directory the web directory and Core shared. For a staged build under `FLUXIQ_CORE_WEB_BUILD_CACHE` outside the repository, that could be a shared parent folder or a drive root. It now writes to Core's pnpm workspace root (the directory holding `pnpm-workspace.yaml` above Core) and refuses a web directory outside that workspace. The default staged location, `<repo>/.tmp/web-build/...`, is inside the workspace, so nothing changes for it.

## Commands run and observed results (round 2)

All heavy steps ran through `heavy-slot.mjs`.

- **Core libraries:** `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build` gave `CORE-LIBS-EXIT 0`. They were 351 minutes behind source after the merge.
- **Script tests:** `npx vitest run scripts/core-bridge scripts/core-trace scripts/one-core-graph` in `apps/web` gave "Test Files 3 passed (3)", "Tests 20 passed (20)".
- **Web build:** `pnpm --filter @fluxiq/web build` gave `WEB-BUILD-EXIT 0`, with "One Core graph: 277 Node server files bundle 0 Core module(s), none more than once." and "Core trace: the Node server's 8173 traced files carry all 15 Core entry points it imports through Node."
- **Web typecheck:** `pnpm --filter @fluxiq/web check` gave `WEB-CHECK-EXIT 0`.
- **Structure audit:** `node scripts/structure-audit.mjs` gave "structure-audit: passed (552 warning(s), 914 baselined)."
- **Trace check CLI:** `node scripts/core-trace/check.mjs` passed on the current build (exit 0) and failed on the old-config build (exit 1), quoted above.
- **Cloud:** `fluxiq-cloud up` (`UP-EXIT 0`, "fluxiq-t930 is up."), the container probes and the live watch (quoted above), `fluxiq-cloud smoke` (`SMOKE-EXIT 0`, "smoke passed: 7 checks"), `fluxiq-cloud down`, `docker desktop stop`.

## What changed in round 2 (Core tree, uncommitted)

- `apps/web/next.config.ts`: runs `assertCoreTraced` after the compile, and the header comment is corrected.
- `apps/web/scripts/core-bridge/`:
  - `core-entry-names.mjs` (new);
  - `write-core-bridge.mjs`: named re-exports, workspace root, refusal outside the workspace;
  - `index.mjs`, `index.d.mts`;
  - `tests/write-core-bridge.test.mjs`: 7 tests.
- `apps/web/scripts/core-trace/` (new):
  - `core-requests.mjs`, `traced-files.mjs`, `assert-core-traced.mjs`;
  - `check.mjs`, `index.mjs`, `index.d.mts`;
  - `tests/assert-core-traced.test.mjs`: 6 tests.

## Not verified (round 2)

- **The Dockerfile change for the gateway's copy.** Proposed, not built. Done in round 3.
- **The `tsconfig.runtime-imports.json` change for the warning.** Proposed, not built. Done in round 3.
- **The credential log on a restarted baseline.**
- **The panel under `next dev`**, still.

# Round 3 (both fixes granted)

## Outcome

Done.

- **Gateway.** In the container, the client gateway's native server resolves `fluxiq/server` to `/app/packages/fluxiq/dist/server/index.js`, the same copy as the panel. The `/opt` copy is gone.
- **Image check.** An image-build step fails the build on a second Core copy.
- **Warning.** The `<dynamic>` warning is gone.
- **Cloud run.** `up` and `smoke` (7 checks) pass, and activity still reaches an open page's stream in the container.

## 1. Dockerfile: one Core in the image

**`deploy/docker/Dockerfile`:**

- Removed `RUN pnpm --filter ./packages/fluxiq deploy --prod /opt/fluxiq-gateway-runtime`, its comment and its `COPY --from=build /opt/fluxiq-gateway-runtime ...`.
- Removed the `mkdir` and `ln -s /opt/fluxiq-gateway-runtime ./apps/web/.server-runtime/node_modules/fluxiq`.
- Added, after the copies:

  ```
  RUN node deploy/one-core.mjs apps/web/.next/server/chunks apps/web/.next/server/chunks/ssr apps/web/.server-runtime \
    && node packages/fluxiq/dist/platform/provisioning/cli/main.js accounts --help > /dev/null
  ```

**`deploy/docker/one-core.mjs`** (new): from each directory Node loads server code from, it resolves the nearest `node_modules/fluxiq` to its real path. It fails (exit 1) when any directory resolves another copy, or none. Locally it passed on this tree's build, and failed with "resolves 2 copies" when two directories linked different packages.

**The operator command line** now runs from the single Core, `/app/packages/fluxiq/dist/platform/provisioning/cli/main.js`. The panel's traces already carry its whole `cli/` directory and its imports (framework, IAM, email, provisioning service, SQLite repository). The `accounts --help` step makes the image build fail if it cannot load; it returns before opening any data. I moved the path in `deploy/docker/smoke.sh` and `docs/operations/self-hosting.md`, and the latter's runtime-stage paragraph now describes the single Core.

**Why both the trace check and the image check.** The second copy was made by the runtime stage after the panel build, so only an image step can see it. The panel build's trace check (round 2) guarantees the standalone output holds what both the panel and the gateway import.

## 2. `tsconfig.runtime-imports.json`

- **The change.** `packages/fluxiq/tsconfig.runtime-imports.json` now includes `src/server/managed-hosts/load-launcher.ts`. Its program pulls in three type-only files (`host-launcher.ts`, `host-launch-request.ts`, `launched-host.ts`). They are re-emitted identically (`export {}`, no relative specifiers), and `tsc -p tsconfig.runtime-imports.json --noEmit` exits 0.
- **Tests.**
  - `import-host-module.test.ts` pinned that config to exactly one file; it now checks that its own file is in the list.
  - New `src/server/managed-hosts/tests/load-launcher-emission.test.ts` compiles the config and asserts two things: the emitted `load-launcher.js` keeps `webpackIgnore`/`turbopackIgnore` on the `import()` with no `__rewriteRelativeImportExtension`, and no re-emitted file keeps a relative `.ts` specifier.
- **The rebuilt `dist`.** `grep -c __rewriteRelativeImportExtension dist/server/managed-hosts/load-launcher.js` gives 0, and the file holds `import(/* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ pathToFileURL(file)...`.
- **The web build** prints no "Turbopack build encountered" warning (`grep -ciE "warning|Can't resolve"` gives 0), and neither did the image's build.

## Commands run and observed results (round 3)

All heavy steps ran through `heavy-slot.mjs`.

**Local checks:**

- **Core libraries:** `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build` gave `CORE-LIBS-EXIT 0`.
- **Core tests:** `npx vitest run src/server/managed-hosts src/platform/panel/host-modules/tests/import-host-module.test.ts` in `packages/fluxiq` gave "Tests 10 passed (10)".
- **Script tests:** `npx vitest run scripts/core-bridge scripts/core-trace scripts/one-core-graph` in `apps/web` gave "Tests 20 passed (20)".
- **Web build:** `pnpm --filter @fluxiq/web build` gave `WEB-BUILD-EXIT 0`, with "One Core graph: 277 Node server files bundle 0 Core module(s), none more than once." and "Core trace: the Node server's 8173 traced files carry all 15 Core entry points it imports through Node."
- **Web typecheck:** `pnpm --filter @fluxiq/web check` gave `WEB-CHECK-EXIT 0`.
- **Structure audit:** `node scripts/structure-audit.mjs` gave "structure-audit: passed (552 warning(s), 914 baselined)."

**Docker session** (`docker desktop start`, then `fluxiq-cloud up --config <scratch config, project fluxiq-t930, source.root = t930's Core>`):

- **Image build output:**
  - "One Core graph: 277 ... 0 Core module(s)";
  - "Core trace: ... 8172 traced files carry all 15 Core entry points";
  - `one-core: apps/web/.next/server/chunks -> /app/packages/fluxiq`, `... chunks/ssr -> /app/packages/fluxiq`, `... .server-runtime -> /app/packages/fluxiq`, "one-core: one copy of Core at /app/packages/fluxiq.", then `#30 DONE 3.0s` (the command line loaded).
- **Up:** `UP-EXIT 0`, all four containers healthy. The log shows "Client gateway WebSocket bound to shared runtime ... at wss://app.fluxiq.localhost/client".
- **Probes in the container** (`import.meta.resolve`, real path):
  - from `/app/apps/web/.next/server/chunks`: `"fluxiq/server":"/app/packages/fluxiq/dist/server/index.js"`;
  - from `/app/apps/web/.server-runtime`: `"fluxiq/server":"/app/packages/fluxiq/dist/server/index.js"`, which is the same file.
  - `ls -d /opt/fluxiq-gateway-runtime` gave "No such file or directory".
  - `node /app/packages/fluxiq/dist/platform/provisioning/cli/main.js accounts --help` printed "usage: fluxiq accounts <operation> [flags]".
- **Live, headed:** owner claimed ("the owner account was claimed; the default admin account was deleted"). The open page's stream got `6.7s activity {"projectId":"c217264d-...","version":1}` and `9.2s ... "version":2`, with the trigger at 5.5s; the hub returned `{"hubEvents":2,"lastLabel":"Run failed"}`.
- **Smoke:** `fluxiq-cloud smoke` gave "smoke passed: 7 checks (tls, sign-up, email, isolation, payments, restart, teardown)." and "the final down left nothing labelled fluxiq-t930 (containers 0, networks 0, volumes 0, images 0)".
- **Teardown:** `fluxiq-cloud down` gave "Removed 0 containers, 0 networks, 0 volumes, 0 images, 0 files." `docker desktop stop` ran, and the slot was released.

## What changed in round 3 (Core tree, uncommitted)

- `deploy/docker/Dockerfile`
- `deploy/docker/one-core.mjs` (new)
- `deploy/docker/smoke.sh` (the command line's path)
- `docs/operations/self-hosting.md` (the runtime stage, the command line's path)
- `packages/fluxiq/tsconfig.runtime-imports.json`
- `packages/fluxiq/src/platform/panel/host-modules/tests/import-host-module.test.ts`
- `packages/fluxiq/src/server/managed-hosts/tests/load-launcher-emission.test.ts` (new)

## Not verified (round 3)

- **`deploy/docker/smoke.sh`** (the older image smoke, service profile) was not run. Only its command-line path changed; the path itself was proven by running `accounts --help` in the container.
- **`one-core.mjs` has no unit test.** It is exercised by every image build; its pass and fail were shown locally by hand.
- **The credential log on a restarted baseline.**
- **The panel under `next dev`.**
