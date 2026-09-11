# Audit reports — verified summary

Seven read-only audits ran on 2026-09-11 for the Week 1 plan. The senior
supervisor agent verified every load-bearing claim below against source
before recording it; each full report in this directory carries the
`file:line` citations. The working document keeps only what changed the
plan and links here.

| Report | Phase |
| --- | --- |
| [audit-recording.md](./audit-recording.md) | 1.1 recording → output mappings |
| [audit-actions.md](./audit-actions.md) | 1.1 / 1.2 action vocabulary |
| [audit-targeting.md](./audit-targeting.md) | 1.3 element identity |
| [audit-evidence.md](./audit-evidence.md) | 1.4 browser state and evidence |
| [audit-failures.md](./audit-failures.md) | 1.5 failure model |
| [audit-testing-facility.md](./audit-testing-facility.md) | 1.6 Testing Lab / FluxBench |
| [audit-core-runtime.md](./audit-core-runtime.md) | Core seams, duplication, dead APIs |

Verified by the supervisor against source. Full detail with `file:line`
citations is in the seven reports; only what changes the plan is kept here.

**Recording → outputs (`audit-recording`).** Boundary rule holds (Core
enforces it twice). 19 event kinds → 7 action inputs → 7 of 11 outputs.
Defects: scroll keyed on unemitted `dom.wheel`; hub filters
`metadata.domainId` while events set it top-level (user-recorded actions
never reach live subscribers; Core's bridge unaffected); `input`/`change`
listeners lack `isTrusted` (replay double-records); checkbox/radio map to
`web.dom.type` with `"on"`; confirmations for `type`/`select` lose the
value; the proposal mapper drops fingerprints; `GatewayInputHub` and the
mapper exist twice (`io/` and `web-panel-host.ts`); zero tests under
`apps/extension`; three stale claims in `extension-client.md`.

**Actions (`audit-actions`).** Eleven action types; matrix 1/10/3/10;
validate 0/24. `success()` unconditional; click/keypress/select can no-op
and report success; no actionability wait or retry; navigate forces a new
tab and never checks the landed URL; unknown action types rewritten to
`web.dom.extract`; `failed` route never taken by the node implementation;
cross-frame execution unreachable; two safety registries disagree; seven
dead exports; legacy alias vocabulary mapped twice; `content/types.ts`
duplicates protocol types loosely; no `downloads` permission.

**Identity (`audit-targeting`).** Core's matcher never receives
candidates (`unresolved_no_candidates` on every action); `testId`,
`accessibleName`, `label` (weights 28/24/20) are zero for web targets due
to field names; first-match resolution, no ambiguity detection, constant
confidence; iframe targets unreachable (`frameId` collision with the visual
frame id); fingerprint lost when Core adapts the target; stale viewport
point preferred over scroll-corrected one; resolution before
scroll-into-view; `wait_for_selector` bypasses the resolver; node metadata
lacks `elementTarget`/`safety.level`.

**Evidence (`audit-evidence`).** Two pipelines from one `DomSnapshot`
(state: 1,500 elements, merged frames, UI-only, discarded outside
recordings; LLM: 40 elements, top frame, 6,000/12,000-byte budget).
8/16 present, 5 partial, 3 absent (dialogs, regions, overlays). No
expected-vs-actual comparison anywhere: Core's `builtin.policy.expectation`
returns `passed: true` unconditionally and `compareAutomationStudioTransition`
counts keys; `NodeStateRuntimeComparison` has no producer despite Core's
plan marking it implemented. Repeating structures collapse to one state
element. Declared `elements.*.<field>` paths are never produced. Sensitive
values captured by default (`readElementValue` has no guard;
`inputValues: true`). Sanitized 40-element packet is 7,226 bytes against a
6,000 default.

**Failures (`audit-failures`).** No taxonomy on the browser path; Core
classifies by regex over English messages; `adapter.ts:54` flattens
`timed_out`; the attempt record has no outputs field (failure-moment
snapshot, URL, target diagnostics lost); `compactRecentActionForLlm` strips
the class. 4 categories produced, 3 partial, 5 absent (all
browser-specific). Capture items 5/6/2. Pattern to copy: Core's
flow-bootstrap taxonomy. Allowlist skew in the test-runner; byte-ceiling
mismatch (domain 6,000 vs Core gate 3,000); dead `WebAutomationRuntimeError`,
`runnerFailureCategories`, `RunEvaluation`.

**Testing Lab (`audit-testing-facility`).** 12 fixtures (docs say 11/10);
coverage 4/5/9 of 18; isolated lane asserts only `finalState`;
`selector()` handles only `testid:` (5 of 12 scripts not executable);
`test-matrix` catalog lists 10; metrics are `{steps}` only; no repeat
aggregation; `compare` cannot say improved/regressed; failure category not
persisted; Flow execution exists only on `existing`/`clone`/demo, never on
`isolated`; all extension lanes headed; `llm-target-drift` conflates
selector and text drift.

**Core runtime (`audit-core-runtime`).** Verified. Core already provides
the seams Week 1 needs for vocabulary (IoRegistry + importer SDK), identity
(`ElementFingerprint`, matcher, dispatch gate), evidence types
(`StateSnapshot` et al., already imported downstream), failure enums, and
the recovery ladder — no evidence DTO is needed. Three seams are wired but
inert here: the element-target gate (no candidates), the host-runtime
boundary (`bindHostRuntime` never called, so no `stateRefs`), and the
always-passing expectation node. Core does flip a node to `failed` on a
failed dispatch effect (`node-execution.ts:119`), but `OutputDispatchResult`
has no status, `AutomationNodeExecutionResult` has no message, and the
attempt trace writes none — so `timeout` is unreachable for browser actions
and the recovery ladder chooses the wrong candidate kind (seam C1).
Target-resolution diagnostics never reach the attempt trace (C2). An
expectation-evaluator seam (C3) would let Core evaluate `expectedState`
instead of counting keys. API-only recording→proposal→review endpoints
exist (`create-recording-flow-proposals`, `review-recording-flow-proposal`).
Duplication: downstream fingerprint fields are not interchangeable with
Core's; target-override validation types are structural copies; the action
result type is declared three times downstream with a narrower status union
than Core's. Core's own patch lane is selector-keyed, contradicting its
fingerprint-first doctrine. The MVP execution loop runs on the deprecated
`AutomationStudioFlowDocument`; `RuntimeActionAttempt` (pre/post state
fingerprints) has no producer.
