# Lane T P5a: reevaluation port in Core's trace matcher (t749)

Worker report for brief P5a (trace plan P5 tier 2). Core tree
`C:/Users/osrs_/FluxStuff/fxwork/t749/!FluxIQ`, branch `task/t749-offline-reads-tier2`. No commits.

## Progress log

### 2026-10-20 — tests first, all shown failing before any source change

Added (tests and test support only):

- `client-gateway/trace-matcher/tests/matcher-reevaluation.test.ts` (new, 7 tests);
  `tests/trial-gateway.ts` gains a `reevaluator` option handed to the matcher.
- `model/offline-trial/tests/{validate-trial-evidence-result,whole-run-gate-eligibility,live-success-eligibility}.test.ts`:
  one test each (snapshot origin and reasons validate; a reevaluated offline pass validates and is never gate or
  live-success eligible).
- `runtime/service/offline-trial/tests/reevaluation.test.ts` (new, 2 tests); `tests/gap-vocabulary.test.ts` gains the
  snapshot-reasons drift check; `tests/offline-harness.ts` `runOffline` takes a `reevaluator` option.

Observed before the change (from `packages/fluxiq`):

- `pnpm exec vitest run src/client-gateway/trace-matcher/tests/matcher-reevaluation.test.ts` ->
  `Tests  6 failed | 1 passed (7)`. The one passing is "never asks when the segment does not hold exactly one result"
  (a guard that holds trivially while no reevaluator is ever asked).
- `pnpm exec vitest run src/programs/automation-studio/model/offline-trial` -> `Test Files  3 failed | 2 passed (5)`,
  `Tests  3 failed | 49 passed (52)` (the three new tests).
- `pnpm exec vitest run .../offline-trial/tests/reevaluation.test.ts .../offline-trial/tests/gap-vocabulary.test.ts` ->
  `Tests  3 failed | 2 passed (5)`: `expected [ 'missing_transition', …(6) ] to include 'snapshot_unavailable'`,
  `expected [] to have a length of 1 but got +0`, `expected undefined to deeply equal []`.

### 2026-10-20 — implementation

Core (`packages/fluxiq/src/`):

- `client-gateway/trace-matcher/types.ts`: new exported types `ClientGatewayTraceRecordedPayload`,
  `ClientGatewayTraceReevaluationArtifact` `{ id; sha256; mediaType; sequence }`,
  `ClientGatewayTraceReevaluationRequest` `{ traceId; command; operation; recorded; recordedCommand; fields;
  recordedResult; artifacts; readArtifact(sha256) }`, `ClientGatewayTraceReevaluation`
  (`{ status: "answered"; result }` | `{ status: "gap"; reason; fields }` | `{ status: "declined" }`),
  `ClientGatewayTraceReevaluator` `{ reevaluate(request) }`. `ClientGatewayTraceMatcherInput.reevaluator?`.
  `ClientGatewayTraceMatchedOperation` gains `answeredFrom: "recorded" | "reevaluated"` and `fields`.
  `ClientGatewayTraceMatcherGap.cause` gains `"reevaluation"`. All reach `client-gateway/index.ts` through the
  existing `export type *` barrel (not edited).
- `client-gateway/trace-matcher/reevaluation-request.ts` (new, one export `clientGatewayTraceReevaluationRequest`):
  eligibility (exactly one readable `client.action_result` for the recorded command id in the segment, every input
  in it readable) and the request: artifacts = manifest artifacts with `sequence <` the next recorded operation's
  sequence (trace end for the last op); `readArtifact` resolves only listed digests; `recordedCommand` read from the
  store's event at the recorded sequence, `null` when redacted or not JSON.
- `client-gateway/trace-matcher/matcher.ts`: on a gap with cause `mismatch`, same action type, reevaluator present,
  not refused/diverged (those return earlier), offers the command. `answered` -> cursor advances, segment fed in
  recorded order with the one result's text replaced by `{ ...recordedEnvelope, payload: { ...result, commandId:
  recordedId } }`, then the usual id translation; matched entry `answeredFrom: "reevaluated"`, `fields` = differing
  paths. `gap` -> gap with its reason/fields, cause `reevaluation`, diverged. `declined` / not eligible -> the existing
  mismatch gap unchanged. Throw, or a malformed answer (non-object, unknown reason, non-string fields, no result
  object) -> `incomplete_capture` gap, cause `reevaluation`, fields = differing paths, `the reevaluator failed: <msg>`
  in `refusedDeliveries`; the command is answered at once (never left to time out). Header comment updated.
- `client-gateway/trace-matcher/gap-reasons.ts`: `snapshot_unavailable`, `dynamic_content` appended, doc comments.
- `programs/automation-studio/model/offline-trial/vocabulary.ts`: origin `snapshot_evaluation` (appended, so
  normalized order is `recorded, pure_computation, live, modeled, snapshot_evaluation`); reasons
  `snapshot_unavailable`, `dynamic_content` appended; docs. `live-success-eligibility.ts`: comment only (the existing
  live-only rule already excludes the new origin; no logic change needed in either eligibility file).
- `programs/automation-studio/runtime/service/offline-trial/contracts.ts`: `AutomationStudioOfflineCandidateTrialInput
  .reevaluator?: ClientGatewayTraceReevaluator`; new `AutomationStudioOfflineTrialReevaluatedOperation
  { ordinal; actionType; fields }`; `AutomationStudioOfflineCandidateTrialRan.reevaluated` (always present, `[]` when
  none). `run.ts` passes the reevaluator to the matcher and fills `reevaluated` from the matcher report.
  `evidence-result.ts` adds `snapshot_evaluation` to `evidenceOrigins` when any matched op was reevaluated.

Commands (from `packages/fluxiq` unless noted):

- `pnpm exec vitest run src/client-gateway/trace-matcher src/programs/automation-studio/runtime/service/offline-trial
  src/programs/automation-studio/model/offline-trial` -> `Test Files  19 passed (19)`, `Tests  109 passed (109)`
  (existing matcher, runner and model tests untouched and passing; new: matcher-reevaluation 7, reevaluation 2,
  gap-vocabulary +1, model +3).
- `pnpm exec tsc --noEmit -p .` -> exit 2 with 5 errors, none in owned paths, all in other workers' in-flight
  test-first files: `runtime/gateway-trace/wiring/tests/service-store.test.ts` (no export
  `automationStudioGatewayTraceServiceStore`) and `runtime/service/trial-ports/tests/{environment.test,fakes,
  service-ports.test,whole-ports.test}.ts` (`Cannot find module '../index.ts'`). An earlier run in the same session
  (before those files appeared) printed no errors.
- From the Core root `node scripts/structure-audit.mjs` -> exit 1, `5 violation(s) across 1 rule(s)`, all
  `[package-exports]` (the new rule another worker is adding) in `apps/web/.../core-contract*.ts` and
  `scripts/{automation-studio-scale-baseline,automation-studio-scale-certification,flow-compiler}.mjs`. No finding
  (fail or warn) names a trace-matcher or offline-trial file.

UNIT READY: packages/fluxiq/src/client-gateway/trace-matcher/{types,matcher,gap-reasons,reevaluation-request}.ts,
packages/fluxiq/src/client-gateway/trace-matcher/tests/{trial-gateway.ts,matcher-reevaluation.test.ts},
packages/fluxiq/src/programs/automation-studio/model/offline-trial/{vocabulary,live-success-eligibility}.ts,
packages/fluxiq/src/programs/automation-studio/model/offline-trial/tests/{validate-trial-evidence-result,whole-run-gate-eligibility,live-success-eligibility}.test.ts,
packages/fluxiq/src/programs/automation-studio/runtime/service/offline-trial/{contracts,run,evidence-result}.ts,
packages/fluxiq/src/programs/automation-studio/runtime/service/offline-trial/tests/{offline-harness.ts,gap-vocabulary.test.ts,reevaluation.test.ts}

## Outcome

Done. The port, vocabulary and runner wiring are in place and tested; owned paths are clean under tsc and the audit.

## What changed and why

See the 2026-10-20 "implementation" log entry above: D31-D33 implemented as briefed (port types and matcher
behaviour in Core's trace matcher, snapshot vocabulary on both sides, runner origin and `reevaluated` list).

## Commands run and observed results

See both dated log entries above (tests shown failing first, then 19 files / 109 tests passing; tsc and audit
findings all outside owned paths).

## Not verified

- Full `tsc` and audit green: blocked by other workers' in-flight files (above), not by this unit.
- Core was not built (lead owns it); downstream not touched or checked beyond a grep (no downstream file names the
  changed types or vocabularies).
- No test drives a redacted recorded operation through the port, or an artifact recorded by another session.

## Open questions or contradictions

- A redacted recorded operation with the same action type matches with reason `redacted_input` but cause `mismatch`,
  so by the brief's rule it is offered to the reevaluator (with `recordedCommand: null`, `fields: []`). I followed the
  brief literally; if redacted ops should never be reevaluated, add `match.reason !== "redacted_input"` to the guard.
- `command` is the raw sent payload as the brief says, so it includes transport-only fields (`metadata.trace`, the
  host `lease`) the matcher never compares. If the lease should not reach a domain port, strip it in the matcher.
- `artifacts` lists every artifact the trace recorded before the next operation, from any session (brief wording);
  the matcher's own feeding is per session.
