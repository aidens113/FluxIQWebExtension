# Report: lane-t-p2-r-episodes (t736, Core `AS/runtime/gateway-trace/`)

## Outcome

Done for my files. The 42 tests in `runtime/gateway-trace` pass, and the tests fail when the code is broken (checked
below). On the final rerun `tsc --noEmit` exits 0. The structure audit still exits 1 with four violations, all in the
gateway worker's in-progress files (`client-gateway/service/transport.ts`, `client-gateway/tests/trace-tap.test.ts`),
none in mine. The brief says those are theirs.

## What changed and why

New directory `packages/fluxiq/src/programs/automation-studio/runtime/gateway-trace/`, plus one line in
`runtime/index.ts` (`export * from "./gateway-trace/index.ts";`). Each file exports one value:

- `episodes.ts`: `AutomationStudioGatewayTraceEpisodes` (D8, D9).
  - Options: `{ enabled, storeFor(projectId), now, flush: { everyEvents, intervalMs }, contractVersions,
    gatewayStreams, buffer?, newTraceId?, reportFailure? }`.
  - `run(episode, work)`:
    - opens a `ClientGatewayTraceRecorder` with origin live, the episode's id, activity and context, and capabilities
      `null`;
    - registers the episode and runs `work` inside a per-instance `AsyncLocalStorage` frame;
    - closes the trace `completed` when the work settles, `cancelled` on an `AbortError`, and `failed` on any other
      throw, then returns or rethrows exactly what the work did.
  - Nested `run`: the child replaces the frame for its own work. The parent records `control.child_episode_opened`
    and `control.child_episode_closed`, each with `{traceId, episodeId, activity | terminationReason}`.
  - `gatewaySource` is the `ClientGatewayTraceCaptureSource` (the innermost frame's screening sink). It is `undefined`
    when tracing is off, so the wiring can pass `trace: episodes.gatewaySource` as it is. `current()` returns the
    ambient open episode, for D9's build id at `service.ts:1568`.
  - Tracing never fails the work. If the store or recorder cannot open, the failure is reported and the work runs
    untraced. A failed close is reported, and the work's own result stands.
- `open-episode.ts`: `AutomationStudioGatewayTraceOpenEpisode`.
  - Holds the identity (project, episode, trace, activity, flowId) and `sink`, which is the screening sink.
  - `recordControl(event)` first records any attached artifact on the control stream. It then records the control
    event as JSON, referencing that artifact's id.
- `registry.ts`: `AutomationStudioGatewayTraceRegistry`, at `episodes.registry`.
  - `byRunId(runId)` matches the episode id (D9).
  - `byFlow(projectId, flowId)` returns the open episodes outermost first, because a build and its trial share a Flow.
  - Also `size()`.
- `episodes.recordControl(event, episode?)`: writes into the given episode, or the ambient one. It does nothing and
  returns `undefined` when tracing is off or no episode is open.
- `control-vocabulary.ts`: `AUTOMATION_STUDIO_GATEWAY_TRACE_CONTROL` = `{ stream: "control", types: [append_turn,
  ask_answer, run_control, start_hook_answer, artifact_intake, child_episode_opened, child_episode_closed] }`.
- `control-event.ts`: builds a control event.
  - Kind `control`, message type `control.<type>`.
  - Payload schema `automation-studio.control.<type>` v1.
  - Only the correlations the caller passes (`commandId`, `recordingId`, `causationEventId`).
- `screening-sink.ts` and `payload-screen.ts`: the D15 screen.
  - Synchronous. Every string leaf and key goes through `screenAutomationStudioLlmEvidence(leaf, [])`, which also
    finds Luhn card numbers.
  - A leaf whose only finding is a card number keeps its other words: `automationStudioWithoutCardNumbers` replaces
    just the number. Any other hit replaces the whole leaf with `[withheld: secret]`.
  - A secret-shaped key is renamed `[withheld secret key N]`, so a redaction path never repeats the secret.
  - When anything is found, the event is stored as JSON with `redactions: [{path: <JSON pointer>, reason: "secret"}]`,
    added after any redactions the gateway already declared (D7).
  - Nothing found: the input object is passed on untouched, so text stays the exact text received.
  - Text that is not JSON is screened as one leaf at path `""`. If the screen itself throws, the whole payload is
    withheld rather than stored raw.
  - Artifacts pass through.
- `flushing-sink.ts`: the flush policy. It flushes every N recorded events, and on an unreferenced `setInterval`
  while events are buffered. It stops the timer on close and reports a flush failure without raising it.
- `termination.ts`: `AbortError` maps to `cancelled`, anything else to `failed`. The detail is `Name: message`, or the
  name alone when the message is secret-shaped, at most 500 characters.
- `environment.ts` and `from-environment.ts`: `FLUXIQ_CLIENT_GATEWAY_TRACE`.
  - On: `1`, `true`, `on`. Off: unset, empty, `0`, `false`, `off`. Trimmed, case ignored.
  - Anything else throws: "FLUXIQ_CLIENT_GATEWAY_TRACE must be 1, true or on ..., or unset, 0, false or off for none."
- `types.ts` and `index.ts`.

Tests are in `gateway-trace/tests/` and use the memory store only:

- `episodes.test.ts` (16):
  - open, close and termination (completed, failed, cancelled, secret-free detail);
  - the store chosen per project;
  - an open or close failure is reported while the work still answers;
  - flushing every N events, and by interval with `unref` called;
  - an invalid flush policy is refused;
  - nesting markers;
  - two concurrent episodes kept apart;
  - registry lookups and their removal at close;
  - control events, given and ambient, with an artifact;
  - control screening;
  - disabled means zero work: no source, no store call, no frame, no control events;
  - repeated streams, or a stream named `control`, are refused.
- `screening-sink.test.ts` (8):
  - a clean text event stays byte-identical;
  - a secret leaf and a card number become markers and `secret` redactions;
  - the gateway's own credential redaction is kept;
  - artifacts pass through;
  - the same payload object is returned when nothing is found;
  - a secret key is renamed, with pointers escaped;
  - unparseable text;
  - a card number beside another secret is withheld whole.
- `from-environment.test.ts` (18): the parsing of the switch.

## Commands run and observed results

From `packages/fluxiq` in `fxwork/t736/!FluxIQ`:

- `pnpm exec vitest run src/programs/automation-studio/runtime/gateway-trace` printed `Test Files 3 passed (3)` and
  `Tests 42 passed (42)`.
- To check that the tests can fail, I broke three things on purpose: the leaf screen always returned its input, `run`
  called `work()` without the frame, and `AbortError` no longer mapped to cancelled. The same run then printed
  `Tests 13 failed | 29 passed (42)`. I restored the files from a scratchpad backup, and a `git diff --no-index`
  against the backup showed no difference.
- `pnpm exec tsc --noEmit` printed `tsc exit 2`. All the errors are in `src/client-gateway/tests/trace-tap.test.ts`,
  the gateway worker's in-progress test: `metadata`/`parameters` missing on a union, and `receiveTraceArtifact` not
  existing on `ClientGatewayService`. No errors are in `gateway-trace/`. An earlier run, before that test file
  existed, printed `tsc exit 0` with my files in place.
- From the repo root, `node scripts/structure-audit.mjs` printed `structure-audit: 4 violation(s) across 2 rule(s)`:
  - three `facade-dispatch` in `client-gateway/service/transport.ts`;
  - one `statement-packing` in `client-gateway/tests/trace-tap.test.ts`.

  None is in `gateway-trace/`, and no warning names it either. Its earlier `failure-as-empty` at `episodes.ts:135`
  (`open` returning `undefined` from a catch) is fixed: a trace that fails to open is now caught in `run`, which
  reports it and runs the work.
- Final rerun after waiting:
  - vitest printed `Test Files 3 passed (3)` and `Tests 42 passed (42)`.
  - `pnpm exec tsc --noEmit` printed `tsc exit 0` with no errors. The gateway worker's files had settled by then.
  - The structure audit still printed `structure-audit: 4 violation(s) across 2 rule(s)`, all the same four in
    `client-gateway/service/transport.ts` and `client-gateway/tests/trace-tap.test.ts`, none in `gateway-trace/`.

## Not verified

- Nothing is wired yet: no capture through the real gateway tap, and no persisted SQLite store. Both are later units.
- I did not observe the audit passing as a whole: the gateway worker's four violations remain. No finding names
  `gateway-trace/`.
- Number leaves are not screened: per the brief, only string leaves and keys. A card number sent as a JSON number
  would be stored.
- The manifest's `capabilities` is always `null`, because the episode does not know the session when it opens.

## Open questions or contradictions found

1. **Stream names are a cross-unit contract.** The recorder refuses an event on an undeclared stream and records it
   as a loss. So `gatewayStreams` is a required option: the wiring unit must pass the stream names unit G's tap
   uses. The test builders use `"gateway"`, the name the trace tests use. The control stream `"control"` is added
   automatically, and a gateway stream named `control` is refused.
2. **Artifact intake has no payload.** The screenshot is recorded as an artifact event on the control stream, then a
   `control.artifact_intake` JSON event that references it, because the recorder gives artifact events no payload.
   D13's dedicated trace-artifact route goes through the gateway's intake, not through this module.
3. **Capture failures are reported, not raised.** By default `reportFailure` logs with `console.error`, giving only
   the stage, the episode id and the error kind, never the message. The wiring may pass its own reporter.
4. **Several episodes per Flow.** `byFlow` returns every open episode of a Flow, outermost first. The cancel-build
   handler probably wants element 0, the build.
