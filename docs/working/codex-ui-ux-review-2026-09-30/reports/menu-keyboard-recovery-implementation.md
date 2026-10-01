# Menu keyboard and disabled activation recovery

Status: Planned — product/test source held pending explicit supervisor release
Owner: deployment_docs_audit worker
Date: 2026-10-01

## Scope and evidence

Read parent Current State and exact released planning brief, frozen shared-overlay-focus-audit F6/F7, current controls/Menu.tsx and imported overlay-environment contract. Original component-contracts accessible menu and environment assertions were read during the preceding audit; remain unchanged. Proposed exact Core paths: apps/web/src/features/programs/components/controls/Menu.tsx and NEW owning controls/tests/Menu-keyboard.test.tsx. Only this report changes during ninth Core gates. Dialog four paths and operational twelve paths remain frozen. No helper/barrel/environment/Modal/Link/router/style source ownership is assumed.

Current Menu ignores disabled on href options, has no arrow-key trigger entry or Tab exit, intercepts modified/composing menu navigation, admits hidden/aria-disabled targets, uses an incorrect ArrowUp fallback when current focus is absent, and permits retained removed/disabled option closures to dispatch. Its boolean closeMenu argument is discarded, while environment release always restores a connected returnFocus target. A synchronous onSelect exception prevents current closeMenu. These are source-confirmed paths; browser navigation/focus consequences are not certified.

## Cohesive state and ownership design

Keep state/open position API and Button/IconButton/Next Link composition. Add local synchronous open-lifetime ref plus generation, current options ref and opening intent (first/last). Ref state must invalidate old action/key callbacks immediately on close, preventing same-turn duplicate selection and previously retained callbacks after close/reopen. Current options are refreshed during render. A rendered option activation requires its captured generation to remain current, menu to remain open, and the same captured option to remain the current enabled entry; removed/replaced/disabled captured options refuse dispatch. Prefer conservative captured-option identity over invoking a newly replaced callback through stale UI. Current rerendered callbacks operate normally. No wire, routing or generic overlay owner state changes.

Local eligible targets must belong to this menu, be connected/rendered, effectively enabled, non-aria-disabled, and outside hidden/inert/aria-hidden ancestors; inspect computed visibility as well as geometry. Use panel.ownerDocument for current focus and environment acquisition. Require current menu lifetime and source focus ownership for event-driven focus changes; old/unmounted menu or off-document/hidden-document callbacks do nothing. Passive options updates must not steal outside focus. If currently focused owned item disappears/becomes disabled, reconcile only while this active menu still owns focus, choosing the next surviving eligible item or panel; exact removed-node focus timing stays a browser limitation. No arbitrary option metadata traversal.

## Disabled and native activation policy

- Enabled href options remain Next Link with their original href; preserve native routing, modified-click/new-tab and native Enter behavior. Do not add onSelect behavior to href options, since current Menu does not call it.
- Disabled button options stay disabled and additionally reject retained callbacks through current owner/option checks.
- Proposed disabled href presentation is a non-link element with role=menuitem, aria-disabled=true and tabIndex=-1, retaining label/icon/danger presentation. It has no href or navigation handler, so browser context-menu/auxiliary activation cannot bypass a click-only preventDefault guard. Enabled Link routing stays unchanged. This is an explicit implementation choice for root review; if root requires preserving disabled Link markup, document the native context-menu limitation rather than claiming a click guard disables every route.
- Only current eligible button actions dispatch once. Close/invalidate before invoking onSelect so synchronous exceptions cannot leave a live actionable menu. Propagate the caller exception instead of inventing local error presentation. Action-induced newer overlays must not receive cleanup focus from the old trigger. A captured old-generation finalizer cannot close a newly opened menu.
- Native Enter/Space activation stays on the real enabled button/link. Menu key handlers do not synthesize clicks, which avoids duplicate native activation and preserves link semantics.

## Keyboard entry and movement

Plain ArrowDown/ArrowUp on the currently focused trigger opens first/last eligible item respectively. Click/native trigger activation opens first. Ignore defaultPrevented, Ctrl/Alt/Meta/Shift shortcuts and composition/keyCode229; Enter/Space retain native trigger button activation. Current open menu Home/End/ArrowDown/ArrowUp move through eligible items, wrapping with deliberate absent-focus fallback (Down first, Up last). PreventDefault only for a valid handled movement. Panel fallback uses tabIndex=-1 when no item is eligible.

Use one roving item tab stop, with other menu items tabIndex=-1, and current item focus tracked locally. All-disabled menu focuses panel. Setting item tab stops does not change enabled Link href/native activation. Option updates retain valid focused item by ID while captured activation still requires current option identity. If no valid item survives, fall back deterministically under current owner focus rather than claiming outside focus. Typeahead is a separate enhancement, not required to fix the audited defects.

## Close intent without environment changes

Use an effect-local environment options object and close-intent ref. The existing acquireOverlayEnvironment API retains this options object, so cleanup can set its returnFocus=null for outside/Tab/action/teardown reasons before invoking its existing release; environment source/stack behavior stays unchanged. Escape and explicit trigger dismissal can retain eligible initiating-trigger restoration. Teardown, action and outside pointer dismissal suppress trigger return and never reclaim focus already moved elsewhere. Validate initiating trigger connection/eligibility and current owner focus before opting into return; do not change lower-stack or idempotent release semantics.

Tab proposal: close/invalidate the current menu without preventDefault. While current owned menu item actually has focus in a visible focused document, move focus to its trigger before native Tab/Shift+Tab default movement, then suppress returnFocus cleanup. This anchors the native next/previous destination in trigger DOM order and avoids cleanup reclaiming the destination. If focus already moved outside, simply close without a focus call. This sequence needs explicit tests for ordering and remains a real-browser hypothesis until tested live; allowing native Tab directly from the portal is simpler but can select a destination determined by portal DOM position. Root should confirm the selected policy before implementation release.

Menu's own Escape branch must honor nativeEvent composition/defaultPrevented/modifiers and current lifetime; the shared document capture Escape currently ignores those guards and is explicitly deferred. Do not claim a Menu-only guard repairs global Escape during IME. Existing environment's top-menu Tab means underlying modal trap is separately deferred; suppressing return focus does not claim a new global trap.

## Tests first and narrow verification

Use actual Menu with a bounded synthetic portal/document fixture, actual owning Button/IconButton, and Next Link's public rendered href/click boundary. No shared test helper or product helper path. Mocking portal placement is permitted; routing assertions must inspect the enabled href/native prevention contract rather than replace routing with a fabricated navigation function.

1. Reproduce disabled href currently exposing navigation/keyboard target; verify disabled button and link consistency, retained disabled/removed/replaced callbacks, and zero dispatch from invalid owners. Enabled Link preserves exact href, native Enter and modified click; current button action executes once and old generation cannot dispatch after close/reopen.
2. Reproduce trigger ArrowUp/Down lacking entry and absent-focus ArrowUp selecting penultimate. Test first/last entry, Home/End/wrap, eligible-only targets, all-disabled panel fallback, roving tab stop, modifiers/defaultPrevented/IME and native Enter/Space no double click.
3. Reproduce Tab menu remaining open; test close ordering, no preventDefault, cleanup suppression and no focus reclaim after destination changes. Test outside pointer/action/teardown suppression versus current eligible Escape/explicit return, with effect-local options object passed to the actual release contract. Original independent environment tests remain mandatory unchanged.
4. Invoke a current action that synchronously throws or opens a newer overlay/menu generation; confirm menu close state is already invalidated and cleanup does not focus old trigger or close new generation. Exception remains observable.
5. Test updated options, unmounted/old-lifetime keyboard callbacks, foreign source focus, disconnected/hidden/inert/fieldset-disabled targets, hidden/unfocused document and same-owner position updates without passive focus stealing.
6. After explicit release, run new owning tests plus unchanged component-contracts/use-operation-lock/Studio overlay-hardening as appropriate, then scoped actual web tsconfig for exact two roots. Root independently reviews and owns broader gates/authored docs/integration.

## Held decisions / boundaries

Confirm disabled href non-link presentation and trigger-anchored native Tab policy with root before release. Exact two product/test paths appear sufficient; environment options mutation is within its existing public contract, but root can choose a separately owned environment policy follow-up instead. No source/test edits, heavy commands, browser/provider/panel/private payload operations, shared docs or commits occurred in planning. Global return/trap/Escape/new-body-root fixes remain separate backlog; source/component tests will not certify browser/IME/assistive-technology behavior.
