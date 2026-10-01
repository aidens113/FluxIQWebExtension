# Automation owner recovery implementation

Status: Complete (worker claim; source/tests frozen for supervisor review)
Owner: recording_controls worker
Date: 2026-10-01

## Written brief (released)

- Secret source/tests remain frozen for eighth Core gates. Read parent Current State and frozen automation-owner-recovery-audit.md. Extension1833/types/build/structure passed and e14e935a checkpoint is preserved.
- Exact downstream source: panel/automations/{controller.ts,automations-tab.ts,automation-strip.ts}. New owning tests/{controller-owner-recovery.test.ts,automations-tab-owner-recovery.test.ts,automation-strip-owner-recovery.test.ts}. Existing tests/{controller.test.ts,automations-tab.test.ts,automation-strip.test.ts} may change only truthful local API mock fixtures when local lease API extends; retain all assertions. No separate types/shared harness/wire/caller source without explicit release.
- Capture a local frontend owner revision from confirmed routing context: gatewayUrl, settings.coreApiUrl when supplied, clientId, projectId and paired state. Missing optional settings must preserve last confirmed Core address; runtime/queue/event/timestamps/session reconnect churn never reset same owner. Pairing loss fences operations without exposing tokens. Preserve shell-held working state.
- Address/context replacement masks foreign rows/replies/details/notices immediately, resets owner-scoped unsupported capability state and triggers one active current read. Connection epochs invalidate pending publications on disconnect/reconnect while confirmed same-owner rows remain usable after manual retry. Offline takes precedence over fallback; offline Run/export send nothing.
- Channel-specific operation objects own lock release/results/follow-up reads/downloads. Old list/detail/run/export replies cannot publish, download or release a same-ID new-owner lock. Validate current flow/run/dataset tuples before dispatch; no issued-operation cancellation claim.
- Same-ID foreign rendered handlers need a local owner lease, scoped row retirement/rekey and strip dataset/Run lease. Preserve same-owner keyed rows, focus, reading position, passive names and explicit navigation. Optional local API defaults must not turn retained old UI callbacks into implicit current-owner actions. Do not change Chat targets or silently claim full Chat owner recovery.
- Active fallback-to-new-owner recovery restarts existing30s timer once; inactive/hidden tab remains quiet. Preserve current export failure/cleanup/reentrant lock recovery, fulfilled error details and defensive fixed rejected-request feedback. No new polling speed/retry or API/wire messages.
- Tests-first synthetic original failures then current-owner lifecycle/partial-status/same-ID/adverse-order/offline/timer regressions. Narrow heavy plus actual-config scoped types; freeze for supervisor review. No broad/live/browser/provider/panel/private data/Core/shared docs/styles/storage/protocol/commit/push.

## Progress

Original synthetic controller reproduction: native1, 0/3 passing (281.9642ms). Owner replacement retained foreign rows, old pending list blocked new-owner refresh, and offline export dispatched. Added tests first.

Supervisor released narrow original export-test setup additions: explicitly focus/load matching flow with truthful dataset detail before export; retain every existing delivery/error/reentrant assertion and lazy-detail expectation. Paired=true fixture corrections released for genuinely paired connected/offline cases. Product detail loading remains lazy.

Controller implementation active; no validation claim yet.

Progress checkpoint: tab/strip tests-first reproduced three additional failures (retained A navigation, same-ID foreign strip still visible, fallback new-owner timer stayed stopped): native1, 3/6 passing, 430.0794ms after controller changes but before UI changes. Intermediate focused54 native0 (562.3638ms), strict actual-config9roots zero diagnostics. UI controls retire only on owner revision; same-owner focus/name/stability/export delivery assertions pass. Additional boundary coverage active, not frozen.

## Implementation / frozen ownership

Exact nine downstream paths only: controller.ts, automations-tab.ts, automation-strip.ts; three new owning *-owner-recovery.test.ts files; existing controller.test.ts, automations-tab.test.ts, automation-strip.test.ts fixture/setup adaptations. No separate helper/types, Chat/shell, shared fixture/harness, protocol, background or Core changes. Existing Secret and Activity source stayed frozen.

Controller exposes a local numeric ownerRevision lease (never a wire field), derived from trimmed gateway/known Core addresses, client/project and paired state. Omitted optional settings retain the confirmed HTTP address. Undefined/null project represent an unscoped session; explicit project changes replace owner. Ordinary session/runtime/event/queue churn preserves confirmed evidence and shell-held working. Owner changes clear foreign rows, replies, notices/details/focus/capability assumptions immediately. Separate connection epoch abandons pending publication/locks on disconnect/reconnect while retaining same-owner confirmed metadata. This does not cancel issued requests.

List/detail/run/export own operation objects. Identity checks at acceptance/follow-up/delivery/finally keep late old work from changing new-owner same-ID state or releasing its locks. List lock releases before lazy detail so independent reads remain available. Focus changes abandon pending detail markers; removed tuples cannot publish old detail or download. Run requires current known flow, export requires current known flow/run/dataset; explicit stale owner leases reject before lock mutation. Offline takes precedence over fallback and dispatches no mutations. Defensive injected request rejection uses fixed local feedback; ordinary PanelStore errors preserve original sentences/details.

Tab row instances retire only on owner replacement, and activation requires captured lease, current mounted instance and current list membership. Same-owner keyed rows/order/focus/scroll remain intact. Strip owner retirement masks the previous selection and reconstructs its Run control; dataset keys and listeners capture owner leases and mounted membership. Offline Run/exports are disabled and guarded. Passive matching-owner metadata/name notifications remain passive. Current active visible nonfallback/nonoffline timer policy restarts a stopped fallback timer exactly once for a new owner, keeps existing30s cadence, and remains quiet while inactive/hidden. Wider Chat target ownership is intentionally still a separate supervisor dependency.

## Original test adaptations / assertion preservation

The original export cases called exportDataset before loading any run detail; that bypassed the new confirmed dataset tuple requirement. Supervisor explicitly released setup-only focus/load additions and truthful runDetail datasets for those cases. No eager product detail loading was added: the original assertion that unopened list rows cause no detail reads still passes. Connected/offline cases representing an approved paired owner now set paired=true rather than the shared fixture's never-paired default. Strip mock states supply ownerRevision; tuple-capture mocks record the same four original tuple arguments while new owner tests assert the fifth lease.

AST comparison against current HEAD confirms EVERY original assert.* call unchanged and in the same order: controller48, tab26, strip43 (117 total). Original delivery-failure, retry, reentrant synchronous export lock, fulfilled error detail, keyed focus/scroll/name/navigation assertions all pass.

## Observed verification

- Tests-first original controller reproduction: native1,0/3 passing,281.9642ms; foreign rows, blocked new-owner list and offline export reproduced.
- UI reproduction before tab/strip product edits: native1,3/6 passing,430.0794ms; retained foreign navigation, foreign same-ID strip and stopped fallback timer reproduced.
- Final heavy focused external harness TEMP/codex-t224-automation-owner-focused.mjs: native0,64/64 passing,530.5856ms across six owning suites: original30 plus new34. Includes actual controller+strip integration, owner/reconnect ordering, old result/refusal/finally, capability reset, lazy detail/focus return, tuple removal, offline controls, stale leases, reentrant pre-dispatch owner replacement, hidden/inactive and timer recovery. No skipped/cancelled tests.
- Final heavy actual-config scoped harness TEMP/codex-t224-automation-owner-scoped-types.mjs: native0,exact9 roots,zero owned/global diagnostics,zero unowned dependency diagnostics. Reads real extension tsconfig with strict options; no exclusions/relaxation. One intermediate new integration test implicit-any was observed and corrected by explicit PanelMessage annotation before final run.
- Exact owned-path git diff --check: native0. Original assertion comparison: native0 (117 unchanged).

No broad/package tests/build/structure, browser/live/provider/panel operations, private runtime state, commits or pushes were run by this worker. Synthetic fake DOM proves local callback/identity contracts; live browser behavior and complete Chat owner recovery are not certified. Root owns independent source review, combined/package gates and coordinated integration. All nine source/test paths frozen now; only supervisor-requested follow-up may reopen them.
