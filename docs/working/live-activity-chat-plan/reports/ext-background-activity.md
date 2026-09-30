# ext-background-activity (E1) report

## Outcome

Done. `pnpm structure:check` still fails, but on two findings in supervisor-owned
working documents, not in any E1 file (details below).

## What changed and why

- `apps/extension/src/background/activity/` (new):
  - `activity-relay.ts`: `ActivityRelay` and `ActivityRelayDeps`.
    - Holds `ExtensionActivityState`.
    - Drops malformed events, and any event whose `sequence` is not greater than
      the last kept one.
    - `noteSessionReady()` resets the sequence mark. Core counts per process, so
      without the reset a Core restart would silence the stream until the new
      count passed the old one.
    - `recent` is capped at `ACTIVITY_RECENT_LIMIT`.
    - The overlay preference defaults to "expanded" and is read lazily from
      storage, once.
    - Each kept event, and each overlay change, fans out in two ways:
      - it broadcasts `{ type: ACTIVITY_MESSAGES.changed, state }`;
      - it sends an `ActivityContentMessage` to the automation tab's top frame.
    - Page delivery is serialized and coalesced. One send is in flight at a
      time, and events that arrive during it collapse into one send of the
      latest state.
    - Every broadcast, delivery and storage failure is absorbed with a
      `/* best-effort */` comment.
    - `noteContentReady(tabId, frameId)` re-sends the current state when it is
      the top frame of the automation tab. It sends nothing before the first
      activity arrives.
  - `is-activity-overlay-preference.ts`: a type guard.
  - `overlay-preference-storage.ts`: `chrome.storage.local` under the key
    `fluxiq.activity.overlay`.
  - `index.ts`: barrel.
  - `tests/activity-relay.test.ts`: 11 tests.
- `background/connection/server-command-channel.ts`:
  - new dep `acceptActivity(activity: unknown)`;
  - `server.activity` is routed to it before `set_active_tab`, with no status,
    reply or error change.
- `background/connection.ts` constructs the relay with these deps:
  - `automationTabId`: `page.tabId()`, or undefined when `page.unsupported()`;
  - `deliverToTab`: `ensureContentScript(tabId)` then `sendToTab(tabId, msg, 0)`;
  - `live`: `gateway.state() === "connected"`;
  - `broadcast`: `chrome.runtime.sendMessage`.

  It also calls `activity.noteSessionReady()` in `onSessionReady` and
  `activity.noteContentReady` in `handleContentReady`, and adds the public
  methods `activityState()` and `setActivityOverlay()`.
- `background/panel/panel-control.ts`:
  - `ACTIVITY_MESSAGES.read` and `setOverlay` join `PANEL_MESSAGES`, so they
    are control-page only;
  - both answer `{ ok: true, state }`;
  - an invalid overlay returns `relayFailure("invalid_request", ...)`;
  - new dep `activity: { read, setOverlay }`, which `panel-control-deps.ts`
    wires to the connection.
- The tests for the panel control and the channel were updated:
  - the harness gains the new deps;
  - the forbidden-sender test now covers the two activity types;
  - new tests cover read, setOverlay and invalid overlays;
  - a new routing test covers `server.activity`.
- `domain/src/runtime/capabilities.ts`: `{ id: CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID, label: "Live activity", kind: "custom" }` appended to `webAutomationGatewayCapabilities`. It declares no domainId, inputs, outputs or action types. New `domain/src/runtime/tests/capabilities.test.ts` has 3 tests. No existing domain test enumerated the capability ids, so none needed updating.
- `docs/architecture/extension-client.md`: under "Wire Shape", `server.activity` is added to the server list, followed by a new "### Live Activity" subsection.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/extension check`: exit 0. It was run
  twice, the second time after the other workers' concurrent edits.
- `pnpm --filter @fluxiq-web-extension/extension test`: exit 0, with
  `# tests 1127`, `# pass 1127` and `# fail 0`. The new tests appear as `ok`,
  for example:
  - "events that arrive during a slow delivery are coalesced";
  - "server.activity goes to the activity relay and nothing else";
  - "an overlay preference that is not one of the three is refused".
- `pnpm --filter @fluxiq-web-extension/domain check`: exit 0.
- `DOMAIN_TEST_BUILD_LABEL=e1-activity pnpm --filter @fluxiq-web-extension/domain test`:
  exit 0, with `# tests 885`, `# pass 885` and `# fail 0`.
- `pnpm structure:check`: it was run twice and exited 1 both times, with 2
  violations. Neither is in E1's files:
  - `[docs-links] docs/working/live-activity-chat-plan.md:28`: the link to
    `./live-activity-chat-plan/reports/t185-live-activity-chat.md` is broken
    (the file is not present or tracked);
  - `[working-docs] docs/working/README.md is out of date`, which needs
    `pnpm structure:baseline`.

  Both belong to the supervisor. E1's files add only these advisory warnings:
  - `connection.ts` is at 438 lines, past the 400-line advisory threshold;
  - `FluxIQConnection` has 29 methods, past the 25-method advisory threshold.

## Not verified

- No browser was run, by the brief's instruction, so none of these were
  exercised live:
  - the overlay delivery;
  - `chrome.storage.local` persistence;
  - the `chrome.runtime.sendMessage` broadcast.
- The end-to-end path with a real Core pushing `server.activity` was not run. It
  depends on C1 emitting to the socket and on the client package passing the
  envelope through the generic `message` event. The routing relies on
  `client.on("message")` receiving every server message, which is how every
  other `server.*` type reaches `handleMessage` today.
- The labelled domain test build dir `domain/.test-build-e1-activity/` (ignored)
  was left behind.

## Open questions or contradictions found

- The relay's state lives in `FluxIQConnection`. A panel `resetSession`
  recreates the connection, and a service-worker restart also clears the
  relay's state. The next Core event restores it. This is acceptable under D2,
  but E3 should not assume history survives either.
- Own origin: when the automation tab is the FluxIQ Core panel's own tab, the
  overlay is still delivered there. `page.unsupported()` does not cover Core's
  origin. It is harmless (`pointer-events: none`), but to exclude it, add an
  own-origin check to `automationTabId` in `connection.ts`.
- `live` means only that a gateway session is ready. The extension cannot tell
  whether that Core actually supports the stream.
