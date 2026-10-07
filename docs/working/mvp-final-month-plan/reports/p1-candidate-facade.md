# P1 candidate facade worker report

Status: Source frozen; supervisor independent verification/integration pending
Created: 2026-10-06
Owner: p1-candidate-facade worker (t299 continuation)
Scope: Core explicit candidate service/API facade, owning scripted regressions and caller narrowing.

## Current State

Main written brief and Current State plus t299 candidate authoring/supervisor integration reports read. Supervisor integrated t298 and merged both dev branches into t299 before source edits. Implemented approved service/API candidate branch and draft store invocation; legacy default preserved. No downstream product changes.

## Findings and decisions

- Existing API handler excludes authoringMode and sanitizer insists proposed. These must change atomically with actual candidate service branch; request parser alone is unsafe.
- Durable candidate store exists separately from adaptations, but the current service does not invoke it. Helper source transferred from supervisor; harness completionSchema/provider corrections already applied before dispatch.
- Proposed/draft discriminated union prevents adaptationId fabrication. Draft response names candidateId/revision/digest/base/settings/source instructions/accounting, verification:not_performed and promotionAllowed:false. Omitted flag stays legacy. Candidate API envelope is payload.candidate, legacy envelope payload.adaptation; API rejects response status inconsistent with requested mode and sanitizes private data/plan fields away.
- One generic public return type preserves typed literal legacy callers; broadly typed inputs retain full union. Initial overload approach exceeded the inherited class-method budget, so overload declarations were replaced. General/re-author paths narrow proposed explicitly. Conversation build rejects any unexpected non-proposed adaptation, reports a candidate as saved/unverified and issues no apply. Existing web BlankFlowAuthoringPanel and ImproveFlowPanel already require proposed status; no web source change required.
- Candidate branch preserves purse, permission/person wrappers, inherited t298 cancellation, normal registry/handle compilation, immutable original instruction text and current base/settings refusal. It does not mark the creation purse ended, create adaptation, seed/continue a legacy incomplete draft or test/promote the candidate.
- Real service regressions use the focused command-module tests folder rather than exceed existing service-bootstrap/tests file budget.
- Focused generation-context extraction approved by supervisor after structure gate found service line growth: shared original instruction/catalog resolution now belongs to flow-bootstrap-commands/generation-context.ts. No baseline increases/suppressions. Existing native permission/resolution semantics remain unchanged.
- Helper records aggregate loop plus authority spend as decisions settle, including stale/cancel/save failure diagnostics. Decision requests retain routing.shown state/evidence and optional fresh reusable context. Activity/tool wrappers and original cancellation scopes retained.
- One existing extension-chat test-only fake pending proposal was corrected to include the actual status:proposed contract; no cancellation or held-rerun source modified.

## Validation

- Initial API owning19/19 pass. Actual scripted service draft/stale/cancel/save failure4/4, conversation draft narrowing4/4 and re-author26/26 pass (34/34 together). Initial fixture used a nonexistent service list method; corrected to inspect the owning adaptation store and reran.
- Final focused facade/API/conversation/re-author run: 53/53 pass across4 files (23.05s), including exact cancellation aggregate4 calls/60tokens/$0.004 and malformed/inconsistent draft API refusal.
- Final command/candidate/store owning directory run: 77/77 pass across12 files (40.70s), including all3 existing service cancellation regressions. This overlaps the4 new service candidate cases above; counts are separate observed runs, not additive unique coverage.
- Omitted-flag legacy proposed generation compatibility1/1 pass (7 skipped,34.15s). Existing conversation pending-permission compatibility1/1 pass (9 skipped,24.25s).
- Final frozen-source fluxiq typecheck passed exit0, executed/stamped (69.600s). A preceding run passed but refused a cache stamp because source changed while checking; it is not the final verification receipt.
- Initial structure gate rejected overloaded method count and service file growth; corrected via one generic signature/focused extraction. Final Core audit passed279 advisories/349baseline; downstream report audit passed176 advisories/118baseline. Service remains4399 lines and inherited222 methods. No baseline growth/suppressions. Both diff checks pass.
- No provider/live/full suites/git mutation or shared document edits.

## Remaining integration and limitations

Supervisor must independently verify/integrate this coherent flag/facade/API slice. Draft records are non-executable and never listed as adaptations; successful static submission is not semantic success. P2 interpreter/start reset/trusted observer/command subject acknowledgements and durable candidate/receipt/promotion joins remain pending.

Stale and cancellation tests cover owner checks before save and provider/tool completion boundaries. The existing draft store does not atomically compare base/settings during ProgramJsonStore.write or interrupt an underlying OS write; cancellation during that write can leave an unverified draft. This task does not claim CAS/crash recovery or execute/promote a draft. Save errors retain aggregate diagnostic spend. Discovery actions retain normal permission boundaries and may affect their permitted target; wrong-turn evidence remains outside the submitted graph.

## Exact changed files

Core `packages/fluxiq/src/programs/automation-studio/`:

- runtime/service.ts
- runtime/service/flow-bootstrap-commands/{candidate-generation,contracts,index,generation-context}.ts
- runtime/service/flow-bootstrap-commands/tests/candidate-generation.test.ts
- api/contracts/adaptation.ts
- api/handlers/llm-generation.ts and tests/llm-generation.test.ts
- runtime/conversations/commands/build.ts and tests/{build,extension-chat}.test.ts (extension-chat is one fake-proposal status correction only)
- runtime/service/runtime-adaptation/reauthor-build.ts and tests/reauthor-build.test.ts

Core authored architecture: docs/architecture/automation-studio/llm-flow-bootstrap.md. Downstream: this worker report only. Candidate submission/controller, cancellation source, held rerun, draft store and t300 verification source untouched. No commits/merges/pushes by worker.
