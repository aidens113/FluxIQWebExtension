# Settings navigation frame recovery

Status: Complete
Owner: runtime_contracts
Date: 2026-10-01

## Written brief

- Root read complete core-navigation-recovery-audit.md and actual SettingsSectionLayout.tsx. Exact two-path Core implementation released NOW; no Core broad gates active. DataInspector worker owns disjoint development paths; floating and shared component source stay frozen.
- Exact Core paths: apps/web/src/features/automation-studio/settings/SettingsSectionLayout.tsx and NEW settings/tests/SettingsSectionLayout-recovery.test.tsx. Own this downstream report only additionally. No caller/tree/keyboard/helper/style/backend/config/old-test edits.
- Fix queued scroll callbacks using latest current sections/selection/callback at frame execution. Fence mounted container/frame lifetime, cancellations and retained handlers after retirement. Ordinary inline callback churn must not discard valid geometry work or masquerade as project ownership.
- Initial-once flag becomes completed only after valid initial content scroll executes; cancelled pre-frame initial work reschedules current activeSection. Preserve once-completed policy, native button semantics, explicit section click offsets and selected-nav visibility. No new public props or keyboard remapping.
- Write actual mounted deterministic RAF/createNodeMock tests first. Cover callback/sections/selection update before frame, redundant selection suppression, frame replacement/unmount/retained callback, initial A-to-B pre-frame rescheduling, completed initialization plus later updates, native controls and aria relationships. Preserve existing assertions.
- Heavy new+relevant unchanged owning tests, exact actual-config two-root strict types including dependency diagnostics, whitespace and module budgets. No compiler/assertion/baseline/timeout/harness weakening; request exact extra scope if necessary.
- Record original and iterative results, freeze exact two paths for root review. No shared docs/commits/broad gates/live/browser/Lab/providers/panel/private/backend operations. Synthetic geometry is not browser certification.

## Tests-first and implementation progress

Added seven actual mounted layout cases with deterministic RAF and synthetic owner geometry. Product unchanged initial heavy owning run ed4dba/session98987 completed b92724/native1:6failed/1passed,1.50s Vitest/123ms tests. Failing assertions demonstrate old sections/callback, stale active selection, lost pre-frame initialization, superseded queued callback, post-unmount frame/handler and foreign-container dispatch. Original native controls/initial-once/explicit-click/selected-navigation compatibility case already passes.

Implemented latest navigation props at frame execution; mounted layout/container/current-frame fences; cleanup invalidates queued scroll and retained click/scroll dispatch. Initialization becomes complete only when a valid first frame executes; cancelled initial effect can reschedule current selection. Explicit native buttons, current location/controls labels, offset arithmetic and completed-initialization-once policy preserved. Final focused/type checks pending; only exact two released paths and this report changed.

Expanded new owning suite to9 cases: retained cancelled initial callback cannot initialize/scroll; retained native section click uses latest callback only for still-present section, removed section no-op. Module budgets148source/104test lines; exact tracked-source whitespace check0d90ef/native0. Heavy new+unchanged settings-view checks session72798 and strict actual-config two roots/all-dependency diagnostics session18635 active. Source held during validation. Latest props updates do not discard queued valid geometry merely for callback identity changes; cleanup and superseding frame invalidate retained execution synchronously. Synthetic geometry/RAF scheduling covers component ownership, not browser native keyboard delivery or actual project navigation incidence.

First implementation validation658d53/native0:2files24tests pass (new9+unchanged15),31.23s Vitest/903ms tests. Strict2roots reported exactly one new fixture TS18046 at createNodeMock element.props (React declares unknown), product/dependencies otherwise clean; completed6685cc/native1. Added explicit local fixture className shape assertion, no behavior/assertion/compiler changes. Corrected owning/type repeats active3846/20694; await exact native results before freezing.

## Frozen worker completion claim

Exact two released Core files now FROZEN: apps/web/src/features/automation-studio/settings/SettingsSectionLayout.tsx (148lines) and NEW settings/tests/SettingsSectionLayout-recovery.test.tsx (104lines). Only this own report additionally changed. Original settings-view assertions untouched; no new public API, helper/barrel/style/config/baseline/caller/tree/runtime/backend paths.

Final heavy owning command from Core/apps/web: `pnpm exec vitest run src/features/automation-studio/settings/tests/SettingsSectionLayout-recovery.test.tsx src/features/automation-studio/settings/tests/settings-view.test.tsx`, wrapper label `codex settings navigation typed fixture`:2ffeeb/native0,2files24pass,14.85s Vitest/726ms tests. Final strict actual web config two roots plus two config declarations, all dependency diagnostics/noEmit/incrementalfalse, wrapper label `codex settings navigation final types`:211ef0/native0,0diagnostics. Exact tracked-source `git diff --check`:d54f17/native0. Tests-first unchanged product observed6fail/1pass; implementation preserved existing15 and passes new9.

Queued scroll uses current sections/selection/callback, active mounted content container and current frame identity. Superseded or retired frame callbacks and post-unmount handlers no-op. Valid queued geometry survives ordinary callback churn; retained current section buttons use latest callback, removed buttons no-op. Initial work cancelled before completion reschedules latest activeSection; cancelled retained callbacks do not set initialized. Once initialization completes, later state tracking does not repeatedly scroll content. Explicit section native buttons still scroll with original16px offset; current location/controls, content tab stop and selected-navigation geometry behavior preserved.

Limits: deterministic synthetic DOM/RAF with actual mounted layout verifies component control flow/ownership; no native browser keyboard/event/geometry/StrictMode configuration or actual caller hydration certification. React-test-renderer's deprecation warning remains. No broad gates/live/browser/Lab/provider/panel/private/backend operations, commits or pushes occurred. This is a worker completion claim, awaiting supervisor independent review/verification.

