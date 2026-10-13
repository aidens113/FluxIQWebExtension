# Core instruction implementation

Status: implemented and source/tests frozen. Supervisor independent final type/audit/build and integration review remain.

## Changes

Existing Core FlowInstruction inventory now gates persisted queue/run, root-owned subflow execution, live resume release, recovery-provider resolution, repaired rerun, bootstrap approval/application and publication. It requires active nonblank Flow-owned task text, preserves legitimate legacy advisory user tasks without any new origin marker, and refuses inherited policy/safety-only or recognized model/recording inference. Caller metadata cannot substitute for durable owner/inventory reads. A continuation uses its existing session's Flow and rejects another caller-nominated Flow. Unknown durable resume sessions return null and cannot release a live registry controller. Pure graph unit execution remains independent. The focused typed AutomationStudioInstructionAuthority collaborator owns readiness, admission assertion and resume against durable Flow/session/inventory ports. The service exposes a single readonly instructionAuthority field; internal admissions and endpoint handlers call its readiness/assert/resume methods. Only the three newly introduced facade methods were removed; pre-existing facade methods and endpoint/wire contracts remain unchanged.

The existing save-flow-generation-instruction command now supports populated existing Flows and leaves their graphs intact. Optional instructionId selects the exact legacy task being edited; otherwise canonical generation task wins, then the first legitimate existing Flow task. Same-owner validation prevents cross-Flow edits and avoids silently appending conflicting task guidance. Model-only conversation_argument is rejected BEFORE mutation. Missing anchored person turns cannot fall back to the model's argument; describe now reads actual person text. New task saves mark taskInstruction true, while missing markers do not disqualify legitimate old task text.

Recording.description is a top-level optional persisted legacy field. New create/server-start/client-start requires trimmed1..4000 description before browser-start dispatch; update changes description independently of name while retaining recorded entries. Missing descriptions receive a static closed refusal. Additive nullable SQL migration0026_recording_description follows the current owning0025 list and preserves legacy rows as null. SQL summaries, optional recording index fallback and summary models carry descriptions, so the picker never needs full timelines to see them.

Task-save linkedRecordingIds validates at most20 same-project finalized described recordings before mutation. Generation validates attachments before provider resolution and adds a separate untrusted_supplementary_demonstration context projection. It carries explicit description plus bounded ordered registered method IDs (at most100, explicit methodTruncated) and known action count. Canonical actions take precedence; registered action-role domain events are fallback only when canonical actions are absent, preventing duplicate evidence. No page values, targets, arbitrary event payloads, screenshots or raw timelines enter this projection. The permission instruction-reading call does not receive demonstrations.

Direct recording Flow/node approval and mined policy executable approval are retired with an actionable closed instruction-led-authoring refusal. Diagnostic recording mapping, evidence access and proposal rejection remain. A proposal.metadata.instructions string never replaces durable task inventory.

Static error codes are automation.instructions_required, automation.instruction_led_authoring_required, recording.description_required and recording.supporting_evidence_invalid. The generic API registry preserves a bounded opt-in diagnostic.code as its existing top-level errorCode without embedding domain-specific types/imports or casting a diagnostic to arbitrary generic payload. Existing runtime payload.diagnostic remains compatible. Readiness endpoint get-flow-instruction-readiness returns ready/instructionIds plus static diagnostic when missing; no task body is echoed.

## Owning paths

All edits are Core packages only. Paths under packages/fluxiq/src/programs/automation-studio:

- model/{recordings,recording-framework}.ts.
- runtime/service/instruction-led/{authority,error,task,description,recordings,run-gate,index}.ts and owning tests.
- runtime/service.ts owning facade wiring; service/flow-bootstrap-commands/save-goal.ts; service/proposals/approval.ts.
- runtime/service/indexes/types.ts; service/recording-projections/{contracts,session-summary}.ts.
- runtime/conversations/commands/{argument,create-here,describe,explore,improve}.ts and argument/execute/extension-chat tests.
- runtime/llm/harness/{task-request,context-packet}.ts.
- api/contracts/{client,endpoints,instruction,recording}.ts; api/handlers/{instructions,llm-generation,run-control}.ts and run-control tests.
- client-gateway/bridge.ts and tests/description.test.ts.
- storage/project/schema/recording-description.ts plus barrel/administration wiring, recording-stream/summary.ts, runtime-stream-store.ts and schema/tests/recording-description.test.ts.

Additional Core package edits: packages/contracts/src/client-gateway.ts; packages/fluxiq/src/programs/_shared/api.ts and owning registry test. No Core apps/web, downstream source, shared working documents, t518, commits or pushes were changed by this worker.

## Observed narrow checks

From Core packages/fluxiq:

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/service/instruction-led/tests src/programs/automation-studio/runtime/conversations/commands/tests/argument.test.ts src/programs/automation-studio/runtime/conversations/commands/tests/execute.test.ts src/programs/automation-studio/runtime/conversations/commands/tests/extension-chat.test.ts src/programs/automation-studio/api/handlers/tests/run-control.test.ts src/programs/_shared/tests/api.test.ts src/programs/automation-studio/storage/project/schema/tests/recording-description.test.ts
```

Passed99 tests in8 files on the final summary/mutation-defense source. Existing real-registry chat/build tests use scripted in-process providers; no real/paid providers were called.

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/client-gateway/tests/description.test.ts
```

Passed2 tests. Combined worker-observed coverage101 tests across9 distinct files.

Coverage includes missing task before session/provider work; populated legacy migration without graph change; valid no-model persisted execution; disabled task blocking resume/continuation; projectless public run refusal; exact legacy task edit without duplication; real diagnostic recording proposals failing Flow/node activation with zero graph writes/dispatch/provider calls; policy activation refusal; model-only replacement leaving person instructions intact; closed registry code; description/event retention and summary visibility after public durable close/reopen; additive old-SQL-row preservation with unknown legacy description; server/client missing-description refusal before create/lookup/browser start; actual person words rather than model paraphrases.

Initial failures were test setup/assertion errors: no storage root, then wrong v2 storage path; happy command fixtures lacked anchored person turns; two turn-index assertions were stale after adding those turns; old describe assertion expected a model paraphrase. Corrected fixtures use owning .fluxiq/data layout and real person anchors. One worker edited3 test files just before receiving the supervisor's active-check hold; reported exact paths immediately, then held further changes until released. Independent checks subsequently used frozen corrected files.

Supervisor subsequently reported final source build/type checks and its independent Core72 tests across7 files passing, including public summary/migration/no-model/direct proposal coverage. Audit identified statement packing; corrected the service import declarations and new dispatcher/finally statements without behavior changes or baseline growth. Final library identity refresh/audit remain supervisor-owned. Worker did not run package builds/type/audits or full suites. Full git diff--check found only a separate UI-owned blank EOF in authoring/index.ts; notified its owner, did not edit it.

## Limits

No live browser behavior was exercised. UI/paired-token endpoint allowlisting and transport errorCode normalization are owned by the UI worker/supervisor and were coordinated. Existing recorded graphs can remain after actual instruction entry; this does not retroactively certify an instruction-led build. Legacy instructions without origin metadata remain compatible, so their historic authorship cannot be proved from this schema alone. Recognized generated/inferred sources are excluded; new conversation source loss fails closed.

The supporting method projection deliberately gives registered action types and description, not concrete target details or a replayable trace. No existing safe public host-redacted target demonstration projection was identified; Core did not invent browser-specific projection or dump recorded content. Instructions alone determine the task, and actual state observations still establish execution details. Scheduled ProductionRunner is currently a stub dispatcher in Core; future actual scheduled automation execution must use this same persisted admission boundary. No hidden recorded-only Lab bypass was introduced.

## Final collaborator extraction

The class-method audit exposed three newly added responsibilities in the existing service. Extracted these together into runtime/service/instruction-led/authority.ts, with explicit typed durable ownership/inventory/session and live-control ports; this is a focused collaborator rather than an arrow-property budget workaround. Updated owning service/API tests to use the collaborator and added missing/unreadable durable-session no-release coverage. Source and tests are frozen for supervisor rebuild/types/audit. Worker-observed affected owning check from Core packages/fluxiq:

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/service/instruction-led/tests src/programs/automation-studio/api/handlers/tests/run-control.test.ts
```

Passed40 tests across3 files on the extracted frozen source (20 authority helper tests,11 persisted service tests,9 run-control handler tests). This includes the new unknown/read-error no-release regression and existing disabled-instruction resume/continuation rejection, positive deterministic run and real pause/resume completion. Scoped git diff --check passes. Supervisor final library freshness/type/audit verification remains independent.
