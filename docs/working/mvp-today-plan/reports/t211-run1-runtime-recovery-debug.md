# t211 — Run 1 runtime/recovery debug

## Scope

- Run: `run-muj2kzx1-8f9f8271`
- Read only the brief-authorized bundle integrity/index, timeline, runtime/action/failure/recovery portions of `snapshots/flow-lane.json`, and sanitized facility diagnostics.
- Did not read raw logs, provider prompts/responses, selectors, recorded page data, credentials, browser state, or unrelated artifact bodies. Did not modify source, shared documents, builds, processes, providers, browsers, or Lab state.

## Verdict

Stage 4 never began. The created-flow lane stopped during **build**, before Core assigned a runtime run id or attempted any action. The terminal product-behavior cause recorded by the bundle is:

- category: `runtime.behavior`
- code: `flow_bootstrap.evidence_iteration_limit`
- stage: `provider_output_validation`
- HTTP status: `400`

The build loop ended after 26 decisions and 24 tool calls (109,661 bounded evidence bytes). It recorded 26 provider calls, all attributable to Flow construction (`providerCalls` and `loopProviderCalls` both 26), not replay. `recoveredAfterTimeout` is false. The build duration is 221,361 ms.

The facility diagnostic is less specific: boundary `finalized-bundle`, stage `scenario.execute`, reason `unclassified`. It does not contradict the more specific lane failure; it only says the facility did not refine that product-behavior failure into a narrower facility taxonomy.

## Bundle integrity

- `bundle.complete.json` schema is `0.1`.
- Its recorded artifact-index SHA-256 exactly matches the current `artifact-index.json`.
- All 15 indexed artifacts exist and match their indexed byte size and SHA-256; zero are missing or mismatched.
- The index contains the authorized `run.json`, `summary.json`, `evaluation.json`, `review/timeline.json`, and `snapshots/flow-lane.json` entries, each marked with applied redaction.

## Timeline

| Sequence | UTC timestamp | Boundary | Safe interpretation |
| ---: | --- | --- | --- |
| 1 | 2026-09-27T00:19:06.569Z | `runtime.dispatch` | The language-driven Flow build/run request was dispatched. |
| 2 | 2026-09-27T00:22:54.168Z | `runtime.settle` | The Flow-build attempt settled. |
| 3 | 2026-09-27T00:22:54.184Z | `error` | The build was rejected because the evidence iteration limit was reached. |

The run manifest spans 2026-09-27T00:17:56.457Z through 2026-09-27T00:22:54.778Z and ends `failed`. The evaluation likewise ends `failed`, lane `flow`, with `flowCreated: false` and zero harness activations.

## Node-by-node execution

| Node | Executed | Produced | Duration | Retries | Recovery rung |
| --- | --- | --- | --- | --- | --- |
| None | No | No Flow reached runtime | Not applicable | None | None |

Evidence: `runtimeRunId` and runtime `status` are null; `actions` is empty; evaluation actions are empty; `flowCreated` is false. Consequently there is no defensible node ordering, node duration, attempt count, target-resolution result, or per-node output to report.

## Failure and recovery behavior

- Terminal failure: Flow bootstrap exhausted its evidence iteration allowance while validating provider output.
- Recovered terminal failures: none (`recoveredFailures` is empty).
- Runtime failure record: none (`runFailure` is null), because runtime was never entered.
- Runtime action retries: none; there are no action attempts.
- Runtime recovery rungs: none; there are no action attempts or recovery record.
- Harness activations: 0 in evaluation; the incomplete lane snapshot has no runtime activation count because it stopped at build.
- Timeout recovery: not used (`build.recoveredAfterTimeout: false`).

This evidence does **not** indicate a defensive-executor failure. The executor, browser action retry ladder, and result-repair path were never exercised. The actionable failure boundary is the Flow-bootstrap evidence loop/provider-output-validation path.

## Provider calls during replay

No replay occurred, so there are no replay-provider calls to count. The 26 calls in the lane snapshot are explicitly build-loop calls and must not be reported as replay calls. Because no replay record exists in the authorized Stage-4 slice, the correct replay value is **not applicable**, not an observed numeric zero.

## Evidence gaps

- No Flow was produced, so Stage-4 behavior—node execution, passive/effect output, retries, readiness waits, target recovery, and success-doing-nothing—has no evidence.
- No runtime run id exists, so runtime status and provider accounting for an execution/replay cannot be correlated.
- No recovery record exists, so the absence of runtime rungs follows from the pre-runtime stop; it is not proof that a rung would or would not work on a runnable Flow.
- The allowed slice identifies the exhausted limit and validation stage but does not expose a safe per-decision reason for why 26 build decisions failed to converge. Diagnosing malformed decisions, repeated exploration, or an insufficient limit belongs to the exploration/proposal analysis, without reproducing raw provider or page content.
- The sanitized facility reason is `unclassified`; there is no narrower facility diagnosis to add.

## Recommended handoff

Treat this as a build-loop convergence/validation failure before runtime, not as a replay or defensive-recovery regression. Use the t210 exploration/proposal findings to identify which bounded decision/validation pattern consumed the iteration budget. Do not change runtime retry or repair behavior based on this run: none of it was exercised.
