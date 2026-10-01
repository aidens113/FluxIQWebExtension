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

Continuous execution is active in paired isolated task t224 worktrees. All three
worker slots are assigned. Claude owns integration: no dev/main merge or push,
protected runtime/storage/conversation/context-packet edits, panel management,
Lab/browser/provider operations or actual private data inspection.

Seventh Core Complete: local source checkpoint e75c6fcc, gates/progress a992f6d8.
Extension utility and seventh reports checkpoint151fbd2e. Supervisor focused
12files150tests/native0/9.43s; full68081 native0,325files2199tests/185.26s;
types72364 native0/92993ms; production76550 native0,17pages/202949ms.
Structure65986 native1 solely inherited protected service4506/4505. No baseline
or config relaxation. Production parameters, Deployment and Docs recovery are
implemented, independently reviewed and covered by these gates.

Eighth Core Complete: source checkpoint fe0165c7. Identity, Secret and Docs tree
independently reviewed; root16files182tests/native0/12.31s. Full36851 observed
333files2342tests/native0/173.54s; types59270 native0/35422ms; production8087
native0/190162ms. Structure56016 native1 solely inherited protected
service4506/4505. No baseline/config relaxation. Root owns shared contracts,
authored docs and verification; later active units are recorded below.

Extension utility Complete: Open/report/Activity four-suite41 pass/native0/
604.5906ms. Full types5771 native0/51888ms; structure37957 native0,136warnings/
119baseline. Full28915 native0,1821tests/113849.9263ms; build18201 native0,
22files per Chrome/Firefox/e2e target/12269ms. Earlier
sixth recording/settings/Start/paused fixes pass full1791/types/build/structure.
Current utility controls preserve protocol/redaction ownership; no browser
certification is claimed. Root export/status six-path unit Complete, checkpoint
e14e935a:
export18/status13 and six-root strict1135 pass. Full50040 native0,1833tests/
114224.7451ms; types90037/build15517/structure66791 all native0. Controller
Core-address ownership is now the separately released worker unit; broader Chat
target ownership remains audit backlog and is not claimed fixed.

Original Claude workload remains complete: t216/t217/t219/t220/t221 were locally
verified/checkpointed; t221 handoff de2096b1 records exact commits and validation.
Its file is docs/working/language-driven-flow-loop-plan/reports/codex-supervisor-handoff.md
in t221. Main downstream checkout is untouched and read-only status clean at the
latest check. Keep progress/report/checkpoint records as work happens and continue
beyond batches; remaining UI/UX and other useful nonconflicting work is authorized.

Ninth Complete: Core9d2eb6fa operational/onboarding and e50a6882 dialogs; root
105/91/88 tests independently passed. Full22516 native0,338files2506tests/
182.57s; types74206 native0/103169ms; build84386 native0/201922ms. Structure
55934 native1 only inherited protected service4506/4505. Downstream924903b8
automation/controller; root66/scoped9roots0 and controller43/scoped0. Full3272
native0,1878tests/113717.0744ms; types44714 native0/27723ms; build60493
native0/22files each/27527ms; structure27824 native0/136warnings119baseline.
Three next slots are released: Menu two paths, mounted Chat eight and extraction
draft/control four. Root ninth-supervisor-verification.md preserves original
failures, refinements and exact full gates; no browser certification.

Tenth Active: extraction draft/control frozen and independently verified66/66,
native0/654.7189ms, strict four-root typing0. Core database semantic refinement
passes existing three suites25/native0/8.70s. Menu frozen pending root130-test
verification; mounted Chat remains active. All slots assigned: Chat source,
extraction read recovery planning and shared overlay executable planning.
[Tenth verification](./codex-ui-ux-review-2026-09-30/reports/tenth-supervisor-verification.md)
records limits; [shell working owner audit](./codex-ui-ux-review-2026-09-30/reports/shell-working-owner-audit.md)
is read-only backlog. Broad gates follow owning source freeze; no Claude integration.

Earlier batch evidence stays in the ledger, worker reports and first-four archive.
[Superseded Current State](./codex-ui-ux-review-2026-09-30/archive/2026-10-01-pre-eighth-current-state.md)
retains the prior detailed continuation record.

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

## Archived coordination history

Initial briefs and settled validation details moved to [the first-four-batch archive](./codex-ui-ux-review-2026-09-30/archive/2026-10-01-first-four-ui-batches.md).

## Active and next worker briefs

### Database table labelling supervisor brief (released)
- Core exact source: features/programs/live-views/database-manager.tsx only; root inspected rendered grid and unchanged own tests. Menu worker owns separate primitive paths.
- Name the native records table with the current store/database context and explicit column header scope. Preserve all request/grant/search/selection/row/value behavior. No new label-mirroring test for this reversible low-impact semantic change; run existing owning database contracts/recovery/authorization tests.
- Root records code diff/check results in parent ledger and validates with next coordinated Core gates after Menu freezes. No shared component/record/data backend/API/protected/source-test assertion change, live/browser/provider/panel/private inspection.

### Menu keyboard and disabled activation implementation brief (released)
- Worker: deployment_docs_audit; paired t224 Core. Ninth338files2506tests/types/build independently pass; structure only inherited protectedservice. Finish own environment read-only report first, then execute frozen Menu plan.
- Exact two paths: features/programs/components/controls/Menu.tsx and NEW controls/tests/Menu-keyboard.test.tsx; own menu-keyboard-recovery-implementation.md. Environment/Modal/Link/router/helpers/styles/source assertions stay unchanged.
- Disabled href options may render aria-disabled non-link menuitems; enabled Next Link/native routing stays unchanged. Eligibility excludes hidden/inert/effectively disabled controls; native composing/modified/defaultPrevented navigation keys remain untouched.
- Implement explicit ArrowDown/Up entry, eligible Arrow/Home/End/roving state, option reconciliation and owner/lifetime/option-instance callbacks. Removed or disabled retained choices do not dispatch; current native Enter/Space acts once. Preserve normal mouse activation.
- Tab closes without preventDefault; when current visible document focus is still owned by this key event, synchronously restore trigger as the native departure point, then suppress cleanup return focus. Never reclaim moved/hidden/unfocused/retired focus. Action/outside/teardown similarly suppress obsolete cleanup return; current Escape may return trigger when appropriate.
- Caller keeps action error presentation; action-owned finally closes its own menu without closing a newly opened/replaced menu or swallowing private exception text. Preserve stack/isolation/scroll and all original assertions; environment focus-policy findings remain separate backlog.
- Actual component tests first, unchanged component contracts/operation/environment/Modal owning gates, actual scoped two roots then freeze. No extra source/shared docs/protected/backend/private/broad/live/browser/provider/panel/commits. Root independently reviews/gates/docs.

### Mounted Chat owner recovery implementation brief (released)
- Worker: runtime_contracts; downstream t224. Read Current State, own frozen design/implementation plan; ninth extension full1878/types/build/structure independently passed.
- Exact eight paths: panel/chat/chat-panel.ts; NEW chat/tests/chat-owner-recovery.test.ts; conversation/{composer.ts,draft-storage.ts}; NEW conversation/tests/{composer-owner.test.ts,draft-storage-owner.test.ts}; NEW chat/owner-context.ts and chat/tests/owner-context.test.ts. Own mounted-chat-owner-recovery-implementation.md.
- Approved private owner/lease helper has one cohesive export; existing directory barrel stays intact. Keep responsibilities/budgets narrow; request exact additional file release if needed.
- Implement written tuple/missing-settings/volatile-context/first-confirmation/A-B-A policy, current-instance request/control leases, coherent latest-target/history/activity reset, active-only subscription/poll/retry and lifetime unsupported capability. Preserve frozen controller/feed/shell/wire/Automations and same-owner names/scroll/caret/focus.
- Explicit parked draft Use draft here/Clear draft, separate atomic versioned UI storage key/literal legacy fallback, matching-owner popup restore and accepted-send owner/edit revisions approved. Never auto-adopt on edit/fill, auto-send/replay, drop newer drafts, expose tokens or pretend issued commands cancelled. Standalone composer/storage behavior stays compatible.
- Actual tests first, then unchanged controller43/composer/keys/feed/Chat/focus/shell tests. Existing assertions/mock harnesses not editable without precise release. Scoped checks during concurrent extraction work are provisional until both freeze; never fix the other worker's files.
- No other source/shared docs/Core/background/protocol/styles/private/browser/provider/panel/broad/commits. Root owns independent review/gates/docs; update own report progressively.

### Extraction draft/control recovery implementation brief (released)
- Worker: recording_controls; downstream t224. Read Current State/frozen extraction draft plan; ninth extension full1878/types/build/structure independently passed.
- Exact four paths: panel/extraction/{panel.ts,field-row.ts}, NEW tests/{field-row.test.ts,panel-draft-recovery.test.ts}; own extraction-draft-recovery-implementation.md. No helper/oldtest/shared-harness edit without precise release.
- Implement E1/E2/E5 raw-name intent with no per-key trim/full redraw; explicit change/Confirm normalization against settled label. Preserve focus/caret through unrelated preview redraw and existing privacy-narrowed values.
- Row/draft epoch+generation leases reject retired same-key callbacks across redraw/cancel/capture/new pick before mutation or requireDraft. Current controls work; failed Confirm preserves intent. Label groups/actions distinguish columns and update on rename; preserve native controls/Remove text/classes/Lab ids.
- Existing dialog-focus/client/view-model/confirm-payload/D12/wire/prepare/start/Cancel semantics untouched. E3/E4 Retry/preview errors and actual session/host ownership remain serial follow-ups; no complete cross-owner extraction claim.
- Actual tests first, unchanged panel/dialog-focus/preview/confirm/view-model tests, scoped four roots then freeze. Chat is another worker's source; dependency checks provisional until coordinated freeze, never edit other paths.
- No shared docs/extra source/Core/background/protocol/styles/private page data/broad/live/browser/provider/panel/commits; update report progressively. Root owns review/full gates/docs.

### Shared environment focus-policy follow-up audit (read-only released)
- Worker: deployment_docs_audit; paired t224 Core source frozen for ninth gates. Menu plan complete/held.
- Read Current State, shared-overlay-focus-audit F4/F5/F8 and features/programs/overlay-environment.ts plus direct helpers/owning tests and acquireOverlayEnvironment consumers as required to trace actual ordering.
- Own downstream reports/overlay-environment-recovery-plan.md only. Propose exact source/test partition for hidden/disabled/fieldset candidates, Escape IME/defaultPrevented, current visible-document return focus, nested release and conditional new body siblings. Discover actual consumer before claiming F8 product defect.
- Preserve stack/isolation/scroll/bookkeeping and frozen Modal/Menu. No blanket observer/global focus reclaim/auth changes; distinguish source/synthetic evidence from browser limits.
- No source/tests/shared docs/heavy/broad/live/provider/panel/private/commits. Menu implementation waits for explicit release after Core full/types/build observed.

### Mounted Chat owner implementation planning brief (product held)
- Worker: runtime_contracts; downstream t224. Read Current State and frozen mounted-chat-owner-recovery-plan.md. Prepare own reports/mounted-chat-owner-recovery-implementation.md; product/tests held through ninth extension full gates.
- Proposed six exact source/test paths from frozen plan: chat-panel.ts/new chat-owner-recovery.test.ts, conversation/composer.ts/new composer-owner.test.ts, conversation/draft-storage.ts/new draft-storage-owner.test.ts. Do not modify frozen controller/feed/shell/protocol/Automations or existing assertions.
- Preserve source owner tuple/missing settings/volatile reconnect distinctions, current-instance request/UI leases, coherent latest-target reset before shell notifications, active-only reads and lifetime unsupported capability. Confirmed owner change parks existing draft for explicit Use draft here/Clear draft; edit/fill alone never adopts or sends it. Same-owner popup restore must avoid repeated review.
- Atomically version a separate local UI draft key with non-secret owner metadata; legacy key is literal unowned text, including JSON-looking text. Accepted old sends remain accepted and cannot clear newer-owner/edit revisions or locks. Preserve original standalone composer/storage APIs; no durable project/history/policy/recording ownership, wire/auth changes or actual storage inspection.
- Inspect module budget and define exactly whether focused chat/owner-context.ts +own test+barrel is needed before release. Do not improvise extra paths. Tests-first source cases/no tests written during hold; current draft/focus/scroll/native shortcuts and held work remain intact.
- No shared docs/source/tests/heavy/broad/live/provider/panel/private data/commits while held. Supervisor releases concrete paths after gates and plan review.

### Extraction draft/control implementation planning brief (product held)
- Worker: recording_controls; downstream t224. Read Current State and frozen extraction-keyboard-recovery-audit E1/E2/E5.
- Plan exact panel/extraction/{panel.ts,field-row.ts}, new owning tests/{field-row.test.ts,panel-draft-recovery.test.ts}; own reports/extraction-draft-recovery-implementation.md only during ninth extension gates. Existing test/harness edits need exact evidence/release; no helpers/wire/session schema/dialog-focus/privacy/client changes.
- Commit raw column input intent without triggering full redraw/trim per keystroke; explicit commit normalizes as currently expected. Preview/redraw must preserve still-focused typed value/caret. Draft/row instance leases reject retired same-key callbacks across redraw/cancel/capture/new pick before requireDraft/current mutation.
- Give column groups/actions distinguishable accessible names that update on rename; preserve classes/Lab ids/Remove visible text/native controls. All D12 preview narrowing and Confirm/Cancel/session compatibility remain intact.
- Write tests-first actual delayed-redraw/retained handler/normalization/privacy/accessibility plan; source/tests HELD until extension gates complete. Stage-aware read/preview Retry and actual session/host lifetime are separate serial follow-ups, not covered by this unit.
- No source/tests/shared docs/heavy/broad/live/provider/panel/private page values/commits while held. Root releases exact source after review.

### Menu keyboard/disabled activation implementation planning brief (product held)
- Worker: deployment_docs_audit; paired t224 Core. Dialog four paths frozen. Read Current State, shared-overlay-focus-audit F6/F7 and existing controls/Menu.tsx plus owning component/environment tests/helpers.
- Proposed exact controls/Menu.tsx and NEW controls/tests/Menu-keyboard.test.tsx only. Own downstream reports/menu-keyboard-recovery-implementation.md during ninth Core gates; all Core source/tests HELD.
- Plan disabled href/button consistency, eligible keyboard entry/Arrow/Home/End/native shortcuts/IME, explicit Tab exit without reclaiming moved focus, current removed/disabled option callbacks and action-owned close behavior. Preserve existing route/Link semantics and environment stack; do not change overlay-environment/Modal/source styles/helpers without exact separately reviewed evidence.
- Trap/return/Escape/global newly mounted body-root findings remain separate backlog; no claim Menu-only fixes them. Test actual Menu and synthetic focused portal boundaries, original component contracts unchanged.
- Write exact policy/tests-first plan while held; no source/tests/shared docs/heavy/broad/live/provider/panel/private/commits. Release follows independently observed Core gates.

### Extension extraction keyboard and recovery audit brief (read-only released)
- Worker: recording_controls; downstream t224. Automation exact nine paths remain frozen for independent root review/gates.
- Read Current State and panel/extraction/{panel.ts,panel-elements.ts,dialog-focus.ts,field-row.ts,preview.ts,preview-table.ts,confirm-payload.ts}; directly owning tests/client/view-model only as required to trace claims.
- Audit meaningful user journeys: keyboard pick/confirm/cancel, disabled/busy errors, field labels/validation, selection/draft preservation through preview/DOM redraw, lifecycle/old callbacks and clear recoverable feedback. Preserve already verified extraction dialog isolation/browser-page focus behavior and Core ownership/wire schema.
- Own downstream reports/extraction-keyboard-recovery-audit.md ONLY. No source/tests/shared docs/private state/actual page recordings/provider/live/browser/panel/commits or broad gates. Record concrete source defects, exact next candidate file partitions and test-first cases; distinguish browser hypotheses. UI protocol changes need later explicit synchronized brief, not this audit.

### Confirmation keyboard and dialog entry implementation brief (released)
- Worker: deployment_docs_audit; paired t224 Core. Read Current State and frozen shared-overlay-focus-audit F1/F2/F3; operational twelve paths remain frozen.
- Own features/programs/components/overlays/{Modal.tsx,ModalContent.tsx}, NEW owning tests/{Modal-keyboard.test.tsx,ModalContent-focus.test.tsx}; own downstream reports/dialog-keyboard-recovery-implementation.md.
- Reproduce actual Cancel/Close/native control Enter misactivation and marked-input initial focus before fixes. Scope quick-submit to eligible current editable text inputs; native buttons/links/select/checkbox/radio/textarea/contenteditable, nested/portal targets, defaultPrevented/modifiers/composition must keep native behavior. Reject inherited busy/current inactive overlay and hidden/inert/disabled targets; preserve existing authorization/OperationGate contracts and text/password quick-submit when appropriate.
- Initial entry honors eligible explicit data-autofocus/autofocus before ordinary inputs and then buttons/panel. Use actual candidate eligibility, including hidden/inert ancestors and disabled fieldsets. Preserve environment acquisition/stack/return/trap behavior; no global environment/Menu/auth/Alert source/helper/style change without separate release.
- Tests use actual Modal/ModalContent/wrappers and bounded synthetic document/portal fixtures. Preserve original overlay-hardening and authorization tests. Narrow heavy and actual-config scoped four roots; freeze exact source before root independent review/full gates.
- No shared docs/protected/runtime/backend/private/live/browser/provider/panel/commits. Broad trap/return/menu follow-up remains separately queued; do not claim browser/IME/assistive-technology certification.

### Mounted Chat owner recovery design brief (read-only released)
- Worker: runtime_contracts; downstream t224 source read-only. Onboarding eight paths remain frozen for root verification.
- Read Current State, root chat-owner-recovery-audit.md and chat/{chat-panel.ts,conversation/controller.ts,conversation/composer.ts}, feed/activity-feed.ts, shell/mount-panel.ts, shared/protocol.ts consumed ExtensionStatus only; directly owning tests/helpers as necessary.
- Root's controller recovery is frozen after43focused/strict0; preserve it. Plan confirmed gateway/Core/client/project/pairing owner masking, retained callback leases, pending operation ownership, feed/history resets and coalesced active refresh. Missing optional settings preserves confirmed Core address; reconnect/volatile state must not reset same owner.
- Drafts and accepted sends need explicit ownership policy preserving newer edit revisions. Preserve same-owner passive names/focus/scroll, quiet read retries, current accepted command destination and background wire. Never claim cancellation/authorization of an already dispatched command.
- Own downstream reports/mounted-chat-owner-recovery-plan.md ONLY. No source/tests/shared docs edits, broad/live/browser/provider/panel/private data/commits. Return exact nonoverlapping candidate paths and meaningful tests-first sequence, documenting constraints before later release.

### Shared overlay keyboard and focus audit brief (read-only released)
- Worker: deployment_docs_audit; paired t224 Core, source read-only.
- Read parent Current State and features/programs/components/overlays/{Modal.tsx,ModalContent.tsx,AlertDialog.tsx,AuthorizationDialog.tsx}, controls/Menu.tsx, plus their directly owning tests and imported overlay helpers only.
- Trace actual keyboard entry/trap/escape/return-focus behavior, nested/busy overlays and retained callbacks/unmount; identify reproducible defects and preserve already verified authorization/OperationGate contracts.
- Own downstream reports/shared-overlay-focus-audit.md only. No product/test/shared docs edits, broad gates, live/browser/panel/provider/private data/commits. Report exact candidate file partition and meaningful test-first cases; distinguish source evidence from browser hypotheses.
- Existing operational twelve paths stay frozen for root review; this is the next independent audit while onboarding is active.

### Conversation controller recovery supervisor brief (released)
- Repository: downstream t224. Read Current State, chat-owner-recovery-audit and owning controller/target/composer tests.
- Own chat/conversation/controller.ts and new chat/conversation/tests/controller-recovery.test.ts only under panel; own chat-owner-recovery-audit report.
- Reproduce defensive injected-request failures, obsolete answer callbacks/completions and disconnect read publication. Catch fixed exceptions without exposing contents, retain PanelResult feedback/quiet retries and accepted send target-switch behavior.
- Fence answers to currently confirmed pending asks and generation/operation-owned completion; old answer must not release a new same-ID operation. Connection changes invalidate old reads; offline takes precedence over fallback.
- Preserve original assertions, same-owner names/drafts/scroll, wire/relay/feed/shell/composer interfaces. Broader Core/project Chat owner observation remains separately scoped backlog, not fixed by this unit.
- Narrow own/controller/target/composer tests and actual scoped types before freeze; root docs/full gates wait for extension worker freeze. No live/provider/panel/private data/protected Core edits.

### Extension explicit navigation focus worker brief (complete)
- Worker: wait_gaps; downstream t224 only. Read Current State and frozen extension-navigation-audit.md.
- Own panel/shell/mount-panel.ts, panel/shell/tests/mount-panel-navigation.test.ts (new), panel/chat/chat-panel.ts, panel/chat/tests/navigation-focus.test.ts (new), under apps/extension/src only.
- Explicit focused automation row activation opens its target then shows Chat then focuses visible enabled composer; if unavailable use the selected visible Chat tab. Latest Back hands focus to visible enabled composer or an explicitly labelled chat container fallback.
- Handoff occurs only for user activation whose source owned focus in active visible extension document. General draws/reconnect/programmatic open/late responses never claim focus; browser-page focus remains free.
- Keep local focus/event modeling within tests, existing chat generation/history/draft/scroll behavior intact. No shared harness, controllers/composer/context-line/top-bar/strip/extraction/background/Core/contracts/styles/shared docs edits.
- Reproduce and test target/show/focus ordering, disabled/hidden destinations, unfocused document, external focus and stale replies. Focused heavy/type checks then freeze, own reports/extension-navigation-focus-implementation.md; no broad/live/provider/panel/commits.

### Background and Production refresh adapter read-only brief
- Worker: lab_bookkeeping; paired t224 Core. Read Current State, own frozen operational-refresh report and current hook public contract.
- Inspect live-views/{background-tasks.tsx,production-runner.tsx} and their directly owning existing tests only. Product source frozen for fourth-batch supervisor gates.
- Propose exact independent adapter/test paths adopting the shared hook while preserving launch drafts, per-run operation locks, selection and existing successful/error states.
- Trace history/detail async owner and request races, replacement snapshot selected-run reconciliation and captured old mutation callbacks. Specify meaningful regressions before implementation.
- Own reports/operational-adapters-audit.md only. No shared docs, source edits, heavy/live/provider/panel/commits; implementation requires later released written brief.

### Legacy launcher navigation read-only brief
- Worker: trace_endings; paired t224 Core. Read Current State and frozen auth-navigation report.
- Inspect app/ProgramLauncher.tsx, existing app/tests/ProgramLauncher.test.tsx, and legacy domains/[domainId]/programs/[programId]/page.tsx plus directly owning tests if present.
- Trace optional recent-storage failures interrupting navigation; legacy alias query preservation for start/flow/subflow/view/detail and repeated query entries. Treat path domainId as authoritative; arbitrary external destination is never accepted.
- Propose exact isolated source/test paths and regression cases preserving original assertions. Server redirects cannot preserve unseen hash; document limits.
- Own reports/legacy-launcher-navigation-audit.md only. Core source frozen during fourth-batch gates; no shared docs, heavy/live/provider/panel/commits. Implementation held for next written release.

### 2026-10-01 - Fourth Core freeze and broad gates
- Agent: supervisor
- Independently reviewed final auth request generation/scope release, local destination validator, inline route gates, hook pre-read cancellation/current-owner callback fence and feedback placement outside Compute grid.
- Combined47326 native0,13files/110tests,9.01s. Clipboard local checkpoint0738bc58; corrected consumer4 tests also native0. Auth69 and refresh19 included in combined run; worker claims independently confirmed.
- Whole Core source frozen. Web check98099 native0,67584ms. Structure75057 reports inherited service4506/4505 plus stale working-doc index; regenerated owning index only, targeted docs-links/working-docs passed0warnings/16baseline. Full10138 and production29706 still running.
- Full suite currently exposes one source-text contract expecting inline AbortController in Compute. Request ownership moved to the shared hook and behavioral cancellation tests pass; inspect complete suite result before updating the owning contract to follow that boundary. No production fallback or relaxed cancellation requirement.
- Workers now read-only audit exact legacy launcher and operational adapter paths. Extension explicit navigation worker alone edits its four downstream files. No cross-tree validation contamination or Claude edits.

### Legacy launcher navigation implementation brief (released)
- Worker: trace_endings; paired t224 Core. Read Current State and frozen legacy-launcher-navigation audit.
- Own app/ProgramLauncher.tsx, existing app/tests/ProgramLauncher.test.tsx, app/domains/[domainId]/programs/[programId]/page.tsx and new directly owning tests/page.test.tsx only.
- Catch only optional recent-history persistence write failures; preserve in-memory recent/dedup/six-entry behavior, exact Link destinations/prefetch and all original3 tests. No preventDefault/router replacement or blocking warning.
- Alias accepts promised searchParams scalar/array values; preserve each supplied value including repeated/empty entries, omit undefined and force one path-owned domainId. Fixed encoded local program destination; external-looking query values remain data. Document unavailable hash and original query byte/inter-key ordering limits.
- Add actual callback continuation/storage getter/quota/retry tests and actual redirect capture tests for deep-link/start keys, repeated values, conflicting domainId and encoded identifiers. No authentication/backend/navigation consumer/recents schema changes.
- Focused/scoped heavy then freeze; own reports/legacy-launcher-navigation-implementation.md. No broad/live/provider/panel/shared docs/commits.

### Background and Production adapter implementation brief (released)
- Worker: lab_bookkeeping; paired t224 Core. Read Current State and frozen operational-adapters-audit.md.
- Own live-views/{background-tasks.tsx,production-runner.tsx}, new tests/{background-freshness.test.tsx,production-freshness.test.tsx}, existing tests/production-runner-operations.test.tsx only. Ask supervisor before responsibility-driven extraction needs extra paths.
- Adopt shared owner-scoped snapshot hook and feedback outside explicit grids; preserve launch parameter defaults/drafts, selected ids/detail/log filters and operation locks. API changes mask previous drafts/data/errors during render, and old callbacks/results/finally never affect new owners.
- Background current selected history page uses independent completion-based10s refresh with query owner task/status/offset/API, limit50; no reads for absent task and no extra history read per snapshot. Guard pagination/filter/search/fallback changes, abort hidden/unmount, clamp shrinking total once, derive selected detail from fresh same-id page object.
- Post-write policy: coalesce requested refresh with pending read, preserve honest separate action acceptance vs last snapshot confirmation; next normal visible read within10s reconciles external state. Do not claim pending pre-write read confirms a mutation, queue extra loops or replay mutations.
- Guard mutation source owner/current target/task/run before POST, synchronous duplicate locks and owner-scoped cleanup. Preserve independent per-run operations and retry/error feedback; aborted reads do not cancel server writes.
- Authorize exactly one Production test update: overlapping manual Refresh expects one coalesced pending read; preserve target/default/post assertions and add newer-owner late-response regression. Keep all other original mutation/draft assertions.
- Test cadence/visibility/backoff/stale/error recovery, selection/history races, external progress, captured old mutations and old finally/new same-id lock. Focused adapters+shared hook/pure tests and scoped types then freeze; own reports/operational-adapters-implementation.md. No backend/runtime/API/contracts/styles/shared docs/broad/live/provider/panel/commits.

### Remaining clipboard consumers supervisor brief (released)
- Exact Core ownership: controls/ClipboardButton.tsx and owning test; data/CodeViewer.tsx and new data/tests/CodeViewer.test.tsx; inspector/InspectorPanel.tsx and new inspector/tests/InspectorPanel.test.tsx; state/StateRawPanel.tsx and new state/tests/StateRawPanel.test.tsx; existing state/tests/StateExplorerView.test.tsx only for truthful moved clipboard contract coverage.
- Extend shared control with explicit accessible label/icon-only presentation while retaining previous secret/TOTP behavior. Migrate source, selected ID and expanded raw JSON clipboard operations to shared pending/ack/failure lifecycle; preserve source download/search/wrap and inspector search/actions.
- Selection/source/value change or raw collapse unmounts/replaces copy ownership. No old acknowledgements, exception contents, unused reset timers or clipboard writes after captured stale activation. Preserve raw lazy serialization and expand/collapse accessibility.
- Reproduce actual missing clipboard, deferred old-selection/collapse acknowledgements and duplicate click cases; test component/consumer behavior with synthetic values. Existing source-only raw status assertion follows new shared ownership with behavioral status verification, never weaken acknowledgement requirement.
- Root owns integration and documentation. No source mutations during fourth gate freeze; no browser/private state/provider calls.

### 2026-10-01 - Fourth source checkpoints and moved cancellation contract
- Agent: supervisor
- Checkpoints: Core9d5e2533 auth11files, e109b226 refresh/Compute7files,0738bc58 clipboard/source/docs9files. No dev merge/push; full gate correction still pending, not reported complete.
- Production29706 native0,17pages/128724ms. Initial full10138 native1,308files/1943tests,1942pass/1source contract failure,156.77s. No product test failures.
- Corrected global-request-contract follows Compute's useOperationalSnapshot ownership and verifies signal pass-through plus shared controller cancellation/generation teardown. Other seven inline-view checks and coordinator assertions preserved. Real hook cancellation/Compute cases rerun with contract:87610 native0,5files/21tests,8.44s.
- Final full21515/types56689 active; source freeze retained. Next exact implementation briefs written/held. Authored current-system captures sign-in and sampled refresh behavior; browser certification remains unperformed.

## Open Questions

- Browser visual validation awaits authorization for panel/browser management.
- Larger redesigns remain recommendations until user preference and observed defects justify scope.

### Extension automation naming read-only worker brief
- Worker: wait_gaps; downstream t224. Read Current State and frozen navigation-focus report.
- Inspect panel/chat/{chat-panel.ts,context-line.ts,chat-target.ts if present}, panel/shell/mount-panel.ts and automations/automation-strip.ts plus directly owning tests only; use rg for actual target-contract file.
- Trace automation rename/removal while its existing Chat conversation is open: title/context/strip consistency without resetting conversation generation, draft, scroll or history. Distinguish source-confirmed defects from visual assumptions.
- Product source frozen during navigation full/types/build gates. Own reports/extension-automation-naming-audit.md only; propose exact next ownership/regressions, no source/shared docs/heavy/live/provider/panel/commits.

### Extension automation naming implementation brief (released)
- Worker: wait_gaps; downstream t224. Read Current State and extension-automation-naming-audit.md; navigation source checkpoint41f3df0b has completed gates.
- Own automations/automation-strip.ts and existing tests/automation-strip.test.ts, chat/chat-panel.ts and existing tests/navigation-focus.test.ts, shell/mount-panel.ts and existing tests/mount-panel-navigation.test.ts only; own reports/extension-automation-naming-implementation.md.
- Strip emits passive current matching-flow name changes after remembering new name/drawing; no duplicate/reentrant emissions. Shell forwards only same-flow metadata to a narrow Chat method. Passive method updates plain-text target/context/empty/placeholder/controller metadata without history/generation/read/draft/selection/scroll/focus changes; explicit open/follow remains unchanged.
- On confirmed complete/empty list missing flow, keep conversation/target/name/draft and disabled Run, show truthful current-list unavailable feedback. Offline/loading/error are not deletion evidence. Returning row clears feedback and refreshes name; never auto-navigate.
- Extend exact local owning models; prove no added requests/scroll/focus/draft loss, old-flow/name/no-op fencing, removal/restoration and keyed export/notice identity. Preserve all existing navigation/stream/strip cases.
- No composer/context-line/controller/target/shared harness/Core/contracts/styles/shared docs edits. Focused/scoped heavy then freeze; no broad/live/provider/panel/commits.

### Runtime log request recovery read-only worker brief
- Worker: trace_endings; paired t224 Core. Read Current State; launcher frozen and supervisor independently14 included in combined59 passed.
- Inspect automation-studio/runtime/RunActionLogView.tsx, run-queries.ts, runtime-host command seam and directly owning run-detail-feedback/runtime-refresh tests only. No protected backend runtime, storage or conversation implementation.
- Trace action/event/list/compact-detail/export rejection and malformed response busy states, captured callbacks across project/run/commands changes, stale render masking and serialization/download cleanup. Existing selected action/event detail fixes must remain.
- Own reports/runtime-log-recovery-audit.md only; propose exact bounded source/test ownership and meaningful regressions. No source/shared docs/heavy/live/provider/panel/commits while adapter source active.

### Database request recovery read-only worker brief
- Worker: lab_bookkeeping; paired t224 Core. Read Current State; adapter42 included in supervisor103 passed, source now frozen during fifth broad gates.
- Inspect live-views/database-manager.tsx, directly referenced frontend owning helpers and existing tests/{database-manager.test.ts,database-manager-authorization.test.tsx} only. Existing authorization scope/expiry/dismissal fixes must remain intact.
- Trace snapshot/metadata/list/get-record rejection, malformed pages, stale render/context/query callbacks and retry/loading feedback. Propose cohesive exact source/test ownership; preserve Core durable storage/security ownership.
- Own reports/database-request-recovery-audit.md only. No backend/storage/auth contracts, source/shared docs/heavy/live/provider/panel/commits during source freeze.

### Runtime log recovery implementation brief (released)
- Worker: trace_endings; paired t224 Core. Read Current State and runtime-log-recovery-audit.md.
- Own runtime/RunActionLogView.tsx, new runtime/audit-export/{runtimeAuditBlob.ts,index.ts,tests/runtimeAuditBlob.test.ts}, new runtime/tests/runtime-log-recovery.test.tsx only. Preserve compatibility runtimeAuditBlob export from existing view. No existing detail test edits without exact-path release.
- Owner is project/run/commands identity; mask obsolete state during render and reject old captured select/retry/pager/close/export callbacks before requests, state writes or aborting current work. Abort/fence reads on replacement/unmount; old finally cannot release new busy state.
- Action/event/compact detail requests catch rejection, validate minimal envelope/rows/pagination/run identity, release loading and offer usable separate Retry. Retain previous confirmed page truthfully; pager index/cursor history commits only on confirmed page success.
- Keep selected detail8 fixes and runtime-refresh behavior. No private payload/error logs; fixed failure strings. Tests first reproduce meaningful busy/retry, malformed data, scope/render/captured-callback races and pager failure/retry.
- Extract serializer as cohesive resource owner with optional AbortSignal, preserving one-argument callers/fallback. Terminate worker and revoke script/download URLs on success/error/messageerror/throwing construction/postMessage/invalid result/owner teardown. No worker/browser startup outside scoped unit fakes; no real audit payload.
- Export has synchronous pending lock, owner fence, retry feedback and catch/finally cleanup for serializer/download errors. Cancellation never publishes/downloads obsolete audit or clears a new export's busy state.
- Focused new tests + unchanged detail8/refresh tests, scoped types then freeze. Own reports/runtime-log-recovery-implementation.md; no backend/runtime/service/datasets/storage/conversations/shared docs/broad/live/provider/panel/commits.


### Logout acknowledgement supervisor brief (released)
- Read-only source review: AuthStatus awaits fetch but navigates home regardless of HTTP refusal; rejected transport has no caught feedback/pending lock. Menu supports disabled options and closes on selection.
- Exact next Core ownership: app/AuthShell.tsx and new app/tests/AuthStatus.test.tsx only. Preserve login/setup/global topbar contracts; no auth API/backend/session library edits.
- Add synchronous pending lock, acknowledged success navigation and fixed retryable local failure. Refused/rejected requests retain current workspace; component teardown/owner replacement fences obsolete feedback/navigation. Issued logout is not claimed cancellable.
- Reproduce native response refusal/rejection, duplicate activation, retry success and unmount/captured callbacks with synthetic response data. Preserve account link and role display; no secret/error payload logging or unnecessary modal.
- Source held during fifth full/type gates; focused existing AuthShell plus owning new tests, scoped types then coordinated broader verification. Root owns report/documentation/checkpoint.

### Database request recovery implementation brief (released)
- Worker: lab_bookkeeping; paired t224 Core. Read Current State and database-request-recovery-audit.md.
- Own live-views/database-manager.tsx, new programs/database-records/{useDatabaseRecords.ts,index.ts,tests/useDatabaseRecords.test.tsx}, new live-views/tests/database-manager-recovery.test.tsx, existing live-views/tests/database-manager.test.ts only for truthful moved-source assertions. Existing authorization14 tests unchanged and required.
- Focused hook owns metadata/list/detail read lifecycle and response validators; API/store/effective query/grant authority identify owner. No authorization write, password/grant storage, polling loop or backend/framework request replacement inside hook.
- Mask foreign metadata/page/detail/dialog/credentials during render. Read start/response/finally/captured callbacks require current lifecycle/query/store and actual grant validity at Date.now; grant expiry, lock, API replacement and teardown abort/invalidate reads and clear authorized presentation, including inspector. Closing an old dialog must not dismiss a newer authorization epoch.
- Catch unexpected rejection and refuse malformed envelopes/records/paging/returned identity; fixed local metadata/list/detail errors with separate usable Retry. Valid empty/missing record differs from unavailable. Preserve successful current context and existing authorizations, store contracts and bounded query parameters.
- Separate requested query/page from confirmed rows/offset/cursor; pending or failed navigation never labels old rows as a confirmed new page. Retry same requested page; large total shrink clamps once. Debounce/query changes mask old records before effects; removed stores reconcile only from confirmed metadata.
- First reproduce expiry-late-list/detail, API render masking, old callbacks/dismissal and rejected/malformed read/pager cases. Synthetic data only; no private exception/payload logs, new durable copies or browser calls. Backend remains authoritative; this fixes stale frontend presentation.
- Focused hook/view + unchanged auth14/pure tests, scoped types then freeze; own reports/database-request-recovery-implementation.md. Ask before extra paths. No shared operational hook/ProgramApi/auth backend/runtime/storage/conversations/styles/shared docs/broad/live/provider/panel/commits.

### Extension connection and recording recovery read-only worker brief
- Worker: wait_gaps; downstream t224. Read Current State; naming source/report frozen during full/types/build checks.
- Inspect settings/{settings-view.ts,address-form.ts,forget-confirmation.ts}, getting-started/start-view.ts, recording/{record-control.ts,review/recording-review.ts} and directly owning tests only.
- Audit user-triggered refusal/rejection/duplicates, busy/retry feedback and selection/draft/focus across async state changes, cancel/forget and popup/side-panel contract parity. Preserve saved-setting draft and extraction fixes.
- Propose source-confirmed defects and exact independent source/test ownership, not visual redesign. Own reports/extension-connection-recording-recovery-audit.md only; no source/shared docs/heavy/live/provider/panel/commits during freeze.

### Settings and Forget recovery implementation brief (released)

- Worker: wait_gaps. Branch/worktree: existing paired t224; no other checkout.
- Read Current State and own frozen extension-connection-recording-recovery-audit report; implement findings 1–3 only.
- Exact source: apps/extension/src/panel/settings/settings-view.ts and settings/forget-confirmation.ts.
- Exact new tests: settings/tests/settings-recovery.test.ts and settings/tests/forget-confirmation.test.ts, under the same panel directory.
- Preserve and run existing settings/tests/settings-draft.test.ts unchanged; preserve Save/Saved./Forget labels and ids, editable persistent drafts and submitted revision guards.
- One synchronous connection mutation lock spans Save plus reconnect, Disconnect and Forget; status refresh must not release it. Catch unexpected rejection with fixed local retry feedback, never raw exception content. Keep inputs editable.
- Forget callback reports acknowledged success; refusal retains confirmation and permits explicit retry. Guard duplicate activation internally. Restore asynchronous focus only while the initiating confirmation still owns focus in a visible active document; hidden/external focus must stay untouched. Explicit open still focuses Cancel.
- Do not redesign transport, background, protocol, address form, recording, other settings, shared DOM helpers or storage; no extra paths without release.
- Write findings/reproduction/decisions/check results progressively to own reports/settings-forget-recovery.md. Supervisor owns shared docs, integration and verification.
- Narrow tests/scoped types via shared heavy wrapper only. No broad gates, live/browser/provider/panel activity, commit or push. Freeze exact source when ready for supervisor review.

### Getting Started result recovery supervisor brief (released)

- Exact source: apps/extension/src/panel/getting-started/start-view.ts; new owning tests/getting-started start-view.test.ts in that source directory's tests subfolder.
- Reproduce audit finding6: requested connection goal renders while request awaits, then refusal must not install an already-obsolete error. Retain failures while the latest rendered goal is unmet; later goal observation clears them, explicit retry remains available.
- Guard activation synchronously through pending acknowledgement, preserve existing labels, controls, guide rendering, approval codes and acknowledgement-first cancellation contract.
- Catch unexpected transport rejection with fixed local retry text and finally release pending controls; reconcile that error against latest rendered status too. No background/protocol/request cancellation redesign.
- Preserve existing start-steps tests unchanged; component tests use existing fake DOM, no shared helper edits or browser claim. Record reproduction/checks in own report; broad extension checks wait for Settings worker freeze.

### Production parameter recovery read-only worker brief

- Worker: wait_gaps, after freezing Settings implementation/report. Read Current State; same paired t224 trees only.
- Read exact Core paths: apps/web/src/features/programs/live-views/production-runner.tsx; its tests/production-runner.test.ts, production-runner-operations.test.tsx and production-freshness.test.tsx; packages/fluxiq/src/programs/production-runner/types.ts, api/handlers.ts and runtime/service.ts (read only).
- Trace parameterSchema consumption, metadata start wire contract, empty/invalid numeric conversion, required/default/enum/integer/range semantics, unsupported nested fields and silent first30 truncation. Distinguish contracts actually enforced from speculative JSON Schema expectations.
- Preserve existing draft/target/API-owner locks and polling. Propose focused UI helper/field ownership and exact regressions, with compatibility risks and backend authority explicitly stated. No model/provider/live calls or payload logs.
- Own downstream report reports/production-parameter-recovery-audit.md only. No product/test/shared-doc edit, heavy/full check, commit or push. Return source findings and bounded next brief; supervisor releases implementation after sixth Core freeze/gates.

### Recording review control identity implementation brief (released)

- Worker: trace_endings, after freezing Runtime implementation/report. Same downstream t224 tree only; Core stays source-frozen in your completed five paths.
- Read Current State and own prior extension-connection-recording-recovery-audit finding5, then exact apps/extension/src/panel/recording/review/recording-review.ts and its tests/review-model.test.ts and tests/payload-parsing.test.ts.
- Exact edited source: that recording-review.ts; exact new test: its tests/recording-review.test.ts. Own report reports/recording-review-controls.md.
- Reproduce phase-change replacement of still-present actions, especially Done across analyzing/building timer. Reconcile buttons by ReviewAction with current label/handler/busy state; preserve retained actions and reducer/request/epoch/id contracts.
- If a focused action disappears, choose an explicitly owned visible local remaining action or named status fallback; never reclaim external/hidden/inactive-document focus. Dismiss hides presentation; no new external caller fallback, cancellation or backend semantics.
- Retain unchanged review-model/payload-parsing tests and all prior paused/extraction/settings/shell fixes. Unexpected promise recovery beyond existing request contract needs a source finding and supervisor release.
- Progressive own report; local fake DOM/focus modeling may live in new test, no shared helper edits. Narrow tests/scoped types through shared heavy wrapper, then freeze for supervisor checks. No broad/live/provider/panel/commit/push.

### Production parameter recovery implementation brief (released)

- Worker: runtime_contracts (resumed lane), released after sixth Core full/type/build gates passed. Read Current State and frozen production-parameter-recovery-audit.md. Same paired t224 trees.
- Exact Core paths under apps/web/src/features/programs/: live-views/production-runner.tsx; new production-parameters/{prepareProductionParameters.ts,ProductionParameterFields.tsx,index.ts,tests/prepareProductionParameters.test.ts,tests/ProductionParameterFields.test.tsx}; new live-views/tests/production-parameters-recovery.test.tsx; existing live-views/tests/production-runner.test.ts only for truthful moved source ownership.
- Preserve original productionParameterFields export/valid legacy descriptor shape. Existing operations/freshness behavioral files unchanged and required. Direct Start metadata envelope, loops/delays, polling, target/API/draft locks and all runtime/backend/transport contracts unchanged.
- Absent parameterSchema means existing empty metadata. Support object declarations with properties (top-level missing type permits legacy object inference), primitive string/boolean/number/integer fields; missing property type permits legacy string inference. Malformed declarations, unsupported object/array/union/composition and more than30 properties show fixed actionable limitation and block launch rather than truncate/coerce. Name the30-field limit explicitly.
- Supported local UI constraints: required names, type-compatible primitive enums, correctly typed finite defaults, finite numeric minimum/maximum and safe integers. Required blank input needs correction; this is a documented UI policy, not a claim of comprehensive JSON Schema/server enforcement. Reject malformed/contradictory constraints/defaults; no clamping or implicit fallback.
- Allow harmless annotations title/description/examples/$comment/readOnly/writeOnly/deprecated; use only string titles. Unknown assertion keywords/composition must produce an explicit unsupported declaration limitation, never imply their constraints were enforced. Define allowed property/top-level keys in the pure helper and test them.
- Numeric blank/whitespace without a default, or explicitly cleared, omits an optional property; untouched valid defaults apply; explicit0 remains0. Reject nonfinite/invalid text and fractional/unsafe integers. Optional plain strings retain existing empty-string semantics; optional booleans retain false/default semantics. Required strings must be nonblank.
- Optional enum without a default stays unset until chosen; selected empty string must remain distinguishable from absence. Use control-only encoded option indices with typed scalar normalization, not a wire sentinel. With a default, an unset choice may restore default. Defaults must satisfy declared enum/range. Do not silently choose first enum value.
- Use own-property-safe draft reads and metadata construction; pure helper returns fields, normalized metadata and fixed issues without mutation. Field component is controlled/keyed, labelled and accessible; never focus/reset on polling. Current explicit drafts survive same-target schema refresh and revalidate; removed fields are never submitted.
- Validate the captured current schema/draft before any Start POST. Invalid/unsupported launch preserves draft with actionable local feedback; corrected valid activation still uses original single lock and exact envelope. No extra polling/read or generic schema library.
- Tests: numeric/required/default/enum/bounds/unsupported/30vs31 boundaries; mounted zeroPOST on invalid and exact valid metadata; refusal/retry/draft/schema-refresh/target/API/captured-handler/duplicate protections. Preserve original tests except truthful source-location assertions; no relaxations.
- Own report reports/production-parameter-recovery-implementation.md; narrow heavy/scoped checks then freeze. No shared docs/extra source/broad/live/provider/panel/commit/push.

### Deployment recovery implementation brief (released)

- Worker: deployment_docs_audit, now released after sixth Core gates; read Current State and own frozen deployment-docs-recovery-audit.md findingsD1–D5. Same Core t224 tree.
- Exact edited source: apps/web/src/features/programs/live-views/deployment-sync.tsx; new owning tests/deployment-sync-recovery.test.tsx; existing tests/deployment-sync.test.ts only truthful source-location assertions. Read deployment-sync response types if needed; no backend edits.
- Key private workspace to API owner during render, layout teardown plus retained callback guards. Foreign snapshot/confirmation/result never appears under new owner and old callbacks never POST. Same-owner refresh preserves selected target, tab and confirmed detail when valid.
- One synchronous action lock spans dry-run/sync/rollback through acknowledged mutation and reconciliation. No automatic mutation retry; explicit repository change confirmation remains mandatory and captured target/version cannot retarget. Refusal/rejection retains local retry feedback and selection; old Cancel/Confirm callbacks cannot close or submit a newer confirmation epoch.
- Validate snapshot/target/git/version/run shapes used for rendering; invalid success is a recoverable read error. Caught snapshot refresh keeps last confirmed same-owner state marked stale with direct Retry. Git-unavailable/unknown state must not announce Clean or success. Do not infer checkout safety from UI.
- Acknowledged action feedback stays separate from subsequent snapshot failure; no falsely failed action or automatic replay. Confirmed metadata removal invalidates unavailable captured target/version before mutation, even before passive cleanup.
- Tests first for old/new owner confirmation and captured callbacks, duplicate actions, failure/rejection, same-owner state, invalid payload, unknownGit and acknowledged-write/read-failure. Existing confirmation/types/wire behavior unchanged; no generic coordinator/polling/styles/backend/shared helpers.
- Own report reports/deployment-recovery-implementation.md; narrow heavy/scoped then freeze. No product edit before release, extra paths/broad/live/provider/panel/commit/push/shared docs.

### Docs recovery implementation brief (released)

- Worker: recording_controls, now released after sixth Core gates; read Current State and frozen deployment-docs-recovery-audit.md C1–C5. Same Core t224 tree.
- Exact Core paths under apps/web/src/features/programs/: live-views/docs.tsx; new documentation-workspace/{useDocumentationWorkspace.ts,index.ts,tests/useDocumentationWorkspace.test.tsx}; new live-views/tests/docs-recovery.test.tsx; existing live-views/tests/docs.test.ts only truthful moved ownership assertions. Read current direct imports/types when needed to preserve page contract; no backend edits.
- Cohesive hook owns snapshot/page read plus rebuild lifecycle, confirmed selection and separate channel/error/busy state; view retains filters, explorer/outline/tree/history/sandbox semantics. Key private view to API owner during render; layout teardown and captured-callback ownership fences. Owner changes mask old page/filter/history immediately, same-owner refresh preserves valid drafts/selection/content.
- Synchronous single rebuild lock, caught/finally release, no automatic mutation retry. Order overlapping snapshot/rebuild responses so an older read cannot erase rebuilt metadata. Preserve acknowledged rebuild outcome even if subsequent current-page read fails.
- Successful rebuild reloads current page even if id unchanged. Removed selected page reconciles to an available URL-requested or first confirmed page; no available page clears selected content/loading/error. Direct current-page Retry for failed read; explicit separately named Rebuild remains available for genuinely missing indexed content.
- Validate snapshot/pages/sources/warnings and page fields actually rendered, including html string/identity; malformed success is recovery failure, zero indexed pages distinct from filtered no matches. No private error logging or exception text. Retained requests cannot act in new owner or selection context before passive cleanup.
- Preserve existing virtualization/tree keyboard/folder expansion/outline/security/history helpers unchanged; C6 is a separate future brief. No styles/generic API/polling/backend/shared hooks. Keep helper focused below budgets, one export per owner and barrel.
- Tests first for same-id rebuild reload, removed selection/direct retry, old owner/page/captured callbacks, duplicate rebuild, rejected/malformed response, busy reset and write/read distinction. Existing tree/outline/sandbox behavioral tests unchanged; explain source-location changes.
- Own report reports/docs-recovery-implementation.md; narrow heavy/scoped then freeze. No product edit before release, extra paths/broad/live/provider/panel/commit/push/shared docs.

### Deployment and Docs recovery read-only worker brief

- Worker: lab_bookkeeping, after freezing database report. Read Current State; same Core t224 tree only.
- Exact Core reads: apps/web/src/features/programs/live-views/deployment-sync.tsx and docs.tsx; their direct tests/deployment-sync.test.ts and docs.test.ts; shared program-api.ts only if necessary to distinguish fulfilled result from rejection contracts.
- Audit snapshot/list/detail and mutation loading/error/retry/duplicate/current-owner behavior, editable draft/selected-path preservation, truthful empty/failed states and labels. No new polling/privileged actions assumed. Trace actual call order; separate source defects from browser hypotheses.
- Own downstream report reports/deployment-docs-recovery-audit.md only; propose exact bounded files/tests and reproduced or source-confirmed sequences. No product/test/shared docs/heavy/broad/live/provider/panel/commit/push. Supervisor releases implementation after Core gates.

### Runtime source-contract reconciliation worker brief (released)

- Worker: runtime_contracts. Read Current State and frozen runtime-log-recovery-implementation report. Same Core t224 tree only.
- Exact edited tests: apps/web/src/features/automation-studio/runtime/tests/request-generation.test.ts, runtime-views.test.tsx and runtime.test.tsx. Read RunActionLogView.tsx and its new runtime-log-recovery.test.tsx; product stays frozen.
- Sixth full retained log confirms319files/2078tests,2072pass/6fail,178.24s, status1: stale function-string assumptions in these three tests. Inspect actual failure text in TEMP/codex-t224-sixth-core-full.log.
- Make source-location assertions follow actual RuntimeLogScope ownership and current predicate equality, retaining bounded page/query/dataset/event/detail/generation/cancellation coverage and other component assertions. Do not alter product, constants, broad assertions, fixtures, skips, baseline or config. Verify wrapper owner scope too when relevant.
- Use authored source reads for implementation now behind keyed wrapper; no export of private component just to satisfy tests. Preserve real behavior tests and source requirements; do not remove failing requirements.
- Own downstream report reports/runtime-source-contract-reconciliation.md. Narrow affected plus new recovery/serializer and unchanged detail/refresh tests through heavy, then freeze. No broad/live/provider/panel/commit/push or shared docs.

### Open FluxIQ utility recovery supervisor brief (released)

- Exact source: apps/extension/src/panel/open-fluxiq/open-fluxiq-button.ts; new owning tests/open-fluxiq-button.test.ts in its tests subfolder. Own utility recovery report.
- Reproduce late failed reply after observed address change; reconcile against current observed address immediately, preserving real same-address failures until retry or later address change. Add synchronous pending guard and finally release controls; exception catch is defensive under PanelStore never-throwing contract, fixed text only.
- Preserve native labels/icon/styles/message/notice details and no automatic retry/new request. Tests synthetic only; no shared helper, caller, transport, status, storage or focus changes. Scoped checks then freeze; no browser/provider/panel management.

### Problem report recovery supervisor brief (released)

- Exact source: apps/extension/src/panel/settings/problem-report-section.ts; new owning tests/problem-report-section.test.ts. Supervisor report: extension-utility-recovery-implementation.md.
- Reproduce native reactivation during pending clipboard work and missing clipboard API. Hold one synchronous operation lock through request, download preparation and clipboard acknowledgement; always release controls. Catch browser API failures with fixed local feedback, preserve valid download when copying fails and preserve copied success when download creation fails.
- Hide the prior download during a new request; replace/revoke only the old owned URL. Preserve report schema, background redaction, wire message, existing labels and pure plan. No actual diagnostics, new lifecycle API, helper/caller/transport/storage changes or automatic retry.
- Synthetic component regressions and actual-config scoped types through heavy wrapper, then freeze. Broader extension gates after utility partitions. No live/browser/provider/panel management or merge/push.

### Activity feed recovery worker brief (released)

- Worker recording_controls; exact apps/extension/src/panel/chat/feed/activity-feed.ts and existing owning tests/activity-feed.test.ts. Own reports/activity-feed-recovery-implementation.md.
- Reproduce out-of-order reads without intervening push, stop/restart stale completion and overlay acknowledgement replacing a newer push. Preserve direct read/setOverlay without start, synchronous overlay lock, unsupported semantics and existing API/messages.
- Separate request generation and lifecycle fences; stop invalidates old callbacks/results, fresh direct reads remain legal. Successful overlay acknowledgement cannot overwrite newer observed push; release saving only for its current operation. Preserve explicit retries and fixed defensive rejection feedback under never-throwing production PanelStore.
- Synthetic deferred tests first, original owning tests retained, narrow heavy/scoped then freeze. No shared helpers/callers/redaction/storage/protocol/Core/styles/docs edits, real activity/browser/provider/panel operations or commit/push.

## Work Ledger

### 2026-10-01 - Tenth extraction independently verified and slots reassigned
- Agent: supervisor
- Changed: extraction four-path source reviewed; database one-file semantics; new verification/planning records.
- Why: preserve column typing and retire stale row callbacks while continuing recovery work with maximum workers.
- Validation: extraction66/native0/654.7189ms; strict four-root typing0. Database existing25/native0/8.70s. Menu source read; independent rerun and owning broad gates pending.
- Outcome: Accepted narrow extraction and database results; no full tenth or browser certification yet.
- Follow-up: mounted Chat implementation active; extraction read recovery and overlay executable briefs read-only; root Menu/full Core verification next.

### 2026-10-01 - Ninth full gates complete and next three units released
- Agent: supervisor
- Changed: source checkpoints, paired Current State and root ninth report.
- Why: verify whole owning packages before continuing disjoint UI work.
- Validation: Core full338files2506tests/native0; types/build native0; structure1
  solely protected inherited service4506/4505. Extension1878/types/build/structure0.
- Outcome: Accepted. Core9d2eb6fa/e50a6882; downstream924903b8; no merge/push/live.
- Follow-up: Menu, mounted Chat and extraction draft workers implement exact
  released partitions; preserve Claude handoff and checkpoint reports as work proceeds.

Earlier settled ledger entries are preserved in the [fifth-through-eighth archive](./codex-ui-ux-review-2026-09-30/archive/2026-10-01-fifth-through-eighth-ledger.md).

### 2026-10-01 - Settled ledger compacted for continued parallel work
- Agent: supervisor
- Changed: parent ledger and linked historical archive; latest three entries retained.
- Why: preserve exact old outcomes and briefs while keeping continuation memory concise.
- Validation: source20entries; archived17entries byte-preserved; no relative links in moved ledger.
- Outcome: Accepted documentation compaction; all active briefs and current worker partitions retained.
- Follow-up: verify next Core/extension source, update index and locally checkpoint progress.

### 2026-10-01 - Conversation controller recovery independently verified
- Agent: supervisor
- Changed: controller, new owning recovery test, architecture and root audit.
- Why: rejected requests and obsolete read/answer completions could strand or
  misdirect feedback; mounted Core/project owner recovery remains separate.
- Validation: original six failures/native1; corrected owning four suites43pass/
  native0/280.3953ms; strict actual-config two-root types/native0; whitespace0.
- Outcome: Accepted narrow source, frozen pending coordinated full extension gates.
- Follow-up: automation worker finishes; root full gates after shared freeze.
  Shared overlay worker audits Enter/initial-focus defects; onboarding active.

### 2026-10-01 - Eighth complete and ninth parallel units released
- Agent: supervisor
- Changed: paired Current State, eighth verification report and local checkpoints.
- Why: preserve independently verified outcomes before releasing three next units.
- Validation: Core full333files2342tests/native0, web types/native0 and production
  build/native0; structure/native1 only inherited protected service4506/4505.
  Downstream full1833/types/build/structure native0; exact sessions in report.
- Outcome: Accepted. Core fe0165c7; downstream e14e935a; no merge/push/live tests.
- Follow-up: operational/onboarding/automation owner workers active; root Chat
  source audit records separate ownership/answer/rejection risks before changes.

### 2026-10-01 - Eighth extension complete and Core review in progress

- Validation: extension full50040 native0,1833tests/114224.7451ms; actual-config typing90037 native0/29248ms; production15517 native0,Chrome/Firefox/e2e22files each/24631ms; full structure66791 native0,136warnings119baseline. Status/export narrow13/18 and strict1135 passed first. Both exact partitions independently inspected and ready for local checkpoint; no browser certification.
- Validation: supervisor Docs tree96439 observed5files42pass/native0/10.79s with unchanged request/status9, helper4 and1,250-page completeness. Reviewed focused/selected/expansion/window/deferred-focus guards and truthful relocated source assertions. Root removed obsolete user-facing implementation hint; authored architecture updated. Full Core gates wait for Identity/Secret freeze.
- Identity worker60/scoped claim source-reviewed, subject label correction requested within its exact view/test before root verification; Secret worker74/scoped checks still active with additional boundary coverage. Other slot prepares exact held operational payload recovery design, and Studio navigation audit report preserves ongoing source findings. Current parent/report state persists checks and pending limitations, no Claude interference or integration.

