# Lab And Domain Instruction Authority Discovery

Status: Read-only discovery complete
Created: 2026-10-13
Last updated: 2026-10-13
Owner: codex-t516 worker
Scope: Domain evidence binding, realistic instruction inventory, recorded Flow callers and a production-gated Lab migration.

## Current State

Instructions must define every automation; described recordings are supplementary evidence. Existing persisted automations without active explicit instructions must refuse before their next run. The current recorded `--flow` lane directly approves a trace-derived graph with no instruction authority. It cannot remain an executable hidden test-only path. The separate created-Flow lane already carries explicit task instructions through real chat or the active-instruction service and is the correct generation measurement path.

Read main sources only while t519 was provisioned, then wrote this report in t519. No source edits, live/provider runs, builds, tests or shared-document edits. Prior t518 source/evidence was untouched. The following findings are source inspection, not observed execution of the new requirement.

## Existing instruction and model context

- `apps/scenario-lab/src/scenarios/realistic-site-live-tasks.ts` gathers the ten realistic sites' authored task inventories from their own `live-tasks.ts`. Existing `tests/realistic-site-live-tasks.test.ts` asserts 68 tasks. `LiveInstructionTask.instruction` is an explicit task string, separate from task identifiers, permitted consequences, expected datasets and page oracles.
- `packages/test-runner/src/flow-lane/creation/instruction-task.ts` defines the runner's equivalent task contract and validates task input; `instruction-catalog.ts` reads the built scenario catalog. `creation/request.ts` resolves the selected task and its workflow/variant/judgement, refuses ambiguous extraction ownership and separates the instruction from expectations. Its report contains instruction size/digest rather than text. Preserve this separation.
- The normal created-Flow entry in `creation/lane.ts` passes `request.task.instruction` to `creation/chat/build-from-chat.ts`. That helper types the exact task into the extension chat, waits for the corresponding person turn and follows Core's real `flow.createHere` result. It does not fabricate instruction inventory downstream.
- The nonchat helper `creation/build-proposal.ts:372` calls `save-flow-generation-instruction` with explicit input and requires returned status `active` before authorizing/generating. It then calls the bootstrap generator with start location and permitted consequences, not fixture expected records or recording-script targets. Retain the public gate here too; do not make it an exception to the chat route's instruction requirement.
- Domain `runtime/llm-evidence/tools.ts` binds generic `systemInstructions`, observation/action tools and browser evidence. `system-instructions/instructions.ts` says the model operates the site on the person's behalf to do their instruction. It does not own FlowInstruction or recording descriptions. The evidence/tool descriptions treat page words as untrusted data, never task authority. Core owns assembly of persisted user instructions and supplementary recording context.
- Cross-worker contract finding, supplied by the Core discovery worker: `FlowInstruction.linkedRecordingIds` already stores attachment references, but current generation context resolves active instruction text/parent/catalog without fetching described recording evidence. Recording descriptions have no owned contract yet; recording update currently handles name/archive. Proposal generation's `metadata.instructions` is a stamp while its trace mapper still constructs the graph directly. The Core report owns exact assembly/service changes; domain must not create a parallel local instruction or description store.

## Recorded-only and saved-run callers

`packages/test-runner/src/flow-lane/run-flow-lane.ts:134-151` waits for finalized recording, calls `createRecordingFlowProposal`, asserts its candidates cover the recorded events, and immediately calls `approveRecordingFlowProposal`. `recording-flow-proposal.ts` sends only project/recording identifiers to `create-recording-flow-proposals`; approval names the Lab Flow. This path supplies neither explicit authoritative instructions nor a demonstration description and turns the recorded action order into executable work.

Its `assertProposalCoversRecording` requires candidate coverage for recorded executable event counts. That remains a useful transport/mapping diagnostic, but must not force every demonstrated action into an instruction-led automation. A demonstration can contain an accidental act, retry, obsolete wait, setup, extra read or task the instruction never requested. Generation correctness is answering the written task, not copying every event.

`packages/test-runner/src/run-scenario.ts` starts recordings in existing, clone and recorded lanes using bare `{ type: "fluxiq.startRecording" }` (current lines 371, 389 and 465). No explicit demonstration description is supplied. Start payloads and fixture/test contracts need a description through the same production recording service as the UI; a generated recording title, scenario ID, trace label or inferred goal is not sufficient.

`existing-flow-run.ts` selects and starts a persisted Flow then calls `runPersistedFlow`; `saved-flow-replay/{run-flow,replay-saved-flow}.ts` does the same for provider-free reuse. These callers must surface Core's missing-instruction refusal, including for cloned/legacy Flows, without silently copying a current fixture goal into someone else's old automation. They should run unchanged only when the selected existing Flow already has valid active instructions.

## Proposed Lab migration

1. Retire or redirect standalone recorded `--flow` approval into executable automation. If the command measures generation, select an explicit authored task and use the existing instruction-led chat/build path. Optional recordings must first have explicit descriptions and be attached through Core's instruction/evidence contract. Do not preserve the old graph approval behind an undocumented flag, append invented instructions just to satisfy the guard, or rename recording conversion as manual authoring.
2. Keep provider-free deterministic execution measurement separate. A manually authored canonical graph may run with explicit fixture instructions through the same Core execution gate, without a model call. Its graph must be independently authored through the production graph API, with a clear manual-authoring provenance; copying a recording-derived graph wholesale is not this separate lane. It measures execution of authored work, not instruction-led generation. Alternatively use an already instruction-authorized saved Flow from a separately qualified build.
3. Keep generation and reuse metrics distinct: explicit active instruction present; build source `instruction`; attached recording count and described count; candidate/build judgement; applied canonical Flow; generation provider-call counts; execution provider-call counts; required output/dataset oracle; repair/proposal/reuse evidence. A successful manually authored deterministic run must not increment model generation success. Dataset/page oracle details remain scoring-only and must not enter product prompts.
4. Add explicit fixture-owned demonstration description fields wherever the Lab records. Validate them before topology/browser startup where possible and pass them at recording start/update through the public contract. A task instruction and a demonstration description are different inputs; neither should be automatically inferred from the other. Existing retained recordings remain accessible and need description attachment through Core before supporting a build.
5. Legacy fixture Flows need an intentional instruction migration. Attaching explicit instructions enables a future run only under Core's final migration decision; it does not retroactively prove an old trace-derived build was instruction-led. Existing user/clone runs must report the actionable missing-instruction error and await actual input, not rewrite data automatically. A later regeneration should be measured independently from preservation/execution of an old graph.

## File-owned implementation partitions

| Partition | Exact owning paths | Intended change |
| --- | --- | --- |
| Authoritative instruction/supplementary context | Core discovery worker's service/model/generation-context paths | Durable explicit instructions and described recording assembly; no downstream persistence |
| Domain model-facing rules | `domain/src/runtime/llm-evidence/system-instructions/instructions.ts`, adjacent tests; harness/tool wording only if necessary | General instruction precedence and untrusted supplementary demonstration semantics, with no scenario-shaped examples |
| Lab recording lifecycle | `packages/test-runner/src/run-scenario.ts`, owning run-lifecycle/extension-runtime contracts; `packages/test-contracts` scenario workflow/recording description contract; realistic site workflow fixtures | Require and pass explicit authored demonstration description through public start/attachment API |
| Recorded lane replacement | `packages/test-runner/src/flow-lane/run-flow-lane.ts`, `recording-flow-proposal.ts`, their owning tests and lane outcome/selection contracts | Remove executable recording-only approval; retain mapping diagnostics as non-generation evidence; route generation to explicit task |
| Instruction generation/context use | `packages/test-runner/src/flow-lane/creation/{request,instruction-task,instruction-catalog,lane,build-proposal}.ts`, `creation/chat/build-from-chat.ts`, adjacent tests | Reuse explicit tasks/real chat; attach only described optional evidence; do not pass scripts/oracles as instruction context |
| Existing execution and reuse | `packages/test-runner/src/existing-flow-run.ts`, `saved-flow-replay/{run-flow,replay-saved-flow}.ts`, their owning tests | Respect Core refusal for legacy/clone instructions; no silent authority injection; score deterministic reuse separately |
| Metrics/CLI | Runner CLI/flow-lane selection and `lane-observation`/creation snapshots, exact shared files assigned serially | Make authoring mode explicit, separate generation versus manually authored execution; reject hidden record-only bypasses |

`run-scenario.ts`, lane-selection and outcome contracts are shared orchestration files: assign them to one worker at a time. Domain generic instructions are independent of Lab recording lifecycle. Shared protocol/UI/Core contracts must settle before runner payload edits. This report does not authorize adding a second authoring engine downstream.

## Feasible narrow validation

- Unit request/task tests: absent/whitespace explicit instruction and missing/ambiguous task refuse before topology/provider setup; valid authored goals stay independent of oracle/script; only the ten realistic scenarios qualify browser entries.
- Recording lifecycle tests: description required at start/attachment, not substituted by generated title/labels; old recording can receive description without losing events; optional evidence attachment preserves separate instruction and description inputs.
- Recorded lane tests: direct recording proposal cannot be approved into executable automation; candidate coverage is diagnostic rather than proof of instruction answer; supplemental demonstration extras/retries do not require corresponding final graph actions.
- Created-Flow chat/build owning tests: exact explicit task reaches real person turn/active inventory; described optional recording linkage survives; missing/inactive/wrong-owner instruction refusal is observed before provider/dispatch; no expected dataset values or scripted selectors in model context.
- Existing-flow/replay owning tests: legacy/clone without active instructions refuses; explicit valid instructions permit provider-free deterministic execution; refusal yields actionable closed error; no automatic Flow mutation or instruction synthesis.
- Metrics tests: a manual deterministic execution pass is never generation success; instruction-led build, judged application and provider-free reuse retain separate counts/statuses. Old recording-only social/store controls remain preserved historical measurements, not qualified instruction-led automation results.
- Supervisor gates: touched-package source/test types, changed-subject tests and structure audits only. Subsequent browser validation uses realistic scenarios with explicit goal/described optional evidence on a frozen pair. No new paid/provider/browser run is proposed during discovery, and no authored product guidance may teach to the fixture.

## Limits

No model calls or new product gates were exercised. The final Core migration decision and owned recording-description wire shape are not settled by this report. Exact Core model-context facts above are attributed to the Core worker and require supervisor verification. Existing catalog counts and source routes were inspected, not freshly tested. Only this report was written.
