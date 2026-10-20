# Report: lane-t-p2-g-gateway-tap (t736, Core gateway capture tap)

## Outcome

Done. The gateway records what it sends and receives into the trace that the dispatching async context names
(`ClientGatewayServiceOptions.trace`). With the option unset, or with `current()` answering nothing, it records and
stamps nothing. The brief's vitest set passes (43 files, 292 tests; the baseline before any edit was 39 files and 271
tests). The existing tests were not edited. `tsc --noEmit` exits 0 and the structure audit passes.

## What changed and why

All paths are under `packages/fluxiq/src/client-gateway/` in `fxwork/t736/!FluxIQ`.

New module `service/trace-tap/`, one exported value per file, plus a barrel:
- `tap.ts` (`ClientGatewayTraceTap`): handles routing, claims and recording.
  - Outbound (`outboundMessage`). Messages are recorded into the sinks of their command id if that id is mapped,
    otherwise into `current()`. Each of those sinks claims the session, by session id and by the client id the
    session speaks for, and the command id is mapped to them. Outside every episode, a message sent to a claimed
    session goes to that session's claimants instead, without creating a new claim.
  - Inbound (`inboundText`, `inboundMessage`, `parseFailed`, `disposition`).
    - Action results and reconcile answers go to the sinks mapped to their command id. If the id is not mapped, they
      go to the claimants.
    - Everything else goes to the claimants. A hello is also matched by the client id it claims.
    - The disposition is recorded with `causationEventId` set to the inbound event's id in each sink.
  - Lifecycle events go to the claimants.
  - `synthesized` records Core's own outcomes. It routes by command id, and falls back to `current()` for
    refusals.
  - `artifact` checks the digest, then calls `recordArtifact` on each claimant and counts how many recorded it.
  - Fail-safe behaviour:
    - Every sink call is wrapped, so a sink that throws never reaches the gateway.
    - A sink that answers `refused: closed` loses its claims and its command routes.
    - When a new sink claims, existing claims whose sink reads `closed` are dropped. This bounds the claim and route
      tables.
- `action-stamp.ts`: returns a copy of the message with `metadata.trace = { artifacts: true }`. The command's own
  metadata is kept and nothing is mutated.
- `result-metadata-strip.ts`: removes `metadata.trace` from an action result, and from the landed result inside a
  reconcile answer. If `metadata` held nothing else, it is removed too. A message with nothing to strip comes back as
  the same object.
- `credential-fields.ts` and `credential-redaction.ts` (D7): redact `client.hello` `/payload/token`,
  `client.pairing_submit` `/payload/pairingCode` and `server.session_ready` `/payload/token`. Each is replaced with
  `{ redacted: "credential" }` plus a `credential` redaction, and the message is recorded as structured JSON. Raw text
  is never stored for these types.
- `streams.ts` (`CLIENT_GATEWAY_TRACE_TAP_STREAMS`: `gateway` and `artifact`), `schemas.ts` (payload schema refs) and
  `types.ts`.

Wiring:
- `service/types.ts`: new option `trace?: ClientGatewayTraceCaptureSource`.
- `service.ts`:
  - builds the tap with `clientIdOf` read from the session registry and passes it to every collaborator;
  - adds the facade method `receiveTraceArtifact(sessionId, { sha256, mediaType, bytes })`, which answers
    `{ status: "accepted", traces }` or `{ status: "refused", reason: "digest_mismatch" }`;
  - re-exports `CLIENT_GATEWAY_TRACE_TAP_STREAMS` and the two artifact types.
- `service/transport.ts`: records in `send`, `sendChecked` (after its admission checks) and `sendUnqueued`. The tap
  is an optional third constructor argument and defaults to inert.
- `service/inbound.ts`:
  - `receiveRaw` records after `JSON.parse`, before any await.
  - A parse failure is recorded as the raw text plus a `parse_failed` disposition, and is then rethrown.
  - `receive` records `JSON.stringify` at entry.
  - The old `receive` body is now a private `handle` that returns a disposition, for example `settled` or `late`,
    the settle result, `reconcile_answered`, `pairing_required` or `accepted`.
  - A throw is recorded as `receive_failed` with its message and rethrown. The websocket host answers that failure
    with `gateway.receive_failed` carrying the same message, so this disposition records that write. I did not edit
    `apps/web/src/server/client-gateway-websocket.ts`.
  - `handle` strips `metadata.trace` first, before the settle and the event emit, so no settle or event sees it.
- `service/commands.ts`:
  - a plain action is stamped before it is recorded and sent, with its owner from `commandOwner`;
  - outcomes recorded as `synthesized`: `answer_never_came` (with the reconcile state and result), `gateway_closed`,
    and `refused_unsent` for host-lease and channel refusals (plain, durable channel, and snapshot channel). A refused
    command never appears as `outbound`.
- `service/command-ledger/dispatch.ts`:
  - the durable message is stamped after the request digest, so tracing never changes what the ledger claims;
  - outcomes recorded as `synthesized`: `uncertain` (on the transition only), `suppressed` with a reason
    (`not_waiting`, `invalid_result`, `uncertain_status` or `not_committed`), `answer_never_came`, and the durable
    host-lease `refused_unsent`.
- `service/lifecycle.ts`, `service/pairing-flow.ts` and `service/access.ts` record lifecycle events:
  - `session.connected`, with any hello passed in having its `/hello/token` redacted;
  - `session.disconnected`;
  - `pairing.approved`;
  - `trust.revoked`, per ready session.
- `service/index.ts`: one barrel line.

Tests (new):
- `service/trace-tap/tests/credential-redaction.test.ts` (3 tests) and `result-metadata-strip.test.ts` (4 tests).
- `tests/trace-tap.test.ts` (13 tests):
  - inert when unset;
  - inert under a source with no episode;
  - plain stamp and strip;
  - metadata dropped when the trace was all it held;
  - durable stamp after digest, and the durable strip;
  - T04 (inbound and outbound);
  - routing across two sinks by command id and by claims, plus claims dropped after close;
  - a sink that answers closed is offered nothing more;
  - lifecycle and synthesized outcomes;
  - artifact intake for two traces, and the digest refusal;
  - credential redaction: neither the original token, nor the rotated token, nor the pairing code appears anywhere in
    the stored events;
  - the parse-failure disposition;
  - a throwing sink does not reach the gateway.
- `tests/trace-tap-replay.test.ts` (T01). Frames with nested values, extension fields, empty values, explicit nulls,
  absent fields, number spellings and whitespace are recorded byte for byte. Replaying them into a fresh gateway's
  `receiveRaw` yields deep-equal events and an equal settled result. The test mints ids from a counter by mocking
  `randomUUID`, so the fresh gateway's command id matches the live one.
- `tests/trace-tap-support.ts`: test support (an async-context source, a recorder over the memory store, a paired
  client).

## Commands run and observed results

All commands ran from `fxwork/t736/!FluxIQ/packages/fluxiq` unless noted.

- Baseline before any edit:
  - Command: `pnpm exec vitest run src/client-gateway src/runtime/tests/client-gateway-transport.test.ts src/programs/automation-studio/client-gateway src/programs/automation-studio/runtime/environment`
  - Result: `Test Files 39 passed (39)`, `Tests 271 passed (271)`.
- New tests on their own: `Test Files 4 passed (4)`, `Tests 20 passed (20)`.
- Mutation checks. Each mutation was reverted afterwards, and `diff` against the backup printed `restored`.
  - Inbound credential redaction disabled: 1 failed (the D7 test).
  - Strip disabled: 4 failed (T01, the plain strip, metadata-drop and durable tests).
  - Results routed only to claimants: 1 failed (the routing test).
  - Claim never dropped: 0 failed at first. I added the "offered nothing more" test, after which it gave 1 failed.
- Final run of the brief's vitest set (same command):
  - `Test Files 43 passed (43)`, `Tests 292 passed (292)`, `exit 0`.
- `pnpm exec tsc --noEmit`: printed nothing; the exit code was 0 (`tsc exit 0`).
- `node scripts/structure-audit.mjs` (from the repository root):
  - The first run failed with 4 violations:
    - 3 `facade-dispatch`: the tap method name `outbound` collided with the facade's public `outbound`, so I renamed
      it to `outboundMessage`;
    - 1 `statement-packing` in the test file, which I split.
  - The final run printed `structure-audit: passed (420 warning(s), 1152 baselined).` The only new warning that
    concerns the gateway is `ClientGatewayService has 35 methods`, which is advisory.

## Not verified

- No live socket or browser run. The websocket host path is covered only through `receiveRaw`; the host file is
  unchanged.
- Integration with the real episode source (lane R) and the persisted store (lane S). Everything here runs against
  `ClientGatewayTraceRecorder` over the memory store.
- The parked or resumed paths, and `attachScopedSession`: scoped attaches are not recorded as lifecycle events.
- Capture overhead was not measured; that belongs to the P2 gate.

## Open questions or contradictions found

1. **`sendUnqueued` versus D1.** The brief lists `sendUnqueued` as a capture point. D1 excludes `server.activity`,
   which is the only message sent unqueued today. The tap is hooked at `sendUnqueued` but skips `server.activity`, as
   D1 says. If activity should be traced after all, remove it from `UNTRACED_OUTBOUND` in `tap.ts`.
2. **Stream names.** I could not edit `trace/**`, so the stream names live in `service/trace-tap/streams.ts`. They are
   exported from `client-gateway/index.ts` through `service.ts` as `CLIENT_GATEWAY_TRACE_TAP_STREAMS`. Lane R's
   recorders must declare both `gateway` and `artifact`; otherwise the recorder declares every tap event lost.
3. **Routing choices beyond the brief, for the lead to confirm.**
   - A result whose command id is not mapped goes to the claimants rather than nowhere.
   - Outbound messages sent outside any episode (pings, `session_ready` on reconnect) go to the claimants.
   - With two traces claiming one session, unsolicited inbound is recorded into both. This is P2a open question 3,
     left as is.
4. **Strip runs even when tracing is off.** The strip runs whatever the option says, so no consumer ever sees
   `metadata.trace`. For any result without that key the behaviour is identical; the cost is one `hasOwn` check.
5. **Parse failures store raw text.** Text that fails to parse goes to the claimants as raw text. If a malformed hello
   carried a token, that token would be stored. Lane R's screening sink (D15) is the remaining guard.
6. **Possible lowerable baseline.** I did not unpack any line in `dispatch.ts`. If the supervisor's audit lists it as
   lowerable, run `pnpm structure:baseline`; I do not own the baseline file.
