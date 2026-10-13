# Instruction-led UI discovery

Status: Done (read-only discovery; implementation not started)
Date: 2026-10-13
Scope: Shared extension UI and Core web UI creation, recording, instruction editing, run and resume paths. Read from the main dev checkouts; this report belongs to paired t519.

## Findings

1. Chrome/Edge and Firefox share the same panel implementation. `apps/extension/src/sidepanel/index.ts` and `popup/index.ts` both call `mountPanel` with only their surface names differing. Implement product behavior under `panel/`, not separate browser-specific flows.
2. Extension New automation presents chat and recording as equivalent ways to define the job. `panel/recording/recording-controls.ts` offers Record a new automation; its helper sends only `RUNTIME_MESSAGES.startRecording`. Extraction's prepare hook silently starts an undescribed recording when idle. The top-bar Record button uses the same path.
3. Extension recording review is a complete recording-only creation/run/approval path: `panel/recording/review/recording-review.ts` sends generateFromRecording, testGeneratedAutomation and saveGeneratedAutomation without task instructions. `review-view.ts` explicitly promises to turn the recording into an automation and allows saving after a failed test. `background/automation-relay/automation-relay.ts` calls generate-recording-proposal (direct mode), run-runtime-session and review-recording-flow-proposal (approved) respectively. This cannot remain as standalone automation authoring.
4. Extension saved-flow rows know only flowId, name and latest run. `panel/automations/rows.ts` discards other summary metadata; `types.ts` has no instruction readiness. `controller.ts` sends Run without reading task authority, and `automation-strip.ts` disables it only for absent/working/running state. Core must provide the authoritative readiness; the extension must not infer it from a recording, name or latest successful run.
5. Extension Hand back goes directly to resume-runtime-session through `background/panel/run-control.ts`. `panel/chat/hold-control.ts` turns every failure into a generic retry message. Missing/deactivated instructions require a specific recovery action here too, while Stop and Take over remain available.
6. Core web already has a good instruction-first starting seam. `flow-editor/components/FlowEditorView.tsx` contains FlowEditorStartPane; `authoring/BlankFlowAuthoringPanel.tsx` explicitly asks for Website task, saves it through save-flow-generation-instruction, then requests generation. Empty draft creation can remain. However its active-instruction build readiness checks active status only, and model-key-dependent start text is unsuitable for adding missing instructions to a legacy deterministic automation.
7. Existing nonblank automations use ImproveFlowPanel. `authoring/authoring-commands.ts` explicitly documents that save-flow-generation-instruction refuses a Flow with existing steps; improvement saves a separate standing required instruction through save-flow-instruction. Therefore missing legacy task authority cannot be repaired by blindly calling the blank-only endpoint or treating an incremental improvement as the full original task.
8. Core runtime readiness has an explicit deterministic bypass. `runtime/run-input-model.ts` requires an active instruction only when mode is not no_llm_intervention, and otherwise checks only active status. `runtime/run-queries.ts` reads one active instruction (limit 1), router and subflow summaries. It does not prove nonblank body, flow ownership or authoritative task selection. All user execution modes need the same Core-owned authority result.
9. Core web has more than one run caller. FlowRunView uses start-runtime-session and run-runtime-session; `flow-editor/commands/run-flow.ts` / live/commands/domain-commands.ts also start a saved Flow via a direct run command. RunControlBar/useRunControl sends resume-runtime-session for Resume, Keep running, Continue and Return control. Rendering one disabled Run button cannot enforce the requirement.
10. Core recording timeline has a second recording-only creation shortcut. `recordings/RecordingTimelineView.tsx` offers Generate Subflow, choosing only a destination Flow. `recording-commands.ts` creates deterministic proposals then approves one into that Flow with replace_recording_derived. Both this control and its data-port command must be removed or redirected into instruction-led authoring with described optional evidence. The conversation capability registry also documents these endpoints as a recording-side workflow; update that contract when the shortcut is retired.
11. Core browser-recording start is another undescribed entry point: `clients/useClientGatewayController.ts` authorizeAction(start) sends sessionId/projectId/PIN only through client-api-types.ts and client-commands.ts to start-client-recording. Extension ActiveRecording.sendStart similarly sends initial state/manifests/start metadata without a description. Description must cross both start paths and the durable owning service, not live in panel state alone.
12. Core recording editing has useful persistence plumbing but no description action. RecordingActionKind is rename/note/marker/finalize/delete; useRecordingActionController edits metadata name or appends a timeline note/marker. RecordingActionDialog is already an ordinary authoring form, and onUpdateRecording reaches the owning update-recording service. Add a distinct description editor; a friendly title or event note does not satisfy the requirement. RecordingListView/timeline currently display name/status/counts, not a demonstration description.
13. Missing-goal errors currently lose their actionable meaning. Extension panel/state/request.ts retains only the generic relay code and maps unknown service sentences through copy/error-copy.ts to Something went wrong; controller then offers no Open FluxIQ action for ordinary refusal. In Core FlowRunView an explicit model-assisted run failure can be replaced with a generic LLM-assisted-run failure. Preserve a closed authority failure and an owner-scoped recovery target rather than parsing raw message text.

## Proposed user flows

### New automation

- Open/create a draft and enter the full task instructions as the primary required field. Explain that the task text defines what the automation may do.
- Persist the explicit text through Core before build/activation. Choosing a model key is a build setting, not a prerequisite to saving task text or ordinary deterministic reuse.
- Offer an optional supporting recording only after/alongside the task field. Each recording must have an explicit description of what it demonstrates. Its steps and description supplement the task and cannot add authority or silently expand the requested actions.
- Review an instruction-led draft/candidate. Recording review offers describe/attach/view evidence, not generate/test/save an executable automation from recording alone.

### Record supporting evidence

- Top Record and extraction's auto-start must open the same description form before recording starts. Require trimmed nonempty text; cancellation starts no recording. A descriptive title is a separate optional label.
- Send the entered description through the recording-start protocol to Core. Preserve it through project linking, retries and acknowledgement; reject a stale response for another recording/project.
- A standalone described recording can remain evidence in the library without creating an automation. Associating it with an automation requires that automation's explicit instructions and a valid described evidence attachment.
- Keep historical recordings, timelines, notes and state accessible. Show Description needed before use on undescribed recordings, offer Add description/Edit description, and disable attachment/generation use until saved. Do not auto-fill from titles, labels or inferred goals.

### Existing automation missing instructions

- Keep its graph, history and datasets visible. Before Run or Resume, show a clear reason such as Add task instructions before running this automation, with a control that opens the correct existing Flow's instruction/migration form.
- Ask for the complete intended task, not just what should change. Save through the Core-owned migration/authority seam; blank-only generation instruction save is insufficient on a populated Flow.
- Core decides whether the existing graph has valid instruction authority or needs a rebuilt/reviewed candidate. Render that state explicitly; simply adding arbitrary active guidance must not automatically bless extra recording-derived steps.
- Refresh readiness after instruction changes and again on execution/resume at Core. Do not require a new model call for a valid deterministic run. Deleted/inactive/wrong-owner text and recording descriptions alone remain blocked.
- Preserve Stop/Take over and read/export access while blocked. Use the service's owning project/Flow IDs for recovery, not an unrelated currently selected Flow.

## File-owned implementation partitions

Partition A — extension recording UX and description transport (downstream):

- `apps/extension/src/panel/recording/recording-controls.ts`, record-control.ts, extract-control.ts and adjacent tests; a focused required-description form under recording/.
- `panel/recording/review/` controller/model/view/preview and owning tests: retire recording-only executable preview/test/save; retain evidence review and described attachment.
- `shared/constants.ts` / shared/protocol.ts recognized request fields; `background/index.ts`, connection.ts and connection/active-recording.ts plus recording-start attempt contracts and tests: carry the user's description to client.start_recording. Coordinate these shared files with the Core protocol owner before dispatch.
- `background/automation-relay/automation-relay.ts` and tests: remove/redirection of recording-only generation/approval relay; optional described-evidence/authority queries must remain narrowly scoped to the paired project.

Partition B — extension saved-flow and resume recovery (downstream; disjoint from A except shared protocol, so protocol edits are supervisor-owned or serial):

- `panel/automations/types.ts`, rows.ts, controller.ts, automation-strip.ts and tests: preserve Core authority readiness and owner-scoped blocked notices; allow viewing existing rows.
- `panel/state/request.ts` / result.ts, copy/error-copy.ts and tests: preserve recognized closed refusal/recovery information.
- `panel/chat/hold-control.ts` and background/panel/run-control.ts tests: Hand back refusal needs an instructions recovery action, not generic retry.
- Existing `background/panel/open-fluxiq.ts` produces project/Flow deep links without authentication material; it can already open the correct Flow. If no view-specific URL is added, make that Flow's start pane show the required migration form so the existing deep link is actionable.

Partition C — Core web instruction/legacy runtime UI:

- `authoring/blank-flow-authoring-model.ts`, BlankFlowAuthoringPanel.tsx; `flow-editor/components/FlowEditorView.tsx`: use Core authority readiness and expose full task capture on existing flows independently of model-key availability.
- `instructions/InstructionsView.tsx`, InstructionWorkbenchPanels.tsx, instruction-model.ts and command/host bindings only as needed: distinguish authoritative task from supplemental/advisory guidance; retain unsaved draft recovery and correct owner scoping.
- `runtime/run-input-model.ts`, run-queries.ts, runtime-host.ts, FlowRunView.tsx, useRunControl.ts, RunControlBar.tsx and tests: remove deterministic readiness exemption; show closed missing/invalid authority recovery for all run/resume modes.
- `flow-editor/commands/run-flow.ts` and tests: preserve typed service refusal instead of a second UI-only gate. Any shared readiness/error contract is Core service owner work, not invented here.

Partition D — Core web recording library and described browser capture (disjoint UI families, but can share one bounded worker):

- `recordings/recording-model.ts`, useRecordingActionController.ts, RecordingActionDialog.tsx, RecordingListView.tsx, RecordingTimelineView.tsx and tests: description create/edit/status, retained old-data access, replace Generate Subflow with instruction-led attachment/navigation.
- `recordings/recording-commands.ts`, recording-api.ts / recording-api-types.ts and conversation/capabilities/registry.ts: retire recording-only approval callers and synchronize the documented capability boundary.
- `clients/useClientGatewayController.ts`, ClientGatewayView.tsx, client-api-types.ts, client-commands.ts and tests: description collection/validation/propagation for Core-initiated browser recordings.
- `live/commands/domain-commands.ts`, live/hooks/useAutomationRecordingCommands.ts and view-host connector types only where new description/authority data must be preserved. The existing update-recording transport is reusable; Core decides the durable allowed field shape.

## Dependencies and narrow acceptance checks

Core contract discovery must establish the authoritative-task identifier/selection, legacy graph migration decision, recording description field and closed execution refusal before UI implementation. Instruction presence in current list summaries is insufficient evidence. Agree the paired extension authorization allowlist if adding direct task/description save requests; avoid silently broadening paired-token permissions.

Tests beside changed subjects should prove:

- Both extension surfaces share the same required task/description controls; Record and extraction never start on whitespace/cancel; stale owner/project replies cannot attach instructions/descriptions elsewhere.
- Recording-only review/Generate Subflow cannot approve or test a runnable automation. Notes/names do not substitute for descriptions; old evidence stays openable/editable.
- Core readiness blocks deterministic and assisted run modes for missing/invalid authority, while valid deterministic runs need no new model call. UI receives actionable closed errors from start, direct run and resume paths.
- Missing-task recovery opens the exact owning Flow and saves its complete task independently of model-key readiness. Failed save retains the user's draft and cannot unlock Run.
- Core service/gateway gates, owned by the contract worker, separately prove zero action/provider calls on refusal; button tests are not that proof.

Relevant existing owning suites: extension panel/recording/tests, recording/review/tests, automations/tests, panel/state/tests, chat hold-control tests and background/automation-relay/tests; Core web authoring/tests, instructions/tests, runtime/tests (including run-control interactions), flow-editor/commands/tests, recordings/tests and clients/tests.

No source changes, commits, builds, tests, browser/provider runs or panel management were performed. This is source-backed discovery, not live UX validation.
