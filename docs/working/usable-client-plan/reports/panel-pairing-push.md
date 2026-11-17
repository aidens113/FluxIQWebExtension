# Panel pairing push (t916) — worker report

## Outcome

Done in the Core tree, `C:/Users/osrs_/FluxStuff/fxwork/t916/!FluxIQ`. Nothing was committed.
The Core web panel now hears about pairing and client changes through a pushed signal. It no longer
reads `/api/client-gateway/snapshot` on a timer. All three snapshot timers are gone. The pairing
countdown's local one-second tick stays, because it makes no network request.

## What changed and why

### Core: a change feed on the gateway

- New `packages/fluxiq/src/client-gateway/service/change-feed/` with `feed.ts`, `kinds.ts`,
  `types.ts`, a barrel, and `tests/feed.test.ts`.
  - `ClientGatewayChangeFeed` sends a signal of the form `{ kind, version }` and nothing else.
  - The kinds are: `pairing.requested`, `pairing.expired`, `pairing.withdrawn`, `pairing.approved`,
    `pairing.denied`, `pairing.refused`, `client.paired`, `client.revoked`, `client.connected`,
    `client.disconnected`.
- The feed listens to three existing sources, each at the one place the change is already recorded:
  - **The audit's security-event listener.** This covers `session.paired`, `pairing.dismissed`,
    `pairing.withdrawn`, `pairing.refused`, `session.enrolled`, `trust.issued`, `trust.revoked` and
    `enrolment.abandoned`. Using it means revocations from `access.ts`, `trust-issuance/` and
    `enrolment/` are caught without editing those files, which I don't own.
  - **The existing event bus** (`session.ready` and `session.disconnected`). Sessions under a channel
    scope are skipped, so offline trials never send a signal.
  - **The pairing registry**, for the two changes nothing else records as they happen.
- Signals raised in the same synchronous turn are merged into one, which keeps the kind of the first.
  An approval records `session.paired` and emits `session.ready` in the same turn, so it produces
  exactly one signal. This merging is not a cap: one read after the change covers the whole turn.
- `event-bus.ts` already carried connect and disconnect, so it is reused unchanged. Pairing events
  are not on the bus, and adding them would mean editing `packages/contracts/src/client-gateway.ts`,
  which this brief forbids.
- `service/pairings.ts`:
  - Gains an optional third constructor argument, `hooks`. It has `changed` (called with
    `pairing.requested` on create, and with `pairing.expired` once when a prune drops any lapsed
    challenge) and an injectable `startExpiryTimer`.
  - The registry now keeps one wait for the earliest pending expiry. Before this, a lapse was only
    noticed when something next read the registry. When the wait fires it prunes and waits for the
    next expiry.
  - The default wait is a `setTimeout` with `unref()`. It does not restart on a clock that has not
    moved, which stops a busy loop on a test's frozen clock.
  - It does not use `config.startTimer`. That source is typed to command answer waits, and
    `trace-replay/walk/timers.ts` reads `wait.commandId`.
- Facade, `client-gateway/service.ts`. The brief calls this `service/index.ts`, but the facade class
  is `service.ts`, so I edited that file. Changes:
  - New field `readonly changes: ClientGatewayChangesPort`, added as a field the way `projectFocus`
    was. No method was added; the class still has 38 methods.
  - Wiring in the constructor.
  - Re-exports of the change types and `CLIENT_GATEWAY_CHANGE_KINDS`.
- `service/index.ts` now exports the change-feed barrel.
- `sessions.ts`, `pairing-flow.ts`, `facade-ports.ts` and `types.ts` did not need changes.

### Web: one push route

- New `apps/web/src/app/api/client-gateway/changes/`:
  - `route.ts` sets `runtime = "nodejs"` and `dynamic = "force-dynamic"`. Its response headers are
    `text/event-stream; charset=utf-8`, `cache-control: private, no-store, no-transform` (the
    `no-transform` keeps compression from buffering events) and `x-accel-buffering: no`.
  - `change-event-stream.ts` is a hand-written async iterator. It sends `: open` first, then
    `event: change` with `data: {"kind","version"}`, built field by field. After 25 seconds of
    silence it sends a `: keep-alive` comment.
  - If changes arrive while the client isn't reading, only the newest one is kept for the next read.
  - When the stream is returned, it unsubscribes at once and settles any pending wait. An async
    generator would have held the workspace lease for up to 25 seconds after the client left.
- Authorization works exactly as the snapshot's does:
  - It uses the same IAM row values: `gateway:Snapshot`, callers `panel: none` and
    `paired-client: none`, resource `workspace`.
  - It goes through the existing `withWorkspaceRouteStream`, which re-checks the caller's authority
    around every chunk. A refused or signed-out stream therefore ends at its next chunk or keep-alive.
- **Files outside my owned paths**, all required because a new route must be classified in the IAM
  table, and that table's own tests fail without the entry:
  - `apps/web/src/lib/app-route-iam/contracts.ts`: one row added.
  - `apps/web/src/lib/app-route-iam/tests/contracts.test.ts`: the route added to the
    workspace-resource list.
  - `apps/web/src/app/api/tests/app-route-calls.ts`: one call added.
  - `apps/web/src/app/api/tests/app-route-iam-parity.test.ts`: one row added (all four callers
    allowed, same as the snapshot).
  - `apps/web/src/app/api/tests/app-route-iam-service.test.ts`: added to "refuses a user a list
    across the workspace".
  - `apps/web/src/app/api/tests/app-route-fixture.ts`: a `changes` stub added to the fixture gateway.

### Browser: one shared subscription

- New `apps/web/src/features/client-gateway-changes/`:
  - `subscription.ts` (`GatewayChangeSubscription`), `types.ts`, `browser-sources.ts`,
    `shared-subscription.ts` (the page singleton), `useGatewayChanges.ts`
    (`useSyncExternalStore`), the barrel, and `tests/subscription.test.ts`.
- How it behaves:
  - The first reader opens a single `EventSource`, and the last one closes it.
  - It reads `/api/client-gateway/snapshot` on every open and re-open, and once per signal.
  - A signal that arrives during a read is served by exactly one more read, so reads never overlap
    and none is lost.
  - A refused read (401 or 403) clears the snapshot.
  - It runs no timer, and a test asserts that `vi.getTimerCount()` is 0.
  - While the stream is down, the state is `reconnecting` (the browser is retrying) or `closed` (the
    browser gave up, or there is no EventSource). A closed stream re-opens when the tab becomes
    visible, on `online`, or when a reader calls `refresh()`.
  - If the stream fails before any snapshot was read, it reads once, so the page can still show
    data.
- `app/GlobalClientGatewayPairing.tsx`: the backoff poll is removed. The snapshot now comes from
  `useGatewayChanges()`. The modal shows a "Not live" notice while the stream is down, through the
  new exported `liveUpdatesNotice`.
- `features/settings-page/connect/`:
  - The 4-second `setInterval` is removed.
  - `load-connect.ts` is replaced by a pure `connect-view.ts` (`connectView`) plus
    `load-discovery.ts`. The discovery document is read once, and again on a retry after an error.
  - `use-connect-view.ts` reads from the shared subscription.
  - `ConnectClientSection.tsx` shows a "reconnecting" line, or "off" with a Reconnect button.
- `features/automation-studio/clients/`:
  - The 5-second poller is removed. `active-poller.ts` and its test are deleted; nothing else used
    them.
  - The controller reads when the view becomes active and on each change revision while it is
    active.
  - The Refresh button also re-opens a stream the browser gave up on.
  - The view header shows the live-update state.
  - `functionality-contract.ts` wording and evidence are updated.
- `useAutomationRuntimeProjectState.ts` and `features/security/data/load/paired-clients.ts` have no
  timer. The first only owns a store slot; the second is a one-shot loader used by `AccessSection`.
  I left both unchanged.

### Tests added

- Core:
  - `change-feed/tests/feed.test.ts`: 7 tests.
  - `client-gateway/tests/changes.test.ts`: 5 tests against the real `ClientGatewayService`. A
    request gives exactly `[{pairing.requested,1}]`, and approval adds exactly `{pairing.approved,2}`.
    The serialised changes contain no pairing code, token, session id, trusted-client id, client id,
    name or approver. Dismissal, revocation, disconnect and withdrawal are each covered, and a scoped
    session gives no signal.
  - `service/tests/pairings.test.ts`: 4 tests for requested and expired signals and the expiry wait.
- Web:
  - `changes/tests/route.test.ts`: 5 tests.
    - Unauthenticated requests get 401 with no event-stream content type and no subscription.
    - An IAM-refused caller gets 403, no stream, and the lease is released.
    - A signal is streamed as kind and version only, with the expected headers.
    - A paired browser is served.
    - When authority lapses mid-stream, the stream errors without sending the change, and the lease
      and subscription are released.
  - `changes/tests/change-event-stream.test.ts`: 4 tests.
  - `client-gateway-changes/tests/subscription.test.ts`: 9 tests. They cover one stream for many
    readers, a refetch on open and on re-open, coalescing, no timers, wake re-open, a single fallback
    read, the no-EventSource case, and refusal.
  - `clients/tests/useClientGatewayController.test.tsx`: 3 tests.
  - `connect.test.tsx`: 2 new push tests. Renders are now unmounted after each test, because the
    shared subscription otherwise outlives them.
  - `GlobalClientGatewayPairing.test.ts`: 2 new tests.
- Architecture doc: `docs/architecture/automation-studio/client-gateway.md` now lists the new route,
  replaces the "five-second interval" sentence, and has a new section, "How the panel hears pairing
  and client changes".

## Commands run and observed results

- `pnpm --filter fluxiq exec vitest run src/client-gateway`: 77 files and 605 tests passed. This was
  the final run, after the last edits.
- `pnpm --filter fluxiq check`: no type errors. The build cache didn't stamp it because the other
  worker changed `packages/fluxiq` while it ran.
- `pnpm --filter @fluxiq/web check`: no type errors, stamped.
- `node scripts/structure-audit.mjs`: none of my files fail. Two violations remain, both in the
  other worker's scratch tests:
  - `packages/fluxiq/src/client-gateway/service/project-focus/tests/zz-wired-scratch-t916.test.ts`
    (`as-never`).
  - `packages/fluxiq/src/programs/automation-studio/api/project-focus/tests/zz-wired-scratch-t916.test.ts`
    (`statement-packing`).
  - The audit also prints "3 baseline entries can be lowered". I did not run
    `pnpm structure:baseline`, because it writes the shared baseline file.
- Web vitest, final run after rebuilding with
  `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build` (exit 0):
  25 files and 266 tests passed. The command was `pnpm --filter @fluxiq/web exec vitest run`
  over these paths:
  - `src/app/api/client-gateway`
  - `src/app/tests/GlobalClientGatewayPairing.test.ts`
  - `src/app/tests/client-pairing-approval.test.tsx`
  - `src/features/client-gateway-changes`
  - `src/features/automation-studio/clients`
  - `src/features/settings-page/connect`
  - `src/lib/app-route-iam`
  - `src/app/api/tests`
  - `src/features/automation-studio/flow-editor/tests/canonical-view-functionality.test.ts`
- Earlier web runs on the same code:
  - `src/app/api/client-gateway/changes`: 9 passed.
  - `src/features/client-gateway-changes`: 9 passed.
  - connect, `GlobalClientGatewayPairing` and `client-pairing-approval`: 31 passed.
  - clients plus `canonical-view-functionality`: 11 passed.
  - `src/lib/app-route-iam` plus `src/app/api/tests`: 81 passed.
- Builds for the web gate: `pnpm --filter @fluxiq/contracts build` and `pnpm --filter fluxiq build`
  passed. I had to build contracts first: the fluxiq build failed with TS2345 in the other worker's
  `project-focus/activity-delivery.ts` until the contracts `dist` included their new
  `server.project_access_ended`.

## Not verified

- **Live browser behavior.** Not checked, because the brief keeps ports 3000 and 4777 for the user's
  instance. Untested in a browser:
  - EventSource opening and reconnecting.
  - That Next.js actually flushes the stream unbuffered.
  - That `request.signal` aborts or the body is cancelled when a tab closes, which is what lets the
    lease go.
  - The keep-alive passing through any proxy.
- `pnpm --filter @fluxiq/web exec vitest run src/features/security`: not run, because I changed
  nothing there.
- Web suites outside the changed directories: not run. Under the twice-a-day rule, the full web and
  Core suites are not mine to run.

## Open questions or contradictions found

1. **Brief versus the tree.** The facade is `client-gateway/service.ts`, not `service/index.ts`; I
   edited `service.ts`. A new route also needs a row in the IAM table and its tests, which sit
   outside my owned paths; those files are listed above.
2. **What the stream reveals.** A paired-client caller, and a `service`-profile panel caller whose
   snapshot is filtered, still receives every gateway signal in the workspace as kind and version.
   That reveals when some pairing or client changed, but not which one or whose. If that matters, the
   route could send only a bare `changed` kind to callers whose snapshot `callerGatewaySnapshot`
   filters.
3. **Trust expiry.** A trusted client's 60-day expiry is worked out when the snapshot is read. No
   event fires when a trust expires, so nothing signals it. The panel shows it on the next signal or
   re-open.
4. **A stale comment.** The header comment in
   `features/automation-studio/conversation/thread/poller.ts` (not mine) still says "There is no
   `EventSource`… anywhere in the panel" and mentions `createActivePoller`, which is now deleted.
   Both lines are out of date.
5. **Proposed replacement text for `docs/integrations/client-gateway-websocket.md`**, which I must
   not touch. Under "Web Panel APIs", add
   `- GET /api/client-gateway/changes (Server-Sent Events: a change signal of kind and version
   whenever pairings or clients change; authorized as the snapshot)`. Under "Notes", replace the
   paragraph that begins "Snapshot discovery pauses its fast cycle…" with:

   > The panel reads the snapshot when the stream at `GET /api/client-gateway/changes` opens or
   > re-opens and once per change it signals; it reads on no timer. A visible pending request shows
   > a live expiration countdown from a local one-second tick that reads nothing. While the stream
   > is down the prompt says so. Dismissed codes are locally bounded to prevent an already rejected
   > snapshot from flashing back before gateway persistence catches up.
