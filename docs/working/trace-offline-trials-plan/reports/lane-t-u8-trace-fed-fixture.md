# Report: lane-t-u8-trace-fed-fixture

## Outcome

Done. A unit test now shows that the trace contract and the run environment together carry a non-browser client's runtime inputs through Core's real intake (`receiveRaw`), with no web field. Only test files changed. Nothing in the trace contract, the environment or the gateway needed changing.

## What changed and why

All three are new files in `C:/Users/osrs_/FluxStuff/fxwork/t729/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/environment/tests/`:

- `recording-socket.ts` (91 lines): `recordingGateway(gateway, sink)` returns a Proxy of the `ClientGatewayService`, which is handed to the unchanged `FixtureGatewayClient`.
  - Its `attachScopedSession` wraps the session socket. Each outbound server message is recorded as a JSON event (kind `outbound`, its message type, correlation `commandId`).
  - Its `receive` turns the client's answer into text and records that exact text as a `text` event (kind `inbound`, correlated by `commandId`). It then passes the same text to `gateway.receiveRaw`.
  - A comment says this wrapper stands in for P2's capture inside the gateway.
- `trace-fed-client.ts` (157 lines): `TraceFedGatewayClient.load(gateway, store, traceId)` is built only from the store's indexed reads: `readManifest`, then `readEventRange(1..lastSequence)` for the outbound commands, then `readEventsByCorrelation("commandId")` when an answer is needed. It attaches as a scoped session.
  - It matches each `server.execute_action` by action type, canonical parameters and occurrence, never by node id.
  - In the recorded inbound text it replaces only the JSON member `"commandId":"<old>"` with the new command's id. The member must appear exactly once, or the call is answered as `incomplete_capture`. The text is fed through `receiveRaw`.
  - An unmatched call is answered at once through `receiveRaw` with a non-retryable, `unacted` failure in the category `blocked_by_capability_or_policy`. Its `code` is an offline-trial reason code: `argument_mismatch` when the trace holds that action type only with other parameters, otherwise `missing_transition`. Such a call consumes no recorded answer.
- `trace-fed-run.test.ts` (248 lines), with 4 tests:
  1. **Recording run and offline run.**
     - The recording run's trace evaluates `{status:"complete", issues:[], limitations:[]}`, and its inbound event is correlated to the outbound command.
     - The offline run, under a different scope with parameters in another key order, gets the same node outcome and outputs.
     - The new command id differs from the recorded one. The text fed in equals the recorded text with only the command id member replaced.
     - The `receiveRaw` spy saw exactly that text. `receive` was never called during the offline run.
     - The recording fixture received nothing new. The paired live session received no command, and the local fallback was never used.
  2. **T07 groundwork.** A candidate with `{amount:3}` against a recorded `{amount:2}` gets one failed attempt, with code `argument_mismatch`, non-retryable, and a code that is in `AUTOMATION_STUDIO_TRIAL_EVIDENCE_REASON_CODES`. The recorded `total:5` never appears in that attempt. A later matching call still gets the recorded success.
  3. **T08 groundwork.** Two recorded calls with the same action and parameters (first a retryable failure, then a success) are answered by occurrence. The offline outcome equals the recording's (`failed` then `succeeded`).
  4. A call past the recorded occurrences gets one failed attempt with `missing_transition`.

Outcome comparison leaves out one output, `runtimeCommandId`. It is the transport's per-command correlation id, minted fresh on every run. Test 1 asserts that it equals the new command id.

## Commands run and observed results

- From `packages/fluxiq`: `pnpm exec vitest run src/programs/automation-studio/runtime/environment`
  - First run: 4 failures. All 4 came from `runtimeCommandId` differing between the recording run and the offline run. The comparison was fixed as described above.
  - Final run:
    - `✓ tests/environment.test.ts (8 tests)`
    - `✓ tests/fixture-run.test.ts (5 tests)`
    - `✓ tests/trace-fed-run.test.ts (4 tests)`
    - `Test Files 3 passed (3)`, `Tests 17 passed (17)`
- From `packages/fluxiq`: `pnpm exec tsc --noEmit` -> exit 0 (`tsc exit 0`).
- From the repository root: `node scripts/structure-audit.mjs` -> `structure-audit: passed (407 warning(s), 1152 baselined).` with exit 0. None of the warnings names one of the new files.

## Not verified

- Core's build was not run, and `dist` was not touched (both as the brief requires).
- No live browser and no Lab run; this is a unit test only.
- The structure audit's statement-packing rule passed. I did not review each line against it by hand beyond that.

## Open questions or contradictions found

- `git status` in the Core worktree shows earlier uncommitted work (client-gateway service files, `trace/`, `environment/`, and others) that predates this brief. I touched none of it, but the supervisor commits it together with these files.
- The fixture client answers through `receive(object)`, so the recorded "raw text" is `JSON.stringify` of that object. The recording run also takes it in through `receiveRaw`. A client that sends its own text would be captured byte for byte once P2 records inside the gateway.
- The code chosen for a gap failure is the bare reason code (`argument_mismatch`, `missing_transition`, `incomplete_capture`), without a namespace prefix. P4 may want a fixed convention for this.
