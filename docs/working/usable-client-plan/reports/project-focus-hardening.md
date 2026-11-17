# Project focus hardening (t916)

CORE = `fxwork/t916/!FluxIQ`, EXT = `fxwork/t916/!FluxIQWebExtension`. Nothing committed.

## Outcome

**Partial.** All three fixes are built and tested. Fix (b) only takes effect once one line in the gateway facade
`packages/fluxiq/src/client-gateway/service.ts` is changed. I may not edit that file, and the permission system
refused the edit. The supervisor must apply this line:

```ts
// service.ts, constructor (currently line 178)
this.activity = new ClientGatewayActivityPublisher(sessions, transport);
// becomes
this.activity = new ClientGatewayActivityPublisher(sessions, transport, projectFocus.activity);
```

**Why it is needed.** The publisher has to reach the access check. The only way to give it one is the constructor
call, and only the facade makes that call. The other worker is editing `service.ts` right now (the change feed).

**The wired state has been tested.** I added two temporary test files. They swapped the facade's private publisher
for a gated one, by reflection, which is exactly what the line does. With that in place:

- All 14 tests in `focus.test.ts` passed.
- All 3 tests in `authority.test.ts` passed.
- One extra real-IAM test passed: disable the person, and their focused project's activity stops. The browser then
  receives `server.project_access_ended` and the session moves to no project.

That run was 50 out of 50. I deleted both temporary files afterwards.

## What changed and why

### (a) Identity source

- **`authority.ts`** (`programs/automation-studio/api/project-focus/`) now reads people from an `identity` source.
  That source must be the one the paired program route reads.
- **Composition root.** Installation moved from `handlers/register.ts` (the registration line was removed) to
  `programs/_shared/runtime.ts`, with `identity: options.secretKeyIdentityAuthority ?? (async () => identityAccess)`.
  - **Hosted tenant:** apps/web already passes the primary instance's `identityAccess` through `tenantOptions`. That
    is the same object `workspaceProgramContext` gives the route as `identityAuthority`.
  - **Single-root and primary instances:** no host identity is passed, so this falls back to the instance's own,
    just as the route does.
- No apps/web edit was needed. A separate option name would read better, but adding one means editing `framework/index.ts`, `apps/web/src/lib/workspaces/create-tenant.ts` and `apps/web/src/lib/fluxiq.ts`.

### Authority now decides one project, cheaply

The authority no longer lists every project. It runs these steps:

1. Builds the person from the identity snapshot (no audit row).
2. Checks the project's domain with `assertProjectDomainAccess`. A missing, deleted or other-tenant project returns false.
3. Calls `registry.authorize` with the `projects` listing's action (`studio:Projects`) on `[workspace, project]`.
   These are exactly the two decisions `filterProgramList` makes before it keeps an item, because
   `evaluateIamRequest` allows only when every resource allows.
4. If the IAM decision could not be made (`decision === null` or `failure: "policy_unavailable"`), it throws. The
   gateway reads a throw as "could not decide", so an outage never ends anyone's access.

### (b) Activity follows current access

Mechanism: a per-push check, with no time-based re-check.

**New `client-gateway/service/project-focus/activity-delivery.ts`** (`ClientGatewayProjectActivityDelivery`, owned
by `ClientGatewayProjectFocus` as `.activity`):

- For a person-paired session, once an authority is installed, every activity waits until a check confirms the
  person may read its project. The check is asked after the activity was published.
- Each session has its own lane, delivered in publish order. Everything published while one check runs is decided
  by the next check, with one question per project, so a burst costs one question per project per session.
- If the session left, or its trusted client or operator changed during the check, nothing is sent.
- If a focus moved the session during the check, activity for the project it left is not sent.

**When the denied project is the session's own** (focused, or bound at pairing):

- The session moves where `null` would take it: its `pairedProjectId`. If that was the lost project, it goes to no
  project and `pairedProjectId` is cleared.
- Core audits `project_focus.access_ended` and sends one `server.project_access_ended { projectId, currentProjectId, message }`.

**Other cases:**

- A session bound to no project now receives only the projects its person may read. Before, it received every
  project's activity on the process-wide hub, including other tenants' (see open question 1). It is never sent the notice.
- If the authority throws, nothing is sent and nothing moves. `project_focus.delivery_check_failed` is audited, with
  only the error type and no message text.
- Managed hosts and channel-scoped stand-ins, and every session when no authority is installed, are sent activity at
  once, as before.

**Related changes:**

- `personPaired` moved to `project-focus/person-paired.ts`; it is not exported from the barrel.
- **`activity-publisher.ts`** takes an optional gate and hands governed sessions to it. `publish` now returns the
  number of sessions the activity was sent or queued to.
- **Contract** (`packages/contracts/src/client-gateway.ts` and its test): new `ClientGatewayProjectAccessEnded` and a
  `server.project_access_ended` union member. The file is at 799 lines after compressing the doc comment; the limit is 800.

**EXT side:**

- **`projects/access-ended.ts`**: `projectAccessEnded` parser, exported from the barrel.
- **`ProjectContext.accessEnded`** (`connection/project-context.ts`):
  - Drops a choice of the lost project exactly as `choose(null)` does, including the stored choice.
  - Moves the session's project to Core's `currentProjectId`, or removes it through a new optional dep `forgetProjectId`.
  - Discards any stale Core lookup (bumps `generation`) and follows Core again in the background.
- **Outside the owned paths but not forbidden:**
  - `connection/server-command-channel.ts` routes the new message to a new dep `onProjectAccessEnded` and never marks the connection failed.
  - `background/connection.ts` wires `forgetProjectId` and `onProjectAccessEnded`, and logs Core's reason as a
    warning: "Project no longer available".
  - One new test case in `connection/tests/server-command-channel.test.ts` and three in
    `connection/tests/project-context-panel.test.ts`. I added no new file there, because that directory is already
    past its advisory file count.

### (c) Race

- **`server/program-route/handle-program-request.ts`**: `sameCallerBinding` no longer compares the paired session's
  `currentProjectId`. The call's project is bound once, from the first authentication (the body's `projectId`, else
  the session's project at that moment), and domain-gated in `refuseProjectOutsideDomain`. The refreshed caller
  carries that bound project.
- The route never puts the session's project into a handler's payload, so a call cannot act on a project other than
  the one it gated. The registry's IAM still decides the call for the refreshed caller.
- Changes to the caller, session, trust, client, type, domain, managed-host or lease still return 401.
- `authority-revalidation.test.ts`: I removed the two `"project"` cases that encoded the old 401.

### Docs

- CORE `docs/integrations/client-gateway-websocket.md`: the Project Focus section rewritten for the new decision and
  identity source, a new "Activity follows current access" subsection (including the race fix), and the new message
  added to the server message list.
- EXT `docs/architecture/extension-client.md`: the Project Focus section and the server message list.

## Commands run and observed results

| Command | Result |
|---|---|
| CORE `pnpm --filter fluxiq exec vitest run src/client-gateway src/programs/automation-studio/api/project-focus src/server/program-route` | 88 files, 759 passed, exit 0. Ran before the last `authority.ts` refactor and the `focus.test.ts` edit. |
| CORE `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/api/project-focus src/client-gateway/service/project-focus src/client-gateway/service/tests/activity-publisher.test.ts` (after those edits) | 7 files, 50 passed, exit 0. Includes the two temporary wired-state files, since deleted. Without them: 5 files, 32 tests. |
| CORE `pnpm --filter @fluxiq/contracts exec vitest run src/tests/client-gateway.test.ts` | 16 passed (15 + 1 new) |
| CORE `pnpm --filter fluxiq check` | exit 0 |
| CORE `pnpm --filter @fluxiq/contracts check` | exit 0 |
| CORE `pnpm --filter @fluxiq/web check` | exit 0 (reused a matching stamp after waiting for another run of the same step) |
| CORE `pnpm --filter @fluxiq/web exec vitest run <changed dirs>` | Not run: I changed no apps/web file. |
| CORE `node scripts/structure-audit.mjs` | 2 violations, neither mine: statement packing in `apps/web/.../connect.test.tsx` and in `client-gateway/service/tests/pairings.test.ts` (the other worker's files). My two earlier violations are fixed: contracts at 809 lines, and `installPairedProjectFocus` at 26 lines against the 20-line budget. |
| EXT `node apps/extension/scripts/test-extension.mjs src/background/projects src/background/connection` | 405/405 (398 before, +7) |
| EXT `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.test.json --noEmit` | exit 2. All 26 errors are `Cannot find module '@fluxiq-web-extension/domain/node'` or `browser-host/reaper`, plus implicit-any errors that follow from them, in `packages/test-runner` and `e2e/content/tests/offline-reads`. None are in `apps/extension/src`. The domain build refuses because Core's dist is stale: sdk, fluxiq, client-gateway-websocket and ui-components need rebuilding. I did not rebuild them. |
| EXT `node scripts/structure-audit.mjs` | passed (251 warnings, 551 baselined) |

## Not verified

- **The facade line itself is not applied**, so in the running product fix (b) is inactive. Its behaviour was tested
  only through the reflection-wired temporary tests.
- **EXT tsc is not clean** while `domain/node` is unbuilt. My EXT files raised no type errors in the run that did complete.
- **No live browser, hosted server, panel or gateway was run.**
- **Deleting a project inside a real runtime test made `afterEach` hang for 60 s.** This happened with
  `automationStudio.deleteProject` followed by `detach` and `rm`. I swapped that case for a project the instance does
  not hold, which goes through the same domain-gate path. I did not investigate the hang; it looks like a separate
  teardown problem.
- **The apps/web vitest was not run.**

## Open questions or contradictions found

1. **Possible cross-tenant leak before this fix.** The activity hub is process-wide (`runtime.ts`), so every tenant
   runtime publishes every tenant's activity to its own gateway. A session bound to no project (any reconnect where
   the browser holds no explicit choice) received all of it, other tenants' included. The per-push gate closes this
   once the facade line lands, because an unknown project fails the domain gate.
2. **Audit volume.** Each delivery check calls `registry.authorize`, which writes one IAM audit row. On the web host,
   allowed reads (`studio:Projects`) are dropped, but refusals are kept. On a shared `service` tenant, a session bound
   to no project therefore adds one refused-read row per batch for each other person's project with activity. The
   t915 listing check already wrote a hidden-count deny row on each focus. A silent decision path would need a
   registry API change.
3. **Once the facade line lands, the facade's `publishActivity` doc comment** ("every ready session...") should
   mention the access check.
4. **The brief names "the gateway facade `client-gateway/service/index.ts`".** That file is the barrel; the facade
   class is `client-gateway/service.ts`. I touched neither.
5. **Files edited outside the owned paths** (none on the must-not-touch list):
   - CORE `programs/_shared/runtime.ts` (the install, needed for (a)) and `server/program-route/tests/authority-revalidation.test.ts`, plus the new `paired-project-binding.test.ts`.
   - EXT `background/connection.ts`, `connection/server-command-channel.ts`, and the two test files in `connection/tests/` named above.
