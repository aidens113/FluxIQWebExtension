# t312 — provider-free dry-run shape audit

## Outcome

The dry-run response is a single sanitized JSON object. The useful identity and authorization fields are nested under `request` and `live`; the requested replay count is not serialized. For the default `create-flow` profile, the effective call ceiling is exposed as `$.live.authorized.maxCalls` and is `26`.

No dry or live command was run.

## Exact output paths and assertions

| Concern | JSON path | Expected assertion | Notes |
| --- | --- | --- | --- |
| Dry-run readiness | `$.status` | `=== "ready"` | Emitted only after target, created-flow request, and live plan initialization succeed. |
| Provider-free guarantee | `$.providerCallCount` | `=== 0` | Literal emitted by the dry-run branch. |
| Lane | `$.lane` | `=== "created-flow"` | Literal emitted by the dry-run branch. |
| Target | `$.target` | `=== "isolated"` (or the explicitly selected owned target) | The live initializer permits `isolated` and `persistent-isolated`; the immediate gate expects the selected command's target. |
| Scenario | `$.request.scenarioId` | `===` the requested scenario ID | This is copied from the resolved instruction task. |
| Workflow | `$.request.workflowId` | `===` the resolved workflow ID, or `null` | The descriptor normalizes absence to `null`. It does not say whether the value came from the CLI, scenario defaulting, or resolution. |
| Instruction task ID | `$.request.taskId` | `===` the requested instruction-task ID | This is distinct from the live LLM task kind. |
| Instruction task kind | `$.request.kind` | Assert the closed task-catalog kind expected by the scenario | The exact value is resolved catalog data and is not established by the permitted code-only read. |
| Live LLM task | `$.live.task` | `=== "create-flow"` | This is the `--llm-task`/profile task, not `request.taskId`. |
| Oracle discriminator | `$.request.judgement.judgeBy` | `=== "expected-dataset"` for a dataset oracle; `=== "playback-goal"` for a playback oracle | This discriminator determines which additional fields are valid. |
| Dataset oracle step | `$.request.judgement.stepId` | `===` the scenario's expected step ID | Present only when `judgeBy === "expected-dataset"`. |
| Dataset oracle index | `$.request.judgement.stepIndex` | `===` the scenario's expected zero-based step index | Present only when `judgeBy === "expected-dataset"`. |
| Playback oracle | `$.request.judgement.goalId` | `===` the expected playback goal ID | Alternative to `stepId`/`stepIndex`, present only when `judgeBy === "playback-goal"`. |
| Replay count | **No JSON path** | Cannot be asserted from dry-run output | `command.replays` is passed only to `runScenario(...)` in the executing branch. The dry-run serializer omits it. |
| Default effective max calls | `$.live.authorized.maxCalls` | `=== 26` for default `create-flow` | The default budget declares `maxCallsPerRun: 26`; `create-flow` maps to iterative `build_and_adapt`, so the plan preserves 26. An explicit override changes this value. A non-iterating task such as `diagnose` would expose `1`. |

## Sanitization assertions

- `$.request.instruction` contains only `characters` and `sha256`; raw instruction text is not emitted.
- `$.live.credentialSource` contains only `name` and `from`; no credential value is emitted.
- `$.live.authorized` exposes numeric/typed bounds (`maxCalls`, token limits, run-token ceiling, timeout, and cost ceilings), not provider request or response text.
- `$.request` and `$.live` are nullable in the serializer's general shape. For the intended created-flow live dry-run, both should be non-null; otherwise the identity and authorization assertions cannot be made.

## Ambiguities and limits

1. The dry-run JSON cannot prove the requested replay count because it does not include one. If replay-count preflight is required, the serializer needs a new sanitized field (for example top-level `replays`) or the invocation layer must separately attest the parsed option.
2. The exact resolved workflow ID, task-catalog kind, dataset step ID, and step index are scenario/catalog facts, not constants in the permitted request-description code. They should be compared with independently known expected values; merely checking presence is weaker.
3. `request.workflowId` does not distinguish an explicit CLI selection from an implicit/default resolution.
4. `live.authorized.maxCalls` is the effective planned ceiling, not necessarily the literal CLI/default input. For `create-flow` those coincide at `26` under the default profile, but planning clamps or changes other task kinds according to purpose.

## Code trace

- `packages/test-runner/src/cli.ts`: dry-run branch and top-level serializer; execution-only forwarding of `command.replays`.
- `packages/test-runner/src/flow-lane/creation/request.ts`: sanitized created-flow request descriptor and judgement union.
- `packages/test-runner/src/live-llm/live-llm-run.ts`: sanitized `live.describe()` shape.
- `packages/test-runner/src/live-llm/live-llm-plan.ts`: effective max-call planning.
- `packages/test-contracts/src/llm.ts`: directly imported default budget (`maxCallsPerRun: 26`).
