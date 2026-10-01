# Core navigation recovery audit

Status: Complete
Owner: runtime_contracts
Date: 2026-10-01

## Written bounded brief and exact reads

Supervisor released read-only automation-studio operational sidebar/navigation controls audit, maximum five source/test files total, to identify one concrete keyboard/loading/error/retained-owner defect and propose exact narrow implementation/tests. Only this report writable; floating five paths remain frozen. No checks, source/tests/shared docs/private/backend/runtime or protected coordinator implementation reads authorized.

Exactly five files inspected in paired Core:
1. apps/web/src/features/automation-studio/settings/SettingsSectionLayout.tsx
2. apps/web/src/features/automation-studio/live/components/AutomationHierarchySurface.tsx
3. apps/web/src/features/automation-studio/hierarchy/AutomationProjectHierarchySidebar.tsx
4. apps/web/src/features/automation-studio/hierarchy/components/ProjectTree.tsx
5. apps/web/src/features/automation-studio/hierarchy/components/tests/ProjectTree.test.tsx

File/path/identifier searches located these sources and existing declarations; no sixth source/test was read. Sidebar search/type controls are labelled native input/select, clear is named, match count is live, collapsed controls are labelled. Tree has semantic tree/treeitem roles, roving focus and virtualization; existing owning tests assert these through static markup. No complete keyboard algorithm/helper/controller was read, so no assumed key-to-command mapping or coordinator defect is claimed.

## Confirmed N1: queued settings-scroll frame calls stale navigation owner

SettingsSectionLayout trackSection cancels a previous pending frame on another scroll, captures event.currentTarget, then schedules requestAnimationFrame. The callback closes over that render's props.sections, props.activeSection and props.onActiveSectionChange. The only frameRef cleanup is the mount-lifetime cleanup effect; ordinary props replacement does not cancel the queued frame or replace its captured navigation values.

Exact source-confirmed public-prop sequence: mounted layout receives sections A, activeSection A and callback A; a scroll queues frame F without executing it; layout rerenders with sections B and callback B (or a new activeSection with the same sections); F runs against current container geometry but computes membership using A and calls A if it differs from captured old activeSection. Thus a retired callback receives navigation state after replacement, or an unchanged callback receives a redundant/outdated selection based on old activeSection. No unmount, asynchronous backend or user data is needed. This is a real component callback-ownership defect, established by the captured closure plus missing dependency/lifetime invalidation; actual callers replacing callbacks/sections between native frames were not read or reproduced, so its production incidence is unverified.

A permanent callback replacement may be semantically the same owner, so do not simply discard every scroll frame whenever an inline callback reference changes. Prefer current latest navigation props at frame execution plus component/frame lifetime fencing. A queued frame that belongs to an obsolete container/unmounted component must not dispatch; a still-current frame should compute with latest sections/current selection and invoke latest callback. A retained old onScroll handler should not supersede a newer active frame after retirement. This scope does not establish project ownership and must not invent projectId props or couple the generic layout to hierarchy state.

## Confirmed N2: first navigation scroll can be cancelled without rescheduling

Initial scroll effect is keyed by activeSection. It sets initializedRef.current=true BEFORE scheduling its first frame. If activeSection changes before that frame executes, React cleanup cancels it; the replacement effect immediately returns because initializedRef is already true. Therefore no initial scrollToSection runs for either selection. The independent selected-navigation visibility effect only moves the sidebar selection into view, not content. Internal selectSection does scroll synchronously, so that path can mask the issue; externally hydrated/replaced activeSection before first frame has no such guarantee. React StrictMode setup/cleanup/setup can exercise the same premature initialized flag, conditional on StrictMode mounting configuration, which was not inspected.

Both sequences are source-level confirmed; no browser/synthetic execution was authorized or performed. Existing initial-once behavior intentionally avoids scrolling content on every scroll-tracking selection update; fixing N2 must preserve that policy instead of adding unconditional activeSection scrolling.

## Narrow implementation and meaningful tests proposal

Proposed exact two paths: existing apps/web/src/features/automation-studio/settings/SettingsSectionLayout.tsx and NEW settings/tests/SettingsSectionLayout-recovery.test.tsx. Existing settings-view tests stay untouched. No caller/runtime/coordinator/tree/backend/CSS/config/helper paths required for the local latest-props/frame lifetime repair. Root may authorize one separate bounded actual SettingsSectionLayout consumer read before release if it needs actual navigation ownership incidence; current component public-prop sequence is sufficient for local correctness design.

Tests-first actual component with deterministic synthetic requestAnimationFrame queue and createNodeMock owner container/navigation geometry, without mocking the layout or exporting private helpers:
- Queue scroll A, rerender callback/sections/activeSection B before executing frame, then flush: callback A untouched, current selected section determined only from B/current geometry and delivered to callback B.
- Queue scroll, rerender activeSection equal to the frame's current visible section: no redundant callback based on captured old activeSection.
- Repeated scroll cancels older frame; unmount cancels queued work and retained frame/onScroll callbacks cannot dispatch afterward.
- Mount activeSection A then replace with B before initial frame; initial content scroll occurs once to B, not zero or stale A.
- Initial first-frame completion followed by ordinary activeSection changes does not repeatedly auto-scroll content; selection tracking/explicit native click and selected sidebar visibility continue behaving normally.
- Preserve native button Enter/Space behavior, section aria-controls/current location, content tabIndex and smooth section scroll offsets. No keyboard remapping required in this two-path unit.

Proposed algorithm: latest navigation props ref plus current mounted/container/frame identity; read current sections/selection/callback only when a current queued frame executes; invalidate/cancel frames during cleanup and ownership replacement as required without treating inline callback churn as navigation retirement. Initial completion flag becomes true only after valid first scroll executes; cancellation before execution permits latest activeSection setup to reschedule. Root implementation brief must state deterministic initial-completion/lifetime ordering and preserve explicit-click scrolling and selected-item visibility.

## Deferred tree concern and limits

ProjectTree onKeyDown accepts any bubbled target whose closest treeitem belongs to the tree; it does not inspect interactive descendants/defaultPrevented/composition/modifiers before passing event.key to imported automationHierarchyKeyboardAction. Root Add Flow is a real nested native button. This is a concrete missing filter but the fifth-file limit prevents inspecting the keyboard helper and TreeRows handlers to prove an actual duplicate/wrong command, so it is a deferred investigation, not a second confirmed keyboard bug. A later read-only partition should name keyboard.ts plus TreeRows.tsx and owning keyboard/interactive tests, then prove an actual nested-button or handled-event outcome before changing it.

Only this own report changed. No source/test edits, checks/types/build/heavy/broad/live/browser/Lab/provider/panel/private/backend/runtime operations or commits. Actual DOM focus/geometry/event delivery, scheduling under browser load, Settings callers and StrictMode configuration were not exercised. Existing owning declarations/markup assertions were inspected, not rerun. Worker findings are claims for supervisor review; floating exact five files stay frozen.
