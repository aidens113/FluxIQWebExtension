# Core and extension UI/UX review

Status: Active
Status detail: Current-source review underway; improvements will be prioritized by task completion and clarity.
Created: 2026-09-30
Last updated: 2026-09-30
Owner: Codex senior supervisor
Scope: All Core web panels and the extension, focusing on user journeys, accessible controls, feedback and recovery.
Paired document: none yet; Core discovery reports live alongside this plan.
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
is queued for a shared heavy slot; no Claude slot is changed to accelerate it.
Next: observe that suite and commit the initial fixes with final reports.
The rest of the roadmap remains explicitly queued.

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

### Phase 1 — Protect work and restore interrupted requests (active)

1. Mount a single authenticated Core reauthentication host at root. Remove the
   duplicate topbar composition. Check pending recovery on mount and settle it
   when the host unmounts; do not discard workspace state or repeat mutations.
2. Preserve newer chat/settings drafts with revision-bound completion. Normal
   unchanged success clears the submitted draft; failure preserves it.
3. Run component regressions, web/extension type checks and affected full suites.
   Review final source independently before committing locally for Claude.

### Phase 2 — Complete creation and review journeys (queued)

1. Thread existing openAdaptation navigation from the Steps connector through
   FlowEditorView/start pane into both authoring panels. Add a durable visible
   Review suggested change action; never apply the proposal automatically.
2. Make first-run setup discoverable in the directory. Consume each validated
   onboarding start intent after Studio initialization, with safe fallback and
   back/refresh behavior, or emit only already-supported destinations.
3. For each creation/improvement path, test returned proposal navigation,
   unsuccessful generation, missing prerequisites and preserved user input.

### Phase 3 — Honest diagnostics and reliable operations (queued)

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

### Phase 4 — Accessible navigation and questions (queued)

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

## Open Questions

- Browser visual validation awaits authorization for panel/browser management.
- Larger redesigns remain recommendations until user preference and observed defects justify scope.
