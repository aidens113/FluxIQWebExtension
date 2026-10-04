# C4 carried candidate fixture preflight

Status: read-only preflight COMPLETE; source remains frozen. Worker resume-cd. No implementation, tests, builds, live/provider/browser, state/env/key/data, shared-document, or commit changes. No executed failing-before claim.

## Confirmed cause

Core draft-from-flow seeds canonical parameterValues, routes/order and node correspondence, returning supplied startPages separately as startedOnByStepId. It does not carry metadata.declaredConsequences and creates no ranWith/replay/performed proof. The full-test gate rejects an untouched proposed carried step as full_run_required/not_run_in_this_build. Replay eligibility/from/calls currently depend on ranWith+replay. Filling those performed fields from persisted configuration would invent execution evidence.

The existing repair-replay-chain service test creates/saves a real primary graph with canonical-selector click and configured extract output, runs/refutes/reauthors/applies/reuses it. Its provider proactively reruns BOTH carried steps, including the unchanged click with explicit empty consequences. This does not cover untouched carried-step scheduling.

Its automationStudioReplayingBinding intercepts reset/step/verify BEFORE the delegate and returns canned success without changing state. Its added start token is an opaque call ID. It cannot prove actual navigation, action count, adapter dispatch or bindings. Existing Core replay-parity.test.ts executes an assembled stored graph through native implementations and compares mappings/order to a walker with a canned recording host; it begins with already performed steps. Downstream node-run/tests/replay.test.ts separately executes the REAL createWebAutomationLlmEvidenceRuntime adapter against a recorded gateway, proving canonical selector action dispatch, captured-start reset, permission denial, row mapping and verify behavior. The gateway supplies authored fixture snapshots; these are adapter tests, not browser DOM tests.

## Separate scheduled candidate

Propose a private typed candidate containing cloned executable input (node, parameters and explicitly present consequences), persisted node provenance, and ordinary captured start context. Derive its types from existing execution/start contracts. Never assign configuration to ranWith, replay.produced, effectApplied, written, checkedCandidate or priorExecution. Preserve absent versus explicit-empty declarations.

Select it only while current executable input/declarations, graph correspondence and relevant routing agree with its snapshot; actual edits invalidate stale eligibility. One cohesive private selector must serve the gate, reset/from, step/verify calls AND replay-span parameter resolution. replay-span currently reads ranWith.parameters, so only changing the outer builder misses bindings. Retain resolveAutomationNodeParameterValues, row input and missing-path refusal. Keep canonical selectors, library validation and permission checks; do not derive handle authority or global selectors.

Existing lasting classification uses declarations/instructed acts to choose verify. A candidate provides NO historical lasting proof: ActDone must still require actual prior execution or current applied effect. Missing valid start, unsupported binding, missing required declaration, library/permission failure remain refusals. No public retryability, budget, permission, replay mode or host API changes.

## Smallest meaningful combined fixture contract

A new DOWNSTREAM integration fixture should instantiate the public Core service and the actual downstream evidence runtime, using locally authored typed provider/native/gateway support. Persist a primary graph through normal service create/save APIs: start → unchanged canonical-selector click → faulty binding-bearing extract/type step → end, with explicit declarations and source instruction/routing provenance. Initial ordinary execution must supply its actual captured start through the existing producer, and a scripted judge refutes actual output.

Reauthor in ordinary extend mode. The provider edits ONLY the faulty downstream step and requests completion; it must NOT rerun/check the unchanged click first. Record actual gateway reset/navigation and click/downstream calls in order before the accepting judge, measure authored fixture state/output, and assert resolved fallback and repeat-row mappings. Before fix, completion is full-run refused with no qualifying untouched replay. After fix, that carried step participates in the fresh full test, followed by acceptance/apply/provider-free reuse. A changed candidate must not execute stale parameters; permission refusal causes zero action dispatch; unresolved binding remains refused; lasting verify causes zero mutation and cannot manufacture historical proof.

GENUINE MISSING SEAM: none of the inspected fixtures combines saved-service reauthoring, an untouched carried candidate and the real web adapter. Existing service support uses the intercepting canned wrapper. Exact public service/native runtime exports and recorded-start producer setup for a new downstream fixture have not been read/approved in this unit. Core test-internal fixture/barrel imports across repositories are prohibited. The existing supplied startPages seam proves seed input only, not the source producer's token/metadata construction. Root should release those exact public setup/start owners and a downstream fixture before claiming combined integration. No further discovery is necessary for this report.

An immediately executable bounded alternative is a generic Core service fixture whose replay delegates to an authored state-changing executor (not the canned wrapper), plus the downstream real-adapter owner. Those establish separate scheduling and adapter proofs; they must NOT be described as whole-seam verification. The combined fixture above remains required for that claim. Later supervisor-owned live testing remains necessary for browser semantics.

## Proposed minimal partition and gates

Core candidates: flow-draft/step.ts (private scheduled type); llm/node-tools/draft-from-flow.ts (candidate/declarations); flow-draft/dry-run.ts and llm/node-tools/{dry-run-gate,replay,replay-span}.ts (consistent selection/start/input/mapping). Introduce one cohesive private selector module/barrel only after release if otherwise duplicated. extend-subject.ts needs change only if its existing node correspondence/start result cannot convey provenance; avoid speculative service edits. verify-only.ts needs regression coverage and source change only if declaration fallback is inadequate.

Core owners: new runtime/tests/refuted-result/tests/carried-replay.test.ts and existing llm/node-tools/tests/replay-parity.test.ts; typed support helper/barrel separately released. Downstream owner: existing domain/src/runtime/llm-evidence/node-run/tests/replay.test.ts. Combined fixture belongs downstream at the nearest common evidence runtime tests directory and must import only public Core APIs; exact path/support release pending root.

After release: heavy-wrapper narrow Core Vitest owner files; actual downstream Node owner through supervisor-approved loader; touched package types/audits by root. No gates executed in this preflight.

## Exact read budget

Sixteen approved files read, with bounded section follow-ups after truncation:

- Initial eight Core: llm/node-tools/draft-from-flow.ts; flow-draft/{step,dry-run}.ts; llm/node-tools/{replay,dry-run-gate}.ts; runtime/tests/service-bootstrap/index.ts and tests/fixtures.ts; runtime/tests/refuted-result/tests/repair-replay-chain.test.ts.
- Expansion six Core: runtime/tests/replaying-binding.ts; llm/node-tools/{replay-draft,replay-span}.ts; service/flow-bootstrap-commands/extend-subject.ts; flow-draft/verify-only.ts; llm/node-tools/tests/replay-parity.test.ts.
- Expansion two downstream: domain/src/runtime/llm-evidence/node-run/replay.ts and tests/replay.test.ts.

Nonexistent proposed replay-mappings owner was replaced with replay-span only after exact root release/path confirmation. Source investigation is now frozen.
