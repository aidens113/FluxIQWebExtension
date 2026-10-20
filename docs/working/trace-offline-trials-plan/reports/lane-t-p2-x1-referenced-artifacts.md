# Lane T P2 X1: referenced artifacts

## Outcome

Done. If a client result references an artifact by digest and that artifact never reached the
trace, the trace now reads `missing_artifact`. If the artifact reached the trace only after the
result, it reads `broken_correlation`. In neither case does it read complete. The action stamp
now carries `scope`, set to the id of the trace it is recorded into. All work is in the Core
worktree `C:/Users/osrs_/FluxStuff/fxwork/t736/!FluxIQ` (branch task/t736-trace-capture). Nothing
was committed.

## What changed and why

All paths are relative to `packages/fluxiq/src/`.

- `client-gateway/trace/types.ts`
  - The event envelope gains `referencedDigests: readonly string[]`.
  - `ClientGatewayTraceEventInput` gains an optional `referencedDigests?`, so an input that
    leaves it out records an empty list. It is optional so that callers I do not own
    (`control-event.ts`, `episode-builders.ts`, `recording-socket.ts`) still compile without
    edits.
  - `CLIENT_GATEWAY_TRACE_SCHEMA_VERSION` is unchanged.
- `client-gateway/trace/recorder.ts`: copies `referencedDigests` into a frozen array (empty when
  absent). Artifact events always get an empty list. `artifactIds` and `referencedDigests` now
  travel to `buildEvent` together as one internal `References` object, which avoids adding a
  ninth parameter.
- `client-gateway/trace/evaluate-completeness.ts`: a new check, `referencedDigestIssues`. For
  each digest an event references, it looks for manifest artifact entries with that `sha256`:
  - no entry: `missing_artifact` at the event, with `artifactId: null` and the digest in the
    detail;
  - entries exist but every one arrived after the event: `broken_correlation`, with the
    artifact id.
  Whether the store still holds the bytes is left to the existing inventory check, which
  already reports it as `missing_artifact`.
- `client-gateway/service/trace-tap/referenced-digests.ts` (new) exports
  `clientGatewayTraceReferencedDigests(message)`:
  - It reads `metadata.trace.artifacts[].sha256` from an action result, or from a reconcile
    answer's `result`.
  - It keeps only lower-case hex SHA-256 values, removes duplicates and keeps their order.
  - It is exported from the trace-tap barrel.
- `client-gateway/service/trace-tap/tap.ts`
  - `readFields` now also extracts the referenced digests, and `envelopeInput` passes them on
    the event's `referencedDigests`. Only inbound results ever carry any.
  - The raw text is still recorded unchanged, and the result strip is untouched.
  - `stampAction` reads the scope from `sink.status().traceId`. The sink port already exposes
    this, so I added no new accessor, and both wrappers already pass `status()` through.
  - If `status()` throws, the command goes out with no stamp at all. I chose this instead of an
    unscoped stamp. An unscoped request would let a client skip an upload this trace never
    received, which recreates the bug. It also keeps the structure audit's `failure-as-empty`
    rule passing; my first version, which returned `undefined` on failure, was flagged by it.
- `client-gateway/service/trace-tap/action-stamp.ts`: `clientGatewayTraceStampedAction(message,
  scope: string)` now stamps `{ artifacts: true, scope }`.
- `programs/automation-studio/runtime/gateway-trace/screening-sink.ts`: when the sink screens a
  payload it rebuilds the input field by field, and that rebuild used to drop the digests. It
  now passes `referencedDigests` through.
- `flushing-sink.ts` needed no change: it already passes `status()` through.

Tests:

- `client-gateway/trace/tests/evaluate-completeness.test.ts`, new "an artifact referenced by
  digest" block:
  - artifact delivered before the reference: complete;
  - never delivered: `missing_artifact`;
  - delivered only later: `broken_correlation`;
  - bytes no longer held: still `missing_artifact`.
- `client-gateway/trace/tests/recorder.test.ts`: the recorder copies the digests immutably and
  defaults to an empty list.
- `client-gateway/service/trace-tap/tests/referenced-digests.test.ts` (new): the extractor's
  unit tests.
- `client-gateway/tests/trace-tap-references.test.ts` (new):
  - references land on the inbound event; malformed ones are ignored; the raw text is
    unchanged; consumers never see `metadata.trace`; outbound and disposition events carry an
    empty list;
  - a reconcile answer's landed result, tested through the tap directly;
  - the stamp carries a scope, one per trace;
  - a sink whose status cannot be read gets no stamp;
  - the two-trace case: an artifact uploaded while only trace A claimed the session leaves A
    complete, and B, whose result references that artifact, reports `missing_artifact`.
- `programs/automation-studio/runtime/gateway-trace/tests/screening-sink.test.ts`:
  - screened and unscreened events both keep their digests;
  - a screening sink wrapping a flushing sink wrapping the recorder reports the trace id, and
    the gateway's stamp names it as the scope.
- `programs/automation-studio/storage/project/gateway-trace/tests/store-persistence.test.ts`:
  the SQLite store round-trips the digests across a reopen, for inline events, events in the
  content store, and events with none.

**Existing test edited:** `client-gateway/tests/trace-tap.test.ts`. Three assertions pinned the
old stamp shape `{ artifacts: true }`, at old lines 58, 87 and 107. They now expect
`scope: "trace.stamp"`, `"trace.only"` and `"trace.durable"`. No other existing test was
changed.

## Commands run and observed results

From `packages/fluxiq`:

- `pnpm exec vitest run src/client-gateway src/programs/automation-studio/runtime/gateway-trace src/programs/automation-studio/storage/project/gateway-trace`
  - `Test Files  46 passed (46)`
  - `Tests  331 passed (331)`
- `pnpm exec tsc --noEmit`: `tsc exit 0`

From the Core root:

- `node scripts/structure-audit.mjs`
  - `structure-audit: passed (421 warning(s), 1152 baselined).`
  - New advisory warning: `tap.ts: 413 lines is past the 400-line advisory threshold` (it was
    397 lines before).
  - The line "1 baseline entries can be lowered" was already printed before my changes.

Before implementing, the new tests failed as expected: 3 failures in the trace tests, 4 in the
tap references test and 2 in the screening sink test.

## Not verified

- The extension side, which must keep its upload dedupe per `scope`, was not exercised (it
  belongs to another worker).
- No live browser run.
- I did not run full Core suites, and I did not run or rebuild Core's build or `dist`.
- The durable resend path was not checked against a stamp that now includes `scope`. The stamp
  is still applied after the request digest is taken, and the existing durable test passes with
  the scoped stamp.

## Open questions or contradictions found

- The brief wrote the input field as required. I made it optional so that callers outside my
  ownership compile unchanged. The envelope field is required. If the lead wants it required on
  the input as well, the owners of those three builders must add `referencedDigests: []`.
- The brief said to read the scope from "whatever the sink exposes". `status().traceId` already
  exists on the port, so I added no new accessor.
- When the scope cannot be read, the command now goes out unstamped. The brief did not cover
  this case.
- `tap.ts` is now 13 lines past the 400-line advisory threshold. One option is to move
  `readFields` and its helpers into their own file later.
