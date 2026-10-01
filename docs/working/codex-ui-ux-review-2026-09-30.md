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
