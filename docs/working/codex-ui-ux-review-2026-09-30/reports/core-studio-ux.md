# Automation Studio UX discovery

Outcome: Complete (read-only source discovery; implementation and browser certification remain separate).
Reviewed: 2026-09-30, paired t224 Core source snapshot. No product changes, tests, builds, panel startup, browser/Lab sessions or provider calls.

## Surface inventory

All Core source paths below are relative to the paired `!FluxIQ` tree. The canonical inventory is `apps/web/src/features/automation-studio/views/canonical-view-definitions.tsx:79`.

| Surface | Current purpose and source |
| --- | --- |
| Entry and project catalog | Authenticated `/programs/automation-studio`, optional domain scope; searchable projects/categories, create/edit/delete dialogs, refresh/retry, drag organization. `app/programs/automation-studio/page.tsx`; `features/automation-studio/project/ProjectCatalogSurface.tsx`; `hierarchy/ProjectBrowser.tsx`, `ProjectModal.tsx`. |
| Workspace chrome | Hierarchy, editor panes/tabs, Details right pane, Action Preview dock; undo/redo, Play/Pause/Stop, Save Project, project exit, preferences and optional data inspector. Narrow layouts use drawers. `workspace/shell/{WorkspaceShell,WorkspaceHeader,ResponsiveDrawers}.tsx`. |
| Connected browsers | Pairing approval/rejection, trusted-client revocation, searchable/paged sessions, recording controls, snapshots, authorized action test and gateway diagnostics. `clients/ClientGatewayView.tsx`. |
| Recorded steps | Recording list and timeline lanes, notes/markers, finalize/delete, state inspection and deterministic subflow generation. `recordings/RecordingTimelineView.tsx`. |
| Steps | Empty/start pane offers creation, website task exploration or existing-flow improvement; hydrated node canvas, palette, outline, selection tools and validation. `flow-editor/components/{FlowEditorView,FlowGraphToolbar}.tsx`. |
| Choose a path / Reusable parts | Flow routing and reusable subflow authoring. Canonical registry lines 102 and 109 bind `router/RouterView.tsx`, `subflows/SubflowsView.tsx`. |
| Guidance for the assistant / Settings | Instructions and flow/subflow settings; model credentials/readiness belong to settings. Registry lines 116 and 130; `settings/SettingsViews.tsx`. |
| Suggested changes | Filter/sort/paged proposals, detail sections, evidence/diffs/validation/audit and review actions. `adaptations/AdaptationsView.tsx`. |
| What the page looked like | Source and input/output phase selection; visual, structured, diff, comparison, raw views, evidence/fact inspector and state-load retry. `state/StateExplorerView.tsx`. |
| Run and test | Typed input values/raw JSON, step limit, readiness repair links, run modes; pause/take control/resume, stop/retry, run/replay history, action/event detail and run datasets/export. `runtime/{FlowRunView,RunControlBar,RunActionLogView}.tsx`. |
| Problems / Details | Project/current-object diagnostics and filters, diagnostic report copying; contextual inspector. `problems/ProblemsView.tsx`; canonical registry lines 151 and 158. |
| Session overlays | Hierarchy create/delete, unsaved-editor decisions and conversation dock are composed by `live/components/AutomationStudioSession.tsx`, `AutomationStudioWorkspaceComposition.tsx`. |

## Representative journeys

- Create: catalog Project opens a named/optional-description dialog; successful creation opens the project. Non-destructive catalog operations do not demand a PIN; delete does. Empty Steps offers Create automation, then hierarchy name/preset/location. A blank model-bound flow can receive a website task, save its instruction, explore and create a proposed adaptation. The start-pane review handoff is missing (S1).
- Edit: select a flow/subflow or node, use Steps graph tools or specialized routing/instruction/settings views, save through registered dirty editors. Project exit is guarded by `live/hooks/useAutomationSessionDirtyGuards.ts:48`; header Save Project reports already-saved/success/error rather than silently doing nothing. Proposal review remains distinct from applying durable changes.
- Run: Run and test checks readiness, offers links to missing prerequisites, validates typed/raw input, selects a default Fully adaptive mode with alternatives under Advanced and launches. Live control reports Core's actual held state, allows manual takeover and returns control. Last Run exposes review links and a permission question when relevant; approval explicitly starts a new run rather than pretending to resume a parked one (`runtime/RunPermissionRequest.tsx`).
- Inspect: previous run opens summary/story, paged attempts, ordered events, datasets and audit export. Selecting an attempt/event separately loads fuller details. List-level errors have retry controls; selected-detail failure does not (S4). Recordings and state evidence have distinct inspection surfaces.
- Recover: readiness retry, failed Steps hydration retry, state-load retry and dirty-editor exit choices exist. Problems currently loses request failures and can claim a clean project (S2). Browser disconnect/exploration failures show actionable text, but actual reconnection/visual behavior remains unverified.

## Prioritized findings

### S1 — P1 confirmed: primary authoring completion has no review handoff

`flow-editor/components/FlowEditorView.tsx:124` and `:127` mount `BlankFlowAuthoringPanel` / `ImproveFlowPanel` without `onOpenAdaptation`. Successful generation calls only the optional callback at `authoring/BlankFlowAuthoringPanel.tsx:161` or `ImproveFlowPanel.tsx:90`, plus local review text. The start pane has no proposal id or Review button. `live/view-host/useAutomationConnectorCommands.ts:69` supplies graph commands and Create Flow but no adaptation navigation; its runtime mapping at `:94` does supply that navigation. `runtime/runtime-host.ts:104` and `:106` are API wrappers, without a navigation side effect.

Consequence: the primary describe/improve journey produces a draft but leaves the person to discover Suggested changes manually. Fix: thread the existing openAdaptation command through the Steps view/start pane to both authoring panels; retain a visible Review proposal action/id on success so a failed or deferred navigation is recoverable. Validate both blank-generation and improvement success from the actual connected Steps surface, selecting the returned proposal without applying it; failed generation must stay on the editable request.

### S2 — P1 confirmed: Problems request failure can look like successful validation

`problems/ProblemsView.tsx:32` suppresses supplied snapshot problems for a project until remote data arrives. `:80` silently returns for `!result.ok`; no loading/error state belongs to that request. The empty view at `:160` / `:216` says "No problems found" and the current snapshot/graph pass checks. The connected model (`live/view-host/canonical-connected-views.tsx:319`) supplies no validation status to counter this default. A previous remote page also remains visible during failed filter changes, under the new filter controls.

Consequence: connection/permission failures can hide real diagnostics or mislabel stale rows as the new query. Fix: explicit query loading/error/stale state, retained rows visibly marked stale, retry for the failed query, and clean-result copy only after a successful response. Invalidate request generations immediately on scope/project/filter change and on unmount. Validate initial failure, filtered-page failure, denied permission, delayed old response after scope change and successful retry; none may claim validation success before data is available.

### S3 — P2 confirmed: project organization is drag-only

`hierarchy/ProjectBrowser.tsx:118` and `:148` expose category reorder/project movement only through HTML drag handlers. Menus at `:133` and `:167` offer create/rename/delete but no Move project or reorder action. `project/ProjectCatalogSurface.tsx:46` and `:60` begin move dialogs only from drop paths.

Consequence: keyboard users cannot complete project-to-category movement or category ordering; touch behavior also needs certification. Fix: add Move project with a destination picker and Move up/down or a keyboard reorder action to the existing menus, preserving their confirmation flow. Validate the complete move/reorder operation without a pointer, including Uncategorized, first/last boundaries, focus restoration and failure feedback.

### S4 — P2 confirmed: selected runtime detail failure is silent

`runtime/RunActionLogView.tsx:130` and `:145` select the summary first, request action/event detail and update it only on `result.ok`; they do not expose a detail error or retry. The detail rendering at `:298` / `:324` continues showing the summary after a failed response. This is distinct from list/run-load errors, which do render retry controls.

Consequence: the person cannot tell whether detail is absent or simply failed to load while investigating a run. Fix: independent selected-action/event detail error and retry, clearly label retained summary data and keep request-generation/abort protection. Validate compact summary → failed detail → retry success, selection change during requests, and closing detail while loading.

### S5 — P2 confirmed integration gap: onboarding start choice is ignored

The Studio route reads only domainId (`app/programs/automation-studio/page.tsx:8` / `:15`). `live/hooks/useAutomationBrowserEntry.ts:11` invokes `navigation.ts:17`, whose parser reads project/flow/subflow/view/detail and has no start choice. A production-source search found no Studio consumer for the onboarding start query. The shell reviewer owns the originating onboarding controls.

Consequence: an onboarding choice sent as `?start=...` reaches the same generic catalog instead of the chosen first action. Fix jointly with shell ownership: consume validated intent after initialization and open an appropriate guided creation/connect journey, or change onboarding destinations to supported navigation. Validate each emitted choice, invalid intent fallback, refresh/back behavior and existing-project state preservation.

## Browser hypotheses and validation requirements

No visual defect is certified by this review. After authorization, exercise wide and narrow viewport composition, graph keyboard shortcuts/focus, hierarchy/menu keyboard navigation, modal/drawer focus trapping/return, screen-reader error announcements, tab semantics, long project names, reduced motion and overflow. Trace a complete isolated create → author → review → edit → run → inspect → recover journey with deterministic mocked commands before any provider/browser execution. UI fixtures must avoid real project data, tokens and page captures. Preserve the existing separation of Core durable ownership, draft review, permission requests and browser execution.

## Validation ledger

- Read current task brief/Current State, Core boundary guidance, architecture workspace guide, Studio route/layout, canonical view registry and representative feature/connector source.
- Used read-only file enumeration and `rg -n` to verify handler wiring and line references; no tests/builds/live/provider calls were run.
- Changed only this report. Findings are source-confirmed triggers and missing transitions; runtime/browser severity and visual experience remain uncertified. Recommendations are not implementation claims.
