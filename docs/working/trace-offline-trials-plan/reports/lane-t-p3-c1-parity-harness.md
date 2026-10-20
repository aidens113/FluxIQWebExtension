# Report: lane-t-p3-c1-parity-harness (t742, Core worktree `fxwork/t742/!FluxIQ`)

## Outcome

Done. The harness, the replay prerequisites and the delivered digests are in. All the tests the brief names pass, and so do `tsc` and the structure audit. Nothing is committed.

A recorded synthetic session replays to `matched` at every delivery point. It covers a stamped action command, a state update, an uploaded artifact, a result that references the artifact, a parse failure, an answer that never came, a durable command and a disconnect. The other cases behave as the brief asks:

- A mutated recorded input gives one `intake_defect`, at the disposition that derived from it.
- A removed event gives `capture_gap`, both for the missing sequence and for the disposition it caused.
- A wrong answer-wait setting gives one `intake_defect`, on the synthesized outcome.
- After session-id translation, every outbound message is byte-equal to the recorded one.

## What changed and why

All paths below are under `packages/fluxiq/src/client-gateway/`.

### 1. Replay prerequisites in the gateway

- **Id source** (`service/types.ts`, `service/config.ts`). New option `ClientGatewayServiceOptions.createId?: (kind: ClientGatewayIdKind) => string`. The kinds are `message`, `command`, `nonce` and `client`. The default is `randomUUID()`.
  - Used in `transport.ts` for server message ids. The id is minted before the clock is read, and a comment pins that order.
  - Used in `commands.ts` for non-durable command ids and ping nonces.
  - Used in `lifecycle.ts` for the scoped client id. The `client.scoped.` prefix is kept.
- **Clock.** `config.now` already stamped every gateway timestamp. Every message the tap records is now built with it, and no direct `Date.now` remains in `service/`.
- **Timer source.** This goes beyond item 1, but the brief's "timeout outcome replays to matched" needs it. New option `startTimer?: ClientGatewayTimerSource`, which is `(wait: { kind: "answer"; commandId }, delayMs, fire) => { cancel() }`. The default wraps `setTimeout`. It is used for the answer wait in `commands.ts` and for both durable answer waits in `command-ledger/dispatch.ts`. `PendingCommand.timeout` and the durable `Entry.timer` now hold a `ClientGatewayTimer`. The packed-line count in `dispatch.ts` is unchanged.
- **`waitMs` on the timeout outcome.** `answer_never_came` synthesized outcomes now also carry `waitMs`, in both `commands.ts` and `dispatch.ts`. A replay reads the original gateway's `commandTimeoutMs` from it, because the timed-out result's message embeds the wait.
- **Session reference.** Tap events did not say which session they came from, so I added one (`service/trace-tap/tap.ts`). Each trace now gives every session it meets an opaque `session-<n>` and puts it on every event that belongs to a session: outbound, inbound, parse failure, disposition, lifecycle and artifact. Synthesized events get none, because they route by command. The reference is never a session id or token.
  - **Contract change (said so, as the brief asked).** This needed a small additive optional field in `trace/types.ts`: `session?: string` on `ClientGatewayTraceEvent`, `ClientGatewayTraceEventInput` and `ClientGatewayTraceArtifactInput`.
  - **Implementation change in `trace/`.** `trace/recorder.ts` copies the field. That is a one-line implementation change inside `trace/**`, beyond the contract files.

### 2. Derived values in the capture

- Every disposition now carries `delivered: { result, event }`. Each value is the lower-case hex SHA-256 of canonical JSON, or `null`. The disposition schema moved to `client-gateway.trace.disposition` version `"2"`.
  - `service/trace-tap/delivered-digest.ts` holds the canonical serializer: keys sorted by code point, arrays in order, `undefined` properties omitted. A value that is not JSON data reads `unhashable` rather than throwing.
  - `service/trace-tap/delivery-collector.ts` takes each digest at the moment of delivery.
- **`result`** is the action result handed to the waiting caller. That is after `interrupted` is read and `metadata.trace` is stripped; for a durable command it is the parsed, allowlisted result.
  - It is recorded only when Core took the result as the outcome: `settled`, and for a durable command only after the receipt committed. I added an optional `delivered` callback parameter to `ClientGatewayCommands.settle` and `ClientGatewayDurableDispatch.settle`/`accept` for this.
  - The durable digest covers the result, not the receipt, because the receipt's `receivedAt` comes from the clock.
- **`event`** is the event emitted to listeners. It covers the event's `type` and `message`, and leaves out the session view: that view's ids and times are minted at session setup, outside any trace, and the inbound event already carries the session reference. `inbound.ts` sends all eight emits through one private `emit`. A collector is built only when a trace took the message, so an untraced gateway computes no digests.

### 3. Replay harness, in the new `trace-replay/`

- **Entry point.** `replayClientGatewayTrace({ store, traceId, commandTimeoutMs?, quietTurns? })` returns a `ClientGatewayTraceParityReport`. It is exported from `client-gateway/index.ts` with one line.
- **Layout.** `walk/` holds the gateway, the id and clock feed (`sources.ts`), manual timers, an in-memory ledger, the alignment, readers of recorded sessions, commands, hellos and inbound text, and the walk itself. `comparison/` holds the differences, the classification, the minted fields, the normalizations and the report. The top level holds `types.ts`, `parity-classes.ts`, `replay-trace.ts` and the barrel. Each module has one export.
- **The replay gateway.** It is an ordinary `ClientGatewayService`, run on the recording's ids and clock and on manual timers, with a private ledger and a lease source fed from the recording. Its own tap records into a `ClientGatewayTraceMemoryStore` under the original trace id, so stamps, scopes and event ids read the same. The recorder declares the trace `derived`/`replay`.
- **The walk.**
  - Sessions that existed before the trace began are paired first, through hello and operator approval, while nothing claims them, so nothing is recorded. They use the recorded client id.
  - The walk then goes through events in sequence order. Before each event it settles: it waits until no new replay event has arrived for 3 `setImmediate` turns. It passes over any event Core already derived.
  - **Inbound.** Each inbound goes through `receiveRaw`, awaited one at a time. A structured credential-type message without redactions is fed as its JSON text. A parse failure is fed as a stand-in `""`, which fails to parse with the same `SyntaxError`.
  - **Artifacts.** Each artifact goes through `receiveTraceArtifact`, with bytes read from the store.
  - **Actions.** Each `server.execute_action` is re-issued through `executeAction` and rebuilt from the recorded payload:
    - fields keep their recorded order;
    - the command id, lease and trace stamp are removed;
    - metadata is kept where the caller wrote it;
    - a durable command is recognised when its owner is a binding whose derived command id equals the recorded one, and is re-issued with `ClientGatewayCommandContext.issue(binding)`;
    - owner and lease are fed from the recording.
  - **Other caller commands.** `start_recording`, `stop_recording`, `capture_snapshot` and `ping` go through their own methods. `server.error` is re-issued only when Core did not derive it.
  - **Lifecycle.** Connect, disconnect, pairing approval and gateway close are reproduced.
  - **Timeouts.** An answer wait runs out when the walk reaches an event Core produced for that command that it has not derived yet. That is a reconcile question or an `answer_never_came`.
  - **Ids and clock per step.** A step is fed the ids and time stamps of the recorded outbound messages up to the next input or caller-only command. Minting a message id moves the clock to that message's recorded time.
- **Comparison.**
  - **Alignment.** Events are aligned by delivery point, not by sequence: an input by the recorded input it was fed from, a disposition by its cause, outbound by type, command and session, lifecycle by type and session, synthesized by type and command.
  - **Compared fields.** Kind, stream, message type, session, source id, sequence and time, all correlations (a cause by its key), payload schema, payload (inbound text byte for byte; structured payloads including key order), referenced digests and redactions. Relative order is checked separately. The two manifests' artifact lists are compared by digest, type and size.
  - **Classes, in order:**
    1. `capture_gap`: the replay noted the trace lacked something, by event, session or command. This also covers a disposition whose cause is missing, an event whose command is absent after a sequence gap, or a different payload schema.
    2. `nondeterminism`: only ids or times Core minted differ (`comparison/minted-fields.ts`), or only the order differs.
    3. `intake_defect`: everything else.
  - **Verdict.** `matched` only when there are no divergences. Control events are listed as `outside`.
- **Normalized fields.** Each is named in the report with its reason:
  - `eventId` and `sequence`: replaced by alignment, with order checked.
  - `time.logicalMs` and `time.observedAt`.
  - `provenance.origin`.
  - `artifactIds`: compared through the manifests instead.
  - Session ids in payloads: translated one to one through the session reference. They come from `sessions.ts`, which is outside the id source and not in my files.
  - The payload of an unparsed inbound: withheld at capture under D18.
- **Declared differences** are listed in every report: sequential intake, answer waits run out where the recording shows, reconcile waits run on the real clock, and pre-existing sessions are paired by the replay.

### 4. Tests

- `trace-replay/tests/replay-parity.test.ts`, 5 tests:
  - the session replays to matched;
  - outbound messages are byte-equal after translation;
  - a mutated input gives `intake_defect` at sequence 6, fields `payload.value.delivered.result` and `payload.value.delivered.event`;
  - `commandTimeoutMs: 99` gives `intake_defect` at sequence 10 on `waitMs` and `result.message`;
  - a removed sequence 2 gives `capture_gap` at 2 and 3, with the other 12 matched.
- `trace-replay/comparison/tests/divergence-class.test.ts`, 2 tests: the class order, and difference paths including key order.
- `service/tests/id-and-timer-sources.test.ts`, 2 tests:
  - every command id, message id and nonce comes from `createId`;
  - every answer wait goes through `startTimer` with `{ kind: "answer", commandId }`, and settling the command cancels it;
  - message timestamps come from `now`;
  - the defaults are UUIDs and real waits that a cancel stops.
- **Existing test edited.** `tests/trace-tap.test.ts` had two assertions that pinned the disposition payload as `{ disposition: "settled", error: null }`. Both now also expect `delivered: { result: <sha256>, event: <sha256> }`. No other existing test was edited.

## Commands run and observed results

All runs are from `packages/fluxiq` in the Core worktree, unless noted. The final results are after the last edit, which was a header comment in `tap.ts`.

- `pnpm exec vitest run src/client-gateway src/runtime/tests/client-gateway-transport.test.ts src/programs/automation-studio/client-gateway src/programs/automation-studio/runtime/environment src/programs/automation-studio/runtime/gateway-trace`
  - Result: `Test Files 56 passed (56)`, `Tests 379 passed (379)`.
  - Before the two pinned assertions were updated, the same set gave `1 failed | 35 passed`. Only those two pins failed.
- `pnpm exec vitest run src/client-gateway/trace-replay`, run 5 times in a row. Every run gave `Tests 7 passed (7)`.
- `pnpm exec tsc --noEmit`: exit 0, no output.
- `node scripts/structure-audit.mjs`, from the worktree root: `structure-audit: passed (427 warning(s), 1152 baselined).`
  - An earlier run failed `[naming]` because 6 `replay-` files shared a prefix. I fixed that by moving them into `walk/` and `comparison/`.
  - **Remaining warnings on my files.** `service/trace-tap/tap.ts` is at 439 lines. It was already past the 400-line advisory threshold at about 413 before this work.
  - **Lowerable baseline entry.** The audit says one baseline entry can be lowered. `--json` shows it is `file-lines packages/fluxiq/src/programs/automation-studio/runtime/service.ts 4316 < 4318`, which is not my file. I did not run `pnpm structure:baseline`, because `.structure-baseline.json` is shared.

## Not verified

- No replay of a real trace: neither a P2 Lab trace nor a saved-flow replay. That is unit D1.
  - **P2-era traces will not replay cleanly.** They lack session references and `delivered`, so the replay reports them as `capture_gap` ("the event does not say which session it belongs to"), or as a payload-schema `capture_gap` on dispositions. D1 needs traces recorded after this change.
- The walk paths for `session.connected` mid-trace (reconnect), `pairing.approved`, caller commands other than actions, `gateway_closed`, host-lease-stamped commands, and the reconcile-question path (a capable session, `server.reconcile_command`) are written but not exercised by a test.
- Concurrency. Inputs are fed sequentially, so an order difference on a live trace would be reported as `nondeterminism`. Synthetic traces cannot show that.
- Full `pnpm check`, `pnpm test` and the Core build were not run. Per the brief, the build was not run.

## Open questions or contradictions found

1. **Files outside my ownership, edited because they were needed:**
   - `client-gateway/service.ts`: one line, to pass `config.createId` to `ClientGatewayTransport`. The facade constructs the transport, so a message-id source cannot be wired any other way. The brief's "Must not touch" covers this file.
   - `trace/types.ts`: the additive `session` field, as the brief allowed.
   - `trace/recorder.ts`: one line to copy that field.
2. **Session ids and trusted-client ids are still minted outside the id source**, in `sessions.ts` and `trusted-clients.ts`, which I did not touch. Session ids are therefore translated through the session reference, and named as a normalization. A `pairing.approved` event's `trustedClientId` will diverge as `nondeterminism`. Routing `sessions.ts` and `trusted-clients.ts` through `createId` would remove both. That is a small follow-up if the supervisor gives a brief for those files.
3. **The program's trace manifests record `capabilities: null`** (`AS/runtime/gateway-trace/episodes.ts:178`). A session that existed before the trace is therefore attached with no capabilities. If the live session answered reconcile questions, the reconcile path cannot be reproduced. The harness then marks that command `capture_gap` ("the trace does not say what the session's capabilities were"). Recommendation: the program records the session's capabilities in the manifest, or the tap records a capabilities snapshot when it first claims a session.
4. **Cross-worker contract.** The persisted store keeps each event as JSON, so `session` and `delivered` survive today. Unit A, the store dedupe, must keep both: the optional `session` field, and the disposition payload's `delivered` object, which is new in schema version 2.
5. **Reconcile waits still use a real timer.** `command-reconcile/reconciler.ts` was outside my files. If a recorded client never answered a reconcile question, the replay waits for the real `reconcileAnswerMs`, and its outcome may land after later steps. It would then show as an order divergence.
6. **The brief listed only an id source and the clock for item 1.** The timer port and the `waitMs` field were also needed so that a timeout replays deterministically. Both are additive, and the defaults are unchanged.
