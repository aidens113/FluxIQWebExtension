# Lane T U4: Client Gateway Trace Contract (P1)

Brief: lane-t-u4-trace-contract. Repository: FluxIQ Core lane worktree
`C:/Users/osrs_/FluxStuff/fxwork/t729/!FluxIQ` (branch `task/t729-traces-offline-trials`). No commits.

## Outcome

Partial, for one reason only. The trace contract, the completeness evaluator, the sink port, the recorder,
the store port and the in-memory store are all in place. The trace tests pass (39/39) and
`pnpm --filter fluxiq check` exits 0. `node scripts/structure-audit.mjs` exits 1 because of a single
violation in a path this brief forbids me to touch:
`programs/automation-studio/runtime/environment/tests/fixture-run.test.ts` line 58, `statement-packing`.
That file belongs to the other worker. I reran the audit after waiting about 2 and then about 4 minutes,
and it still failed both times. The audit reports nothing for `client-gateway/trace/` or
`client-gateway/index.ts`.

## What changed and why

New directory `packages/fluxiq/src/client-gateway/trace/`. Every exported name carries the
`ClientGatewayTrace*` / `clientGatewayTrace*` / `CLIENT_GATEWAY_TRACE_*` prefix. Nothing imports the
executor's or evidence loop's "trace" files.

| File | Exported thing |
| --- | --- |
| `versions.ts` | `CLIENT_GATEWAY_TRACE_SCHEMA_VERSION`, `CLIENT_GATEWAY_TRACE_CAPTURE_BOUNDARY_VERSION` (both 1) |
| `vocabulary.ts` | Closed lists: activities (exploration, test, execution); event kinds (inbound, outbound, lifecycle, disposition, synthesized, control, artifact); termination reasons (completed, failed, cancelled, timed_out, disconnected, recorder_failed); redaction reasons (credential, secret, personal_data); derivations (replay, reingest) |
| `completeness-vocabulary.ts` | Loss reasons, completeness statuses (open, complete, incomplete), issue codes, recorder states |
| `types.ts` | `ClientGatewayTraceManifest`, `ClientGatewayTraceEvent`, payload, correlation, inputs, `ClientGatewayTraceSink`, `ClientGatewayTraceStore` / `StoreWriter`, completeness input and result types |
| `clone-json.ts` | `cloneClientGatewayTraceJson`: a deep-frozen JSON copy |
| `artifact-digest.ts` | `clientGatewayTraceArtifactDigest`. This is the only file that imports `node:crypto` |
| `evaluate-completeness.ts` | `evaluateClientGatewayTraceCompleteness` |
| `derived-origin.ts` | `deriveClientGatewayTraceManifest`, `deriveClientGatewayTraceEvent`, `isClientGatewayTraceLive` (T24) |
| `recorder.ts` | `ClientGatewayTraceRecorder`, which implements the sink, plus its start and options types |
| `memory-store.ts` | `ClientGatewayTraceMemoryStore`, which implements the store |
| `index.ts` | Barrel |

I added one line to `packages/fluxiq/src/client-gateway/index.ts`: `export * from "./trace/index.ts";`.
`trace/` is not exported from `contracts.ts`, the browser-bundle entry. The `browser-imports` audit rule
reported nothing.

The vocabulary is split into three files so that no file exports more than the 8-value advisory threshold.

### Contract decisions made within the brief

1. **Sequence scope.** The delivery sequence belongs to one trace. Every stream and every kind in that trace
   shares it, and it is contiguous from 1. The recorder assigns it synchronously inside `record` and
   `recordArtifact`. I read "gateway-wide" as "across every stream the gateway captures", not "across
   traces". See open question 1.
2. **Event ids** are `<traceId>#<sequence>`. **Artifact ids** are `<traceId>#artifact-<sequence>`, one per
   arrival, so each revision of a mutable resource is a separate artifact (source 5.3). The live resource's
   own identity is kept in `resourceKey` and is never dereferenced.
3. **Payload** is one of three encodings:
   - `{ encoding: "text", text }`: lossless raw text.
   - `{ encoding: "json", value }`: a deep-frozen clone. The clone drops a property whose value is
     `undefined`, as the wire does. It refuses, naming the path, anything the wire would silently change:
     non-finite numbers, Date or Map values, functions, bigint, cycles, holes or `undefined` in an array.
   - `{ encoding: "none" }`: for lifecycle and artifact events. This third encoding was not in the brief.
4. **The sink never throws into the gateway.**
   - An event it cannot keep still takes its sequence and returns `{ status: "lost", reason }`. That covers
     a payload it cannot copy, a stream not declared in the manifest, a full buffer, or a store that failed
     earlier.
   - The loss is declared in `manifest.completeness.losses`. Adjacent losses with the same reason merge
     into one range.
   - Any loss, or a recorded failure, makes the trace's claimed status `incomplete` immediately.
5. **Store failure.** If a store write fails, the recorder state becomes `failed`. An open-ended loss starts
   at the first sequence that was not saved; at close it ends at the last sequence. If the final manifest
   write fails, `close` rejects, and the stored manifest stays unclosed, so the evaluator reads it as
   `truncated`.
6. **Append after close** returns `{ status: "refused", reason: "closed" }`. `markCheckpoint` gives the same
   answer. A second `close` throws.
7. **Bounded buffer.** Two limits apply: `maxBufferedEvents` and `maxBufferedArtifactBytes`. Both count
   pending batches and batches currently being flushed.
8. **Flush order** is artifacts, then events, then the manifest. A reader therefore never meets a reference
   to bytes that have not been written yet.
9. **Completeness evaluator.**
   - Inputs: the manifest, the events, `availableArtifacts` (id, sha256, byteLength) and the caller's
     compatibility verdict, plus an explicit `recorderActive` flag.
   - When the trace is not closed, the result is `open` only if `recorderActive` is true; otherwise it is
     `truncated`.
   - Issues are tagged by sequence range or artifact id. The codes are:
     - `sequence_gap`
     - `sequence_conflict`
     - `truncated`
     - `foreign_event`
     - `undeclared_stream`
     - `broken_correlation`: a cause that is unknown or delivered later; a disposition without an earlier
       inbound cause; a delta whose base revision was not delivered earlier; an inventory entry with no
       artifact event at its sequence; a checkpoint without its event; a reference to an artifact
       delivered later
     - `missing_artifact`
     - `artifact_integrity`
     - `incompatible_contract`: from the caller's verdict, and also from the evaluator's own check of the
       trace schema and capture-boundary versions
     - `recorder_failure`
     - `buffer_overflow`
     - `declared_incomplete`
   - The evaluator never trusts a recorder's `complete` claim, and never upgrades an `incomplete` claim.
   - Gaps already covered by declared losses are not reported a second time.
10. **Redactions** are returned in a separate `limitations` array (`redaction_limited`, with path and
    reason). They do not make a trace incomplete: the token in every `client.hello` would otherwise make
    every trace incomplete. They do mark the scope as unable to pass exact parity. See open question 2.
11. **The manifest's `completeness` field** holds the recorder's claim: status, `lastSequence` and losses.
    Readers evaluate rather than trust it.
12. **Contract-value rule.** No conditional spreads anywhere. `derived-origin.ts` uses
    copy-with-override of a named value of the same type, which `code-structure.md` allows.

### Tests (`client-gateway/trace/tests/`)

I did not strictly follow "tests first": the tests were written right after the source, before the first
run. To check that the tests actually bite, I ran two mutation checks:
- Dropping declared losses in the evaluator failed 3 tests.
- Not copying artifact bytes in the recorder failed the T04 test.

Both files were restored afterwards. The test names cover:
- **T01:** raw text kept byte for byte (`1.0`, `1e3`, a 20-digit integer, null, empties, extension field,
  key order); a structured copy keeps nested, extension and empty fields and omits only `undefined`.
- **T04:** mutating the payload, the owner or the artifact bytes after recording leaves the trace
  unchanged; a mutated read copy does not change the next read.
- **T14:** truncated tail; never closed; middle gap; broken delta base; removed artifact; digest mismatch;
  incompatible contract or schema; missing evidence never evaluates complete.
- **Recorder failure (three tests):** a store write failure, with close then rejecting; a store failure
  with a successful close declaring range 2-3; an uncopyable payload, a Date value and an undeclared
  stream declared as lost.
- **Overflow (two tests):** the event bound, with recording resuming after a flush; the artifact byte
  bound.
- **Repeated events:** distinct ids and sequences.
- **Others:** append after close refused; one contiguous sequence across streams; checkpoints; manifest
  identity; store indexed reads; T24 derived origin; the clone's refusals; the sha256 vector for "abc".

## Commands run and observed results

1. From `packages/fluxiq`: `pnpm exec vitest run src/client-gateway/trace` (final run, after the builder
   export trim):
   ```text
   ✓ src/client-gateway/trace/tests/artifact-digest.test.ts (1 test)
   ✓ src/client-gateway/trace/tests/clone-json.test.ts (5 tests)
   ✓ src/client-gateway/trace/tests/derived-origin.test.ts (2 tests)
   ✓ src/client-gateway/trace/tests/memory-store.test.ts (6 tests)
   ✓ src/client-gateway/trace/tests/recorder.test.ts (13 tests)
   ✓ src/client-gateway/trace/tests/evaluate-completeness.test.ts (12 tests)
   Test Files  6 passed (6)
        Tests  39 passed (39)
   ```
2. Mutation checks with the same command:
   - Evaluator losses dropped: `Tests 3 failed | 36 passed (39)`.
   - Recorder byte copy removed: `Tests 1 failed | 38 passed (39)`.

   Both source files were restored, and `grep` confirmed the original lines are back.
3. From the worktree root: `pnpm --filter fluxiq check`, run twice.
   - First run: `check exit=0`, with `"reason":"inputs changed: packages/fluxiq; not stamped, because
     inputs changed while it ran"`, ms 93525.
   - After the builder edit: `check exit=0`, with `"reason":"no stamp; stored in the shared store"`,
     ms 84632. This was a real `tsc` run, not a cache hit.
4. From the worktree root: `node scripts/structure-audit.mjs`, run three times, exit 1 each time.
   - **First run:** one warning on my code, `[exported-values] .../trace/tests/trace-builders.ts: 11
     exported values`. I fixed it by unexporting four helpers that no test imports.
   - **Second and third runs:** no line mentions `trace/`. The only failure, on every run:
     ```text
     FAIL  [statement-packing] packages/fluxiq/src/programs/automation-studio/runtime/environment/tests/fixture-run.test.ts: 1 line holds more than one statement, line 58.
     structure-audit: 1 violation(s) across 1 rule(s).
     ```

## Not verified

- The audit passing as a whole. It is blocked only by the other worker's `fixture-run.test.ts:58`, and it
  needs a rerun once they fix it.
- Wiring the sink into `ClientGatewayService`. That is P2, as the brief says.
- Behaviour against a persisted store. Only the in-memory store exists.
- Capture overhead. Nothing was measured.
- Whether a real gateway message, once traced, round-trips through `receiveRaw`. That is P2 and P3.
- The full `vitest` run. Only the trace directory was run, per the validation rules.

## Open questions or contradictions found

1. **"Gateway-wide" sequence.** The brief says the delivery sequence is "gateway-wide, contiguous". If one
   counter were shared across every trace a gateway serves at once, no single trace's events could be
   contiguous, and gap detection would be impossible. I implemented one counter per trace, shared by all of
   that trace's streams and kinds. If several sessions or episodes are ever traced at once, P2 needs a
   recorder per trace, or a separate global ordering field. The supervisor should confirm.
2. **Redactions are limitations, not issues.** The brief lists "redaction-limited scopes" among the issues.
   I return them in a separate `limitations` array so they do not make the trace incomplete. They still
   mark exactly which sequences cannot pass exact parity. This relates to u2a open question 6.
3. **Redacting text payloads.** The u2a decision captures raw inbound text and replaces `client.hello.token`
   with a credential marker. The recorder cannot redact inside raw text. P2's inbound capture has to choose
   between two options:
   - Record the hello as a re-serialized object (`json` encoding), with a declared redaction.
   - Rewrite the text before calling `record`, and declare the redaction.

   Either way, the text is no longer the exact bytes received for that message.
4. **The evaluator's own version check is strict.** A manifest whose `traceSchemaVersion` or
   `captureBoundaryVersion` differs from this reader's version evaluates as `incompatible_contract`, even if
   a future version would be compatible. This is deliberately fail-closed, and it needs to be relaxed once a
   real migration exists.
5. **Undefined `correlation.owner`.** The recorder records an `undefined` owner as `null`, because
   `commandOwner()` may return `undefined`. Any other value that is not JSON is a recorder failure.
