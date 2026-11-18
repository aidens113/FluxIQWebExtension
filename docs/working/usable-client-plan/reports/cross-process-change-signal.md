# cross-process-change-signal (follow-up 7): investigation report

Worker: worker-heavy. Read-only. Core: `C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ` at `297f26ff9` (Merge task t921). Nothing was edited, built or committed. Core paths below are relative to `packages/fluxiq/src/` unless they start with `apps/` or `docs/`.

## Outcome

Done. No shipped configuration runs a second process that writes a signalled store while the panel runs. Two unguarded ways to start one do exist, and nothing refuses them. A separate defect was found inside the single process, and it is live today: in the production build, the panel stream's `activity` topic listens to a different copy of the activity hub than the one runs publish to. Recommendation: (1) give the activity hub to the route from the instance; (2) enforce one serving process per data root; (3) if several processes ever must serve one root, add a durable change journal. Detail below.

## 1. Signals, the store each describes, and its writers

| Signal (raised at) | Store it describes | Writers |
| --- | --- | --- |
| Conversation hub `signal()`: `runtime/conversations/conversations.ts:571` (project threads), `runtime/conversations/assistant/store/panel-threads.ts:142` (panel threads). Hub: `signals/hub.ts`, instance member `conversations.ts:156` | Per-project SQLite DB (`conversations`, `conversation_turns`, asks), plus the reserved panel-thread DB. Each write also appends to that DB's `change_feed` in the same transaction (`store.ts:145,177,216,258`; `framework/persistence/automation/project/unit-of-work.ts:117-125`) | Only `AutomationStudioConversations` and `PanelAssistantThreads`. All SQL writes are in `runtime/conversations/store.ts` (grep: 10 write statements, none elsewhere). They are reached from routes, gateway handlers, runs and asks in whichever process holds the instance |
| Activity hub `publish()`: `runtime/activity/emit.ts:26` → module singleton `runtime/activity/default-hub.ts:4` | No store. The hub keeps the recent events per project in memory (`runtime/activity/hub.ts:27-33`) | Runs executing in the process (`emit.ts`, AsyncLocalStorage frame) |
| Gateway change feed: `client-gateway/service/change-feed/feed.ts:55-65` (audit security events and `session.ready`/`session.disconnected`), `client-gateway/service/pairings.ts:99,131` | Pairings and live sessions, in memory in the gateway process. Trusted clients are in the browser-trust SQLite | That process's gateway, and panel routes acting on it |
| `server.project_access_ended`: `client-gateway/service/project-focus/activity-delivery.ts:214` | Derived from the three rows below, through `installPairedProjectFocus` (`programs/automation-studio/api/project-focus/authority.ts:85`) | See the three rows below |
| `server.conversation_changed`: `client-gateway/service/project-focus/conversation-delivery.ts` | Fed by the conversation hub through `project-focus/conversation-relay.ts` | As for the conversation hub |
| IAM `iamStoreChanges.announce`: `platform/iam/store/context/store-scope.ts:40`. Module singleton `announced-changes.ts:21`; heard through `programs/_shared/iam/program-iam-gate.ts:119-128` and `api.ts:316` (`caller-reads.ts:52`, `authority.ts:85`) | IAM SQLite repository (`platform.iam`) | Panel IAM routes, the provisioning listener (in-process), and `fluxiq accounts` offline (see 2) |
| Identity `directoryChanges.observe`: `programs/identity-access/runtime/service.ts:84,579` (in `persist()`) | Identity repository (users, roles, sessions) | The identity service in each process that opens the root. `revokeUserSessions` already reloads from the store for another process's sessions (`service.ts:448-451`) |
| Project removals: `framework/automation-service/service/projects/removals.ts` `run()`, called at `service.ts:3758` | Project catalogue and project files | `deleteProject` in the process that runs it |

Process-local by design (code comments): `signals/hub.ts` ("In-process only… hosted follow-up 7"), `announced-changes.ts:13-20` ("A write made by another process is not announced here"), and `apps/web/src/app/api/panel/changes/route.ts` header. Two places already plan for another writer: run parking polls the ask row "as the backstop for an answer written by another process" (`runtime/automation-parking/conversation-port.ts:170-175`), and run control says a run "executing in another process is not live here" (`framework/automation-service/run-control/registry.ts:7`).

## 2. Can a writer run in another process at the same time as the panel?

- **Next.js itself: no.** The panel the person uses is the production build (`!FluxIQWebExtension/scripts/run-fluxiq-web.mjs:33-45`, `next start`). `next start` calls `startServer` in-process with no fork (`apps/web/node_modules/next/dist/cli/next-start.js:30`). The image runs `node apps/web/server.js`, standalone and one process (`deploy/docker/Dockerfile:117`). Neither compose file has replicas or a second service on `/data` (`deploy/compose/*.compose.yml`). The hosted plan's Current State says "one process per deployment". The client gateway runs inside that process: it is native-imported by `apps/web/src/server/gateway-runtime/load.ts` and started by the web runtime.
- **Background work: in-process.** Grep of `packages/fluxiq/src` and `apps/web/src` finds no `worker_threads`, `cluster` or `fork`. The only `child_process` uses are `execFile` for the FluxNode owner-liveness check, deployment-sync's `execFile` and a Windows keyring `spawnSync`. None of them opens an instance. The `new Worker` hits are browser-side.
- **`fluxiq dev` (Core CLI, the FluxNode engine): yes, if pointed at the panel's root.** It opens a full instance and serves it, gateway included (`server/cli/run-dev.ts`). Its default root is `~/.fluxiq/data` (`server/cli/dev-arguments.ts:22,55`), while the panel's is `FLUXIQ_ROOT` or the importer repo (`apps/web/src/lib/fluxiq.ts:634-647`), so the defaults differ. `--data-dir` can name the panel's root, and nothing refuses that: grep finds no instance or root lock. Both default to ports 3000 and 4777, so running them together also needs `--port` and `--gateway-port`. The FluxNode docs send developers to the panel to add a model key "against the same data directory `fluxiq dev` serves" (`docs/fluxnodes/README.md:66`), and the panel does not serve the FluxNode API (no `createFluxNodeService` in `apps/web/src`). A developer who wants FluxNodes and the panel live together therefore has to run both processes on one root.
- **`fluxiq accounts` (provisioning CLI): yes, unguarded.** Without both `FLUXIQ_PROVISIONING_LISTEN` and `FLUXIQ_PROVISIONING_TOKEN_FILE`, it opens the data itself (`platform/provisioning/cli/select-accounts-transport.ts`, `main.ts:13-16,38-49`). It writes the platform store, IAM and identity. It prints "Use it only while the server is stopped" (`main.ts:39`; usage `--offline … (server stopped)`, `usage.ts:18`) but does not refuse. The service compose sets both variables (`service.compose.yml:38-40`), so it goes through the in-process listener. The self-hosted compose sets neither, so the documented `docker compose exec fluxiq node …/cli/main.js accounts` runs offline beside the live server.
- **SDK host and SDK CLI: no.** It is an HTTP client (`FluxIQ.connect`). Its `fluxiq dev` spawns the engine's `fluxiq dev` (`packages/sdk/src/cli/dev-command.ts`), the case covered above. `init` writes only `~/.fluxiq` key files.
- **MCP server: none in Core** (grep finds no `modelcontextprotocol` or MCP server in packages or apps).
- **Setup (`domain/scripts/setup-fluxiq.mjs` → `domain/src/setup.ts:9-14` → `FluxIQ.setup`, `framework/index.ts:379+`): no.** It creates directories, guides and the config file only. No signalled store.
- **Scenario Lab and demo workspace: no.** Each run has its own root (`packages/test-runner/src/environment.ts:168-170`). The identity bootstrap writes before Core starts: `coordinator.ts:116` runs before `supervisor.start` at `:153`, and `demo-workspace/core-process.ts:98` runs before the server start at `:120`.

## 3. Verdict

- **No concurrent second writer exists in any shipped default** (local `pnpm dev`, self-hosted image, service image). The missing cross-process signal is a latent defect, not a live one.
- **Two unguarded configurations make it live:** `fluxiq dev --data-dir <panel root>`, and offline `fluxiq accounts` while a self-hosted server runs.
- **What a person sees in those cases:**
  - A turn or ask written in the other process does not appear in the panel chat, which now has a complete feed and no poll, until the stream reopens or the page reloads. A paired extension on the panel's gateway gets no `server.conversation_changed` for it.
  - Activity of runs in the other process never appears, because activity is in-memory data and not only a signal.
  - Pairings and clients of the other gateway never appear, for the same reason.
  - An offline IAM, policy or disable change leaves cached decisions standing:
    - the stream's per-project cache (`caller-reads.ts:51-63`);
    - the gateway's reused paired-client decisions, so a disabled person's paired client keeps getting pushes and `project_access_ended` never fires;
    - the identity service's in-memory directory.

    The last two are authorization staleness, not just display.
- **No cross-process signal can fix activity or gateway state.** Their data lives only in the writing process. A durable signal helps only the durable stores: conversations, IAM, identity and the catalogue.

### Contradiction found: the activity topic is dead inside one process (live today, production build)

- **The instance is built from the instrumentation bundle's copy of Core.** `transpilePackages: ["fluxiq"]` (`apps/web/next.config.ts:22`) bundles Core into each Next graph. `apps/web/src/lib/fluxiq.ts:24-26` notes that instrumentation is bundled separately from routes. The primary instance is built from instrumentation (`instrumentation.ts` → `initializeFluxIQWebRuntime` → `getWebRuntimeState`, `fluxiq.ts:278-279`). Runs therefore emit through that copy.
- **The route subscribes to a different copy.** It imports `automationStudioActivityHub` itself (`apps/web/src/app/api/panel/changes/route.ts:1,75`).
- **The build output shows two module ids, so two hub objects.** In `apps/web/.next` (BUILD_ID dated 2026-11-17 12:14), instrumentation loads `chunks/packages_f5128fc3._.js`, where the hub is module `307292`. `app/api/panel/changes/route.js` loads `packages_4126c17a._.js`, where it is module `318516`. Both load through one `[turbopack]_runtime.js` module cache (`:575`), so the two ids are two separate objects.
- **What a person sees.** During a run, the panel chat's live activity updates only when the stream opens. The activity port reads only on `opened` and on `activity` events (conversation-push report, line 66).
- **Why the tests missed it.** Vitest runs a single module graph.
- **The same hazard exists for `iamStoreChanges`** (instrumentation `361278`, routes `759750`). I did not trace whether any IAM write runs from route-graph code.
- **Where the extension stands.** Its gateway relay is wired inside the instance (`programs/_shared/runtime.ts:221`), so it is unaffected.

## 4. Design

Stores Core supports: SQLite only. `sqlite3` is the only database dependency (`packages/fluxiq/package.json:237`, `apps/web/package.json`; project DBs `framework/persistence/automation/project/database.ts:3`; platform and IAM stores are `SQLiteRepository`). The local, self-hosted and service profiles all use it. Grep finds no Postgres or other server database.

| | A. Durable change journal (recommended signal) | B. Database notifications | C. Process-to-process push |
| --- | --- | --- | --- |
| Mechanism | One SQLite file per data root (`.fluxiq/databases/changes.sqlite`). Table `change(seq integer primary key autoincrement, origin, workspace_id, topic, scope_kind, scope_id, subject_id, at_ms)`. Each hub's raise point publishes locally, as now, and appends a row. One tailer per process reads `seq > cursor` and republishes rows from other origins into the local hubs | Postgres `LISTEN/NOTIFY` | Each process registers a loopback port under `.fluxiq/run/`, and writers POST hints to its peers |
| Works on Core's stores | Yes, any SQLite profile | **No.** There is no Postgres, and SQLite's update and commit hooks fire only on the writing connection, in the same process | Yes, but only on one host |
| Ordering | Total per root by `seq`. Rows are appended after the data commit, so the order across processes is close to commit order but not exact. That is harmless for "read again" hints | Per session | None |
| Missed | A crash between the data commit and the append loses one hint. SQLite WAL gives no atomic transaction across attached files. Conversations can close this gap exactly by tailing the per-project `change_feed` they already write in-transaction (`unit-of-work.ts:117-125`). A reader whose cursor is below the oldest kept row emits `opened`, which already means "re-read everything" | Lost while a listener is down, so a journal is needed anyway | Lost on any peer restart or discovery gap |
| Duplicates | None locally (own origin skipped). A duplicate is harmless because the stream coalesces | None | Possible |
| Cleanup | The tailer deletes rows older than a retention window (minutes). Note: today's per-project `change_feed` is never pruned (grep finds no delete) | Not applicable | Peer files plus liveness checks |
| Cost per change | One small WAL insert (sub-millisecond) and a shared write lock on one file | One NOTIFY | One HTTP call per peer |
| Wake | `fs.watch` on the `-wal` file, then `PRAGMA data_version`, then one indexed range read, with a slow backstop check. No client-facing timer | Push | Push |

**Recommendation, in order.**

1. **Fix the duplicate activity hub now.** Hand the route the hub the instance uses, for example as an `automationStudio.activity` port. `programs/_shared/runtime.ts:221` already passes it to the gateway relay. The route then reads it from `selected.fluxiq`, as it does for the conversation signals. Also check the `iamStoreChanges` announce and subscribe sides the same way. Files: `programs/_shared/runtime.ts`, the automation-studio program surface that exposes it, `apps/web/src/app/api/panel/changes/route.ts`, and a build-level test, because the unit tests cannot see bundle copies.
2. **Enforce one serving process per data root.** This removes today's only route to a second writer. It also covers process-local state that no signal can reach: activity, pairings, run control, and the caches in `projects.held` and IAM decisions.
   - Take an exclusive owner file holding the process and machine, using the owner-file pattern of `docs/architecture/runtime-ownership.md:60` with its dead-process recovery.
   - The panel takes it in `apps/web/src/lib/fluxiq.ts` (`initializeFluxIQWebRuntime`), and `fluxiq dev` takes it in `server/cli/run-dev.ts`.
   - Offline `fluxiq accounts` (`platform/provisioning/cli/main.ts`) refuses while a live owner holds the root and names the listener.
   - New module: `server/data-root-lease/`.
   - Docs: `docs/fluxnodes/README.md`, `docs/operations/self-hosting.md`, `runtime-ownership.md`.
   - With this in place, the in-process signals are complete by construction.
3. **Build A only when several processes must serve one root**, for example the panel and FluxNode live together, or active-active hosting.
   - New `framework/persistence/change-journal/` (store, tailer, retention, tests).
   - Journal-backed hubs: `runtime/conversations/signals/hub.ts`, `platform/iam/store/context/announced-changes.ts` (made instance-owned), `programs/identity-access/runtime/service.ts` (a remote row triggers `reloadFromStore` and then `observe`), and `framework/automation-service/service/projects/removals.ts` and `held.ts`.
   - `framework/index.ts` owns the journal and the tailer's open and close; `programs/_shared/runtime.ts` does the wiring.
   - Routes and gateway deliveries need no change: they already consume the hubs.
   - A alone is not enough for that case: activity and the gateway would need shared data too.

## Commands run and observed results

- Read-only `grep`, `sed` and `cat` over Core source, docs, deploy files and the built `.next/server` chunks, and the named extension files. Key observations are quoted with file:line above. The chunk module ids came from `grep -o '\["automationStudioActivityHub",()=>…\],<id>'` per chunk, with the loader chain from `instrumentation.js` → `chunks/apps_web_src_c8863078._.js` → `packages_f5128fc3._.js`.
- `git log -1` in Core: `297f26ff9 Merge task t921: client-conversation-push`.

## Not verified

- I made no live run. The dead activity topic comes from reading the build output, not from watching `/api/panel/changes` during a run. The `.next` build may predate later commits, and `next dev` was not checked.
- Whether any IAM write runs from route-graph code and so misses `iamStoreChanges`.
- Whether FluxNode runs write conversation asks. The run path can raise asks, but I did not trace it.
- How the identity service reads users per request after another process writes, beyond `revokeUserSessions`.

## Open questions or contradictions found

- The dead activity topic is a contradiction of t920's claim that activity reaches the panel by push.
- Product decision for the lead: should the panel serve the FluxNode API (one process), or must the panel and `fluxiq dev` share a root? That choice decides whether step 3 is needed at all.
- The per-project `change_feed` grows without limit. This is a separate retention issue.

```text
Outcome: Done
Changed: docs/working/usable-client-plan/reports/cross-process-change-signal.md (report only)
Validation: read-only investigation; no checks to run -> evidence quoted with file:line and build-chunk module ids
Not verified: no live run; dead activity topic inferred from .next chunk ids; IAM route-graph writes and FluxNode asks not traced
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/cross-process-change-signal.md
Notes: No second concurrent writer in shipped defaults; `fluxiq dev --data-dir` and offline `fluxiq accounts` are unguarded ways to make one.
Live today in one process: the panel stream's activity topic subscribes to a different hub copy (instrumentation 307292 vs route 318516).
Recommend: fix hub ownership, then a per-root serving lease; a durable SQLite change journal only if a root must be served by several processes.
```
