# bs-w14-runner-sequence: why W14 Flow run 2 timed out on project.select

Read-only diagnosis. Repositories: `F:\!FluxIQWebExtension` (runner) and `F:\!FluxIQ` (Core, read only for route
layout, scripts and Next internals). Run: `bench-shard1-d0825d39-c35-a1`, bundle
`F:\fxlab-runs\sharded-final-2\b\bench-shard1-d0825d39-c35-a1`. Questions 7 and 8 were added mid-task.

## Outcome

Done. The call that timed out was **not** a post-recording call. It was the first `selectProject` inside
topology startup, `coordinator.ts:137`, sent with no `flowId` and no `clientId`. Zero steps had run and no
browser had launched.

That request was the first request ever made to `/api/client-gateway/automation-studio-context` in a Core
process that `next dev --turbopack` had started seconds earlier (`coordinator.ts:104-106`). The route was
therefore compiled on demand inside the 30 s operation bound. The handler itself is trivial.

Two loads were running during that window. The machine-wide slot pool allows at most two isolated runs at
once (`acquire-machine-cell-slot.ts:118`), so at most one other Core was running. Queued cells were
polling the pool, and each poll starts one `powershell.exe` per slot owner (`bench/campaign/lease.ts:203-222`).

Every piece of evidence points to a cold route compile under load, not a hung handler. It cannot be
proven, because the runner deletes Core's log on exactly this failure path.

Answers to the two added questions:
- **Q7:** runs share no working directory, `.next` or Turbopack cache. The one cross-run coupling in the
  spawn spec is `turbopack.root` set to the whole `F:\` drive, which is unverified as a stall cause.
- **Q8:** a run's footprint is about 3.1 GB, of which the dev Core is about 2.5 GB. A production build
  would cut an estimated 1.7-2.2 GB per run. Holds shorten fully only if the gate's 3 GiB per slot is
  retuned to match.

The root-cause fix belongs in this repository: serve the isolated Lab Core from a production build
(`next build` once per Lab instance, `next start` per run). A second, independent fix is to stop starting
PowerShell on every 100 ms slot poll.

## What changed and why

Nothing in either repository. The brief was read-only. This report and its folder
`F:\fxlab-runs\sharded-final-2\reports\` are the only files created. `git status --porcelain` shows 0
entries in both repositories (see Commands).

**Correction to my first version:** it said four Lab cells overlapped. That came from folder
finalize times alone. The slot gate caps concurrent isolated runs machine-wide at two, so the other cells
in that window were queued, not executing. The brief's "two cells concurrently" is right.

## Findings

### 1. Every Core HTTP request a Flow-lane isolated run makes, in order, with bounds

Default bounds: `boundedFetch` uses `boundedTimeout(undefined)`, which is 30 000 ms
(`http-control/index.ts:165-171, 236-240`). `waitForHttp` defaults to 60 000 ms
(`http-control/index.ts:8`). No caller passes `startupTimeoutMs`; it is read only in `coordinator.ts`
(`:100, :115, :122`) and not set at `run-scenario.ts:160`. No caller passes HTTP bounds either:
`coordinator.ts:128,135,137`, `run-scenario.ts:293`, and the Flow lane (`run-flow-lane.ts:99`, where
`input.bounds` is never set at `run-scenario.ts:345-381`).

**Topology startup** (`startTopology`, before any browser exists):

| # | Request | Where | Bound |
|---|---|---|---|
| 0 | GET scenario-lab `/__control/health` (not Core) | `coordinator.ts:97-102` | 60 s poll (`http-control/index.ts:8,21`) |
| 1 | GET Core `/` (core.health) | `coordinator.ts:113-117` | 60 s poll; each attempt has no per-request timeout (`http-control/index.ts:14-17`) |
| 2 | GET `/api/client-gateway/snapshot`, unauthenticated, starts the gateway | `coordinator.ts:118-121` | **Unbounded** (run signal only); errors swallowed |
| — | TCP connect to the gateway port (not HTTP) | `coordinator.ts:122, 331-344` | 60 s |
| 3 | POST `/api/auth/login` | `coordinator.ts:128` → `http-control/index.ts:48-57, 77-80` | 30 s, stage `auth.login` |
| 4 | POST `/api/programs/automation-studio/create-project?domainId=web-automation` | `coordinator.ts:135` → `http-control/index.ts:91-94, 132-147` | 30 s, stage `project.create` |
| **5** | **POST `/api/client-gateway/automation-studio-context` `{activeProjectId}`, no flowId, no clientId** | **`coordinator.ts:137` → `http-control/index.ts:112-113`** | **30 s, stage `project.select`: FAILED HERE** |

**Run body** (`run-scenario.ts`, never reached by this run):

| # | Request | Where | Bound |
|---|---|---|---|
| 6 | POST `/api/client-gateway/approve-pairing` | `run-scenario.ts:231, 570-575` → `run-lifecycle/pair-extension.ts:77` → `http-control/index.ts:116-117` | 30 s; pairing wait 15 s (`pair-extension.ts:29`) |
| 7-8 | POST `.../execute-client-action` ×2 (Core probe) | `run-scenario.ts:288, 595, 604` → `http-control/index.ts:128-129` | 30 s each |
| 9 | POST `.../list-recordings` (baseline) | `run-scenario.ts:289` → `http-control/index.ts:124-125` | 30 s |
| 10 | POST `automation-studio-context`, second hit, no flowId/clientId | `run-scenario.ts:293` | 30 s, `project.select` |
| — | *(recording script runs; the extension may call GET snapshot with a bearer token, `apps/extension/src/background/connection/core-api.ts:39`, and PUT `state-assets`, `core-api.ts:79`)* | | extension-side, no runner bound |
| 11 | GET `/api/client-gateway/snapshot` (authenticated) | `run-scenario.ts:323, 637` → `http-control/index.ts:120-121` | 30 s |
| 12 | POST `list-recordings`, polled | `run-scenario.ts:640-642` | 5 s loop, 30 s per call |
| 13 | POST `list-recordings {summaries:true}` (finalization wait) | `run-scenario.ts:651` → `flow-lane/finalized-recording.ts:187` | 90 s total (`finalized-recording.ts:75, 94`), 30 s per call |
| 14 | GET snapshot (discard audit, first read) | `run-scenario.ts:329` | 30 s |
| 15 | POST `get-recording` per recording | `run-scenario.ts:333` → `run-expectations/recording-completeness.ts:65` | 30 s |

**Flow lane** (`runFlowLane`, `run-scenario.ts:345`). Every `automationStudioCall` goes through
`existing-fluxiq-control.ts:61-66`, 30 s:

| # | Request | Where |
|---|---|---|
| 16 | `list-recordings` (finalization wait again, 90 s total) | `run-flow-lane.ts:104` → `finalized-recording.ts:187` |
| 17 | `create-recording-flow-proposals` | `run-flow-lane.ts:105` → `recording-flow-proposal.ts:39` |
| 18 | `review-recording-flow-proposal` | `run-flow-lane.ts:109` → `recording-flow-proposal.ts:112` |
| — | scenario-lab reset (not Core, 5 s) | `run-flow-lane.ts:115` → `reset-scenario-lab.ts:17` |
| 19-20 | `get-flow`, `list-flow-subflows` | `run-flow-lane.ts:121` → `flow-action-types.ts:72, 83` |
| 21 | `automation-studio-context` **with `activeFlowId`**, third hit | `run-flow-lane.ts:144` → `persisted-flow-run.ts:170` → `existing-fluxiq-control.ts:239` → `http-control/index.ts:112-113` |
| 22 | `start-runtime-session` | `persisted-flow-run.ts:172` → `existing-fluxiq-control.ts:241-242` |
| 23 | `run-runtime-session`; on a bounded timeout, `get-flow-run-detail` is polled for up to 90 s | `persisted-flow-run.ts:177, 184, 16, 234` |
| 24 | `get-flow-run-detail` | `persisted-flow-run.ts:187, 276` |
| 25 | GET snapshot (second discard read, up to 2 fetches) | `run-scenario.ts:459-462` |

**Which selectProject failed: #5, `coordinator.ts:137`, without flowId or clientId.** Evidence (structure
only; no messages were read):

- `run.json` has `ports: {}` and `processExits: {}`. `run-manifest/create-run-manifest.ts:80-81` writes
  `{}` only when `topology` is undefined. So `startTopology` threw, and the assignment at
  `run-scenario.ts:160` never completed.
- The bundle has no `logs/`. `copyProcessLogs` runs only `if (topology)` (`run-scenario.ts:484`).
- `events.ndjson` holds exactly 1 event, trigger `error`, with detail keys `failureCategory|capture` only.
  There is no `step.start`, which `run-scenario.ts:307` would emit per step. `run.json` has `steps` of
  length 0 and `actions` of length 0 (`run-scenario.ts:522`).
- Call #10 comes after browser launch (`run-scenario.ts:210`) and pairing (`:231`). Call #21 requires the
  Flow lane, which would have written `snapshots/flow-lane.json` (`:375`). Neither happened.
- The facility stage `scenario.execute` is set at `run-scenario.ts:141`, before `startTopology` at
  `:160`. It is projected at `:396`. The `http.timeout / project.select / 30000` shape comes from the
  timer details at `http-control/index.ts:171`, projected by
  `facility-failure/project-facility-failure.ts:41-42, 58-68`.
- **"metrics.steps 3" is not three recorded steps.** `metrics = { steps: workflow.recordingScript.length }`
  (`run-scenario.ts:525`) is the script length. It is published unchanged whether or not any step ran
  (`run-evaluation/single-run-evaluation.ts:79`).
- The 92,820 ms also covers bundle initialization, the rest of startup, the 30 s wait, process-tree
  teardown (`coordinator.ts:150` → `process-supervisor.ts:80-90, 101-109`, which runs
  `taskkill /T /F` and waits up to 2 s per process), run-root removal (`coordinator.ts:151`), redaction
  attestation (`run-scenario.ts:489-499`), and finalize.

### 2. Was the route already requested earlier in that Core process's life?

**No. #5 was the route's first hit.** The earlier requests in that process were `/` (#1), `snapshot` (#2),
`auth/login` (#3) and `programs/[programId]/[endpoint]` (#4). In Core each of these is its own route
module: `apps/web/src/app/api/auth/login/route.ts`, `.../client-gateway/snapshot/route.ts`,
`.../programs/[programId]/[endpoint]/route.ts`, and `.../client-gateway/automation-studio-context/route.ts`.
The context route had never been requested, so `next dev` (`coordinator.ts:106`) compiled it inside
#5's bound.

Its shared imports (`lib/auth`, `lib/fluxiq`; context `route.ts:2-3`) were already compiled for the
snapshot route (`snapshot/route.ts:2-3`). The incremental compile is therefore small, and 30 s for it
points at contention rather than compile size. This is an inference.

The handler cannot plausibly hang long. It awaits `requireFluxIQUser` → `cookies()` +
`identityAccess.validateSession` (Core `lib/auth.ts:6-17`), then calls two synchronous functions,
`setAutomationStudioWebContext` (`lib/fluxiq.ts:59-62`) and `getFluxIQWebRuntimeStatus`
(`lib/fluxiq.ts:31+`). `validateSession` had just succeeded for create-project (`[endpoint]/route.ts:33-36`).

**Routes first hit only after recording:** none from the runner in a healthy run. Every post-recording
runner request (#11-#25) reuses snapshot (#2), `[programId]/[endpoint]` (#4) or automation-studio-context
(#5), all compiled during startup. `approve-pairing` is first hit at pairing (#6), before recording. The
only separate route module that can first be hit during or after recording is the extension's PUT
`/api/programs/automation-studio/state-assets/[projectId]/[sha256]` (`core-api.ts:79`; Core
`state-assets/[projectId]/[sha256]/route.ts`), which has no runner bound. Not checked: whether individual
endpoints behind `[programId]/[endpoint]` lazily load their own code on first call.

### 3. Pre-warm, warm-up, production build or `next start`?

- **Readiness pre-warms only two things.** `/` via core.health (`coordinator.ts:113`) compiles the root
  page. The unauthenticated snapshot probe (`coordinator.ts:118-121`) compiles one API route, to start
  the gateway rather than as a warm-up; it has no timeout and swallows errors. No other API route is
  touched before #3-#5.
- **There is no production-build or `next start` path.** `coordinator.ts:104-106` and
  `demo-workspace/core-process.ts:86-89` both spawn `next dev --turbopack`. `prepareWebWorkspace`
  excludes `.next` from the per-run copy (`coordinator.ts:267`) and writes a dev-oriented
  `next.config.mjs` with `turbopack.root` (`coordinator.ts:278-284`). The demo path is the same shape:
  60 s readiness (`core-process.ts:99`), a snapshot probe bounded at 30 s (`core-process.ts:100`), and
  60 s TCP (`core-process.ts:101`).
- **Core already has a build path, but the Lab does not use it.** `apps/web/package.json` has
  `"build": "next build --turbopack"` and `"start": "next start --hostname 127.0.0.1"`. A `.next` with
  `BUILD_ID` exists in the Core checkout (last write 2026-09-13T11:41:01), and the Lab does not use it.
- **Core has no server-side warm-up.** Core `src/instrumentation.ts` `register()` only loads the host
  module. The `warm` matches under Core `apps/web/src` are UI-only (for example
  `features/automation-studio/workspace/commands/warm-activation.ts`).

### 4. Where the 30 s and 60 s bounds are set, and what they can tell apart

- **30 s:** `http-control/index.ts:236-240` (`boundedTimeout` default), applied by `boundedFetch`
  (`:165-171`).
- **60 s:** `http-control/index.ts:8` (`waitForHttp`) for `scenario.health` and `core.health`
  (`coordinator.ts:97-117`); TCP gateway `coordinator.ts:122`. Projected as `readiness.timeout` via
  `http-control/index.ts:208-221` and `project-facility-failure.ts:27-31`.
- **Neither bound can tell a cold compile from a hung handler.** `fetch` resolves on response headers,
  so the 30 s window covers accept, Next's on-demand compile, auth and the handler together. The timeout
  records only `{bounded, operationStage, timeoutMs}` (`http-control/index.ts:171`). The projection keeps
  only `reason/operationStage/timeoutMs` (`project-facility-failure.ts:58-68`). Nothing records whether
  the route was hit before, and Core's log is deleted (item 5).
- **Side note:** each `waitForHttp` attempt has no per-request timeout (`http-control/index.ts:14-17`),
  and the deadline is checked only between attempts (`:11`). A single stalled attempt can therefore run
  past 60 s.

### 5. Retained Core stdout/stderr or per-run logs under `F:\fxlab-runs\sharded-final-2\b`

**None.** Paths, sizes and timestamps only:

- `F:\fxlab-runs\sharded-final-2\b\.work\`: empty when listed (directory mtime 2026-09-14 20:40:18 -0700).
  `a\.work\` was also empty (20:43:21).
- Bundle contents (all 2026-09-14 20:21:12.73 to 20:21:13.38 -0700): `artifact-index.json` 2295 B,
  `bench-receipt.json` 476, `bundle.complete.json` 122, `evaluation.json` 1234, `events.ndjson` 356,
  `evidence-policy.json` 158, `report.html` 956, `review/contact-sheet.html` 314, `review/timeline.json` 448,
  `run.json` 1617, `snapshots/redaction-attestation.json` 129, `summary.json` 417. There is no `logs/`.

**Why nothing is retained.** Core output goes to `<runRoot>/logs/core.log` (`coordinator.ts:110`;
`process-supervisor.ts:39, 56-57, 128-130`). `runRoot` is `<runsDirectory>/.work/<runId>`
(`run-scenario.ts:156-158`, `allocation.ts:42, 50`). On a startup failure, `startTopology`'s catch deletes
the run root (`coordinator.ts:151, 210-215`) before rethrowing, and `run-scenario` copies logs only when
`topology` is set (`run-scenario.ts:484, 756`). **Every topology startup failure destroys its own Core
log.** On later failures the log is copied first, then deleted (`run-scenario.ts:557`).

### 6. Recommendation

**Root cause, runner side.** Each Lab run starts a fresh Core under the dev compiler
(`coordinator.ts:104-111`) in a freshly copied workspace (`coordinator.ts:91, 259-286`). Every route module
is compiled on its first request inside that run, and those first requests are bounded operations: 60 s at
`coordinator.ts:113`, 30 s at `:128`, `:135` and `:137`.

Load at the time:
- At most two isolated runs execute machine-wide. The slot defaults are capacity 2, reserve 4 GiB,
  3 GiB per slot (`acquire-machine-cell-slot.ts:118-120`). The CLI passes no overrides (`cli.ts:81`), and
  the slot wraps exactly one `runScenario` (`run-bench.ts:344-345`, `sharded-bench.ts:110, 120-128`).
- Folder finalize times fit `a\bench-shard0-bea29d18-c33-a1` (finalized 20:20:54) being the other
  executing run. `b\bench-shard0-0f1bc4b3-c33-a1` and `a\bench-shard1-9c95f372-c36-a1` were probably
  queued tickets.
- A queued ticket loops over every ticket and slot owner, starting `powershell.exe` for each liveness
  check (`acquire-machine-cell-slot.ts:84, 198-215` → `lease.ts:203-206, 215-222`), and sleeps only
  100 ms between loops (`:109, :121`). The supervisor reports a 19 s hold overlapping W14's 30 s window.
  In that window, one queued run kept starting PowerShell processes back to back while this run's Core
  compiled a route.
- The machine has 12 logical processors, 25.8 GB RAM, and faulty RAM.

W05 (`readiness.timeout / core.health / 60000`) and W14 fit the same event hitting different first
requests. W25 (`environment.missing` at 74 s, no stage) is consistent with it but unproven. Startup-path
throws of that category with no stage include `http-control/index.ts:81, 84, 140` and
`existing-fluxiq-control.ts:65, 466`.

**Fix A (removes the class): serve the isolated Lab Core from a production build.**
- Build once per Lab instance before its first run: prepare one workspace and run `next build`.
- Per run, spawn `next start --hostname 127.0.0.1 --port <webPort>` with the per-run environment from
  `buildFluxIQEnvironment` (`environment.ts:56-73`) instead of `dev --turbopack`.
- This removes on-demand compilation from every bounded window, and removes the compiler's CPU, file
  watcher and about 2 GB per Core from contention (item 8). Nothing is retried and no bound changes.

Files (this repository):
- `packages/test-runner/src/coordinator.ts`: `:91`, `:104-111`, and `prepareWebWorkspace` `:259-286`,
  split into prepare-and-build once and start per run.
- `packages/test-runner/src/lab-instance/resolve-lab-paths.ts`: declare the prebuilt Core, mirroring
  `hostPrebuilt` at `:17, :54`.
- The Lab-instance setup that produces the prebuilt host (not read).
- Coordinator tests under `packages/test-runner/src/tests/`.
- `docs/architecture/`.
- `demo-workspace/core-process.ts:86-89` can follow separately.

Why it belongs here, not in Core: Core already ships `build` and `start` scripts. Two runtime reads look
compatible with a build: the host module loads in `register()` (`instrumentation.ts`), and the gateway URL
reads `process.env` at call time (`lib/fluxiq.ts:42`). A Core change is needed only if the web app turns
out to read per-run configuration at build time. `NEXT_PUBLIC_*` usage and statically rendered routes
were not checked.

Stated consequence: `transpilePackages: ["fluxiq"]` (`coordinator.ts:280`) bakes Core packages into the
build, so Core edits made after the build are not picked up.

**Fix B (independent, small): stop starting PowerShell on every 100 ms poll.** For example:
- confirm a live owner with `process.kill(pid, 0)`, and query the start-time identity only once per
  owner or when an owner changes; or
- raise `pollIntervalMs` while the ticket's rank has not changed.

Files: `packages/test-runner/src/bench/campaign/lease.ts:208-222` and
`bench/campaign/machine-slots/acquire-machine-cell-slot.ts:84, 121, 198-216`. This removes a CPU load
that lands exactly while other runs are starting up. It is unmeasured: no CPU sample of the loop exists.

**Stopgap if A cannot land first (reclassifies, does not remove).** After `coordinator.ts:121`:
1. Send side-effect-free GETs to each route module the run will use:
   - `/api/auth/login`, `/api/client-gateway/automation-studio-context` and
     `/api/client-gateway/approve-pairing` are POST-only, so Next should answer 405 after loading the
     module. Not verified live.
   - `/api/programs/automation-studio/projects` unauthenticated answers 401 before any program call
     (`[endpoint]/route.ts:17`).
2. Poll these until non-5xx under `startupTimeoutMs ?? 60_000`, as a new readiness stage (for example
   `core.routes`).
3. Register the stage in `http-control/index.ts:4`, `project-facility-failure.ts:17`, and the
   `facilityFailureOperationStages` vocabulary in `packages/test-contracts` (file not read).

**Diagnostic (small): keep Core's log on a startup failure.** Copy `logs/*.log` into the bundle before
`coordinator.ts:151` removes the run root, or let `run-scenario` own that removal
(`coordinator.ts:147-153`, `run-scenario.ts:484, 756`).

### 7. Do concurrent isolated Core dev servers share a working directory, `.next` or Turbopack cache?

**No. Each run has its own working directory, its own `.next`, and no persistent Turbopack cache.**

- **cwd:** `allocation.webWorkspaceDir` = `<runsDirectory>/.work/<runId>/core-workspace/apps/web`
  (`run-scenario.ts:156-158`; `allocation.ts:42, 48-49`). It is populated by `prepareWebWorkspace`
  (`coordinator.ts:91, 259-286`) and used as the spawn cwd (`coordinator.ts:107`). The source Core web
  package is never the cwd.
- **distDir:** the copy excludes `.next` (`coordinator.ts:267`), and the per-run `next.config.mjs` sets
  only `transpilePackages` and `turbopack.root`, with no `distDir` (`coordinator.ts:278-284`). Next's
  default is `.next` inside the per-run cwd. The Core environment builder adds `PORT` and `FLUXIQ_*`
  values only, with no `NEXT_*` or dist override (`environment.ts:56-73`). Inherited base environment
  values were not inspected.
- **Turbopack persistent cache:** off. Next enables it only for `experimental.turbopackPersistentCaching`
  (`F:\!FluxIQ\node_modules\.pnpm\next@15.5.23_...\next\dist\shared\lib\turbopack\utils.js:281-284`;
  passed at `apps/web/node_modules/next/dist/server/dev/hot-reloader-turbopack.js:197`). The Lab config
  does not set it.
- **Live check (metadata only):** the running run `b\.work\bench-shard1-d0825d39-c43-a1` had
  `core-workspace\apps\web\.next` (mtime 20:51:14, 278 MB about 40 s after the run dir appeared at
  20:50:33). Its `.next\cache` held only `.rscinfo`.
- **Source checkout untouched today:** `F:\!FluxIQ\apps\web\.next` last write 2026-09-13 11:41:01,
  `.next\cache` 2026-09-12 18:03:31, `node_modules\.cache` 2026-09-13 11:34:40. All predate today's
  campaigns, whose `bench` folders were created at 18:35.
- **What is shared, read-only:**
  - `node_modules` entries, as junctions to `F:\!FluxIQ\apps\web\node_modules` (`coordinator.ts:269-270, 288-302`)
  - root `@types/node` (`coordinator.ts:271-274`)
  - the Core `packages` junction (`coordinator.ts:276`)
  - the `next` executable from the source `node_modules` (`coordinator.ts:285`, spawned at `:105`)

  Nothing was observed writing into these.
- **Could shared cache writes stall a request?** They cannot: there is no shared cache.
- **One cross-run coupling that needs no shared cache:** `turbopack.root` is the filesystem root `F:\`
  (`coordinator.ts:277, 281`). Next passes it as Turbopack's `rootPath` with file watching on
  (`hot-reloader-turbopack.js:164-173`). If the native watcher watches `rootPath` recursively on
  Windows, which I believe but could not verify because it is inside the native binding, then each
  dev server receives change events for every write on `F:`. That includes the other run's `.next`
  output (278 MB in about 40 s), Chromium profile writes and bundle writes under `F:\fxlab-runs`. It is
  plausible extra invalidation work during a compile, and unproven. `next start` has no watcher, so
  Fix A removes it too.

### 8. Per-run memory footprint, and would a production build cut it?

**Processes a Flow-lane isolated run spawns:**
- the shard child's own node process, which runs `runScenario` in-process (`run-bench.ts:344`)
- Scenario Lab, `node <scenarioEntrypoint>` (`coordinator.ts:92-95`)
- Core through a shell (`coordinator.ts:104-111`): a cmd shell, the next CLI parent, and the next server
  child
- headed Chromium with the extension (`run-scenario.ts:564-566`), with pages for the side panel (`:568`),
  the scenario (`:227`) and the Core probe tab (`:592-600`)
- host-build is skipped when the host is prebuilt (`run-scenario.ts:160`; otherwise `coordinator.ts:84-89`)

**Live single sample**, 20:51:25. Only one run was executing (`bench-shard1-d0825d39-c43-a1`, about 50 s
in). Processes were grouped by role and no command lines were printed:

| Role | Processes | Working set MB | Private MB |
|---|---|---|---|
| Core next server child | 1 | 2,474 | 2,748 |
| Core next CLI parent + cmd shell | 2 | 66 | 70 |
| Lab Chromium (browser, GPU, 4 renderers, 4 utility) | 10 | 507 | 286 |
| Scenario Lab | 4 matched (about 46 each) | 182 | 303 |
| Campaign and shard node processes (both campaigns, not per run) | 7 | 425 | 606 |
| Non-Lab Chrome (user's browser, not per run) | 30 | 4,852 | 5,803 |

At the same moment `FreePhysicalMemory` was 6,837 MB and free commit was 3,922 MB.

**Estimate per executing run:** Core about 2.54 GB, Chromium about 0.5 GB (likely more later in the run),
Scenario Lab about 0.05 GB, for **about 3.1 GB working set, of which the dev Core is about 80%**. Early
in a run this sits close to the gate's 3 GiB per slot.

**How the gate turns this into holds.** A queued ticket needs
`os.freemem() >= 4 GiB + 3 GiB × (active + rank + 1)` (`acquire-machine-cell-slot.ts:92-95`):
- 7 GiB on an empty machine;
- 10 GiB while one run is active.

With the user's Chrome holding about 4.9 GB and one dev-mode run about 3.1 GB, the sample showed
6.8 GB free, below both thresholds. That fits the supervisor's 20-60 s holds while memory from a finished
run returns.

**Would a production build materially cut it? Yes, for the Core share. This is an estimate, not a
measurement.** `next start` carries no Turbopack compiler state, no file watcher and no HMR. It holds the
Node server, the prebuilt server chunks it has loaded, and the FluxIQ runtime (SQLite, gateway). I
estimate 0.3-0.8 GB for that, which would cut about 1.7-2.2 GB per run, bringing a run from about
3.1 GB to about 0.9-1.4 GB. It also removes the roughly 278 MB of dev output written in each run's first
minute.

Effect on holds: with one run active, free memory would be about 2 GB higher (about 8.8 GB in the
sampled state). That is still under the 10 GiB second-slot threshold, because `bytesPerSlot` is a fixed
3 GiB. Holds shorten materially only if `bytesPerSlot` is retuned to a measured built-Core footprint
(for example 1.5 GiB, giving 7 GiB for the second slot). Measure one built Core's working set in a quiet
window before choosing the number.

## Commands run and observed results

- `ls -la` on `sharded-final-2`, `b`, `b\.work`, `a\.work` and the bundle (recursive): `.work` folders
  empty; bundle as in item 5, no `logs/`.
- A `node -e` structural read of the bundle, printing counts and key names only: prints
  `events 1 triggers error detailKeys failureCategory|capture`; `run.steps 0 run.actions 0`;
  `ports object{}`, `processExits object{}`; artifact paths as listed.
- `ls` of `a` and `b` filtered to 20:15-20:26 mtimes: finalize times as cited in item 6.
- `node -e` on Core `apps/web/package.json` scripts: `build: next build --turbopack`,
  `start: next start --hostname 127.0.0.1`, next `^15.5.23`.
- `find` of Core API route files: auth/login, client-gateway/{approve-pairing, automation-studio-context,
  dismiss-pairing, snapshot}, programs/[programId]/[endpoint], programs/automation-studio/state-assets/...,
  programs/route.ts.
- PowerShell CIM query (20:46): `TotalPhysicalGB=25.8 FreePhysicalGB=9.1 LogicalProcessors=12`;
  Core `.next` exists, `BUILD_ID present=True`.
- Live `.work` listing (20:51): one run dir, `.next` 278M, `.next/cache/.rscinfo` only; source `.next`,
  `.next/cache` and `node_modules/.cache` mtimes as in item 7.
- A PowerShell `Win32_Process` aggregate by role (20:51:25): the item 8 table; `FreePhysical_MB=6837
  CommitFree_MB=3922`.
- Greps: `acquireMachineCellSlot` callers (`sharded-bench.ts:110-128`, `run-bench.ts:344-345`); lease
  probe (`lease.ts:203-222`); `isPersistentCachingEnabled` (Next `utils.js:281-284`); `rootPath` and
  `watch` in `hot-reloader-turbopack.js:164-197`.
- `git --no-optional-locks status --porcelain | wc -l` in both repositories: `0` and `0`.

## Not verified

- **Compile versus hang is not proven.** No Core log survives. The conclusion rests on the route being on
  its first hit plus a trivial handler, a single observation.
- **Which run executed alongside W14** is inferred from folder finalize times plus the capacity-2 gate,
  not from slot history.
- **The PowerShell poll loop's CPU cost** was not measured.
- **Turbopack's recursive watch on `rootPath` (`F:\`)** is my understanding of native code, not verified.
- **Memory figures come from one sample** of one run about 50 s in; Chromium and Core may peak later.
  Four Scenario-Lab-classified node processes with only one Core live is unexplained: either my classifier
  matched non-server processes, or Scenario Lab servers outlived their runs. Worth a check.
- **The production-build footprint (0.3-0.8 GB) is an estimate.** Next's 405 behavior for the warm-up
  and `next start` compatibility with Core's per-run environment were not tested.
- **Not checked:** endpoint-level lazy loading behind `[programId]/[endpoint]`.
- **Not read:** `bench/sharded-bench.ts` beyond the slot wiring; the isolated target is inferred from
  `run-scenario.ts:70, 156-158` and the populated `.work`.
- **W05 and W25 were not examined;** only candidate throw sites are named.
- **Deliberately not read:** event summaries, logs, environment values, command lines and page data.

## Open questions or contradictions found

- The brief says "project.select ... after 3 recorded steps". Zero steps ran. `metrics.steps` is the
  script length (`run-scenario.ts:525`), and the failure was before browser launch.
- My first version of this report claimed four concurrent cells. That was wrong, and corrected above;
  the brief's two is right.
- The gate's static 4 GiB reserve and 3 GiB per slot, together with the user's browser (about 4.9 GB),
  keep free memory near the thresholds. Holds are then set by the host's other memory as much as by the
  Lab.
- The snapshot probe at `coordinator.ts:121` is unbounded, unlike the demo path's 30 s
  (`core-process.ts:100`). It is not implicated here.
- `waitForHttp` can exceed its own 60 s deadline on a single stalled attempt
  (`http-control/index.ts:11-18`).
