# Core and extension UI/UX review

Status: Active
Status detail: Continuous Core/extension audit and implementation resumed with three workers; remaining phases execute in file-partitioned batches.
Created: 2026-09-30
Last updated: 2026-10-01
Owner: Codex senior supervisor
Scope: All Core web panels and the extension, focusing on user journeys, accessible controls, feedback and recovery.
Paired document: codex-ui-ux-review-2026-09-30.md in the sibling FluxIQ Core worktree.
Related: [working document index](./README.md)

## Current State

Latest continuation checkpoint (2026-10-01): Core onboarding1a5afc47, Runtime
d011b0ae and sensitive-store authorizationd5c979a6 are checkpointed; supervisor
combined82/full300files1852tests/corrected types/production9733 passed. Structure
has only inherited service4506/4505. Auth and operational-refresh/Compute workers
are now released in their exact disjoint paths; supervisor clipboard control
implementation has22 focused passing tests; one strict test callback typing
correction is awaiting its rerun. Extension extraction checkpointc96f5f78 passed
full1716/types/build/audit. Strip hidden-draw regression is corrected; supervisor
related21/full1727/types/build pass. Final structure/checkpoint precedes release
of explicit navigation focus. Auth and refresh receive additional route-change
and hidden-before-microtask review; source not broadly frozen yet. Continue
working beyond every batch.

The user requested a primary focus on Core framework UI/UX across all web panels
and the extension. Existing Core UX plans describe older implementations and lack
live browser certification; they are background, not evidence of current behavior.

Work is isolated in task/t224-codex-ui-ux-review, with a paired Core worktree.
Discovery is read-only for product source; bounded confirmed fixes are specified below. No panel startup, browser, Lab or model
provider calls are authorized in this session. No dev merge or push: Claude owns
integration. Claude's existing worktrees and excluded runtime/storage areas stay
untouched. Findings must name current source and distinguish observed code from
visual/browser hypotheses.

Done: current indexes and relevant prior UX Current State sections read; all
global operational panels, Studio surfaces and extension journeys inventoried
in the three discovery reports. Supervisor independently confirmed missing
session-recovery host, ignored onboarding intent, missing authoring-review
callback, single-conversation prompt selection, and extension draft races.
Initial fixes are source-complete and frozen. Extension typecheck passes; full
corrected TAP1685/1685 passes (outer PowerShell redirect exit1 documented);
supervisor independently runs12draft regressions with native exit0. Downstream
full structure passes135warnings/119baseline. Core web typecheck passes; full
Core structure has only inherited unchanged service4506/4505. Focused recovery
17/17, Core web production build (165872ms) and extension production build
(42135ms; Chrome/Firefox/e2e22files each) pass. Supervisor full web suite88597
completed with1699pass/1fail: unchanged core-contract flow.build fixture rejected
its obsolete pre-provider request budget. The published-default fixture correction
and matching Core composer draft guard were then verified and checkpointed.
Initial fix checkpoints: Coree6eb33f2, downstream21e915ee.
Follow-up code checkpoint: Core95573296. Final supervisor web suite98054 passed
287files/1704tests, exit0,212.84s. Final web typecheck62339 passed,83544ms;
production build71345 passed,17pages,248727ms. Core audit1037 has exactly the
same inherited service4506/4505 failure; no new violation or baseline increase.
Downstream documentation audit96080 passed,0warnings/2baselined.
The initial fix batch is complete and checkpointed for Claude integration.
On 2026-10-01 the user explicitly requested continuous execution of the remaining
UX work with subagents, followed by other useful nonconflicting work when UX is
exhausted. Do not stop at a batch boundary. Three file-partitioned workers resume
authoring review navigation, honest Problems query states and stable extension
automation rows. Supervisor owns Production Runner operations next. Source is
unfrozen only in those assigned files; broad validation waits for a coordinated
freeze. Keep recording and checkpointing as work proceeds. No merge/push, live
provider calls or panel management; Claude integration boundaries remain intact.
No Claude slot or source is changed to accelerate this work.
The remaining roadmap is now authorized for execution. Browser/visual validation
still respects the standing no-live/panel-management boundary; continue useful
source audits, component tests and fixes independently of that limitation.

Original Claude workload is complete: all five tasks locally committed and
verified; final t216 downstream3dc66aee/Core90dfd1db. Final handoff commitde2096b1
on t221 follows the earlier checkpoint866a1601.
Its durable handoff lives in t221 reports/codex-supervisor-handoff.md. The UI/UX
task neither replaces those checks nor changes Claude's integration ownership.

## Review criteria

- A clear primary action and understandable starting point for every panel.
- Predictable navigation and preservation of selected project, flow and edits.
- Useful loading, success, failure and permission feedback with a recovery action.
- Keyboard access, labelled controls, focus behavior and responsive composition.
- Functional integration between extension and Core without duplicate ownership.

## Findings and implementation roadmap

Detailed source references and surface inventories:
[Core shell](./codex-ui-ux-review-2026-09-30/reports/core-shell-ux.md),
[Studio](./codex-ui-ux-review-2026-09-30/reports/core-studio-ux.md), and
[extension](./codex-ui-ux-review-2026-09-30/reports/extension-ux.md).
These are source-based findings, not visual/browser certification.

### Phase 1 — Protect work and restore interrupted requests (complete)

1. Mount a single authenticated Core reauthentication host at root. Remove the
   duplicate topbar composition. Check pending recovery on mount and settle it
   when the host unmounts; do not discard workspace state or repeat mutations.
2. Preserve newer Core/extension chat and extension settings drafts with revision-bound completion. Normal
   unchanged success clears the submitted draft; failure preserves it.
3. Run component regressions, web/extension type checks and affected full suites.
   Review final source independently before committing locally for Claude.

### Phase 2 — Complete creation and review journeys (active)

1. Thread existing openAdaptation navigation from the Steps connector through
   FlowEditorView/start pane into both authoring panels. Add a durable visible
   Review suggested change action; never apply the proposal automatically.
2. Make first-run setup discoverable in the directory. Consume each validated
   onboarding start intent after Studio initialization, with safe fallback and
   back/refresh behavior, or emit only already-supported destinations.
3. For each creation/improvement path, test returned proposal navigation,
   unsuccessful generation, missing prerequisites and preserved user input.

### Phase 3 — Honest diagnostics and reliable operations (active)

1. ProblemsView owns query loading/error/stale/retry states. Show a clean result
   only after a successful response; reject old scoped/filter responses.
2. RunActionLogView exposes selected-detail loading/error/retry independently
   from its list. Preserve explicitly labelled summary data on detail failure.
3. Production Runner guards launch and per-run advance/cancel requests, handles
   refused results locally and resets parameters when effective target changes.
4. Reconcile Compute selection with filtered nodes. Add bounded, visible-panel
   freshness and last-updated feedback to Compute/Background/Production views.
   Pause hidden polling; never treat local elapsed time as current server health.
5. Test duplicate activation, failure/retry, stale completion after target change,
   external run completion, permission refusal and disconnected refresh.

### Phase 4 — Accessible navigation and questions (active)

1. Reconcile extension automation rows by flowId so refresh retains focused
   buttons and handlers use current data. Define focus behavior for removed rows.
2. Add extension dialog focus entry/containment/return and background inertness,
   preserving real-page extraction selection and Firefox reopening.
3. Add keyboard menu actions for project movement and category ordering.
4. Global question UI inspects bounded candidates rather than only the first
   thread. Dismiss/answer should reveal the next pending ask; include pagination
   policy without reading all conversation history or changing runtime ownership.
5. Verify keyboard-only journeys and request-lifecycle races with synthetic data.

### Phase 5 — Close remaining panel functionality gaps (queued)

1. Runtime catalog entry must lead to an intentional actionable workspace or
   clearly describe unavailable functionality; no generic unexplained placeholder.
2. Secret-copy feedback follows actual clipboard success with a usable fallback.
3. Sensitive-store authorization has an operation lock and scoped completion.
4. Preserve validated local return paths through sign-in; keep launcher recents
   optional when browser storage fails. Explain unsupported production schemas.
5. Profile heavy collapsed payloads before replacing them with lazy viewers.

### Phase 6 — Visual and live acceptance (not exercised)

After explicit session authorization, use an isolated test instance and synthetic
data for wide/compact/mobile, 200% zoom, reduced motion, keyboard and dialog
focus. Measure create/author/review/run/inspect/recover task completion, feedback
latency and overflow across every surface. Capture evidence without secrets.
Do not infer these results from compilation or static markup tests. Larger
layout changes should answer measured problems in these journeys.

## Dependencies and risks

- Claude owns integration of original task branches; preserve t219 deep links
  and t216/t217 wait/ending contracts. Do not copy those fixes into this branch.
- Question ordering touches global presentation only; runtime conversations,
  storage and context-packet files remain excluded from this lane.
- Recovery modal placement must avoid multiple listeners/overlapping hosts and
  safely settle outstanding requests on logout/route lifecycle changes.
- Stable row reconciliation must update data captured by handlers; retaining DOM
  with stale closures would make the interface look correct but act on old data.
- Browser behavior remains unverified until authorized live acceptance.

## Worker Briefs

### Brief: codex-web-contract-budget-investigation
- Repository: paired Core t224; report in downstream t224.
- Task: diagnose sole broad-suite failure: core-contract flow.build rejects pre_provider_request_total_exceeded. Establish whether the unchanged test fixture has obsolete request budget after baseline t210 integration. No fix before reporting exact root cause/proposed path.
- Required reads: this Current State; apps/web/src/features/automation-studio/conversation/capabilities/tests/{core-contract.test.ts,core-contract-world.ts,core-contract-arguments.ts}; follow fixture provider/profile configuration as needed. Read public budget contracts only as needed; excluded context-packet/runtime conversation/storage code must not be edited.
- Owns (may edit): downstream reports/core-contract-budget.md; after supervisor diagnosis review, Core apps/web/src/features/automation-studio/conversation/capabilities/tests/core-contract-world.ts only. Use existing public AUTOMATION_STUDIO_SESSION_KEY_PROVIDER_DEFAULTS.tokenLimits in place of obsolete literal fixture limits.
- Must not touch: all other product source/tests, shared docs/indexes, other reports/worktrees, protected Core runtime/storage/conversations/context-packet files; no commits/push/provider/browser calls. Keep scripted provider, call/cost/timeout and strict acceptance assertions unchanged.
- Definition of done: exact mismatch and source evidence; proposed smallest fixture correction that preserves contract assertion (no skip/expected-refusal expansion/timeouts), or identify a real Core defect and integration owner. Do not blame load/machine. Narrow controlled tests only after scope clearance through heavy.sh.
- Report to: docs/working/codex-ui-ux-review-2026-09-30/reports/core-contract-budget.md

### Brief: codex-core-auth-ux-fix
- Repository: paired FluxIQ Core t224; report in downstream t224.
- Task: fix the confirmed global program session-recovery hang: mount one reauthentication host for authenticated app routes and ensure pending recovery settles when its host unmounts. Preserve workspace state and current login semantics.
- Required reads: this Current State; Core docs/architecture/code-structure.md; apps/web/src/app/{AuthShell,layout}.tsx; features/programs/program-auth-recovery.ts and program-api.ts; existing AuthShell tests and component-test patterns.
- Owns (may edit): apps/web/src/app/AuthShell.tsx; apps/web/src/app/layout.tsx; apps/web/src/app/tests/AuthShell.test.tsx; app/session-reauthentication/{SessionReauthentication.tsx,index.ts,tests/SessionReauthentication.test.tsx}; downstream report reports/core-auth-ux-fix.md only.
- Must not touch: other product files, storage/runtime/conversation code, shared docs/indexes, Claude worktrees, git commits. If extraction/new host file is necessary, report proposed exact path before editing it.
- Definition of done: global routes have one host; mocked expired request opens recovery, success retries and cancellation/unmount settles false; regression tests exercise behavior rather than source-string only. No live/browser/provider calls. Wait for supervisor source-edit clearance after task initialization, then run focused web tests through heavy.sh and report actual results.
- Report to: docs/working/codex-ui-ux-review-2026-09-30/reports/core-auth-ux-fix.md

### Brief: codex-extension-draft-ux-fix
- Repository: downstream t224.
- Task: preserve subsequent user edits while chat send or settings save is pending (EXT-01/02). Use edit revisions to avoid clearing/refilling newer drafts; preserve failure behavior and reconnection semantics.
- Required reads: this Current State; reports/extension-ux.md; apps/extension/src/panel/chat/conversation/composer.ts; apps/extension/src/panel/settings/settings-view.ts; their existing fake DOM/component-test patterns.
- Owns (may edit): the two named source files; focused new tests under chat/conversation/tests/ and settings/tests/; downstream reports/extension-draft-ux-fix.md only.
- Must not touch: Core, other source, shared docs/indexes, other reports, Claude worktrees, git commits. Do not broaden fake DOM changes without supervisor approval.
- Definition of done: deferred send/save tests show newer edits and stored draft survive success; unchanged success clears correctly; failures preserve draft; no spurious automatic save/send. Wait for source-edit clearance after initialization. Use per-label scratch test bundles and heavy.sh; no timeouts/skips/live/provider calls.
- Report to: docs/working/codex-ui-ux-review-2026-09-30/reports/extension-draft-ux-fix.md

### Brief: codex-core-shell-ux
- Repository: paired FluxIQ Core t224; report in downstream t224.
- Task: inventory and inspect global shell, onboarding, domain/program routes and global operational panel journeys; identify concrete UX/function defects.
- Required reads: this Current State; Core AGENTS Repository Boundary; Core docs/architecture/ui-theme.md; apps/web/src/app/{page,layout}.tsx; apps/web/src/app/get-started/page.tsx; apps/web/src/app/programs/[programId]/page.tsx; apps/web/src/app/domains routes. Follow their imported shell/program UI components as needed.
- Owns (may edit): docs/working/codex-ui-ux-review-2026-09-30/reports/core-shell-ux.md in downstream t224 only.
- Must not touch: all product source, shared docs/indexes, other worktrees; Automation Studio feature source is the other worker's lane.
- Definition of done: enumerate every global operational surface; source-backed findings with path/line, user consequence, suggested fix and validation; distinguish confirmed bugs from browser hypotheses. No tests/builds/live/provider calls; no commit/push.
- Report to: docs/working/codex-ui-ux-review-2026-09-30/reports/core-shell-ux.md

### Brief: codex-core-studio-ux
- Repository: paired FluxIQ Core t224; report in downstream t224.
- Task: inventory Automation Studio surfaces and trace create/edit/run/inspect/recover journeys; identify concrete usability/function defects and high-value improvements.
- Required reads: this Current State; Core AGENTS Repository Boundary; Core docs/architecture/automation-studio/workspace.md; apps/web/src/app/programs/automation-studio/{page,layout}.tsx. Follow apps/web/src/features/automation-studio components; read existing UX working documents Current State only if relevant.
- Owns (may edit): docs/working/codex-ui-ux-review-2026-09-30/reports/core-studio-ux.md in downstream t224 only.
- Must not touch: all product source, shared docs/indexes, other worktrees; global shell/program source is the other worker's lane. Never read secrets/runtime project state.
- Definition of done: surface map and source-backed prioritized findings with path/line, consequence, fix and validation; mark unverified browser hypotheses. No tests/builds/live/provider calls; no commit/push.
- Report to: docs/working/codex-ui-ux-review-2026-09-30/reports/core-studio-ux.md

## Work Ledger

### 2026-09-30 — Review initiated
- Agent: supervisor
- Changed: this isolated plan and written discovery briefs.
- Why: user shifted primary focus to UI/UX across Core and extension.
- Validation: not validated; code discovery is underway.
- Outcome: Partial
- Follow-up: review source and worker reports; record implementable priorities.

### 2026-09-30 — Durable review checkpoint and scoped fixes
- Agent: supervisor
- Changed: complete surface reports and roadmap; paired Core working record; generated indexes.
- Why: user explicitly requested progress durability without dropping Claude's work.
- Validation: both git staged diff checks passed; implementation tests remain pending.
- Outcome: Partial
- Follow-up: initial UX fixes and t216 gates continue. Checkpoint commits: downstream c0cf1bc9, Core 239a52bb; Claude handoff checkpoint 866a1601 on t221.

### 2026-09-30 — Authentication host ownership correction
- Agent: supervisor and core-auth worker
- Changed: approved app/session-reauthentication module and owning tests in written brief.
- Why: another AuthShell export would raise its legacy three-component ratchet.
- Validation: source structure inspection; final revised implementation checks pending.
- Outcome: Partial
- Follow-up: extract focused host without raising baseline; rerun final source checks.

### 2026-09-30 — Initial fix verification and original work completion
- Agent: supervisor and workers
- Changed: draft guards/tests/fake DOM; focused global recovery host; authored architecture paragraphs.
- Why: prevent lost edits and unresolved expired requests, preserving existing UX contracts.
- Validation: supervisor draft12/12native0; inspected full extension TAP1685/1685, wrapper ambiguity recorded; downstream full audit pass135/119; Core web tsc0, full audit only inherited service4506/4505. Web suite/builds running.
- Outcome: Partial
- Follow-up: resume root sessions88597(websuite),2726(webbuild),23308(extensionbuild); worker Core focused14460. All command paths/results belong to per-worker reports. Original five tasks final handoff committedde2096b1.

### 2026-09-30 — Production verification complete
- Agent: supervisor
- Changed: no further product edits; all source frozen.
- Why: verify compiled route composition and browser-target bundles after fixes.
- Validation: root `pnpm --filter @fluxiq/web build` exit0,17pages; extension `build` exit0,22files per target; inspected focused Core17pass and exact sole inherited audit failure. Root full web tests88597 remain queued.
- Outcome: Partial
- Follow-up: allow shared slot scheduling; run full web suite without altering Claude jobs. Final local commits and generated indexes follow.

### 2026-09-30 — Core composer counterpart found
- Agent: supervisor
- Changed: finding recorded only; current full-suite source remains frozen.
- Why: Core ConversationComposer also clears text unconditionally after awaited successful send while leaving textarea editable.
- Validation: direct current-source review; existing six tests omit edits during pending send.
- Outcome: Partial
- Follow-up: after suite88597 finishes, reproduce with deferred-send tests and fix this source/test pair; rerun affected Core UI checks. No runtime/conversation implementation changes.

### 2026-09-30 — Broader web suite result
- Agent: supervisor
- Changed: no product changes during validation.
- Why: verify root recovery composition across all web panels.
- Validation: `pnpm --filter @fluxiq/web test` exit1;286files pass/1fail,1699tests pass/1fail. Sole failure: core-contract flow.build rejected flow_bootstrap.pre_provider_request_total_exceeded. Auth recovery cases pass.
- Outcome: Partial
- Follow-up: bounded fixture/configuration diagnosis; do not mask refusal or edit Claude's context-packet work. Core composer reproduction/fix proceeds independently on its source/test pair.

## Final batch handoff

The entries below describe the completed initial batch. Execution resumed on
2026-10-01; consult Current State and the following briefs for active ownership.

## Worker Briefs — 2026-10-01 continuation

### Brief: runtime-workspace-audit
- Repository: paired Core t224.
- Task: read-only architecture-compatible implementation design for Phase5.1 functional Runtime workspace using existing read APIs.
- Required reads: Current State; shell finding3; ProgramLiveViews.tsx; runtime-control/metadata.ts,api/contracts.ts,api/handlers.ts; public runtime index/types/service snapshot/getRun; representative shared-UI panels/tests.
- Owns (may edit): downstream reports/runtime-workspace-audit.md under this effort only.
- Must not touch: product source/tests, all runtime/storage/context-packet source, shared/architecture docs, other worktrees; Core is frozen for root broad gates.
- Definition of done: trace supported clients/capabilities/runs/dispatch/transport payloads and public imports; propose focused read-only operational workspace with bounded lists, selection, lazy detail, safe loading/error/retry/race/freshness feedback and exact owned files/tests. Avoid raw secret/recording logs; no new backend contract or mutation. Prefer real useful inspection over a preview dead end.
- No heavy jobs/tests/build/provider/browser/panel/Lab/commits/push. Return source references, exact minimal scope, meaningful regressions and limits for immediate implementation brief after freeze release.

### Brief: extraction-dialog-implementation
- Repository: downstream t224; extension broad rows gates are complete and downstream product source released for this brief only.
- Task: Phase4.2 implement extraction-dialog-audit.md's focused modal/async lifecycle design.
- Required reads: Current State; own frozen audit; named files, privacy/preview tests read-only.
- Owns (may edit): apps/extension/src/panel/extraction/panel.ts,panel-elements.ts,dialog-focus.ts(new),index.ts,tests/dialog-focus.test.ts(new),tests/panel.test.ts(new),tests/dialog-dom.ts(new focused local harness if needed).
- Must not touch: field-row/preview/privacy reducers, recording/shell/content/background/contracts/shared fake DOM, Core, architecture/shared docs or other worktrees. Request any extra exact files.
- Definition of done: root-mounted open sheet remains visible across host moves; exact prior inert restoration/listener cleanup; extension-document-only focus entry/trap/return, no page/browser focus stealing; field identity/caret preserved across redraw; IME/busy Escape safe, Close visibly disabled while busy; lifecycle epochs drop stale prepare/poll/preview/capture completions.
- Explicitly authorized defect fixes: keep pending/failed cancellation shell visible with safe retry after immediate preview erasure; close modality only on acknowledgement/no-session; Confirm disables editable controls while submitted draft is pending. Preserve payload/privacy/capture counts and background picking ownership; no new private persistence/reconnect policy.
- Report to: downstream reports/extraction-dialog-implementation.md under this effort.
- Reproduce then focused lifecycle/panel + unchanged preview/preview-reread tests through bash heavy.sh. No whole suites until source freeze, no commits/live/browser/provider/panel calls. Report exact outcomes and limitations; synthetic focus tests are not browser certification.

### Brief: onboarding-entry-implementation
- Repository: paired Core t224.
- Task: execute onboarding-entry-audit.md's guided entry design for Phase2.2.
- Required reads: Current State; own frozen audit; Core code structure; exact files below and their referenced navigation commands.
- Owns (may edit): Core app/page.tsx,app/tests/HomePage.test.tsx; app/get-started/GetStartedClient.tsx and tests/GetStartedClient.test.tsx; features/automation-studio/live/hooks/useAutomationBrowserEntry.ts and tests/browser-start-intent.test.tsx; onboarding/entry/StudioStartJourney.tsx,index.ts,tests/StudioStartJourney.test.tsx; live/components/AutomationStudioSession.tsx and tests/studio-start-entry.test.tsx. All app paths start apps/web/src/; feature-relative paths under same tree.
- Must not touch: navigation.ts, runtime packages, shared onboarding types/checklist, existing authoring/Problems fixes, architecture/shared docs, other worktrees. Request extra exact files if needed. Keep oversized host within its current ratchet; focused entry module owns new behavior.
- Definition of done: discoverable Get started; allowlisted describe/demonstrate/extract banner and explicit existing Create automation/Connected browsers actions; no URL-triggered mutation; canonical links and domain scope win; guarded replace removes only start on action/dismiss; refresh/back/idempotence and stale handlers safe; preserve project/workspace state.
- Report to: downstream reports/onboarding-entry-implementation.md under this effort.
- Reproduce then focused component/hook/wiring tests via bash heavy.sh. No broad gates/commit/live/browser/provider/panel calls. Report frozen source and exact results; do not promise Core-owned page extraction or bypass prerequisites.

### Supervisor ownership: Selected run detail feedback
- Owns Core runtime/RunActionLogView.tsx and runtime/tests/run-detail-feedback.test.tsx under web automation-studio feature.
- Add independent action/event-detail loading/error/retry with clearly retained summaries; generation/abort protection, close/scope/selection races, malformed/mismatched detail handling. No runtime package/API changes.

### Brief: onboarding-entry-audit
- Repository: paired Core t224.
- Task: read-only scoped implementation design for Phase2.2 discoverable setup and consumed onboarding start intents.
- Required reads: Current State; core-shell-ux.md finding9/core-studio-ux.md S5; app/page.tsx,ProgramLauncher.tsx,get-started/GetStartedClient.tsx; Studio route; live/hooks/useAutomationBrowserEntry.ts, navigation.ts and referenced entry commands/tests.
- Owns (may edit): downstream reports/onboarding-entry-audit.md under this effort only.
- Must not touch: all product source/tests/shared docs, runtime packages or other worktrees.
- Definition of done: exact emitted intents and supported initial catalog/project states, safe create/connect/record paths; refresh/back/idempotence behavior; minimal exact file ownership list and meaningful synthetic tests; preserve existing deep-link project/flow/subflow/view/detail and domain scope.
- No heavy tests/builds/live/browser/provider/panel calls/commits. Report a concrete architecture-compatible proposal and source references for immediate next implementation brief; no approval needed for discovery.

### Brief: extraction-dialog-audit
- Repository: downstream t224.
- Task: read-only focused audit/implementation proposal for Phase4.2 extraction dialog focus and background interaction.
- Required reads: this Current State; extension-ux.md dialog finding; panel/extraction/panel.ts,panel-elements.ts,field-row.ts,preview.ts; panel/recording/extract-control.ts; relevant shell composition and existing extraction tests.
- Owns (may edit): only docs/working/codex-ui-ux-review-2026-09-30/reports/extraction-dialog-audit.md.
- Must not touch: all product source/tests/shared docs, Core and other worktrees; extension source is frozen for root broad gates.
- Definition of done: trace actual open/close/select/preview/disconnect/tab-reopen lifecycle; design focus entry/trap/Escape/return/background inertness with source references and exact minimal ownership list, preserving real-page extraction selection and Firefox reopening. Identify meaningful synthetic regression cases and risks; no live claim.
- No tests/build/provider/panel/browser/Lab/commits/push. Return durable findings for next implementation brief; ask if required context missing.

### Supervisor ownership: Compute visible selection
- Owns Core live-views/compute-control.tsx and tests/compute-selection.test.tsx.
- Reconcile selected node against visible search/health/capability result using existing helper; filtered-out/removed/all-empty cases cannot retain stale detail/activity. Focused red-to-green verification, no runtime changes.

### Brief: global-question-queue
- Repository: paired Core C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ.
- Task: Phase4.4 fix global question starvation across candidate conversations.
- Required reads: this Current State; core-shell-ux.md finding2; app/GlobalConversationPrompt.tsx, its owning tests and referenced public conversation summaries/contracts.
- Owns (may edit): Core apps/web/src/app/GlobalConversationPrompt.tsx and app/tests/GlobalConversationPrompt.test.tsx only (create owning test if absent).
- Must not touch: runtime packages/conversations/storage/context-packets, Studio views, other source/tests, shared/architecture docs or other worktrees. Request exact additional file clearance if needed.
- Definition of done: newer idle or dismissed conversation cannot mask older waiting ask; bounded candidate/page scan, no full-history reads; dismiss/answer advances; safe permission failure/retry/obsolete response/unmount behavior. Reproduce then focused regression tests.
- Report to: downstream docs/working/codex-ui-ux-review-2026-09-30/reports/global-question-queue.md.
- No commits/broad checks/live/browser/provider/panel calls; all heavy commands through bash heavy.sh. Freeze/report observed outputs. Source-only bounded iteration; do not change backend ownership/API.

### Brief: authoring-review-navigation
- Repository: paired Core C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ.
- Task: implement Phase2.1 authoring completion and explicit proposal review.
- Required reads: this Current State; core-studio-ux.md S1; Core boundary and code structure; named source/tests below.
- Owns (may edit): flow-editor/components/FlowEditorView.tsx and tests/flow-editor-start-pane.test.tsx; live/view-host/useAutomationConnectorCommands.ts and tests/authoring-review-navigation.test.tsx; authoring/BlankFlowAuthoringPanel.tsx, ImproveFlowPanel.tsx and their owning tests. All source paths under Core apps/web/src/features/automation-studio/.
- Must not touch: other files, runtime package/conversations/storage/context-packets, shared documents, architecture docs, other worktrees. Request extra exact files if needed.
- Definition of done: Steps connector navigates to returned proposal for blank/improve; explicit recoverable Review action; failures preserve input; no automatic apply. Reproduce and run focused owning tests through heavy.sh; no whole suites until supervisor freeze.
- Additional supervisor requirement: deferred generation followed by project/flow change or unmount must not publish proposal/navigation/error/phase into a new scope; add request-generation guards and regressions in the same owned files.
- Report to: downstream docs/working/codex-ui-ux-review-2026-09-30/reports/authoring-review-navigation.md.
- No commits/push, live/browser/provider/panel calls. Use bash heavy.sh for all heavy commands, report observed exit/counts and frozen source. Keep brief/report progress durable.

### Brief: problems-query-feedback
- Repository: paired Core C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ.
- Task: implement Phase3.1 honest Problems loading/error/stale/retry and request races.
- Required reads: this Current State; core-studio-ux.md S2; Core boundary; problems/ProblemsView.tsx and owning tests.
- Owns (may edit): Core apps/web/src/features/automation-studio/problems/ProblemsView.tsx and problems/tests/problems-query-feedback.test.tsx only.
- Must not touch: other source/tests, runtime packages, shared/architecture documents, other worktrees. Request exact additional files if needed.
- Definition of done: initial failure cannot claim clean validation; filtered failed results explicitly stale; retry success; denied permissions and delayed scope/filter/unmount completions safe. Tests reproduce defect and pass without skips/timeout/expectation relaxation.
- Report to: downstream docs/working/codex-ui-ux-review-2026-09-30/reports/problems-query-feedback.md.
- Run narrow owning tests through bash heavy.sh only; no whole suites yet, no commits/push/live/browser/provider/panel calls. Report frozen source and exact outcomes.

### Brief: stable-automation-rows
- Repository: downstream C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQWebExtension.
- Task: implement Phase4.1 keyed extension automation rows, focus continuity/current handlers.
- Required reads: this Current State; extension-ux.md EXT03; panel/automations/automations-tab.ts,row-element.ts,controller.ts; existing fake DOM and tests.
- Owns (may edit): apps/extension/src/panel/automations/automations-tab.ts,row-element.ts,tests/automations-tab.test.ts,tests/row-element.test.ts only.
- Must not touch: shared fake DOM, other sources/tests/docs, Core, any other worktree. Request exact additions if necessary.
- Definition of done: refresh/update retains row/button identity and focus; changed data used on activation; reorder preserves focus; removed focused row moves to predictable visible next/previous button or named empty/heading fallback. No focus stealing for background refresh.
- Report to: docs/working/codex-ui-ux-review-2026-09-30/reports/stable-automation-rows.md.
- Run narrow tests through bash heavy.sh, no full suite until freeze. No commits/push/live/browser/provider/panel calls. Report actual checks and source freeze.

### 2026-10-01 - Continuous execution resumed
- Agent: supervisor
- Changed: active scope and written file ownership; initial commits remain intact.
- Why: user explicitly requested continued work and subagents, including useful follow-on work after UX.
- Validation: both t224 worktrees clean at start; previous final records read.
- Outcome: Partial
- Follow-up: dispatch three workers, independently inspect Production Runner; checkpoint each verified step and continue remaining phases.

### 2026-10-01 - Production operation regressions corrected
- Agent: supervisor
- Changed: Production Runner launch/per-run locks, local failure feedback, target-bound drafts and snapshot-generation guard; two owning test files and own report.
- Why: repeated activation issued duplicate mutations; target type/removal reused another target's values.
- Validation: initial reproduction5fail; corrected initial9pass; expanded final session49742 exit0,2files/11tests,15.77s. Exact failure diagnostics and commands in production-runner-operations.md.
- Outcome: Partial pending coordinated web types/build/full-suite review.
- Follow-up: source frozen in supervisor files; authoring worker adds scoped async fencing after supervisor review, Problems and extension workers continue. No whole-tree checks until all editors frozen.

### 2026-10-01 - Independent feature verification
- Agent: supervisor and three workers
- Changed: authoring review navigation/scope guards; Problems remote-query feedback; stable keyed extension rows; Compute visible selection.
- Why: complete user journeys, prevent misleading diagnostics and preserve keyboard focus/selection.
- Validation: supervisor authoring55/55 exit0(1473,19.32s); Problems30/30 exit0; rows10/10 exit0; Compute reproduced4fail then6/6pass(38824,9.58s). Extension check54177 exit0,62980ms. Full extension tests19704 and build73717 active against frozen downstream product source.
- Outcome: Partial pending coordinated broad gates.
- Follow-up: global-question worker implements bounded scans; other workers audit onboarding/extraction read-only. Continue through roadmap; no batch-boundary stop. Production checkpoint c71aa0fd.

### 2026-10-01 - Extension rows broad validation complete
- Agent: supervisor
- Changed: stable keyed automation rows and owning tests; authored extension UX contract paragraph.
- Why: keep focus and current activation data while status and polling update the list.
- Validation: independently reviewed source and10focusedtests; full extension19704 exit0,1695pass/0fail/0skip,115774ms; extension54177 types0; build73717 exit0,19004ms,Chrome/Firefox/e2e22files each.
- Outcome: Accepted for source/component/bundle verification; live focus certification remains unexercised.
- Follow-up: checkpoint rows and frozen reports, then implement extraction-dialog plan when read-only audit completes. Core focused checkpoints c71aa0fd/3d90046b/b2eb277f/2594f6c9. No merge/push; continue remaining roadmap.

### 2026-10-01 - Core batch source freeze for broad gates
- Agent: supervisor and workers
- Changed: global question candidates/cursor continuation/handler guards; selected action/event detail loading/error/retry and page/scope abort guards.
- Why: pending asks were masked by idle threads; failed detail reads looked like complete data.
- Validation: supervisor global36/36 exit0(26160,9.18s); selected detail initial3fail/2pass then final8/8 exit0,7.80s. Downstream full audit passes135warnings/119baseline after rows.
- Outcome: Partial pending Core broad types/tests/build/audit.
- Follow-up: Core source frozen, onboarding implementation held; runtime audit read-only. Extraction implementation may edit only its downstream owned files, since downstream rows gates are complete. Continue useful audits during checks; no batch stop.

### 2026-10-01 - Broad gates found strict typing and test import defects
- Agent: supervisor
- Changed: failure/resume record only; product snapshot remains frozen for web suite63749.
- Why: focused runtime tests do not replace strict compile and structure checks.
- Validation: web typecheck66630 reports optional callback props with explicit undefined, fixture helper undefined arrays/optional callback, and Compute test string-vs-ElementType. Core audit85381 exit1: inherited service4506/4505 plus new authoring test import bypassing views barrel.
- Outcome: Partial; these new issues must be corrected, no compiler/baseline/expectation relaxation.
- Follow-up: after web suite63749 finishes, release exact worker test/FlowEditor callback/import fixes plus root Compute helper typing, rerun focused/types/audit; build follows successful types. Onboarding held; Runtime audit read-only; extraction implementation continues downstream.

### 2026-10-01 - Whole web suite passed; scoped compile corrections released
- Agent: supervisor
- Changed: root Compute helper parameter narrowed to its actual three intrinsic element types; worker optional-prop/test-fixture/import corrections released only.
- Why: complete real strict typing fixes while preserving the tested behavior.
- Validation: full web63749 exit0,293files/1775tests,136.08s; no failures/skips. This is the pre-compile-correction snapshot; focused reruns/types/build will verify final correction.
- Outcome: Partial pending final corrected typecheck/build/audit.
- Follow-up: source changes limited to compile/import corrections; onboarding remains held, extraction continues downstream, Runtime read-only report underway. No compiler/baseline/assertion weakening; continue roadmap after gates.

### 2026-10-01 - Follow-on Core audit queue
- Agent: supervisor
- Changed: next-step evidence recorded without product mutations during compile correction gates.
- Why: user requires continuous whole-Core/extension audit and fixes beyond initial batches.
- Validation: current shared.tsx174 copyText returns void/unhandled clipboard promise; secret-keys.tsx205 immediately says Copied. Database-manager.tsx99 authorize-store lacks in-flight/scope guard. ProgramLauncher.tsx67 localStorage.setItem can throw on navigation; AuthShell login/setup destination is always root. These match prior audit findings and remain unfixed.
- Outcome: Planned
- Follow-up: after current Core gates release, partition clipboard feedback/secret reveal expiry, sensitive-store authorization, optional recents persistence and validated sign-in return path; synthetic rejection/duplicate/late completion/navigation tests. No private values in test/logs. Operational freshness and keyboard project organization remain queued too.

- Core task branch: task/t224-codex-ui-ux-review, checkpoints239a52bb,
  e6eb33f2 (global recovery),95573296 (composer/fixture),07acd910 (resume record).
- Downstream same task branch: c0cf1bc9 (audit),21e915ee (extension drafts),
  061e8a70 (follow-up reports). Final records are committed after these.
- Recovery host belongs once in authenticated root layout; preserve removal
  from GlobalTopbar and app/session-reauthentication module together.
- Draft guards rely on edit revisions, including identical retyped text;
  preserve Core/extension regression tests and settings submitted-value reconnect.
- fake-dom replaceChildren is identical to t219 cleanup's helper correction;
  preserve one method when integrating both tasks.
- Contract fixture uses the public provider token-default export. Scripted
  provider, one-call/cost/timeout bounds and acceptance assertions are unchanged.
- Original five tasks retain their separate finalized t221 supervisor handoff;
  integration must retain both diagnostic and clearedWait wire keys from t220/t216.
- No merge or push performed. Claude owns integration; no Claude worktree,
  slot, private state, context-packet/runtime conversation/storage source changed.
- Live browser, visual/accessibility certification and provider calls were not
  exercised. The broader six-phase roadmap stays queued beyond this first batch.

### 2026-09-30 - Final initial-batch verification
- Agent: supervisor
- Changed: final current state, resume and integration records; product source frozen.
- Why: durable handoff must distinguish verified fixes from queued UX work.
- Validation: root full web287files/1704tests pass; final web types/build pass;
  downstream docs audit pass. Full Core audit has only inherited service4506/4505.
  Extension full TAP1685/1685 and root focused12/12 recorded above; all target builds pass.
- Outcome: Complete for current-source audit and initial recovery/draft batch.
- Follow-up: Claude integrates local checkpoints; queued phases/live validation remain separate.

## Next bounded worker briefs

### Extension navigation audit
- Worker: wait_gaps; isolated t224 downstream checkout, read-only product scope.
- Read Current State and locate panel project/category/automation navigation modules and owning tests with rg.
- Inspect keyboard menus, focus persistence, asynchronous navigation and organization controls; record concrete source defects and exact minimal implementation paths/regressions.
- Own report: reports/extension-navigation-audit.md; no shared document, product/test edits, heavy/live/provider calls or commits.
- Extraction source remains frozen during supervisor broad checks. Claude boundaries unchanged.

### Runtime workspace implementation (held until Core production build completes)
- Worker: lab_bookkeeping; paired t224 Core only. Read Current State and reports/runtime-workspace-audit.md.
- Own new live-views/runtime/{RuntimeLive.tsx,RuntimeInventory.tsx,RuntimeRunDetail.tsx,runtime-snapshot.ts,index.ts,tests/runtime-snapshot.test.ts,tests/RuntimeLive.test.tsx} and programs/ProgramLiveViews.tsx only.
- Implement the report's read-only global inventory, client-side pages, safe field projection, honest snapshot/stale/retry feedback and lazy run detail with selection/scope/unmount fencing.
- Existing public runtime read endpoints/types only. No backend, metadata, styles, runtime/storage/context-packet or shared docs changes. No raw payload display/log/persistence, execution controls, live/provider calls or commits.
- Tests: malformed/omitted sensitive fields, latest-request wins, distinct client sessions, filters/pages/selection, detail mismatch/retry/races, read-only composition. Run focused via heavy slots then freeze; supervisor verifies broad gates.
- Own report: reports/runtime-workspace-implementation.md; return exact files, observed checks, limitations and unresolved contract constraints.

### 2026-10-01 - Corrected compile and independent extraction checks
- Agent: supervisor
- Changed: strict optional props/test fixture corrections reviewed; read-only Runtime and extension navigation work scoped.
- Validation: corrected Core web typecheck73179 exit0 (13487ms); Core audit28482 exit1 only inherited service4506/4505, no new violation. Independent extraction30/30 native0,349.30ms from owning package; first wrong-cwd invocation found no test files and is not accepted test evidence.
- Outcome: Partial; Core production build36344, extension check84206/full suite24092 active. All product source frozen during these gates.
- Follow-up: release onboarding and Runtime workers only after Core build; preserve extraction freeze through remaining extension build/audit. Continue read-only investigations and durable checkpoints meanwhile.

### Sensitive-store authorization supervisor scope
- Own Core live-views/database-manager.tsx and live-views/tests/database-manager-authorization.test.tsx only, after current Core build finishes.
- Reproduce duplicate authorization activation, deferred success after modal close/store change, refusal/rejection feedback and credential reuse between stores.
- Add synchronous submission lock plus modal/store/API/unmount completion fencing; disable submitted fields, preserve retryable current credentials on refusal, clear them on close or scope change, and show a local fixed safe failure message.
- Cancel remains available to dismiss the UI and discard late completion; it does not claim to revoke a server grant. Validate successful grant shape/expiry before accepting it.
- Existing runtime/security/grant contracts unchanged; synthetic data only. Focused tests and strict typecheck first; broader gates after workers freeze.

### 2026-10-01 - Core gates passed; next disjoint implementation released
- Agent: supervisor
- Changed: exact strict fixes checkpoint445e12d9; paired Core Current State updated; onboarding and Runtime implementation released, supervisor database authorization scope begins.
- Validation: corrected production build36344 native0,17pages,120426ms; corrected types and only inherited structure failure recorded above. Worker corrected focused55/66 passed and diffs reviewed.
- Outcome: Complete for second Core batch, Active for next roadmap phase. No merge/push; source mutations restricted to written disjoint briefs.
- Follow-up: extension full suite24092/build44384/audit69034 remain active on frozen extraction source. Continue Core implementation and read-only extension navigation audit; broader Core checks after coordinated freeze.

### 2026-10-01 - Extraction full gates and database reproduction
- Agent: supervisor
- Changed: extraction architecture/lifecycle evidence recorded; Database Manager focused auth fixes underway.
- Validation: extension full24092 native0,1716/1716 tests,112847.14ms; check84206 native0,34506ms; Chrome/Firefox/e2e build44384 native0,22files each,14430ms. Audit69034 has only stale generated working index following current documentation changes; regenerate through owner and rerun. Database original corrected-harness reproduction6/6 failed native1; first harness-only StatusText window.dispatchEvent failure excluded from evidence.
- Outcome: Extraction functional gates pass; final documentation audit/checkpoint pending. Database source corrections active alongside disjoint onboarding/Runtime workers.
- Follow-up: preserve tested extraction source, regenerate index and audit, then checkpoint exact seven source/test files plus frozen reports. No live/browser claims or Claude source changes.

### Extension stable strip and keyboard worker brief
- Worker: wait_gaps; downstream t224 only. Read Current State and reports/extension-navigation-audit.md.
- Exact ownership: panel/automations/automation-strip.ts, panel/automations/tests/automation-strip.test.ts (new), panel/shell/top-bar.ts, panel/shell/tests/top-bar.test.ts (new), all under apps/extension/src.
- Preserve export/notice controls for stable flow/run/dataset/format identities; update handlers and pending state without detaching controls. Removed focused controls choose a visible neighbor/fallback only when this surface owns focus; unrelated focus untouched.
- Plain tab arrows/Home/End continue working; modified/composing/229 events must remain unconsumed. Native Enter/Space activation stays intact.
- Keep local per-test focus/event modeling inside the two tests. No shared harness, shell mounting, chat, extraction, background/Core, contracts/styles or shared docs edits.
- Reproduce meaningful identity/focus/keyboard cases before implementation, then focused heavy checks/types; freeze exact files and own reports/extension-strip-keyboard-implementation.md. No broad/live/provider/panel commands or commits.
- Next shell/Latest Back/rename handoffs remain serial follow-on work with separate briefs.

### 2026-10-01 - Extraction checkpoint and database scoped authorization
- Agent: supervisor
- Changed: downstream extraction checkpointc96f5f78 after full1716/types/build/audit; Core database authorization source and14 owning regressions, API-domain grants/record reset included.
- Why: a prior-scope accepted grant must not unlock the new UI, and a dismissed or replaced operation must not complete into it.
- Validation: extraction final full structure native0,136warnings/119baseline after generated index regeneration. Database final focused16/16 native0,7.29s; earlier scoped types82642 native0, final scope changes awaiting types. Core onboarding worker restores existing3 GetStarted regressions before claiming final suite; Runtime display-owner review correction pending.
- Outcome: Extraction Complete; Database focused verified/broad pending; onboarding/Runtime still active and file-partitioned.
- Follow-up: coordinated Core freeze and independently reviewed narrow tests/types/full suite/build; continue extension strip/keyboard worker. Preserve original five-task t221 handoff and Claude integration ownership.

### Sign-in destination read-only worker brief
- Worker: trace_endings; paired t224 Core. Read Current State; locate AuthShell login/setup panels, domain login and program route gating/ProgramLauncher with rg.
- Audit preservation of requested local path/query/domain/deep link through password, PIN/TOTP and credential setup flows. Include optional recent-history storage failure interrupting launcher navigation.
- Propose validated local return-path handling without open redirects or backend auth/session contract changes, exact independent source/test ownership and meaningful regressions.
- Own reports/auth-navigation-audit.md only. Core product/tests remain frozen during supervisor third-batch gates. No broad/heavy/live/provider/panel commands or shared docs/commits.

### Operational freshness read-only worker brief
- Worker: lab_bookkeeping; paired t224 Core. Read Current State; inspect only live-views/{compute-control.tsx,background-tasks.tsx,production-runner.tsx} and owning tests plus existing frontend polling/visibility utilities where directly referenced.
- Confirm where mount-only snapshots plus local clocks misrepresent current state. Propose bounded visibility-aware refresh, stale/error/time feedback and selection/async guards with exact independent paths and tests.
- No backend/runtime/storage/contract changes or global unconditional polling. Own reports/operational-freshness-audit.md only; product/tests frozen during third-batch gates. No heavy/live/provider/panel/shared docs/commits.

### 2026-10-01 - Third Core batch independently reviewed and frozen
- Agent: supervisor
- Changed: onboarding original tests restored and independently inspected; Runtime owner-display correction reviewed; database final scoped types62070 passed.
- Validation: combined supervisor69171 exit0,9files/82tests,8.86s (48onboarding,18Runtime,16Database). Core third-batch check38949/full suite30596/audit34979 active on frozen source.
- Outcome: Partial pending broad gates/build. Extension strip worker corrects missing document.hasFocus guard before broader checks.
- Follow-up: workers audit sign-in navigation and operational freshness read-only while Core gates run; root prepares clipboard design. Continue all roadmap phases, no batch stop or Claude interference.

### Clipboard feedback supervisor design (held during Core gates)
- Existing two consumers are Secret Keys revealed value and Identity Access manual TOTP key; shared copyText returns void and discards the clipboard promise, allowing false Copied feedback.
- Next exact proposed ownership: components/controls/ClipboardButton.tsx (new), controls/index.ts, controls/tests/ClipboardButton.test.tsx (new), live-views/{shared.tsx,secret-keys.tsx,identity-access.tsx}, and an owning secret-copy consumer test if required.
- Move clipboard control responsibility into a reusable component, then remove the old helper after both consumers migrate. Pending lock, acknowledged success, safe manual-copy fallback, value/scope/unmount fencing; no private-value logs or durable copies.
- Validate denied/missing clipboard, deferred failure/success, duplicate activation, value replacement and unmount with synthetic data. Preserve reveal expiry and TOTP ownership; backend/secret operations remain separate.
- Source mutations held until current Core suite and corrected type/build gates finish. Do not copy generic behavior into a live-view catch-all.

### 2026-10-01 - Third-batch strict issues and extension focused verification
- Agent: supervisor
- Validation: Core typecheck38949 failed only Runtime test helper string/ElementType; audit34979 reports inherited service4506/4505 plus Studio Session test hook import bypassing barrel. Exact test corrections prepared but held until full web30596 completes. No config/assertion/baseline relaxation.
- Extension supervisor reviewed stable controls/IME guards, requested missing document.hasFocus correction, and independently ran final11/11 native0,261.79ms. Extension check94250/full suite31774 active on frozen source.
- Outcome: Partial; all new strict issues will be corrected before build/checkpoints. Source review and worker read-only auth/freshness audits continue during gates.

### Initial sign-in navigation implementation brief (held until corrected Core build)
- Worker: trace_endings; paired t224 Core. Read Current State and reports/auth-navigation-audit.md.
- Own app/AuthShell.tsx, app/auth-navigation/{localAuthDestination.ts,index.ts,tests/localAuthDestination.test.ts} (new), existing app/tests/AuthShell.test.tsx, and app/{get-started,programs/[programId],programs/automation-studio}/page.tsx plus each route's tests/page.test.tsx (new).
- Preserve actual current local requested path/query/hash through password/TOTP and first credential replacement. Validate local same-origin destination, reject authority/backslash/control/ambiguous encoded leading separators; never obey arbitrary returnTo query as redirect authority.
- Replace three unauthenticated root redirects with existing inline LoginPanel gates, preserving authenticated domain/program validation and loading. Fence late login/setup replies after unmount or actual route/query change.
- Preserve all existing login/setup assertions/API bodies/factor requirements. No backend/API/lib-auth/session recovery/privileged PIN/storage/theme/legacy alias/ProgramLauncher or shared docs changes in this brief.
- Tests: scoped routes/deep links, retries/TOTP/setup, unsafe destinations, stale completion, no loaders before login, authenticated route behavior. Focused+scoped types via heavy then freeze; own reports/auth-navigation-implementation.md. No broad/live/provider/commits.
- Optional recents and legacy alias are separate subsequent supervisor units after this source freezes.

### Operational refresh foundation and Compute implementation brief (held until corrected Core build)
- Worker: lab_bookkeeping; paired t224 Core. Read Current State and reports/operational-freshness-audit.md.
- Own programs/operational-refresh/{useOperationalSnapshot.ts,OperationalFreshness.tsx,index.ts,tests/useOperationalSnapshot.test.tsx} (new), live-views/compute-control.tsx, live-views/tests/compute-freshness.test.tsx (new), and existing compute-selection.test.tsx only for realistic timer/document harness adaptation.
- Implement program-mounted generic owner-scoped read hook: visible reads10s after completion, single in-flight automatic read/coalesced manual/resume, hidden pause/read abort, one immediate resume, failure20/40/60s backoff,403 auto pause/manual recovery, last-success/loading/error/stale-after30s feedback; no mutation/retry loop inside API read.
- Stable public hook contract supports optional local display clock cadence and payload validation; no unconditional root poll. Fixed safe UI feedback and render/request/captured-callback owner fences. Retain good data on transient failure.
- Compute adopts hook preserving pure heartbeat thresholds and visible selection/activity; identify heartbeat status as sampled estimate while stale/paused. No focus jumps or server health changes.
- Tests: timers/visibility/backoff/coalescing/races/unmount/API changes, fresh server heartbeat beyond300s, filtered selection and failures. Preserve existing coverage/expectations; scoped types then freeze, own reports/operational-refresh-implementation.md.
- Background and Production adapters are held for later separate briefs; no changes there, shared time math, backend/runtime/storage/contracts/styles/metadata or shared docs. No broad/live/provider/commits.

### 2026-10-01 - Third full web suite and durable database checkpoint
- Agent: supervisor
- Validation: full Core30596 native0,300files/1852tests,133.01s before test typing/import corrections. Database final scoped types62070 native0; checkpointd5c979a6 includes source,14 regressions and current-system paragraph. Extension check94250 passed61228ms; full31774 still active.
- Outcome: Third Core functional suite passed; strict test corrections and final type/build/audit remain. Next auth/freshness briefs written and held.
- Follow-up: review and verify exact test corrections, corrected typecheck and build, then release next file partitions; preserve source freeze and continue clipboard scoping independently.

### Extension explicit navigation focus worker brief (held until strip suite completes)
- Worker: wait_gaps; downstream t224 only. Read Current State and frozen extension-navigation-audit.md.
- Own panel/shell/mount-panel.ts, panel/shell/tests/mount-panel-navigation.test.ts (new), panel/chat/chat-panel.ts, panel/chat/tests/navigation-focus.test.ts (new), under apps/extension/src only.
- Explicit focused automation row activation opens its target then shows Chat then focuses visible enabled composer; if unavailable use the selected visible Chat tab. Latest Back hands focus to visible enabled composer or an explicitly labelled chat container fallback.
- Handoff occurs only for user activation whose source owned focus in active visible extension document. General draws/reconnect/programmatic open/late responses never claim focus; browser-page focus remains free.
- Keep local focus/event modeling within tests, existing chat generation/history/draft/scroll behavior intact. No shared harness, controllers/composer/context-line/top-bar/strip/extraction/background/Core/contracts/styles/shared docs edits.
- Reproduce and test target/show/focus ordering, disabled/hidden destinations, unfocused document, external focus and stale replies. Focused heavy/type checks then freeze, own reports/extension-navigation-focus-implementation.md; no broad/live/provider/panel/commits.

### 2026-10-01 - Corrected third types/audits and strip build
- Agent: supervisor
- Validation: Core corrected typecheck69624 native0,14708ms; corrected full audit84320 only inherited service4506/4505. Onboarding corrected48 and Runtime corrected18 focused pass; exact changes reviewed. Core production build now running on frozen source.
- Extension final strip11 independently pass; check94250 native0,61228ms; build74032 native0,22files each,16403ms; audit98215 native0,136warnings/119baseline. Full31774 remains active.
- Outcome: Partial pending Core build and extension full completion/checkpoints.
- Follow-up: auth/freshness/navigation focus briefs remain held until owning gates complete; source mutations restricted to exact released paths.

### 2026-10-01 - Strip whole-suite integration failure
- Agent: supervisor
- Validation: full extension31774 native1,1727tests/1719pass/8fail,116142.45ms. Focused strip11, types/build/audit passed; full failure is not waived.
- Root source search identifies exactly8 existing automation-tab cases mounting an unshown strip whose new draw inspects ownerDocument before hidden early return. Worker reproduces this seam and may restore the owned strip's lazy hidden short-circuit; no shared fake-only fallback or assertion relaxation.
- Outcome: Partial; navigation focus implementation held. Core build9733 remains active on frozen Core source.
- Follow-up: verify exact failure/ordering correction with old row tests plus new strip/key tests, then rerun full extension gate and relevant final checks.

### 2026-10-01 - Third Core batch checkpointed; fourth batch released
- Agent: supervisor
- Validation: final production9733 native0,17pages,101959ms. Original full1852/corrected strict gates and inherited-only audit recorded above; no new violations or relaxed limits.
- Checkpoints: onboarding1a5afc47, Runtime d011b0ae, databased5c979a6. Auth and operational-refresh/Compute written briefs released; root clipboard exact planned scope released. No merge/push; Claude owns integration.
- Follow-up: focused fourth-batch checks then coordinated freeze. Extension worker captures exact full-suite failures before approved hidden-strip ordering correction; no navigation handoff until verified.

### 2026-10-01 - Exact strip regression corrected; clipboard reproduction
- Agent: supervisor and workers
- Root cause: full runner diagnosis reproduces8 automation-tab failures; first throw is exports.querySelectorAll on unshown strip before early return, rather than ownerDocument as first suspected. Restore unshown short-circuit before DOM/focus work; shown-strip ownership guard remains intact. No fake-only fallback/shared harness or assertion changes.
- Validation: worker related21/21/scoped types0; supervisor independently21/21 native0,256.66ms. Corrected extension full/types/build active with full log captured under TEMP for diagnosable failures.
- Clipboard: original real SecretKeys consumer3fail/1pass reproduced native1; corrected first4 pass; expiry still closes reveal. Shared responsibility now in focused ClipboardButton, both secret/TOTP consumers migrated and old void helper removed. Root adds component lifecycle/denial tests before freeze.
- Outcome: Partial pending corrected extension full gates and fourth Core batch checks. New auth/freshness workers remain exact scoped; no runtime/backend changes or live/provider calls.

### 2026-10-01 - Strip broad verification complete; fourth-batch review continues
- Agent: supervisor
- Validation: corrected extension42032 native0,1727/1727,111140.3163ms; corrected types41792 native0,19626ms; corrected build5348 native0,15486ms,22files each Chrome/Firefox/e2e. Final full structure passed136warnings/119baseline; no new baseline entries. Exact strip source reviewed again after hidden-return correction.
- Outcome: Strip Complete; explicit navigation focus brief released after local checkpoint. Clipboard22 focused pass; corrected scoped12321 native0 after test-only act callback fix. Auth/refresh additional route-scope and pre-read cancellation review remains active; broader Core gates await refreeze.
- Follow-up: preserve original Claude task handoff, keep all edits in paired t224, no merge/push or live operations. Record independent verification before accepting worker completion.

## Open Questions

- Browser visual validation awaits authorization for panel/browser management.
- Larger redesigns remain recommendations until user preference and observed defects justify scope.

### 2026-09-30 - Scoped follow-ups verified; final checks running
- Agent: supervisor and fixture worker
- Changed: Core composer edit-revision guard and four owning regressions; contract fixture uses published provider token defaults. Runtime code, scripted responses, assertions and other budgets unchanged.
- Why: preserve newer Core chat drafts and align the test fixture with the current public context window.
- Validation: supervisor reproduced two composer failures (2fail/8pass), then observed corrected10/10 exit0. Inspected worker raw contract completion60/60 exit0 and exact fixture diff. git diff --check0.
- Outcome: Partial
- Follow-up: root full web tests session98054 and web typecheck62339; source frozen. Production build and final documentation checks follow. Initial checkpoints Coree6eb33f2/downstream21e915ee remain recoverable. Claude integration ownership unchanged.


Final documentation verification: supervisor session68649 exit0, docs-links and working-docs passed (0warnings/2baselined); paired Core session48994 passed (0warnings/16baselined). Final records/index checkpointed locally; no merge or push.
