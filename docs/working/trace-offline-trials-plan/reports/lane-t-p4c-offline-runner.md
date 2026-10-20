# Lane T P4c: offline trial runner (worker report)

Brief: lane-t-p4c-offline-runner. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t746/!FluxIQ`, branch `task/t746-offline-trials-tier1`. Nothing committed.

## Outcome

Done. `runAutomationStudioOfflineCandidateTrial` is in the new directory
`packages/fluxiq/src/programs/automation-studio/runtime/service/offline-trial/`. A trial episode opened in a non-live
environment now records a derived trace. The brief's three checks pass; their output is quoted below.

## What changed and why

New directory `runtime/service/offline-trial/` (one export per file, plus a barrel):
- `contracts.ts`: the types.
  - Phases: `exploration | test | repair`.
  - The gateway port: `attachScopedSession`, `receiveRaw`, `receiveTraceArtifact` and `disconnect`.
  - The source: store, trace id and an optional session reference.
  - The input, and the outcome: `{status:"refused", reasonCode, detail}` or `{status:"ran", trial, evidence, matcher}`.
- `reader-contracts.ts`: the contract versions the reader speaks by default. These are the same three versions the host's
  episodes record (`client-gateway.protocol`, `client-gateway.trace-schema`, `client-gateway.trace-capture-boundary`).
- `run.ts`, `runAutomationStudioOfflineCandidateTrial`. In order:
  - Refuses `exploration` with `offline_not_allowed_in_phase`.
  - Reads the manifest. A missing manifest is refused. A derived source trace is also refused, because U5 needs live source
    episodes.
  - Builds a virtual clock at `manifest.clockOrigin.epochMs`, and a `trace` scoped environment on it with `random` fixed at
    0.5. The Wait node reads 0.5 as no jitter.
  - Loads `ClientGatewayTraceMatcher`. If the matcher refuses the trace, the runner refuses before anything runs or any judge
    is paid. This covers legacy traces with no session attribution, since the matcher's admission already uses P3's
    single-session evaluation.
  - Attaches the matcher session under the environment's scope and calls `deliverOpening()`.
  - Runs `runAutomationStudioCandidateTrial(request, {...ports, environment, now: environment.now})` inside
    `AutomationStudioGatewayTraceReplaySources.run([traceId])`. It then calls `settled()` and disconnects the session in a
    `finally`.
  - Answers the runner's outcome plus the U5 result.
- `evidence-result.ts`, `automationStudioOfflineTrialEvidenceResult`. It builds the U5 result and runs it through U5's
  validator, throwing if it is invalid:
  - Origins are `recorded` and `pure_computation`. `liveEpisodeId` is null, and `sourceEpisodeIds` is the manifest's
    episode id.
  - Each matcher gap becomes missing evidence: its reason, scope `segment`, operation `actionType#ordinal`, and a detail
    with the cause, the differing paths (never values) and the recorded sequence. Any gap makes the verdict `inconclusive`.
  - With no gap, a judge yes is a pass with assertion `build_test_judge.task_goal` satisfied. Every other verdict is a fail
    with reason `assertion_failure`. The assertion is `violated` for no and execution_failed, and `unverified` for unsure
    and not_judged.
  - The scope is `full_recorded_path` when execution succeeded with no gap, and `segment` otherwise.
  - Assigning the matcher's gap reason to the U5 reason type is a compile-time subset check.

Episode origin (T24), the smallest edits in `runtime/gateway-trace/`:
- `types.ts`: `AutomationStudioGatewayTraceEpisode.origin?: ClientGatewayTraceOrigin`. Absent means live.
- `episodes.ts`: the recorder uses `episode.origin ?? { kind: "live" }`. This is a one-line change.
- New `replay-sources.ts`, `AutomationStudioGatewayTraceReplaySources`: an AsyncLocalStorage holding the recorded trace ids
  an offline trial runs on. It is exported from `gateway-trace/index.ts`.
- `wiring/trial.ts`: a trial whose environment is not live (trace or fixture) opens its episode with origin
  `{kind:"derived", derivation:"replay", sourceTraceIds: <replay sources or []>}`. A live trial is unchanged. This also
  applies to the subflow trial, which uses the same wrapper.
- `candidate-trial/run.ts` was not touched.

Tests:
- `offline-trial/tests/offline-harness.ts` (support). It installs real trace episodes over a memory store, a gateway with
  the channel scope and the tap, a scripted non-browser client paired by a person, and real RuntimeService, IoRegistry and
  graph options. The candidate is plan-validated:
  - start;
  - `builtin.policy.action` reading rows with `recordOutput`;
  - a `filter-list` on price;
  - optionally a second `filter-list` on `stock`.

  The live recording is a real `runAutomationStudioCandidateTrial` with no environment. The runner opens its `test` episode,
  and the offline trial reads that trace.
- `parity.test.ts`:
  - original parity: the same rows are kept (ordinals [2,3]), the full U5 result is pinned, no live command is sent, and
    nothing is dispatched locally;
  - T16: the recorded failed-then-succeeded reads are consumed by the production retry, in order, with no gaps;
  - T22: the judge is called again on the offline run's summary, which shows the new threshold and the new step. The
    recorded yes is not reused: the judge's no gives a fail.
- `edits.test.ts`:
  - T05: threshold 10 to 15 keeps [3].
  - T06: a new `stock` computation over a field nothing read before keeps [3].
  - T23: only the upstream threshold changes and the downstream step recomputes, [2,3] to [3].
  - Changed argument: an `argument_mismatch` gap at `parameters.query`, a single non-retryable failed read, no rows, no
    judge call, an inconclusive segment, and no argument value in the evidence.
- `provenance.test.ts`:
  - T24: the derived manifest names the source trace, every event's provenance is derived, `isClientGatewayTraceLive` is
    false, the result is no live success and no whole-run pass, and the live tally is 0. An offline trial on the derived
    trace is refused.
  - Exploration is refused: no judge call, no episode, no command.
  - A missing trace is refused.
  - Gate: a port over a trace environment reads offline with no `prepareStart`, and the runner never calls a given start
    hook.
- `gap-vocabulary.test.ts`: every `CLIENT_GATEWAY_TRACE_MATCHER_GAP_REASONS` entry must be in
  `AUTOMATION_STUDIO_TRIAL_EVIDENCE_REASON_CODES`.
- `gateway-trace/wiring/tests/trial-origin.test.ts`: a live trial (named or not) records a live origin; a trace trial
  inside replay sources records derived with those sources; a fixture trial records derived with `[]`.

## Commands run and observed results

All run from `packages/fluxiq` unless noted.
- `pnpm exec vitest run src/programs/automation-studio/runtime/service/offline-trial src/programs/automation-studio/runtime/service/candidate-trial src/programs/automation-studio/runtime/gateway-trace src/programs/automation-studio/runtime/environment src/client-gateway/trace-matcher`
  -> `Test Files  48 passed (48)`, `Tests  338 passed (338)`.
- The offline-trial tests plus trial-origin, run three more times -> `Tests  15 passed (15)` each time.
- `pnpm exec vitest run src/programs/automation-studio/runtime/service/subflow-trial src/programs/automation-studio/runtime/flow-bootstrap/candidate`
  (neighbours of the `wiring/trial.ts` change) -> `Test Files  37 passed (37)`, `Tests  227 passed (227)`.
- `pnpm exec tsc --noEmit` -> no output; `tsc exit 0`.
- `node scripts/structure-audit.mjs` (worktree root) -> `structure-audit: passed (430 warning(s), 1152 baselined).`
  - One earlier run warned that `offline-harness.ts` had 10 exported values. I unexported four.
  - It also printed "1 baseline entries can be lowered". That was not caused by my files, and I did not run
    `structure:baseline`.
- Development history:
  - The first T22 run failed with `findings is not iterable`. My test's "no" verdict was missing `findings`, so the fault
    was in the test; fixed.
  - A temporary probe test was deleted.

## Not verified

- Not strictly tests-first: I drafted the runner, then the tests. The first probe passed and the tests then pinned the
  behaviour.
- Legacy traces were not tested end to end here. They rely on the matcher's admission, which P4b covers.
- No live browser or Lab run, and no full Core suite (narrow-checks rule).
- With virtual time, a region timeout inside a candidate still uses a real timer, because `executor/graph-run.ts` does not
  pass `startTimer` (P4a's open question 1). The diff shows `graph-run.ts` modified in this worktree, so P4a's fix may
  have landed, but I did not check it.
- `refusedDeliveries` from the matcher are not turned into evidence gaps (see open question 3).

## Open questions or contradictions found

1. **Refusing a derived source uses `incomplete_capture`.** U5 has no reason code for "source is not a live episode". If a
   specific code is wanted, it is a model vocabulary edit, which I did not own.
2. **A non-yes verdict with no gap is mapped to `fail`.** This applies to `not_judged`, `unsure` and `execution_failed`, as
   the brief's "pass/fail from the judge" says. An unjudged offline trial is arguably not a fail. U5 has no reason that
   fits "judge could not answer", so making it `inconclusive` would need a vocabulary addition.
3. **`refusedDeliveries` are not turned into gaps.** These include an artifact the store could not read, or the matcher
   failing. I left them out because the matcher's messages are free text, and a gateway refusal may match the original
   run. A structured kind on those entries in the matcher would let the runner classify them. That is a client-gateway
   change, so I am reporting it rather than editing.
4. **Derived origin is keyed on environment kind.** Any non-live trial episode, fixture included, is now `derived` with
   `sourceTraceIds: []` outside an offline trial. That fits T24, but it changes fixture-environment trial traces, which
   were `live` before.
5. **`deliverOpening()` is always called.** Inputs recorded before the first operation are fed before the run starts. This
   is my choice (P4b's open question 5).
