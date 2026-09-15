# bt-w14-core-handler: why `POST /api/client-gateway/automation-studio-context` went unanswered for 30 s

Read-only diagnosis. FluxIQ Core at `F:\!FluxIQ` (HEAD 19468b7), Next.js 15.5.23.
No file in either checkout was edited, created, or staged. `git status --short`
was empty in both before and after.

## Outcome

Done. This is a diagnosis. Nothing was reproduced.

The handler cannot wait on a gateway client, a WebSocket acknowledgement,
recording finalization, or a lock when the session is valid and held in memory.
Its awaits are a cookie read, an in-memory session lookup, and the request body.

The runner had already called this exact route once earlier in the same run,
at startup, so a first-hit compile does not explain the stall. The best
supported explanation is the Next **dev** server itself. In dev mode, every
request waits for Turbopack to finish processing its latest update to the
route list. Two other settings make those updates and cold compiles likely:
the Lab points Turbopack's watched root at the whole drive, and each run starts
with an empty `.next`.

The fix that removes the whole failure class is downstream: run the Lab's Core
panel from a production build (`next build` once, `next start` per run). Core
already supports and documents this. No Core change is needed.

## What changed and why

Nothing in either repository. One scratch script was written outside both
checkouts to count import graphs statically:
`C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\3454178a-dd53-4d6d-917d-85b8f63d0d91\scratchpad\bt-w14-graph.mjs`.

## Answers

### 1. The handler and everything it awaits

The route is `apps/web/src/app/api/client-gateway/automation-studio-context/route.ts`.

- `:6` awaits `requireFluxIQUser()`. That function (`apps/web/src/lib/auth.ts:13-17`) awaits:
  - `cookies()` (`auth.ts:7`), and
  - `getFluxIQ().programs.identityAccess.validateSession(sessionId)` (`auth.ts:10`).
- `:9` awaits `request.json()`.
- `:13` calls `setAutomationStudioWebContext`, which is synchronous. It only
  assigns a map entry (`lib/fluxiq.ts:59-62`, `lib/automation-studio-context.ts:9-21`).
- `:14` calls `getFluxIQWebRuntimeStatus`, which is also synchronous
  (`lib/fluxiq.ts:31-57`). It calls `nativeRuntimeSummary`, which only counts
  in-memory definitions (`packages/fluxiq/src/programs/automation-studio/runtime/service.ts:806-813`),
  and `reusableLlmContextStatus`, which only reads fields (`service.ts:1681-1687`).

`validateSession` is in `packages/fluxiq/src/programs/identity-access/runtime/service.ts:294-308`:

- `load()` touches storage only once per process, because the `loaded` flag
  guards it (`service.ts:408-416`).
- A session found in memory returns with no further I/O (`:297`, `:302-307`).
- A session **missing** from memory calls `reloadFromStore()` (`:298-299`), which
  calls `repository.list({})` (`:482-484`). That repository is the SQLite
  repository for `identity.users` (`programs/_shared/runtime.ts:56,70`).
  - Its operations queue behind a promise lock per file, in JavaScript
    (`database-manager/storage/sqlite-repository.ts:144`, `:205`, `:235-250`).
  - The file is `global.sqlite` (`:163`). Background tasks and secret keys
    share it (`_shared/runtime.ts:55-57`).
  - Each operation opens the database, sets `busyTimeout` 10 000 ms (`:231`),
    runs `mkdirSync` (`:124`), and closes again (`:146-150`).
  - So a session **miss** can wait behind other `global.sqlite` work, and on a
    locked file for up to 10 s per operation.
  - The runner's session is created in this same process by `/api/auth/login`
    (`app/api/auth/login/route.ts:56-61`, which calls `createSession` and so
    `sessions.set` at `service.ts:289`). That session is therefore in memory,
    and this path should not run.

Other questions from the brief:

- **Gateway, WebSocket, or client acknowledgement**: none. No awaited code
  touches the gateway. `getFluxIQ()` starts the shared gateway only if it is not
  already running, and that start is synchronous (`lib/fluxiq.ts:25-28`, `:220-232`).
- **Recording finalization**: not awaited anywhere on this path.
- **A `clientId` naming a client that is reconnecting**: nothing happens. The
  `clientId` is only part of a map key (`automation-studio-context.ts:14`,
  `:85-87`). No client is looked up, and nothing checks whether it is connected.
  It matters later, when a recording starts
  (`lib/fluxiq.ts:113-133`, `automation-studio-context.ts:66-83`).
- **Blocking by another request**: possible only by starving the event loop.
  The FluxIQ runtime, its SQLite callbacks, and the gateway WebSocket server all
  run in the Next server process (`lib/fluxiq.ts:228-230`). Synchronous work
  there delays every HTTP request. I found no synchronous filesystem calls on
  the gateway, identity, or recording paths. A grep across non-test
  `packages/fluxiq/src` found only these:
  - `framework/storage-layout.ts:42`, `:133`
  - `framework/index.ts:455`
  - `programs/_shared/storage.ts:234`
  - `database-manager/storage/sqlite-repository.ts:105`, `:110`, `:124`
    (the `mkdirSync` at `:124` runs on every repository open)

  I did not audit CPU-heavy synchronous work such as JSON handling of large
  documents.

### 2. How large the module graph is

These counts come from a static walk of imports that are not type-only. The
`fluxiq` package resolves to `packages/fluxiq/dist` through its `exports`.

| Entry | Files | Size | From `fluxiq` |
| --- | --- | --- | --- |
| POST automation-studio-context | 494 | 2.55 MiB | 489 files, 2.52 MiB |
| POST auth/login | 495 | 2.56 MiB | 489 files |
| GET client-gateway/snapshot | 494 | 2.55 MiB | 489 files |
| instrumentation | 493 | 2.55 MiB | 489 files |
| GET / (page + layout) | 549 | 2.64 MiB | 489 files |

The graph is dominated by `packages/fluxiq/dist/programs/automation-studio`, at
372 files and 2.22 MiB. Next are `programs/_shared` (50 KiB),
`framework` (43 KiB), `client-gateway/service` (39 KiB), and
`programs/identity-access` (36 KiB).

The whole framework barrel is pulled in because
`lib/fluxiq.ts:1` imports `FluxIQ` from `"fluxiq"`, and every API route imports
`lib/fluxiq`. `transpilePackages: ["fluxiq"]` makes Turbopack bundle it rather
than leave it external (`apps/web/next.config.ts:4`, downstream
`coordinator.ts:280`). The `/` graph shares 493 of this route's 494 files.

Why a first-hit compile does **not** explain the Flow-lane timeout: the runner
posts this same route at startup. `coordinator.ts:137` calls `selectProject`
(`http-control/index.ts:112-114`). The Flow lane posts it again
(`flow-lane/persisted-flow-run.ts:170` via `existing-fluxiq-control.ts:239`).
By the time the lane runs, the route has been compiled. The 30 s bound is the
default at `http-control/index.ts:236-237`.

A recompile or entrypoint wait does fit, through this mechanism in Next 15.5.23 dev:

- The Lab writes `turbopack: { root: <drive root> }` (downstream `coordinator.ts:277-281`).
- Next uses that value as Turbopack's `rootPath`, with file watching enabled
  whenever it is in dev mode
  (`next/dist/server/dev/hot-reloader-turbopack.js:164-174`).
- Every run's files live on that same drive (`allocation.ts:42-55`). Each run
  copies `apps/web`, mirrors `node_modules`, and creates junctions
  (`coordinator.ts:264-276`). It also writes SQLite and WAL files, logs, and a
  browser profile. With two concurrent runs, each server watches the other's writes.
- Each Turbopack entrypoints update re-arms `currentEntriesHandling`
  (`hot-reloader-turbopack.js:457-460`). It is resolved only after
  `handleEntrypoints` finishes (`:492-493`).
- `ensurePage` awaits it (`:822`), and the dev server calls `ensurePage` before
  loading page components (`next/dist/server/dev/next-dev-server.js:697`).
- While an update is being handled, or a changed module is being recompiled,
  a request to an already-compiled route waits.

Separately, every run compiles cold, because the workspace copy excludes `.next`
(`coordinator.ts:267`). That fits the two earlier events: `GET /` not ready in
60 s (`coordinator.ts:113`, default at `http-control/index.ts:8`), and the
first `/api/auth/login` compile running at 74 s.

### 3. Running the panel from a production build

Core supports it. The scripts in `apps/web/package.json` are:

- `"build": "next build --turbopack"`
- `"start": "next start --hostname 127.0.0.1"`
- the root `build` script chains contracts, then `fluxiq`, then
  client-gateway-websocket, then web.

Core's own documentation says development-server measurements are diagnostic
only, and that accepted performance measurements "must target a production
`next start` host" (`docs/operations/web-panel-responsive-visual-certification.md:76-79`,
with build and start commands at `:81-90`). A production build with the runtime
host module loader passed `next build` (exit 0) at
`docs/working/mvp-week1-web-automation-reliability-plan/reports/core-host-loading.md:129,133`.
That report also records that no live `next start` was run (`:174`).

There is no `output: "standalone"` (`next.config.ts:3-5`). Standalone is not needed.

What production mode removes:

- The file watcher, since `watch.enable: dev` (`hot-reloader-turbopack.js:171-172`).
- Compile on demand. `preloadEntriesOnStart` defaults to true
  (`next/dist/server/config-shared.js:153`), and the production server preloads
  all entries at start (`next/dist/server/next-server.js:535-537`).

Cost:

- **Once per build**: one `next build` whenever Core's web source or
  `packages/fluxiq/dist` changes. I did not measure its duration because builds
  were out of scope.
- **What does not require a rebuild**:
  - The downstream host module, which loads at runtime through a native
    `import()` that Turbopack ignores (`lib/fluxiq.ts:193-197`, `src/instrumentation.ts`).
  - The `FLUXIQ_*` settings, which are read from `process.env` at runtime
    (`lib/fluxiq.ts:184,217,221-227,266`).
- **Per run**: copy or link a prebuilt `.next`, then start the server. There is
  no compile, no watcher, and no memory spent on Turbopack.

Risks to check when switching:

- With `NODE_ENV=production`, the login cookie gets `secure`
  (`app/api/auth/login/route.ts:86`). The runner's Node-side cookie handling
  should be unaffected. Browsers generally treat `http://127.0.0.1` as a secure
  origin. This was not verified here.
- The prebuilt output has to match the Lab workspace layout: the copied
  `apps/web`, the `packages` junction, and `turbopack.root`
  (`coordinator.ts:259-286`). The simplest option is to build once inside a
  prepared workspace and reuse it.
- Cache the build by Core HEAD plus a hash of `packages/fluxiq/dist`.

### 4. Warm-up

Core has no health route and no warm-up. The only API routes are
`auth/login`, `auth/logout`, `client-gateway/{approve-pairing, automation-studio-context, dismiss-pairing, snapshot}`,
`framework/{io, io/validate, setup}`, `programs/...`, and `recordings`.

In dev, Next has no supported way to precompile routes other than requesting
them. In production, Next already preloads every entry
(`next-server.js:535-537`). A Core warm-up that requests routes would therefore
be dev-only test-harness behavior. It is not generic Core behavior, and it would
not stop recompiles caused by watcher events.

A generic readiness route could still be useful Core behavior: a
`GET /api/health` that awaits `getFluxIQ()` and reports whether the gateway is
listening (`lib/fluxiq.ts:43-45`). It would give readiness a real contract, but
it only moves compile time around. It is not the fix.

### 5. The readiness probe's compile cost

The Lab's readiness probe is `GET /` (`coordinator.ts:112-117`). That compiles
`app/page.tsx` and `app/layout.tsx`:

- `page.tsx:1,4-5` imports `fluxiq`, `lib/auth`, and `lib/fluxiq`.
- `layout.tsx:3-5` imports `GlobalClientGatewayPairing`, `features/programs/shared-ui`, and `lib/auth`.

Statically that is 549 files and 2.64 MiB, the largest graph measured, and it
must be built for the React server, SSR, and client layers. So yes: the
readiness probe triggers the biggest compile in the application.

### 6. Recommended fix

**Downstream** (FluxIQWebExtension `packages/test-runner`). Core needs no change.

1. In `packages/test-runner/src/coordinator.ts:104-111`, start the panel with
   `next start --hostname 127.0.0.1 --port <port>` instead of
   `next dev --turbopack`. Point it at a `.next` built once per Core revision.
   - Add a cached, locked build step next to `prepareWebWorkspace`
     (`coordinator.ts:259-286`), keyed by Core HEAD plus a `packages/fluxiq/dist`
     hash, and run `next build`.
   - Stop excluding `.next` at `coordinator.ts:267`, or link the cached build.
   - Apply the same change to `demo-workspace/core-process.ts:70-90`, which
     reuses `prepareWebWorkspace`.

   This removes both parts of the failure class: compile on demand, which covers
   the `GET /` readiness timeout and the slow first login, and dev-watcher
   entrypoint waits on already-compiled routes. Retries are not needed.
2. If dev mode must stay for any lane, stop using the drive root as
   `turbopack.root` (`coordinator.ts:281`). This may not be possible while the
   run base and `F:\!FluxIQ\packages` share only the drive root. That is one
   more reason to prefer option 1.

## Commands run and observed results

- `git status --short` in both checkouts, at the start and before writing: empty output both times.
- `node <scratchpad>\bt-w14-graph.mjs`: printed the graph counts in answer 2.
  Static analysis only; no build, test, or server.
- Greps and reads of Core source, Next 15.5.23 `dist` internals, and the
  downstream runner files cited above. No tests, builds, or servers were run,
  and no process was stopped.

## Not verified

- No runtime evidence. I did not read the failing run's Core log (`logs/core`),
  because the brief did not name it. That log decides the question: a
  `Compiling ... automation-studio-context` or `Compiled` line near the timeout
  confirms the dev recompile or entrypoint wait. Its absence points to
  event-loop starvation or a session miss.
- Whether writes outside the module graph, under a drive-root Turbopack watch
  on Windows, actually produce entrypoint updates or rescans. The stall
  mechanism is traced through code, not observed.
- That app route handlers reach `ensurePage` with `shouldEnsure` true in dev. I
  followed `next-dev-server.js:685-705`, not every caller.
- The duration of `next build`, whether `next start` works with the Lab's copied
  workspace and junction layout, and how the `secure` cookie behaves on `127.0.0.1`.
- CPU-heavy synchronous work in the FluxIQ runtime during recording.
- The failure was observed once in six runs, on a machine with faulty RAM. That
  weakens any conclusion drawn from a single event.

## Open questions or contradictions found

- The brief's premise of a "first-hit compile" does not hold for this route in a
  run with credentials. `coordinator.ts:137` posts it at startup, before the Flow
  lane. If the failing run skipped `control.selectProject` (for example a target
  without credentials), a first-hit compile is back in play.
- The "Core health readiness" check is not a health route. It is `GET /`, the
  page with the largest graph.
- A session missing from the in-memory cache routes `validateSession` through
  the shared `global.sqlite` queue with a 10 s busy timeout. That is a latent
  way for any authenticated route to stall under database contention, even
  though it should not trigger in this run.
