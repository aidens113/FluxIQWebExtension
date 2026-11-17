# client-conversation-push-core (t921): report

## Outcome

Done, with one acceptance check failing on a file I may not touch. Core's client gateway now sends
`server.conversation_changed` (`{ conversationId, projectId }` and nothing else) to each ready person-paired
session whose person may read the chat that changed. Every named check passes except the structure audit, which
fails only on `packages/contracts/src/client-gateway.ts` at 810 lines (the limit is 800). That file was 799 lines
before the lead's contract commit `ed37b9556`, which added the 11 lines, and it is on my must-not-touch list.

## What changed and why

Which chats: the extension's thread list reads `list-conversations` with `projectId: null`, which spans every
project, and reads each thread with `get-conversation` naming that thread's project
(`apps/extension/src/background/panel/conversation-relay.ts`). A paired token call may name any project in its
bound domain. So the push goes to a person-paired session for **every project chat its person may read, whichever
project the session is focused on**, not only the focused project's. Panel threads (null `projectId`) are
**never sent**: the panel-assistant endpoints refuse the `paired-client` channel
(`programs/automation-studio/api/panel-assistant/register.ts:88`), so no paired client may read one.

Gateway (`packages/fluxiq/src/client-gateway/`):
- `service/project-focus/conversation-delivery.ts` (new) has `ClientGatewayConversationChangeDelivery`, built on
  t916's activity delivery. It reaches only ready, connected, person-paired sessions (`personPaired`). Each
  decision comes from the installed `ClientGatewayConversationReadAuthority` and is reused per session and project
  through the existing `ClientGatewayProjectAccessDecisions`. `setAuthority` voids every reused decision. A
  question that was still running when access changed is asked again. A decision made for a different speaker is
  not reused. It sends nothing when no authority is installed or a check throws (audited as
  `conversation_push.check_failed`, recording only the error's kind), and nothing for a null or blank project. It
  builds the payload from the two fields alone and sends with `sendUnqueued`. Each session has one lane, and a
  change already waiting is not queued twice.
- `service/types.ts`: added `ClientGatewayConversationReadAuthority` and `ClientGatewayConversationPushPort`
  (`setAuthority`, `publish`).
- `service.ts`: new `readonly conversationPush: ClientGatewayConversationPushPort`. I put `publish` on the port, not
  on the facade, because a new facade method took `ClientGatewayService` to 41 methods (the limit is 40).
- `service/trace-tap/tap.ts`: `server.conversation_changed` added to `UNTRACED_OUTBOUND`, next to
  `server.activity`. It is a display-only hint that nothing answers, so it is kept out of build and trial traces
  and does not affect replay parity.
- `service/project-focus/index.ts`: exports the new file.

Program side (`packages/fluxiq/src/programs/automation-studio/api/project-focus/`):
- `paired-read.ts` (new) is the shared decision taken out of `authority.ts`: read the person from the paired
  route's identity source, check they are enabled with a role holding `programs.read`, narrow the actor to the
  `paired-client` channel, run `assertProjectDomainAccess`, then `decideUnrecorded` of an endpoint's registered
  action on its resources. A decision that could not be made throws.
- `authority.ts`: `installPairedProjectFocus` now installs two authorities from one change watch. The focus
  authority decides as the `projects` listing does, on the workspace and the project (unchanged behaviour). The
  conversation authority decides as `get-conversation` does: `studio:GetConversation` on `{ kind: "project" }`,
  `endpointResource.project()`. Both are installed again on an IAM store write, an identity directory change, a
  registration or a project removal.
- `access-change-watch.ts` (new) is the old `AccessChangeWatch` class, moved and renamed
  `PairedAccessChangeWatch`. `types.ts` (new) holds the shared types; the barrel still exports
  `PairedProjectFocusDependencies` and `PairedProjectFocusIdentity`. `clientGateway` is now typed
  `{ projectFocus; conversationPush: Pick<…, "setAuthority"> }`.
- `conversation-relay.ts` (new): `relayProjectConversationChanges` subscribes to the runtime's own
  `AutomationStudioConversations.signals` and passes on project-scope signals as `{ conversationId, projectId }`.
  It drops panel-scope signals.
- `programs/_shared/runtime.ts` (wiring only): the relay feeds `clientGateway.conversationPush.publish`, and
  `detach` stops it.

Docs: `docs/integrations/client-gateway-websocket.md` has a new "Chats that changed" subsection, and the message is
added to the "FluxIQ may send" list. `docs/architecture/automation-studio/client-gateway.md` has a new section,
"How a paired client hears its chats change".

Unknown message type (checked read-only): older clients do not break. Core's websocket client accepts any
`server.*` type (`client-gateway-websocket/src/messages.ts` `parseServerMessage`) and only emits it as a generic
`message`. The extension's committed `ServerCommandChannel.handleMessage` (HEAD) falls through to a no-op for an
unknown type. So no capability gate was added.

## Commands run and observed results

All were run from `C:/Users/osrs_/FluxStuff/fxwork/t921/!FluxIQ`, one at a time. There were no heap crashes.
- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build`:
  all five steps `build`, no errors. Run first and again last, after the final code, so the extension checks
  against this build.
- `pnpm --filter fluxiq check`: passed (`fluxiq:check` stored, no TS errors) on the final code. One earlier run
  failed with TS2741 in `access.test.ts` after I moved `publish` onto the port; I fixed it by narrowing the
  installer's dependency type.
- `pnpm --filter @fluxiq/contracts check`: passed.
- fluxiq `npx vitest run src/client-gateway`: 78 files, 618 tests passed.
- fluxiq `npx vitest run src/programs/automation-studio/api/project-focus`: 6 files, 19 tests passed (includes the
  real-SQL `conversation-push.test.ts`: 3 tests).
- fluxiq `npx vitest run src/programs/_shared` (folder of `runtime.ts`): 41 files, 291 tests passed.
- contracts `npx vitest run src/tests/client-gateway.test.ts`: 17 passed (one new test: type and payload shape).
- `node scripts/structure-audit.mjs`: 1 violation, `[file-lines] packages/contracts/src/client-gateway.ts: 810 lines
  exceeds the 800-line limit` (the lead's commit, see Outcome). An earlier run also showed `[class-methods]
  ClientGatewayService has 41 methods`; that one was mine and is fixed.

Mutation checks. Each gate was removed and then restored from a scratch copy; the failing tests are listed.
- Without `personPaired` in `publish`: "never tells a session no person paired" fails.
- Without the null/blank-project check: "never sends a panel thread's change" fails.
- Sending regardless of the verdict: "another person's session", "project its person may not read", "cannot
  decide", reuse and stale-answer tests fail (6).
- `setAuthority` not voiding: the reuse/forget test and the stale-answer test fail.
- `sameSpeaker` always true (in `access-decisions.ts`): "does not reuse a decision for a session that now speaks for
  someone else" fails.
- Relay forwarding panel scope: the relay test fails.
- IAM decision skipped in `paired-read.ts` (always allow): the real-SQL "only the chats they may read" and
  "forgets it when the IAM store changes" tests fail.
- Every runtime relaying from one shared hub (simulating a process-wide hub, `runtime.ts`): "hands a project chat's
  change to its own tenant's gateway only" fails (`publish` called once). Re-run after the port change, with the
  same result.

## Not verified

- No live browser run with the parallel extension change. Delivery to a real extension socket and the extension
  dropping its 10 s poll were not exercised.
- The conversation authority's domain gate has no conversation-specific negative test. It shares `paired-read.ts`
  with the focus authority, whose `access.test.ts` covers "a project it does not hold → false".
- The panel-thread null path is tested at gateway and relay level only, not through a real `PanelAssistantThreads`
  write.
- No full sweeps (`pnpm check`, `pnpm test`), by the daily rule.

## Open questions or contradictions found

- The lead needs to act: `packages/contracts/src/client-gateway.ts` is 810 lines and fails the structure audit
  (800-line limit), from `ed37b9556`. It needs a split (for example the server message union, or the project-focus
  and conversation payload types, moved into a sibling module re-exported by the file) or a baseline decision.
- The contract keeps `projectId: string | null`, but Core never sends null, because no paired client may read a
  panel thread. If a paired client is ever allowed panel threads, the delivery's null guard and the relay's
  panel-scope drop are the two places that would change.
- The signals are in-process (t920's hub). A write in another process serving the same workspace is not pushed
  (hosted follow-up 7, already noted in the hub's doc).

## Fix round: an undecided change waits instead of being dropped

Outcome: Done. This builds on the lead's commit `065a92760`, after the contract split in `8724a8b74`. Nothing is
committed. The structure audit now passes.

### The problem and its cause

In `conversation-delivery.ts`, an answer the authority could not make (it threw, which means an outage, not a
denial) and a drain that threw were both audited and then the waiting change was dropped. The extension now keeps
no timer, so a dropped change left that chat stale until a later change or a reconnect.

### What changed

- `packages/fluxiq/src/client-gateway/service/project-focus/conversation-delivery.ts`:
  - An undecided change goes back to the head of its session's lane. Each change is kept once: one that arrives
    while the question runs is merged, not duplicated.
  - It is asked again after a wait that starts at 1 s and doubles up to 30 s. The wait goes back to 1 s once
    everything waiting is decided.
  - A change is sent only once an answer allows it. It is discarded only on a denial, or when the session goes
    away or speaks for someone else. That is checked when the retry fires, after each answer, when a new change
    arrives, and on the gateway's `session.disconnected` and `session.ready` events, which cancel the wait at once
    (new `sessionChanged`).
  - The whole drain is now guarded. A throw anywhere keeps exactly the changes that were not yet sent or settled,
    and waits the same way (`conversation_push.delivery_failed`). Before, only the answer step was guarded.
  - Auditing happens once per outage per session, recording only the error's kind: `conversation_push.check_failed`
    names the first undecided project, and `conversation_push.delivery_failed` covers a failed drain. It no longer
    audits once per question.
  - While a retry waits, a change for a project already decided is applied at once (sent if allowed, dropped if
    denied). An undecided change joins the lane and waits for the retry already set; no second wait is started.
  - The only wait is the one created when something is undecided. It uses `setTimeout` through an optional
    `startRetry` collaborator. I did not use the gateway's `startTimer`, because replay drives that source from the
    answer waits it recorded, and these hints are untraced.
- `packages/fluxiq/src/client-gateway/service.ts`: the delivery is now built with the gateway's `events` bus.
- `.../project-focus/tests/conversation-delivery.test.ts`: 7 new tests using vitest fake timers for `setTimeout`
  and `clearTimeout`. The existing "cannot decide" test now asserts that the change waits (one timer) instead of
  being dropped.
- Docs: the integration doc ("Chats that changed") and the architecture doc now describe the wait and retry.

### Commands run and observed results

All run from the Core worktree, one at a time, with no heap crashes.
- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build`:
  contracts, sdk and client-gateway-websocket were reused from the cache; fluxiq and ui-components were rebuilt.
  No errors.
- `pnpm --filter fluxiq check`: passed, with no TypeScript errors.
- fluxiq `npx vitest run src/client-gateway src/programs/automation-studio/api/project-focus src/programs/_shared`:
  125 test files, 935 tests passed.
- `node scripts/structure-audit.mjs`: no FAIL. The only output for my files is an advisory warning that
  `tests/conversation-delivery.test.ts` is 406 lines (the advisory threshold is 400; the hard limit is 800).

Mutation checks. Each change below was applied to `conversation-delivery.ts` on its own and then restored from a
scratch copy; the tests that failed are listed.
- R1, undecided changes dropped: fail "delivers exactly once after two failed answers…", "never delivers … denial"
  and "next outage's wait …".
- R2, a denial treated as undecided: fail "never delivers a change whose retried answer is a denial…" and the
  earlier "project its person may not read" test.
- R3, `sessionChanged` disabled: fails "cancels the wait at once when the session disconnects…" (a timer is left).
- R4, no liveness check when the retry fires: fails "sends nothing to a session that now speaks for someone else…".
- R5, no de-duplication while waiting: fails "sends a chat that changed again while waiting once…".
- R6, a failed drain drops its changes: fails "keeps what was waiting when the drain itself fails…".
- R7, no doubling: fails "delivers exactly once…" (the second wait must be 2 s).
- R8, no reset after success: fails "starts the next outage's wait at one second again…".
- R9, audit on every attempt: fails "delivers exactly once…" (the audit must appear once).

### Not verified

- No live browser run.
- The gateway does not emit an event when a person changes without a new `session.ready`. That case is caught
  when the retry fires or at the next change, so the wait can outlive it by up to one interval (30 s at most). The
  test covers it at retry-fire time.
- When the authority is installed again during an outage, the waiting retry is not brought forward; it fires on
  its own schedule.

### Open questions

None.
