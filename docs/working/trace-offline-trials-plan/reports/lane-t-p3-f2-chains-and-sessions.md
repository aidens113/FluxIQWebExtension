# Report: lane-t-p3-f2-chains-and-sessions (t742, Core worktree `fxwork/t742/!FluxIQ`)

## Outcome

Partial.

- **D22 is done.** Parity now checks order within each causal chain, not across the whole trace. The two concurrently handled state updates from D1 now match. A disposition that is changed or missing still diverges.
- **D23 is done in the tap and the replay, but no live gateway records it yet.** The tap gets a new optional option, `sessionViewOf`. It is set where `ClientGatewayService` builds the tap, in `client-gateway/service.ts:87`, and my brief forbids me to touch that file. So today no gateway hands the tap a session record, and no live trace contains a `session.claimed` event. The fix is one line, given under Open questions.

Nothing is committed.

## What changed and why

All paths are under `packages/fluxiq/src/client-gateway/`.

### D22: order is compared per causal chain

- **New `trace-replay/comparison/causal-chains.ts`** (`clientGatewayTraceCausalChains`). It names the chains an event belongs to, using its trace's alignment keys:
  - `inputs`: every inbound message and artifact, in the order received. This keeps the order of the inputs themselves checked.
  - `input|<key>`: one input and the disposition it caused, found through causation.
  - `command|<id>`: a command's outbound message, its answers, their dispositions and its synthesized outcomes.
  - `uncorrelated`: everything else, such as lifecycle events and messages for no command. These stay in recorded order among themselves.
- **`comparison/parity-report.ts`.**
  - The single global "latest replay sequence" check is replaced by a per-chain check (`outOfOrder`).
  - A reorder inside a chain is still `nondeterminism` on the field `sequence`. Its detail now names the kind of chain, for example "delivered in another order than recorded within its causal chain (an input and its disposition)".
  - Content is still compared by alignment through causation. So a disposition that is missing, extra or different keeps its class (see the tests).
  - The first declared difference now names the rule. It says "order is compared per causal chain (D22)", lists the chains, and says that inputs whose handling overlapped live may finish in either order.

### D23: the session's public view is recorded when a trace first claims the session

- **New `service/trace-tap/session-view.ts`** (`clientGatewayTraceSessionView`). It reads, by name only: `clientType`, `name`, `version`, `capabilities` and `metadata`. A token, pairing code, socket, trusted-client id, status or time on the record is never read.
- **New `service/trace-tap/lifecycle-events.ts`.** It defines `CLIENT_GATEWAY_TRACE_LIFECYCLE_EVENTS.sessionClaimed = "session.claimed"`.
- **`service/trace-tap/types.ts`.** Adds the optional `sessionViewOf?: (sessionId) => ClientGatewaySession | undefined` to `ClientGatewayTraceTapOptions`, and the type `ClientGatewayTraceSessionView`.
- **`service/trace-tap/tap.ts`.** The first time a trace claims a session, `claim()` records a lifecycle event.
  - The event's value is `{ event: "session.claimed", sessionId, clientId, view }`, under the existing lifecycle schema v1.
  - It goes into that trace under that trace's session reference, before the message that claimed it.
  - Each trace records its own claim, once.
  - With no `sessionViewOf`, or when the record is gone, nothing is recorded, as before.
- **`service/trace-tap/index.ts`.** Exports the two new modules.
- **Replay side:**
  - **`trace-replay/types.ts`.** `ClientGatewayTraceRecordedSession.claimedView` is the recorded view as a hello (no client id, no token), or `null`.
  - **`walk/recorded-sessions.ts`.** Reads the view field by field through `readClientGatewayTraceHello`. When present, the view also supplies the session's capabilities.
  - **New `walk/stand-in-hello.ts`.** A session that existed before the trace is attached with its recorded view under the recorded client id. Without a view it gets today's custom hello with the manifest's capabilities.
  - **`walk/walk.ts`.** Uses the stand-in hello. A recorded `session.claimed` event is not driven, because the replay's own tap records its own claim.
- **Comparison of the claim record.** The record is listed as `outside`, on both sides, and named as a normalization: "session.claimed lifecycle events".
  - The reason: it is state set up before the trace, and the replay attaches the session from it. Core delivered nothing for it.
  - Every delivery that depends on the view is still compared.
- **Older traces keep today's behaviour.** Without a claim record, the only gap is the existing reconcile-question `capture_gap` ("the trace does not say what the session's capabilities were..."), and only when the missing view changes a delivery.

### Tests (new files only; no existing test edited)

- **`trace-replay/tests/replay-causal-order.test.ts`** (4 tests):
  - Two state updates handled concurrently live (recorded as inbound, inbound, disposition, disposition) and replayed one at a time give `matched`.
  - The same trace with the second input's disposition recorded first also gives `matched`.
  - A changed disposition gives `intake_defect` on `payload.value.disposition`.
  - A missing disposition gives a `capture_gap` for the missing sequence, plus `intake_defect` for the replay's extra disposition.
  - Before the fix, the first two tests failed with exactly D1's divergence: `nondeterminism`, field `sequence`, "delivered in another order than recorded: the replay feeds inputs one at a time".
- **`trace-replay/tests/replay-claimed-session.test.ts`** (2 tests). The client declared `answersReconcile`, was paired before the trace, and one command's answer never came; the client answered the reconcile question `not_seen`.
  - With the claim record, the replay asks the reconcile question again and the trace matches. The entries are `outside` followed by 5 `matched`, and the normalization is listed. The recorded events do not contain the client's bearer token.
  - Without it (an older trace), every divergence is `capture_gap`, including the reconcile-capabilities gap.
  - Because the gateway is not wired, the test writes the claim record with the real tap (`sessionViewOf` set to the session's snapshot view), then inserts it before the first claiming message. If the live gateway already recorded one, the test uses that one instead.
- **`service/trace-tap/tests/session-claim.test.ts`** (3 tests):
  - The view is recorded once, before the claiming message, with the public fields only. The record's pairing code, token and trusted-client id never appear in the trace.
  - Each trace records its own claim as `session-1`.
  - Nothing is recorded with no `sessionViewOf`, or when the record is gone.
- **`trace-replay/tests/trace-copy.ts`.** Test support: copy a trace into a fresh store, renumber events, and recognise a claim record.
- **Robust to the wiring.** These tests find sequences by kind and ignore claim records where they are not the subject, so they do not depend on whether `service.ts` is wired.

## Commands run and observed results

All runs were from `packages/fluxiq` unless noted.

- `pnpm exec vitest run src/client-gateway/trace-replay/tests/replay-causal-order.test.ts`, run before the fix: `Tests 2 failed | 2 passed (4)`. Both failures were `"class": "nondeterminism", "detail": "delivered in another order than recorded: the replay feeds inputs one at a time", fields ["sequence"]`, at sequence 4 and sequence 5.
- `pnpm exec vitest run src/client-gateway/trace-replay src/client-gateway/service/trace-tap`: `Test Files 8 passed (8)`, `Tests 27 passed (27)`.
- `pnpm exec vitest run src/client-gateway src/programs/automation-studio/runtime/gateway-trace src/programs/automation-studio/client-gateway`, final run: `Test Files 54 passed (54)`, `Tests 359 passed (359)`.
- `pnpm exec tsc --noEmit`: `tsc exit 0`, final run.
- `node scripts/structure-audit.mjs`, from the worktree root, final run: `structure-audit: passed (427 warning(s), 1152 baselined).` and "1 baseline entries can be lowered" (the known `service.ts` entry, not mine).
  - The warning on my files is `trace-tap/tap.ts: 460 lines` (advisory 400). It was already 442.
  - `walk.ts` went past 400 at one point. I moved the stand-in hello into its own module, and it is now 397 lines.

## Not verified

- **D23 on a live gateway.** No `ClientGatewayService` passes `sessionViewOf`, so no live or Lab trace records the view yet. The end-to-end replay test uses a claim record written by the real tap from the session's snapshot view, not one recorded by the gateway.
- **The real D1 traces** (store seq 184, social seq 8). I did not re-run them. The synthetic concurrent recording reproduces the same divergence and now matches.
- **The activity capability.** `server.activity` is not traced, so no delivery depends on it. Only reconcile eligibility is exercised.
- **Full suites and the Core build.** Neither was run, per the brief.

## Open questions or contradictions found

1. **The wiring D23 needs is outside my files.** One line in `packages/fluxiq/src/client-gateway/service.ts:87`:
   ```ts
   const trace = new ClientGatewayTraceTap({ source: options.trace, clientIdOf: (sessionId) => sessions.get(sessionId)?.clientId, sessionViewOf: (sessionId) => sessions.get(sessionId) });
   ```
   `InternalSession` extends `ClientGatewaySession`, and the tap reads only the five named public fields. With that line, the replay gateway in `walk/gateway.ts` records its own claims too.
2. **Existing tests to re-pin once the line is in.** A claim record then becomes the first event of every trace whose first in-trace outbound claims a pre-existing session.
   - `trace-replay/tests/replay-parity.test.ts` pins the recorded kind list, `entries` all `matched`, sequences 6, 10, 2/3, and "12 matched". All shift by one, and one entry becomes `outside`.
   - `tests/trace-tap*.test.ts` may pin event lists that start with an outbound message. I did not check them one by one.
   - My new tests already tolerate either state.
3. **Downstream `test-runner` trace-parity summaries.** The new `outside` entry and normalization name appear in the report. The D1 projection keeps `outside` counts, so this is additive. The reason screen there may need the new reorder-detail template, "delivered in another order than recorded within its causal chain (...)". The old fixed sentence is gone.
4. **Claim-record comparison was my choice.** I made `session.claimed` `outside` (bookkeeping the replay consumes) rather than a compared delivery point. That way a trace recorded before wiring, or a replay gateway without the view, does not diverge on it. If the lead wants the replay's re-recorded view compared once both sides are wired, it is a two-line change in `parity-report.ts` (`isClaimedView` in `compare` and `extras`).
