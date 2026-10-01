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
has only inherited service4506/4505. Auth and operational-refresh/Compute are
checkpointed9d5e2533/e109b226; clipboard0738bc58 has22 focused passing tests
and corrected scoped types. Fourth combined110/types pass; production29706
passed17pages/128724ms. Initial full1942pass/1 source-only moved-controller
contract failure is corrected, focused21pass; final full21515 passed308files/
1943tests/121.20s and types56689 passed15522ms. Fourth Core batch Complete;
legacy launcher, Background/Production adapters and remaining clipboard
consumer briefs now released in disjoint paths. Extension extraction checkpointc96f5f78 passed
full1716/types/build/audit. Strip related21/full1727/types/build/structure pass,
checkpoint5e162c36. Explicit navigation focus is Complete41f3df0b (full1738/
types/build and corrected docs pass). Naming consistency worker owns six next
downstream paths. Core fifth Complete: combined103/full314files1987tests,
final types35028 and production69313 passed17pages/131107ms. Clipboard95004f19,
launcher62a8532f and adapters1cd44425 saved; strict comment/contract correction
checkpoint follows. Structure has only protected inherited service4506/4505
after optional-write marker and index fixes; no config/baseline changes.
Extension naming Complete: related48/full1747/types/build/structure pass.
Next sixth Core database/runtime-log/logout briefs released in disjoint paths;
extension settings/recording worker audits read-only.
Continue working beyond every batch.

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

## Archived coordination history

Initial briefs and settled validation details moved to [the first-four-batch archive](./codex-ui-ux-review-2026-09-30/archive/2026-10-01-first-four-ui-batches.md).

## Active and next worker briefs

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

## Work Ledger

### 2026-10-01 — Logout reproduced and fixed; extension recovery released

- Supervisor reproduced duplicate logout POST and navigation despite HTTP refusal: two targeted failures on original source. AuthStatus now locks activation synchronously, navigates only after acknowledged success, shows fixed local retry feedback, and ignores obsolete completion/activation after teardown. Component instance owns the request; display-name changes are not invented authentication identity boundaries.
- Validation: heavy-wrapped `pnpm --filter @fluxiq/web exec vitest run src/app/tests/AuthStatus.test.tsx src/app/tests/AuthShell.test.tsx` printed 32 tests passed, native exit0, 2.41s (AuthStatus6 plus unchanged AuthShell26). Full Core gates wait for database/runtime-log workers to freeze.
- Extension read-only audit frozen with six source findings. Supervisor confirmed Settings render releases pending Disconnect and Save releases before reconnect; Forget currently closes on refusal. Exact four-file Settings/Forget implementation released to wait_gaps; remaining start/review/paused partitions remain queued.
- All work remains isolated in t224; no merge, push, live execution or Claude changes.
- Logout scoped types passed against actual web configuration, native0. Paused recording regression reproduced enabled Start on original source (6pass/1fail); two-file correction plus architecture note now passes all7 owning tests, native0/119.8275ms. Reports preserve exact evidence; broader gates await worker freeze.

### 2026-10-01 - Fifth Core and extension naming gates complete; sixth released
- Agent: supervisor
- Validation: corrected Core66758 native0,314files/1987tests,155.23s; final types35028 native0,20432ms; production69313 native0,17pages/131107ms. Targeted source/docs rules pass0warnings/47baseline; full structure's sole remaining failure is inherited protected service4506/4505. No limit/config/baseline relaxation.
- Extension naming66735 native0,1747/1747,116175.3907ms; types27533 native0,37359ms; build22753 native0,75072ms,22files per target; full structure passed136warnings/119baseline. Six-path source review/related48 independently observed native0,526.6323ms.
- Outcome: Complete fifth Core/naming batches. Local checkpoints follow, with full logs in TEMP and frozen reports/architecture in authored docs. No live browser certification or Claude integration mutations.
- Follow-up: release exact sixth Core briefs: trace_endings runtime log5paths, lab_bookkeeping Database6paths, root logout2paths; extension worker continues source-only settings/recording audit. No batch stop.

### 2026-10-01 - Fifth corrected contract and naming source verification
- Agent: supervisor
- Validation: original fifth full77112 native1,314files/1987tests,1986pass/1copy wording source failure,132.40s. Owning assertion follows shared acknowledged status/manual-failure boundary; unchanged download assertions. Corrected launcher/contracts/consumers7files60tests native0,2.84s. Optional history write uses rule's documented best-effort reason; targeted rules passed0warnings/47baseline after index regeneration. No config/baseline change.
- Final web types35028 native0,20432ms; corrected full and production69313 active. Extension naming independently reviewed six paths and48/native0,526.6323ms; types27533 native0,37359ms. Full naming and production22753 active; both source trees frozen.
- Outcome: Partial until final whole gates. Database late authorized-read/expiry has held six-path brief; runtime log/logout held. Extension settings/recording read-only audit follows.
- Follow-up: finish builds/full runs, checkpoint/docs audits, then release sixth Core work; preserve original Claude workload/integration ownership.

### 2026-10-01 - Fifth broad strict follow-up
- Agent: supervisor
- Validation: full structure79891 native1: inherited protected service4506/4505, ProgramLauncher optional empty catch needs documented best-effort marker, stale working-doc index. Read actual swallowed-failure rule: it explicitly permits optional failure with an in-block best-effort reason. Existing comment reason is valid product policy but lacks recognized prefix. Web types53622 native0,65366ms; full77112 still active.
- Outcome: Partial pending final whole suite and precise comment/index correction. Regenerated index through owning generator; no baseline expansion or failure logging of local optional storage.
- Follow-up: finish full before source-comment correction, rerun targeted rule/launcher tests, build latest frozen source. Runtime log/logout held; database read-only worker audits during gates.

### 2026-10-01 - Fifth Core independently reviewed and frozen
- Agent: supervisor
- Validation: reviewed API-keyed workspace and render/lifecycle mutation guards, selected history/query reconciliation and target-keyed pending launch errors; worker reproduced2 pending-error failures then42focused/types pass. Supervisor27199 native0,17files/103tests,9.89s includes adapters42, cancellation2 and launcher/clipboard/existing59. Every worker claim included in independently observed run.
- Outcome: Focused Complete; full Core source frozen. Launcher62a8532f and clipboard95004f19 saved; adapter/source contract checkpoint follows. Authored current-system updated with sampled refresh/history and action acceptance policy.
- Follow-up: whole web tests/types/structure, then build after types. Next runtime log and logout briefs remain held; extension naming stays in separate downstream source tree.

### 2026-10-01 - Fifth scoped clipboard and launcher verification
- Agent: supervisor
- Validation: clean original clipboard reproduction7fail/2pass native1 after correcting test browser/child modeling. Corrected6files/36tests native0,2.60s; final scoped82345 native0 after public phase fixture correction, corrected raw4 native0/2.37s. Independent combined60136 native0,10files/59tests,9.12s includes launcher14, clipboard36 and secret/identity9; exact launcher2-source diff independently reviewed.
- Checkpoint: Core95004f19 clipboard9source/tests plus authored current-system. Launcher optional history/alias query contracts now authored; local source checkpoint follows. No full-Core claim during adapter edits.
- Outcome: Clipboard and launcher focused Complete; fifth whole gates pending. Production pending-launch error scope reproduced next under worker review; root moved cancellation contract now covers all three hook-backed views.
- Follow-up: independently verify adapter follow-up, coordinated Core freeze/full types/tests/build and structure; extension six-file naming work remains independent.

### 2026-10-01 - Extension focus broad verification complete
- Agent: supervisor
- Validation: full6605 native0,1738/1738,111020.2786ms; types71900 native0,22390ms; build76352 native0,22422ms,22files per target. Independent related23 pass/native0,445.3732ms. Full structure80714 has no new source violation but found two ledger/index documentation defects; moved brief outside ledger, recorded validation bullet and regenerated index. Corrected working-docs/docs-links native0,0warnings/2baseline; inherited source warnings136/119baseline unchanged.
- Outcome: Complete. Authored extension-client navigation paragraph updated. Local checkpoint follows before naming source is released.
- Follow-up: passive naming consistency six-file implementation; Core clipboard corrected36/scoped initial0, final typing active; adapters still actively testing additional scope races.

### 2026-10-01 - Extension focus independently reviewed
- Agent: supervisor
- Validation: supervisor reviewed explicit capture/consume/expiry and Back source ownership, visibility/inert/document-focus guards, composer and labelled fallback. Independent related23 native0,445.3732ms; source stays frozen for full6605/types71900/build76352.
- Outcome: Partial pending whole extension gates and authored documentation/checkpoint. Worker now read-only audits naming consistency; Core fifth workers/root remain separate source paths.

### 2026-10-01 - Fourth Core batch independently verified; fifth released
- Agent: supervisor
- Validation: corrected full21515 native0,308files/1943tests,121.20s; final web types56689 native0,15522ms. Production29706 native0,17pages/128724ms before test-only contract correction; final contract21 independently pass. Structure has only protected inherited service4506/4505 after owning index regeneration.
- Outcome: Complete fourth Core batch. Source checkpoints0738bc58/9d5e2533/e109b226/47748f82, paired reports a7df3da8; no merges/pushes or runtime/backend changes.
- Follow-up: release written fifth briefs to trace_endings/lab_bookkeeping; root migrates three remaining clipboard consumers. Extension worker remains separately active in four assigned paths. Continue all roadmap phases without stopping.

### 2026-10-01 - Coordination document compacted
- Agent: supervisor
- Changed: retained current state, roadmap, active extension focus assignment and next held Core briefs; preserved the complete pre-compaction evidence snapshot in the linked archive.
- Why: settled ledger exceeded20entries; protocol compaction preserves decisions without forcing workers to reread obsolete assignments.
- Validation: active briefs still name exact owned paths; archive contains original failures, corrections, checkpoints and Claude workload references. Fourth Core final full/types remain active; no source edits during gates.
- Outcome: Complete documentation compaction; continuous implementation remains Active.
- Follow-up: finish current gates and release next written Core briefs.

