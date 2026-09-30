# core-gateway-activity (C1) report

## Outcome

Done. Core can now push `server.activity` to paired clients, and the WebSocket
client emits it as a typed `activity` event.

## What changed and why

All paths are in the Core tree `C:\Users\osrs_\FluxStuff\fxwork\t185\!FluxIQ`.

- `packages/fluxiq/src/client-gateway/service/activity-publisher.ts` (new):
  `ClientGatewayActivityPublisher.publish(activity, { projectId }): number`.
  It sends to a session only when all of these hold:
  - `status === "ready"`;
  - `capabilities` include an entry with `id === CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID`;
  - `session.projectId` is null, undefined or equal to `target.projectId`.

  It returns the number of sessions whose socket accepted the send.
- `packages/fluxiq/src/client-gateway/service/transport.ts`: added
  `sendUnqueued(session, message): boolean`, which writes straight to
  `session.socket` and never touches `outbound`.
  - It returns false when there is no socket, or when `send` throws. That case
    carries a `/* best-effort: ... */` comment.
  - A rejected promise from an async socket is caught with its own best-effort
    comment and still counts as sent. The count is synchronous, so it cannot
    know about a later rejection.
- `packages/fluxiq/src/client-gateway/service/index.ts`: barrel export.
- `packages/fluxiq/src/client-gateway/service.ts`: the facade method
  `publishActivity(activity: ClientGatewayActivity, target: { projectId: string }): number`,
  which forwards to the publisher. The publisher is built from the same
  `sessions` and `transport` as the other collaborators.
- `packages/client-gateway-websocket/src/types.ts`: added
  `{ type: "activity"; message: Extract<ClientGatewayServerMessage, { type: "server.activity" }> }`
  to `FluxIQClientGatewayWebSocketEvent`.
- `packages/client-gateway-websocket/src/transport.ts`: `handleServerMessage`
  emits `activity` for `server.activity`. The generic `message` event still
  fires first, as it does for every server message.
- Tests:
  - `packages/fluxiq/src/client-gateway/service/tests/activity-publisher.test.ts`
    (new, 5 tests). They cover capability filtering (including an unpaired
    capable session), project filtering (same, null and other project), the
    queue bypass (50 events and `outbound` unchanged), a closed socket (a sync
    throw and an async rejection, where no throw occurs and the other sessions
    are still reached), and a socketless ready session (count 0).
  - `packages/client-gateway-websocket/src/tests/index.test.ts`: one new test.
    It checks that the typed `activity` event fires with its payload and that
    no other typed event fires.
- `packages/client-gateway-websocket/dist` was rebuilt. It is untracked build
  output.

## Commands run and observed results

- `pnpm --filter fluxiq exec vitest run src/client-gateway --minWorkers=1 --maxWorkers=2`
  -> 2 files passed, 18 tests passed (activity-publisher 5, service 13).
- `npx vitest run --minWorkers=1 --maxWorkers=2`, run in
  `packages/client-gateway-websocket` -> 1 file, 4 tests passed.
- `npx tsc --noEmit`, run in `packages/client-gateway-websocket` -> exit 0.
- `pnpm --filter fluxiq check` (`tsc --noEmit`) -> exit 0.
- `pnpm structure:check` -> "structure-audit: passed (196 warning(s), 355
  baselined)". The relevant warnings:
  - The advisory `[directory-files] packages/fluxiq/src/client-gateway/service/:
    18 source files is past the 15-file advisory threshold`. The directory was
    already over the threshold at 17 before this change, and the new file makes
    18.
  - It also printed "1 baseline entries can be lowered". That entry is not from
    this change as far as I can tell, and I did not run `structure:baseline`,
    because the baseline is shared.
- `pnpm --filter @fluxiq/client-gateway-websocket build` -> succeeded. The
  output `dist/types.d.ts` has the `activity` event, and `dist/transport.js`
  emits it.

## Not verified

- Behaviour against a real `ws` socket. It is unknown whether a closed `ws`
  socket throws, calls back with an error, or silently no-ops. Tests use a fake
  socket that throws or rejects.
- The full `fluxiq` test suite. Only `src/client-gateway` was run.
- Wiring the gateway to the hub (P3, lane lead). No caller of
  `publishActivity` exists yet.

## Open questions or contradictions found

- The return count includes a session whose async `send` later rejects. This
  is inherent in a synchronous `number` return. The brief's signature was kept.
- `service/` is now at 18 files, past the advisory threshold of 15. If
  the supervisor wants it under the threshold, a later split (for example
  `service/outbound/` for `transport` and `activity-publisher`) would be
  needed. That is outside this brief.
