# Shared overlay environment recovery plan

Status: Complete — read-only design, implementation not released
Owner: deployment_docs_audit worker
Date: 2026-10-01

## Scope / actual consumers

Read parent Current State and written follow-up brief, shared-overlay-focus-audit F4/F5/F8, programs/overlay-environment.ts, actual direct acquisition consumers ModalContent.tsx, Menu.tsx and automation-studio/workspace/overlays/accessible-floating-overlay.tsx, Drawer.tsx integration, and existing owning Studio overlay-hardening environment tests. Portal/acquisition searches found exactly four apps/web source portal producers: Modal, Drawer, Menu and AccessibleFloatingOverlay. All register environment entries through their direct consumer's passive effect. No unrelated application/runtime/storage data inspected; no tests/heavy/live commands or source edits.

Dialog and operational source stay frozen. Menu has a separate held exact two-path implementation plan; environment edits must be serialized with its root-reviewed close-policy use. Existing registered overlay stack, scroll lock, original inert/aria-hidden restoration, four document/two window listener counts, connected-target restoration and lower-release/idempotence guarantees remain binding.

## Confirmed candidate/trap defects

Trap's selector union includes native controls and all tabindex except the literal string -1. Its final predicate checks only the candidate's own hidden/aria-hidden. Inputs type=hidden, non-rendered or hidden/inert ancestor descendants, effective disabled fieldset descendants matched through the alternate tabindex selector, and tabIndex=-2 can enter the computed sequence. visibility:hidden may retain geometry and therefore needs computed-style eligibility, not geometry alone. Effective :disabled preserves the native first-legend exemption instead of blanket rejecting every disabled-fieldset descendant. The final sequential candidate policy should reject tabIndex<0 as numeric DOM state.

Wrapping handles only exact first/last activeElement. Current ModalContent now deliberately focuses panel when all candidates are disabled; when children later become enabled, Shift+Tab from panel has no intentional final-item fallback. Similarly a removed/disabled previously active item or unexpectedly outside activeElement has no owned recovery branch. Trap should use current eligible candidate order on each real Tab, wrap first/last, and choose first/last for panel or invalid current position only when this top modal owns the event/lifetime. No focus moves on passive render/rebuild. Focus remains on panel for an empty eligible list.

Top menu/nonmodal entries do not request trapFocus, so their Tab currently bypasses underlying modal's trap branch. Menu's own exit policy is separately planned. Broadening the shared trap to underlying modal while a top menu exists could fight menu native Tab and is not part of the minimal environment fix; specify and test this only in a later synchronized nesting policy unit.

## Escape ordering and composition

Shared document keydown handler runs in capture before React panel/bubble handlers. It immediately prevents/stops Escape and calls the top entry's current onEscape when canDismiss permits. Thus Menu's later IME guard alone cannot prevent global dismissal during native composition. At the shared capture entry, ignore already defaultPrevented events, native isComposing/keyCode229 and modified Escape. Do not promise to honor preventDefault called later during bubble: that has not happened when capture executes. Preserve top-entry-only routing and busy canDismiss, and do not weaken authorization/OperationGate checks. Modal convenience Enter has already been repaired separately; shared environment should not duplicate submission behavior.

Use visible/focused document and connected current top panel checks when actual DOM/document capabilities exist. Avoid treating missing methods in the existing lightweight synthetic fixtures as evidence of a hidden/unfocused browser document. A browser Document always supplies those capabilities; compatibility fallback exists for the helper's current test/public FocusTarget abstraction, not to mask malformed product state.

## Return-focus release ordering and narrower F5 conclusion

Release determines entry index/topness, removes the entry, applies the remaining isolation, then removes final listeners/restores original scrolling, then focuses connected returnFocus. Existing nested tests verify underlying target return while the underlying modal keeps scrolling locked. Any lower/non-top release makes no focus call, and repeated release is idempotent.

Consequently a newer overlay that has already acquired an entry protects itself: releasing the older entry sees wasTop=false. The earlier audit's action-opens-overlay sequence is not proof of unconditional clobbering after registration. When React removes an old menu and mounts a new overlay, cleanup can occur before the new passive acquisition; focus/return-target capture ordering during that gap remains a browser/component hypothesis. Do not claim every action-induced overlay is currently broken.

Actual source gaps remain: release considers neither current document visibility/focus nor effective return-target eligibility, and connected old trigger restoration occurs even if outside pointer/native Tab/user navigation has already moved focus elsewhere. Menu and floating consumers do not encode close intent. Route teardown with a still-connected initiating control also uses unconditional restoration. An environment-only ownership guard can refuse reclaim where the current focus is already on an unrelated connected control; explicit consumer close intent is needed where focus naturally falls to body after removal.

Minimal shared release policy proposal:

- Preserve wasTop and idempotence first; capture current activeElement and released panel/root focus ownership before applying remaining isolation.
- If available, require document visible/hasFocus and same-document connected initiating target. Reject rendered DOM targets that are effectively disabled, hidden/inert/aria-hidden, visibility hidden/collapse or non-rendered after remaining isolation is applied.
- Restore only when closing panel/root still owned current focus, or focus is body/null/disconnected after removal and the consumer still permits restoration. Never move focus away from an unrelated connected active control or into a root isolated by the remaining top modal.
- Preserve the minimal FocusTarget contract (focus plus optional isConnected): non-DOM focus proxies cannot be subjected to HTMLElement-only methods. Existing connected fake targets in old tests must still receive focus, disconnected targets must not, and old assertions remain unchanged. Add richer DOM/document fixtures to prove guarded behavior rather than weaken old fixtures/assertions.
- Consumer options can already set returnFocus=null before calling release. Menu's separately reviewed effect-local options object can use this existing seam for outside/Tab/action/teardown suppression; no new generic close-intent API is required for that bounded unit. Modal/Studio floating close intent requires its own serialized consumer brief if stronger policy is desired.

## F8 isolation discovery result

applyEnvironment isolates current body children only on acquire/release. A newly inserted body sibling before its acquisition can remain uninert during that interval. However every actual source portal producer discovered here registers with this environment; once acquired, active root selection and existing-child isolation rerun. No permanent unregistered interactive portal consumer was discovered. F8 remains a conditional timing gap, not a source-confirmed persistent product defect warranting a MutationObserver.

Do not add blanket observers or global focusin reclaim. If a specific portal/host needs a pre-acquisition guarantee, reproduce its real commit/effect sequence and give its exact consumer ownership before choosing layout-effect acquisition or explicit root registration. Observation of body additions would itself need original-state/restoration/lifetime semantics and could inert a just-created permitted portal before it registers. That risk is not justified by the present evidence.

## Minimal exact next partition / tests first

Proposed shared-only implementation paths are existing apps/web/src/features/programs/overlay-environment.ts and NEW nearest owning apps/web/src/features/programs/tests/overlay-environment-focus.test.ts. No Menu/Modal/Studio source modification in this unit; no public helper extraction/barrel assumed. Keep eligibility and release checks narrow/private to their owning capability; request exact additional focused helper ownership before changing budgets or exporting shared candidate policy. A later root-approved integration can unify current Modal/Menu eligibility with a focused module, but no extract-and-drop or concurrent shared-file edits.

Tests must call actual acquireOverlayEnvironment and invoke its installed handlers from a bounded synthetic document/DOM fixture:

1. Native Escape defaultPrevented/composition/keyCode229/modifiers do not dismiss, preventDefault or stopPropagation; ordinary Escape calls current top once, never lower, honoring current busy and released lifetime. Test hidden/unfocused document and disconnected top panel through actual DOM-capable fixtures.
2. Trap excludes hidden input, hidden/inert/aria-hidden ancestors, computed CSS visibility, zero geometry, negative numeric tabindex and disabled/disabled-fieldset candidates matched via tabindex. Native first-legend eligible candidate stays eligible. Test first/last wrapping, panel/removed/current invalid position in both directions, no eligible candidate panel fallback, and no modified/composing/defaultPrevented interference.
3. Release restores eligible underlying control while preserving original scroll/isolation/listener counts; refuses foreign/disconnected/disabled/hidden/inert/isolated/hidden-document/unfocused-document targets; refuses external active focus reclaim. Preserve all original simple connected FocusTarget fixtures. Test top versus lower release, idempotence and a newer registered overlay protecting its active focus.
4. Options.returnFocus=null before release suppresses restoration without losing cleanup. Simulate explicit consumer policy separately without pretending that the environment infers a close reason from route state.
5. Conditional new body-root insertion may be characterized in a synthetic fixture as acquire-triggered isolation, but must not be reported as fixing a discovered unregistered consumer. No observer/new root policy implemented without a concrete consumer brief.

After release run new owning helper tests plus unchanged Studio overlay-hardening10, component-contracts20, OperationGate1 and dialog88 selection as relevant; actual-config scoped environment/new-test types, root independent review and broad gates follow. No browser IME/inert/Tab/assistive-technology certification is implied by synthetic assertions.

## Return / limitations

Only this report changed. F4 trap/candidate and capture Escape guards are concrete minimal next work; F5 ownership-aware return needs rich tests preserving old public focus proxies and serialized consumer close-intent integration. F8 lacks a persistent actual consumer and stays conditional. Menu remains held for supervisor's explicit implementation release after ninth Core gates. No source/test/shared docs edits, heavy/broad/live/provider/panel/private operations or commits.
