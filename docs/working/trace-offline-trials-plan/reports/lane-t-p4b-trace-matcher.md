# Lane T P4b: trace matcher (worker report)

Brief: lane-t-p4b-trace-matcher. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t746/!FluxIQ`, branch `task/t746-offline-trials-tier1`. No commits.

## Outcome

Done. The matcher is a new domain-neutral directory, `packages/fluxiq/src/client-gateway/trace-matcher/`, exported from `client-gateway/index.ts`. The three checks in the brief pass. Their output is quoted below.

## What changed and why

New files under `packages/fluxiq/src/client-gateway/trace-matcher/`, one exported value per file, each directory with a barrel:

- `matcher.ts`: `ClientGatewayTraceMatcher`, which implements `ClientGatewaySocket`.
  - `static load({ store, traceId, gateway, clock, contractVersions, sessionRef? })` builds the matcher.
  - `attach(scopeId, hello?)` attaches through `attachScopedSession`. It uses the `session.claimed` view the trace recorded, then the caller's `hello`, then `{ clientType: "custom" }`.
  - `deliverOpening()` feeds what the trace received before its first operation.
  - `send(raw)` is the transport. `settled()` resolves when everything due is fed. `report()` returns the result.
  - Commands are handled one at a time, in the order the gateway sent them.
- `trace-admission.ts`: reads the manifest, the events and the artifact list from the store and runs `evaluateClientGatewayTraceCompleteness` with `recorderActive: false`.
  - It refuses a trace that is not `complete` or whose contracts are incompatible. The refusal reason is `incompatible_contract`, or `missing_artifact` when every issue is about artifacts, or `incomplete_capture` otherwise.
  - A legacy trace whose events name no session goes through P3's `session-references` (attached when it held one session, refused otherwise).
  - It picks the session the matcher stands in for. If operations went to several sessions and the caller named none, the result is `ambiguous_context`.
  - It refuses a recorded `server.execute_action` it cannot read back (`incomplete_capture`).
- `contract-compatibility.ts`: every contract the reader names must be recorded at exactly that version. Contracts only the trace names are ignored.
- `operation/`:
  - `fields.ts` names the compared fields, the transport-only fields and the fields that are not compared, with the reason for each.
  - `read.ts` reads the canonical operation: `actionType`, `target` and `parameters`, keys sorted at every depth, array order kept, absent read as `null`.
  - `differences.ts` lists differing paths, never values.
  - `match.ts` does strict matching at the cursor.
- `recorded-deliveries.ts`: splits the served session's inputs into an opening and one segment per operation.
  - A segment is everything after operation i and before operation i+1: inbound messages except `client.hello` and `client.pairing_submit` (attaching stands for those), plus artifacts.
  - A recorded `answer_never_came` for a matched command is a deadline. Nothing is fed for it; the clock moves to `max(event time, issued + waitMs + 1)`.
- `gap-answer.ts`: a `client.action_result` with `status: failed` and `failure: { category: blocked_by_capability_or_policy, code: <gap reason>, retryable: false, stage: dispatch, effect: unacted }`, fed through `receiveRaw`.
- `command-id-translation.ts`: replaces every occurrence of a recorded id written as a JSON string, quotes included, with the new id. So `cmd-1` never matches inside `cmd-10`, and every other byte is unchanged.
- `gap-reasons.ts`: a domain-neutral copy of the U5 reason codes the matcher can produce, with the same spellings: `missing_transition`, `argument_mismatch`, `ambiguous_context`, `missing_artifact`, `incomplete_capture`, `incompatible_contract`, `redacted_input`. It is a copy, not an import, because `client-gateway` must not import the program.
- `types.ts`: the input, clock, gateway port (`Pick<ClientGatewayService, "attachScopedSession" | "receiveRaw" | "receiveTraceArtifact">`), admission, match, gap and report types.

How matching behaves:

- **Match.** On a match the clock moves by the recorded latency. Each delivery in the segment is then fed in recorded order, after the clock moves by its recorded delta, with every matched command's recorded id translated.
- **Reconcile answers.** A recorded `client.reconcile_result` is held until the trial gateway sends the `server.reconcile_command` for that command id, so it is never fed before the question is asked. Once asked, it is fed outside the command queue, because that queue may be waiting on the clock.
- **Gap.** On a mismatch, or past the recorded end, the matcher answers at once and records `{ ordinal, commandId, actionType, reason, cause, fields, recordedSequence }`. `fields` holds paths only.
- **After a gap.** Every later command is answered with `missing_transition` and cause `after_gap`. No later segment is ever fed (T10).
- **Unreadable recorded answer.** If a matched segment holds an input the trace withheld or cannot write back, the command is answered with a gap (`redacted_input` or `incomplete_capture`, cause `unreadable_answer`). Nothing from that segment is fed.
- **Report.** `report()` gives `traceId`, `sourceEpisodeId` (the manifest's `episodeId`), `refusal`, `recordedOperations`, `matchedOperations`, `gaps`, `deliveredSequences`, `refusedDeliveries` and `unansweredMessageTypes`.

Transport-only fields, left out of matching and named in `operation/fields.ts`:

- the command id;
- `metadata.trace`;
- the host `lease`;
- the message envelope: `id`, `timestamp`, `sessionId` and `protocolVersion`.

Two fields are not compared but are not claimed to be transport-only:

- `timeoutMs`: the production timeout logic on the trial clock handles it (T13).
- The rest of `metadata`: this is where a program carries its node or Flow identity, which T15 says must not be the matching key.

`client-gateway/index.ts` has one added line: `export * from "./trace-matcher/index.ts";`.

Tests are in `trace-matcher/tests/`. Each recording is a real tap episode with a scripted client paired before the trace (`episode-recording.ts`). Each trial uses a gateway with a manual channel scope, a clock that really sleeps the requested milliseconds, and a gateway port that keeps every fed text (`trial-gateway.ts`).

- `matcher-replay.test.ts`:
  - original parity: search with an uploaded artifact, an unsolicited state update, then open. Results are equal apart from the command id; the fed bytes are translated.
  - T08: occurrence.
  - T12: acknowledgement, then an unsolicited state event, then completion, fed in recorded order. The command is unsettled after the first two and settled only after completion. The acknowledgement keeps its correlation. The clock's total advance equals the recorded completion latency.
  - Recorded timeout: nothing is fed, and the clock advances by more than 20 ms in total.
  - Reconcile `not_seen`: the session is attached with the recorded claimed view, whose capabilities include the reconcile capability. The result equals the recorded one.
  - T15: two candidates with different `metadata` node identity, one also with a different `timeoutMs`. Both match with no gaps.
- `matcher-gaps.test.ts`:
  - T07: changed parameters (`argument_mismatch`, fields `["parameters.query"]`, no value appears in the gap); changed target (`["target.ref"]`); changed order (`ambiguous_context`, then `after_gap`); a new operation, and one past the recorded end (`missing_transition`).
  - T10: no later observation or answer is delivered, and every delivered sequence comes before the second recorded operation.
  - T14: a missing sequence gives `incomplete_capture`, and an incompatible protocol version gives `incompatible_contract`. Every command gets the gap and only gap texts are fed.
  - T20: a live paired session on the same gateway never receives an `execute_action`.
- `operation-match.test.ts`: unit tests of canonical reading, difference paths, classification at the cursor, id translation and compatibility.

## Commands run and observed results

All from `C:/Users/osrs_/FluxStuff/fxwork/t746/!FluxIQ`.

- `pnpm exec vitest run src/client-gateway/trace-matcher` (in `packages/fluxiq`), run five times after the last fix: `Tests  19 passed (19)` every time.
  - One earlier run failed the T12 test once under parallel load. I could not see which assertion failed. The likely cause was a check that the clock moved exactly 3 times: two recorded events can share a millisecond, which gives a zero delta and no move. I replaced it with the total-latency check, and ran the suite 5 more times, all passing.
- `pnpm exec vitest run src/client-gateway` (in `packages/fluxiq`): `Test Files  47 passed (47)`, `Tests  291 passed (291)`.
- `pnpm exec tsc --noEmit` (in `packages/fluxiq`): no output, exit 0.
- `node scripts/structure-audit.mjs`: exit 0, `structure-audit: passed (430 warning(s), 1152 baselined).` with no finding under `trace-matcher`.
  - The first run failed on two of mine: `failure-as-empty` (the queue `.catch` handlers) and `naming` (four `operation-` files). Both are fixed.
  - The same run also failed on P4a's `programs/automation-studio/runtime/environment/tests/region-deadline.test.ts` (`imports`). That had cleared by the final run. I did not touch it.

## Not verified

- I have not run the matcher with P4a's virtual clock. The tests use a clock that really sleeps. Two things are untested:
  - deadlines landing exactly on a virtual timer boundary. The matcher moves the clock to `issued + waitMs + 1`, assuming timers fire once time reaches or passes them.
  - the case where a reconcile answer is held because Core has not yet asked. In the reconcile test the question came first.
- No test covers these paths:
  - an unreadable segment (`redacted_input` or `incomplete_capture` on a withheld input);
  - a redacted recorded operation;
  - several sessions with `sessionRef` (`ambiguous_context`);
  - `deliverOpening()`;
  - `missing_artifact` admission.
  The code is in place; only the tests are missing.
- A durable (ledger) command matched by the matcher was not exercised. The translation is id-agnostic, but I did not test a trial-derived ledger id.
- I did not do strict test-first ordering. The design came first, then the code and tests together. The tests then caught the T12 expectation error.

## Open questions or contradictions found

1. **`timeoutMs` and `metadata`.** The brief keys matching on action type, target and parameters, and that is what I implemented. `timeoutMs` and the rest of `metadata` are declared "not compared", not transport-only. If a domain client acts differently on a metadata field, the trial would not see that. P4c or the supervisor should confirm that the downstream web domain puts nothing evidential in command `metadata`.
2. **The AS vocabulary copy.** `gap-reasons.ts` repeats seven U5 spellings. Nothing checks mechanically that they stay a subset of `AUTOMATION_STUDIO_TRIAL_EVIDENCE_REASON_CODES`. A one-line test on the AS side, where importing both is allowed, would enforce it. I suggest P4c adds it.
3. **Reason choices that are my own.**
   - An ordering change, meaning the operation is recorded but at another point, is `ambiguous_context`.
   - Any command after the first gap is `missing_transition` with cause `after_gap`.
   - A trace refused for having no session attribution is `incomplete_capture`.
   - Change these if U5 intends otherwise.
4. **Derived traces.** The matcher does not refuse a derived trace (`origin.kind: "derived"`). It reports `sourceEpisodeId` from the manifest either way. The brief does not say whether a trial may run on a derived trace. T24 accounting belongs to P4c.
5. **The opening.** `deliverOpening()` exists but is not called automatically. The P4c runner must decide whether a trial feeds what was recorded before the first operation, for example initial state.
