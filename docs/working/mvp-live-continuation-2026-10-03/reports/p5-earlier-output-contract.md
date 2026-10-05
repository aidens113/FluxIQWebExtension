# P5 earlier-output contract

## Current State

Read-only investigation active. Current State, prior P5 preflight and eight current Core owners inspected; bounded producer/persistence expansion requested. Only this report changed. No source/tests/build/types/audit/runtime/provider/state/keys/shared-document/git actions. P5 remains unimplemented and no saved execution or repair acceptance is claimed.

## Initial observed pipeline

`flow-draft/binding-forms.ts` rejects every `$step` with `step_binding_not_yet`; stored binding classification recognizes row/input only. Existing forms translate when a written configuration is created, while `run-node.ts` says immediate execution accepts concrete values. A new earlier-output reference therefore needs a separate deferred identity that survives authoring; syntax acceptance alone cannot make its value available.

`llm/node-tools/replay-span.ts` currently resolves state-bound parameters against `{}` outside a list pass and `{item: currentRow}` inside a pass. Input bindings work through their retained test fallback; row bindings use the actual current row. Missing paths produce `core.replay.unresolved_binding` without sending. No preceding-step output state is supplied to that resolver. List planning does use actual answers' registered array output, retained in the current walk's `asked` map, but that does not expose arbitrary earlier outputs to parameters.

`replay-draft.ts` initializes a fresh asked map for its walk, obtains readable actual answers, invokes the optional answered callback and passes current answers to span planning. That current-walk result seam is preferable to historical step.produced or priorExecution. Exact replay-call produced semantics still need the requested owning read.

`assemble-draft.ts` maps actual routed steps to the assembled first Subflow's positional `s1`, `s2`, ... node keys. It returns `draftStepIdByNodeKey` only when the node definition matches the routed step's declared node; inserted join/loop nodes have no draft identity. Stable draft IDs are thus not persisted node IDs, and reordering/routing can change the positional key. Exact plan→persisted mapping has not yet been inspected.

`nodes/parameter-bindings.ts` already resolves an exact own state key, then its longest dotted prefix, and then nested own record fields. This supports `${nodeId}.${outputId}` keys even when a persisted node ID itself contains dots. Missing bindings without fallback remain missing. Its nested path walk excludes arrays: an array-index path is not currently a supported output projection and must not be promised by new grammar without an explicit separate change.

`executor/node-execution.ts` supplies actual run inputs, live run variables, `values` and collected node inputs to parameter resolution before any native/builtin/composite execution. Missing paths fail before dispatch with `executor.parameter.unresolved_state_path`. Native output/IO and builtin paths yield actual result outputs. This owner consumes output state but does not establish where the graph inserts or clears it; graph/run-state owners are required before asserting scope/reset freshness.

## Requested bounded expansion

Initial eight source owners: `flow-draft/binding-forms.ts`, `llm/node-tools/run-node.ts`, `replay-draft.ts`, `replay-span.ts`, `flow-bootstrap/authoring/assemble-draft.ts`, `nodes/parameter-bindings.ts`, `runtime/executor.ts` (forwarding shim), `executor/node-execution.ts`.

Requested exact additional owners: `executor/graph-run.ts` output insertion/reset/loop contexts; `executor/run-state.ts` scope initialization; `flow-bootstrap/authoring/assemble.ts` registered output and node-key contexts; `llm/node-tools/replay.ts` call/produced construction; one actual plan→persisted mapper named through owning discovery before reading. No further source read until release. Tests/support and adaptation-reseed owners may require later exact expansion if these contexts do not prove them.
