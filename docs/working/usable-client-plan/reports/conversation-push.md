# conversation-push (t920): the panel hears a changed conversation by push

Worker: worker-heavy. Core worktree: `C:/Users/osrs_/FluxStuff/fxwork/t920/!FluxIQ`. Nothing committed.

## Outcome

Done. The adaptive 1-10 s poll (`apps/web/src/features/automation-studio/conversation/thread/poller.ts`) is deleted. A turn a run writes, a reply finishing, an ask answered and the live activity behind them now reach the Core panel through one push stream per page, `GET /api/panel/changes`. Nothing in the panel's own transport reads a thread or the activity on a timer. One timer is left, and it is outside this brief's paths: the chat widget package's own read interval (see Open questions, item 1).

## What changed and why

### Where the poll was really used

The poll's only production caller was the chat's **activity** port (`chat-widget/activity/activity-port.ts`, `get-activity`). Thread turns are read by `@fluxiq/ui-components`'s own `setInterval` (`chat/read-beat.ts`), which this brief does not own. So removing the timer meant two push signals: one for **threads** and one for **activity**.

### Core (`packages/fluxiq/src`)

- New `runtime/conversations/signals/`: `AutomationStudioConversationSignalHub` and its types. A signal is `{ scope, conversationId, version }`. `scope` is `{ kind: "project", projectId }` or `{ kind: "panel", userId }`. It is delivered synchronously, in order, to each listener. A listener that throws is reported by error name only, and the other listeners still get the signal. It works in-process only.
- `AutomationStudioConversations.signals` (`conversations.ts`): it signals once each write has committed. That covers open (only when a thread was actually written), rename, delete, Core's turn, a person's turn (one signal for the turn plus its auto-title), and ask answered or expired. A read, or a write the store refused, signals nothing.
- `PanelAssistantThreads` takes an optional `signals` sink and signals panel-thread writes under the person's user id. `panel-assistant/register.ts` passes `service.conversations?.signals` lazily, inside the threads factory, so registering still touches nothing on the service.
- Exported through `runtime/conversations/index.ts` (and from there `fluxiq/automation`).

### Server route (`apps/web/src/app/api/panel/changes/`)

- `route.ts`: the panel's one change stream. It has three topics:
  - `gateway` (`{version}`): t916's pairing and client signal, moved here.
  - `conversation` (`{conversationId, version}`).
  - `activity` (`{projectId, version}`).
  - `version` is a single per-stream sequence that starts at 1 and has no gaps. No content is ever sent.
- `panel-change-stream.ts`: `PanelChangeStream`, generalized from t916's `ChangeEventStream`. It sends the opening comment, a keep-alive every 25 s, and coalesces repeats until they are sent: one gateway read, one read per thread, one per project's activity. Any topic failing fails the stream.
- `topics/`:
  - `gateway.ts` is t916's fingerprint logic, unchanged in behaviour.
  - `conversation.ts` listens to Core's hub.
  - `activity.ts` listens to the process activity hub (`automationStudioActivityHub` from `fluxiq/automation`).
- `caller-reads.ts`: decides each change the same way the read it prompts is decided.
  - A project's thread: `studio:GetConversation` on the project, plus `assertProjectDomainAccess` with the stream URL's domain scope, as `get-conversation` does.
  - A panel thread: only the person whose thread it is, plus `studio:GetPanelThread` on their own user.
  - Activity: `studio:GetActivity` on the project.
  - Decisions use `decideUnrecorded`, are cached per project, and the cache is cleared on `subscribeDecisionChanges`.
  - A decision that cannot be made (policy unavailable) fails the stream instead of dropping the signal. The browser reconnects and reads again.
  - A paired client gets no thread or activity topics.
- The tenant boundary is structural. The route reads the selected workspace's own `fluxiq.programs.automationStudio.conversations.signals` and decides with that workspace's own registry.
- Deleted `apps/web/src/app/api/client-gateway/changes/` (route, stream and tests). Its tests moved to `panel/changes/tests/` and were adapted: `event: change` became `event: gateway`, and the URL changed.

### Why one generalized stream, not conversation events on the old route

The old route is authorized as `gateway:Snapshot` on the workspace. Under the `service` profile, `FluxIQUserAccess` does not hold that: `app-route-iam-service.test.ts` asserted that a hosted user is refused `/api/client-gateway/changes`. Adding conversation events there would have left every hosted user with no push at all. A second route would break the one-connection-per-page rule.

So the stream is authorized as a watch over what the caller may read: `studio:ListConversations` on the workspace, the filtered list a user does hold. Each topic then decides its own events. The gateway topic is included only when the snapshot's own contract allows the caller. That is decided at open and again before every look at the caller's view, so a caller who loses it hears nothing more: the stream fails and reopens without the topic.

### IAM table

`lib/app-route-iam/contracts.ts`:

- The `GET /api/client-gateway/changes` row is removed.
- Added `GET /api/panel/changes` → `studio:ListConversations`, callers `{ panel: "programs.read", "paired-client": "none" }`, resource workspace. `programs.read` (not `none`) for the panel matters: the stream's per-chunk re-check then ends a local-profile caller's stream once they lose `programs.read`, so a cached per-project decision cannot outlive it.
- Updated `contracts.test.ts`, `app-route-calls.ts`, `app-route-fixture.ts`, the parity row (new route; allowed for admin, viewer and paired admin/viewer, as observed) and the service test.
- `authorizeWorkspaceRoute` is now exported from `lib/workspaces/routes/index.ts`.

### Browser

- New `features/panel-changes/`: `PanelChangeConnection` and `sharedPanelChanges()`. It is one `EventSource` per page, opened by the first reader and closed by the last.
  - Readers get `opened` (read everything once) when the stream opens or reopens, when a sequence number is skipped, or when an event cannot be parsed. A reader that joins an already-open stream gets `opened` at once.
  - It runs no timers. A closed stream reopens on tab-visible, `online`, or `reopen()`.
- `features/client-gateway-changes/`: `GatewayChangeSubscription` now reads through the shared connection (`sources = { changes, readSnapshot }`). Its state and behaviour are unchanged, and its tests were ported one-for-one onto a real `PanelChangeConnection` with a fake stream.
- `chat-widget/transport/changes-port.ts`: keeps same-tab mutations, and adds push: `conversation(id)` becomes `{ conversationId }`, and `opened` becomes `{}`.
- `chat-widget/activity/activity-port.ts`: no poller. It reads once on first subscribe, on `opened`, and on `activity(projectId)` for the chat's project. Reads never overlap: one more read serves reasons that arrive during a read.
  - New `followProject()`, called from `ProgramChatWidget`'s `onTarget`. It reads at once when the chat moves to a thread of another project. The poll used to cover that within 10 s.
  - `createProgramChatTransport` now returns `ProgramChatTransport` (a `ChatTransport` whose `activity` is a `ProgramActivityPort`). It also takes an optional `changes` option.
- Removed the poller's exports from `conversation/thread/index.ts`.
  - The poller tests in `thread-model.test.ts` are removed.
  - The poller source test in `conversation-architecture.test.ts` is replaced. The new test asserts that the poller file is gone and that the changes port and the activity port use `sharedPanelChanges()` and contain no `setTimeout`, `setInterval` or `createBackoffPoller`.
- `settings-page/connect/tests/connect.test.tsx`: its `FakeEventSource` now sends numbered `gateway` events to `/api/panel/changes`.

### Docs (Core)

- `docs/integrations/client-gateway-websocket.md`: the Web Panel APIs list and the pairing-queue paragraph.
- `docs/architecture/automation-studio/client-gateway.md`: the route list, and the "How the panel hears pairing and client changes" section (Route and Browser bullets).
- `docs/architecture/automation-studio/workspace.md`: a new section, "How the chat hears a turn". It covers the Core signals, the stream, who hears what, the browser side, the in-process limit, and the remaining package interval.

## Commands run and observed results

All were run from the Core worktree, one at a time.

- `pnpm --filter fluxiq check`: passed. Last line: `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; stored in the shared store ..."}`; no TS errors.
- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build`: fluxiq and ui-components rebuilt, the others reused.
- `pnpm --filter @fluxiq/web check`:
  - First run: 2 errors, both in my test (`automationStudio` missing from the route-runtime type). I fixed them with a cast.
  - Rerun passed, and passed again after the audit fixes.
- `node scripts/structure-audit.mjs`:
  - First run: 3 violations. Two `swallowed-failure` in `topics/{conversation,activity}.ts`, where a rejection was dropped after the stream stopped. One `failure-as-empty` in `panel-changes/connection.ts` (the JSON parse catch).
  - I fixed them: a stated best-effort reason for the stopped case, and an unreadable event is now an explicit "missed" action.
  - Rerun: `structure-audit: passed (550 warning(s), 914 baselined).`
- Core vitest:
  - `npx vitest run src/runtime/conversations src/programs/automation-studio/api/panel-assistant`: `Test Files 60 passed (60) / Tests 426 passed (426)`. The new `signals.test.ts` needed one fix first: a choice ask needs two options.
  - `npx vitest run src/programs/automation-studio/api/handlers/tests/llm-generation.test.ts src/framework/automation-service/tests`: `Test Files 121 passed (121) / Tests 746 passed (746)`.
- Web vitest:
  - `src/app/api/panel src/features/panel-changes src/features/client-gateway-changes`: `4 passed / 45 passed`. The route test has 19 cases: 11 gateway (ported), 8 thread and activity (new).
  - `src/app/api/client-gateway src/features/automation-studio/conversation src/features/chat-widget src/features/settings-page/connect src/features/automation-studio/clients src/app/tests/GlobalClientGatewayPairing.test.ts src/lib/app-route-iam`: `50 passed / 470 passed`.
  - `src/app/api/tests src/lib/workspaces/routes` (IAM parity and service): `10 passed / 160 passed`.
  - After the audit fixes, rerun of `src/features/panel-changes src/app/api/panel src/features/client-gateway-changes src/features/settings-page/connect src/features/chat-widget src/features/automation-studio/conversation`: `38 passed / 350 passed`.
- Mutation check of the new negative tests: I temporarily made `caller-reads.ts` answer `true` for every thread and activity, then restored it.
  - 3 tests failed as they should: another person's panel thread, a project outside the domain, and a hosted user's other-person project.
  - The other-tenant and paired-browser tests pass either way, because those boundaries are structural (another workspace's hub, and no topic added for a paired client).
- `pnpm --filter @fluxiq/web build` (next build, once at the end): exit 0. It printed `✓ Compiled successfully in 110s` and `✓ Generating static pages (42/42)`, and the route list shows `ƒ /api/panel/changes` (dynamic). `/api/client-gateway/changes` is no longer in it.

## Not verified

- No live browser session. I did not watch a real `EventSource` on a running panel, a reconnect through a proxy, or a real run writing a turn with the chat updating.
- Multi-process hosting: signals are in-process only. A deployment that serves one workspace from several processes needs a shared signal (hosted follow-up 7, not built). Until then a turn written by another process reaches a panel only when its stream next reopens.
- Panel-thread decisions under the `service` profile with `FluxIQUserAccess`. The tests cover a project's threads for a hosted user, but the panel-thread case was only tested in the `local` profile.
- I did not run the full suites (`pnpm check`, `pnpm test`, Core's whole vitest), per the twice-a-day rule.

## Open questions or contradictions found

1. **The chat still polls, inside `@fluxiq/ui-components`.**
   - `packages/ui-components/src/chat/chat-widget.ts` runs a `setInterval` at `readBeatMs(background, changes)` (`chat/read-beat.ts`): 4 s, or 10 s when `transport.changes` exists, and 5 s in the background. It re-reads the thread list, the shown thread and the activity on that beat.
   - Its comment says the poll stays "because a change made elsewhere reaches a client with no push channel in no other way". For Core's panel that is no longer true: `transport.changes` now carries server pushes.
   - The package is outside this brief's paths. The interval should be removed there, at least when a client's changes port is push-backed. That probably needs a flag on `ChatChangesPort`, because the extension's client may still need the beat.
2. **Activity is process-wide, not per tenant.**
   - `automationStudioActivityHub` is one module singleton keyed only by `projectId`. Core's existing `get-activity` already reads it that way.
   - My activity topic decides each event on the caller's own workspace registry. So a caller is told only about a project id they may read in their own workspace. But if two workspaces ever shared a project id, the refetch would return the other workspace's activity.
   - This predates t920. Ids are random UUIDs in practice, but tenant-keying the activity hub belongs in a follow-up.
3. **Stale doc line.** `docs/architecture/automation-studio/workspace.md` says `FluxIQUserAccess` grants none of the panel-assistant actions, but `platform/iam/predefined/user-access.ts` grants them (`OWN_PANEL_ASSISTANT`). I left that line as it was.
4. **Rename of the gateway event.** It was `event: change` and is now `event: gateway`, and the route moved from `/api/client-gateway/changes` to `/api/panel/changes`. No other consumer was found: I grepped Core `apps/web/src` and the extension worktree's `apps` and `domain/src`. The extension does not use it.
5. **The chat refreshes on any readable thread's signal.** A `conversation` signal names a thread, not a project, so the chat (which does not filter by id in `ui-components`) re-reads the thread it is showing whenever any thread the person may read changes. That is cheap (`sinceTurnId`) but not minimal. The widget could filter by the shown thread's id.

## Fix round

The coordinator asked for three changes before merge. Items 1, 2 and 3 of "Open questions" above are all resolved here. Item 1 under that heading is now handled by the change described in item 2 of this round.

### 1. Activity reaches only the workspace that owns the project, at both entry points

**The problem.** The activity hub (`runtime/activity/`) is one process-wide object. On a hosted platform, one process runs several tenants' runtimes, and each event carries only a project id. Two entry points handed that activity out without checking which workspace owned the project:

- The stream's activity topic heard the shared hub and checked only `studio:GetActivity`.
- `get-activity` answered any project id from the shared hub.

So a caller whose policy grants that action on every project (a workspace admin) could hear another tenant's project ids, then read that project's activity, authored step labels included.

**Shared rule, extracted rather than copied.** The fix reuses t916's rule: "a project is this instance's when its own catalogue lists it."

- New `framework/automation-service/service/projects/held.ts`: `AutomationStudioHeldProjects`. The project store now has one instance of it, `projects.held`.
- How it reads:
  - It reads each id once and every caller shares that one read.
  - An id read as another instance's stays another instance's (ids are random UUIDs).
  - An id read as this instance's is forgotten when the project is removed.
  - A removal that lands during a read means that read's answer is not recorded.
  - A read that failed is not remembered.
- t916's gateway relay (`project-focus/own-project-activity.ts`) now asks `projects.held` instead of keeping its own sets and its own removal subscription. Its queue-behind-the-read ordering is unchanged and its existing tests pass. `programs/_shared/runtime.ts` passes `projects: automationStudio.projects.held`.

**The panel stream.** In `caller-reads.ts`, an activity event is passed on only when the selected workspace's `projects.held.holds(projectId)` says yes, and then `studio:GetActivity` allows it. The holdings check comes first, so another workspace's id is never put to this workspace's IAM at all. A catalogue that cannot be read fails the stream, which then reconnects and re-reads; nothing is guessed.

**`get-activity`** (`handlers/activity.ts`):

- It has a required `holds` dependency. There is no default, so no registration can forget it.
- `register.ts` passes `(projectId) => service.projects.held.holds(projectId)`, read on each call, never at registration.
- A project id this instance does not hold gets exactly the unknown-project answer, `{ current: null, recent: [] }`. "Another tenant's project" and "no such project" cannot be told apart.
- A catalogue that cannot be read gives an error, not an answer.
- The deliberate rule against asserting the domain stands. The holdings check is a tenant check, and `tests/domain-scope.test.ts` still passes.

**Tests.**

- `handlers/tests/activity.test.ts` has three new or rewritten tests:
  - A project the instance does not hold, though the shared hub has its activity, gets an answer equal to an unknown project's, with no trace of its label.
  - An unreadable catalogue fails the call.
  - The proxy test now asserts that registration touches nothing and that a call asks only `projects.held`.
- `panel/changes/tests/route.test.ts`, new test: two workspaces in one process share the hub, under the service profile with an administrator (`studio:*`) policy on both. Activity for B's project reaches B's stream, version 1. A's first event is its own project's, version 1, so B's never reached A.
- `projects/tests/held.test.ts` (new) covers the holdings class itself: one shared read, held and not-held remembered, removal including a removal during a read, and failure not remembered.

**Mutation checks**, each temporarily applied and then restored:

- Removing the `holds` line in `get-activity`: 3 tests fail, including the tenant test.
- Removing `await held(projectId) &&` in `caller-reads.ts`: the two-workspace stream test fails, because A heard B's project under the admin policy.

### 2. The chat widget runs no poll beside a complete change feed

**Package change** (`packages/ui-components/src/chat/`):

- `ChatChangesPort` has a new optional `readonly complete?: boolean`. It is additive, and leaving it out keeps today's behaviour. `true` means: the client's feed tells of every change the chat shows, whoever made it, and tells once with `{}` whenever its channel opens, reopens or may have missed one.
- `read-beat.ts`: the signature is now `readBeatMs(background, changes: ChatChangesPort | undefined): number | null`. It returns `null` for a complete feed and the old values otherwise: 4 s alone, a 10 s ceiling beside a feed, 5 s in the background.
- `chat-widget.ts`:
  - `startReads` tracks started reads with a `reading` flag instead of the timer handle, and skips `setInterval` when the beat is `null`.
  - With a complete feed, each change also re-asks about a "missing" model key; it was already re-asked when the person turns to the composer. That replaces the beat's periodic readiness recheck. A key added while the chat sits idle is noticed on the next change or the next composer focus.
- `lease-transport.ts` forwards `complete`. Without that, the lease would have dropped it.

**The panel's feed** (`apps/web/.../chat-widget/transport/changes-port.ts`) now declares `complete: true`.

**Tests.**

- `lease-and-beat.test.ts`: the beat table now includes the complete case, and `complete` survives the lease.
- `threads-widget.test.ts`, two new tests:
  - With a complete feed, `setInterval` is never called and 10 minutes of quiet read nothing; a change is then read.
  - With a plain feed, the beat still reads after 10 s.
- `changes-port.test.ts` asserts `complete === true`.
- Mutation check: removing the `complete` gate in `read-beat.ts` makes 2 tests fail. Restored.

**The web extension, read only, not edited.** Its chat adapter keeps polling, by design, at the 10 s ceiling:

- `apps/extension/src/panel/chat/transport/ports/changes.ts` passes a `ChatChangesPort` without `complete`.
- Its pushes come only from `background/projects/panel-changes.ts`, which turns each gateway `server.activity` into a `panelChanges` message.
- So it hears no change that comes without activity: a person's turn from another tab, an answer, a rename.
- It also tells nothing when its socket reconnects.
- The feed is not complete, so keeping the beat is correct until the extension pushes every thread change and a reconnect signal.

### 3. Corrected the doc line about panel-assistant permissions

`workspace.md` now says `FluxIQUserAccess` grants the person's own thread endpoints through `OwnPanelAssistant` (`OWN_PANEL_ASSISTANT`), on their own `user/${fluxiq:PrincipalId}`, and only when `fluxiq:RequestOrigin` is `panel`. It does not grant `set-panel-assistant-allowance`; reading the allowance is granted on the workspace by `IAM_USER_WORKSPACE_SETTING_READS`. That matches `platform/iam/predefined/user-access.ts`.

The "How the chat hears a turn" section was also updated: the widget runs no poll beside the panel's complete feed, and the extension keeps its beat.

### Fix-round commands and observed results

All were run one at a time from the Core worktree.

- `pnpm --filter fluxiq check`: passed.
- `pnpm --filter @fluxiq/ui-components check`: passed.
- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build`: fluxiq and ui-components rebuilt. It was rerun after the mutation restores and reused the stamp, since the content was unchanged.
- `pnpm --filter @fluxiq/web check`: passed.
- `npx vitest run src/chat` (ui-components): `109 passed / 739 passed`.
- fluxiq vitest, `src/framework/automation-service/service/projects src/programs/automation-studio/api/project-focus src/programs/automation-studio/api/handlers/tests/{activity,domain-scope,llm-generation}.test.ts src/runtime/conversations src/programs/automation-studio/api/panel-assistant src/programs/_shared/tests`: `93 passed / 583 passed`.
  - Before that, `held.test.ts` failed once on a wrong expectation in my test: the catalogue was emptied before the read answered. I fixed the test's ordering.
  - After the audit's statement-packing fix, `held.test.ts` was rerun: 3/3.
- web vitest:
  - `src/app/api/panel`: `2 passed / 31 passed`. The first try refused because the Core build was 6 minutes behind its source, after the mutation restores; it ran after the rebuild.
  - `src/app/api/client-gateway src/app/api/tests src/features/panel-changes src/features/client-gateway-changes src/features/automation-studio/conversation src/features/chat-widget src/features/settings-page/connect src/features/automation-studio/clients src/app/tests/GlobalClientGatewayPairing.test.ts src/lib/app-route-iam src/lib/workspaces/routes`: `62 passed / 646 passed`.
- `node scripts/structure-audit.mjs`: first run had 1 violation (`statement-packing` in my new `held.test.ts`); fixed. Rerun: `structure-audit: passed (550 warning(s), 914 baselined).`
- `pnpm --filter @fluxiq/web build`: exit 0. It printed `✓ Compiled successfully in 96s` and `✓ Generating static pages (42/42)`, and the route list includes `ƒ /api/panel/changes`.

### Still not verified after the fix round

- No live browser session against a running panel.
- No real two-tenant hosted process. The two-tenant case is covered by the route fixture: two workspace instances in one process, sharing the real hub object with its subscription replaced.
- Panel-thread decisions under the service profile are still covered only in local.
