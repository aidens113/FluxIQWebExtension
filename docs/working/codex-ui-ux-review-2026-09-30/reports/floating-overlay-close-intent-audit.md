# Floating overlay close intent audit

Status: Complete (read-only; later consumer implementation proposed)
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief

- Core source/tests stay frozen during root broad gates. Own only this downstream report.
- Read parent Current State, completed overlay-environment executable brief and exact Core automation-studio/workspace/overlays/accessible-floating-overlay.tsx, Drawer.tsx and directly owning overlay-hardening tests; discover exact Drawer path by rg, do not read unrelated consumers.
- Audit dismissal reasons and return-focus ownership in these real consumers; distinguish source-confirmed stale callbacks/cleanup from passive registration timing hypotheses. Preserve original Menu suppression, current Modal policy and minimal FocusTarget contract.
- Propose exact later consumer/test partitions and browser limitations. Do not modify source, create tests, run heavy/broad/browser/provider gates, commit or inspect private state.
- Environment implementation remains held until root broad gates finish. Provide findings and exact proposed scopes for the next serial release; do not duplicate the existing environment plan.

## Findings

Read parent Current State and completed executable environment brief. Inspected exact AccessibleFloatingOverlay and Drawer/ModalContent delegation, directly owning existing overlay-hardening tests, and direct real ViewAdder/LayoutPicker/WorkspaceDrawer/InspectorDrawer subscribers plus their consumed atomic-command hook to identify where close intent is lost. No unrelated runtime/dispatcher/provider/state contents inspected. All source and tests remain frozen; no gates ran.

## F1 — Real floating action, outside and teardown closures lack distinct return intent

AccessibleFloatingOverlay registers returnFocus captured from global document.activeElement. Its environment onEscape and onPointerDownOutside both call the same latest behaviorRef.onClose; cleanup returns the raw environment release. ViewAdderSurface's explicit Close button directly calls props.onClose, while successful async add also calls props.onClose. LayoutPickerSurface's successful async arrange calls that same callback. Neither surface communicates action-success versus cancellation to the wrapper.

This is a source-confirmed inability to encode desired return policy. The shared environment can reject ineligible targets or already moved outside focus, but body focus after unmount cannot reveal whether a successful action intended to move into the newly opened workspace panel. An eligible source-owned Escape/explicit cancellation may return its trigger; outside pointer, action completion and unrelated teardown should not reclaim a destination. Future consumer metadata is therefore necessary for a truthful stronger policy; changing shared ownership checks alone cannot infer close reason.

No actual successful action or workspace activation was executed. Action dispatch may have its own focus handling, uninspected here. Do not claim the current wrapper invariably overrides a newly registered overlay: registered newer stack entries already protect themselves via non-top release. Passive old-cleanup/new-acquisition ordering remains a separate unverified timing hypothesis.

## F2 — Existing request-keyed close protection is correct

ViewAdder/LayoutPicker subscribers key their Surface by request.id and bind onClose to store.close(channel, request.id). Their async closures therefore retain the initiating request ID. Existing overlay-hardening test opens old then new and proves closing old returns false while current new remains. Preserve this guard rather than rewrite ownership or introduce a second store.

The atomic gate blocks same-gate duplicate dispatch while pending and snapshots commands. Its hook does not itself fence retired Surface callbacks; a retained button callback can still call its old add/arrange closure after unmount, and a settled old execute can call the old onClose. The latter is safely request-keyed at the subscriber; dispatcher validation of retired actions is outside this audit and not assumed. A later local Surface lifetime fence should refuse retired dispatch and stale accepted completion UI closure without claiming cancellation of an already dispatched command. No shared atomic-command source change is needed for the proposed consumer partition, and its duplicate/snapshot tests must remain unchanged.

## F3 — Actual ViewAdder autofocus loses to heading Close

ViewAdderSurface renders enabled heading Close before its search input with autoFocus. AccessibleFloatingOverlay's combined selector starts with [autofocus] but querySelector follows DOM order across the full list, so the earlier Close button is selected and focused in its passive effect. This is the same selector-order defect repaired in ModalContent, confirmed here through a separate actual consumer. It also admits disabled/hidden explicit autofocus candidates through the unqualified [autofocus] branch. A wrapper-only entry-focus unit can prioritize eligible explicit autofocus separately and use panel.ownerDocument; it should not duplicate the global environment/trap recovery work.

## F4 — Drawer has no additional dismissal policy of its own

Drawer portals a data-overlay-root=drawer and delegates heading Close/Escape/busy/focus registration to ModalContent with overlayMode=drawer. It has no backdrop click handler or separate return logic. Updating Drawer alone therefore cannot distinguish arbitrary consumer content action closure, store reset and explicit heading cancellation. Any generic dialog close-intent feature belongs in the owning ModalContent/DialogProps boundary, serially after current frozen dialog/environment gates; do not add a redundant Drawer-only coordinator.

Workspace hierarchy/timeline and InspectorDrawer subscribers bind close to current request.id, so old captured heading callbacks are request-keyed. Unlike the floating subscribers, they do not key Drawer by request.id. A same-kind request replacement can retain one ModalContent environment/return target while its behaviorRef adopts the newer close callback. This is confirmed mount-lifetime semantics, not proof of a user-facing defect: opening such a replacement while the current modal owns/inerts the background and intended content reset policy were not traced. Treat adding request keys as an explicit later owner-design choice requiring same-kind replacement tests; do not silently remount content/drafts to fix a hypothetical race.

## Exact later partitions and policy

1. **Floating entry priority, independently bounded:** existing automation-studio/workspace/overlays/accessible-floating-overlay.tsx and NEW owning tests/accessible-floating-overlay-focus.test.tsx. Actual wrapper plus real ViewAdder content fixture reproduces Close taking search autofocus. Prioritize valid data-autofocus/autofocus, then enabled content control, then panel; validate effective disabled/hidden/inert/visibility and use panel.ownerDocument. Preserve positioning/ResizeObserver/scroll and existing calculated-position tests. This does not change close semantics and can precede the wider consumer unit if desired.
2. **Actual floating close intent/lifetime:** the same accessible-floating-overlay.tsx, exact ViewAdderOverlaySubscriber.tsx and LayoutPickerOverlaySubscriber.tsx, and NEW owning tests/floating-close-intent.test.tsx. Serial with partition1 because wrapper ownership overlaps. Keep subscriber/store/dispatcher/atomic API intact. Wrapper privately records known Escape/outside reason, suppresses unknown teardown, and receives a focused optional callback that reports whether its current Surface explicitly requested trigger return. Surface-local ref is updated synchronously before props.onClose, avoiding a last render requirement. ViewAdder explicit Close records return permitted; accepted add/arrange records action/no return. The callback is current through behaviorRef and cannot publish an old keyed Surface's reason into a newer Surface. Include retired callback/accepted completion lifetime fences local to Surface. No mutable shared close-intent object or generic store is needed. Confirm callback naming/type/default compatibility in the exact implementation brief before release.
3. **Generic ModalContent dismissal intent, only if required:** existing programs/components/overlays/ModalContent.tsx, DialogProps owning type therein, and NEW owning tests/ModalContent-close-intent.test.tsx. Drawer remains delegated and likely unchanged. Explicit heading Close and Escape can mark owned return; unrelated unmount/action from arbitrary children requires an opt-in owner callback/close-intent seam rather than inference. This public dialog change impacts many consumers and should not be released as a tiny Drawer patch; discover exact affected public use cases before expanding scope.
4. **Same-kind Drawer request lifetime, conditional:** existing WorkspaceDrawerSubscribers.tsx and InspectorDrawerSubscriber.tsx plus NEW owning tests/drawer-request-lifetime.test.tsx. Decide intended content/draft preservation versus new-owner remount first. Request-keyed close already works. Add keys only if a reproduced replacement/return-target defect justifies them. No changes proposed to unrelated drawer consumers.

Partitions above are candidates, not released paths. No helper/API/backend/runtime/provider/panel/style or shared environment implementation is needed for the first two units; root owns any new public surface contract review. Menu's effect-local close intent and negative-tabindex native departure behavior remain unchanged.

## Meaningful tests and remaining assumptions

- Use actual wrapper and keyed subscribers with bounded synthetic portal/document/resize/frame fixtures; caller/store actions are synthetic. Assert correct initiating request ID, busy outside/Escape refusal, explicit close return, outside/action/teardown suppression, owner-document eligibility and no late focus stealing. Keep listener/stack/scroll semantics through actual existing helper or a bounded captured-options public-boundary fixture plus independent helper suite.
- Reproduce actual search autofocus ordering before changes. Invalid explicit candidates fall back; hidden/unfocused document or passive retired lifecycle must not claim focus. Existing position calculations and overlay-hardening tests remain unchanged.
- Old accepted action completion cannot close newer store request (existing test retained). New local retired callbacks do not dispatch. Same-owner pending duplicate remains refused by existing atomic gate. Caller error still displays current error and keeps Surface available; do not turn failed action into successful close.
- If testing optional close-return callback, call it during cleanup after explicit/action refs change synchronously but before another render, proving the policy does not depend on state commit. Capture old Surface callbacks and acquire a new request to prove current newer return policy is not overwritten.
- Drawer replacement tests must prove a specific behavior before any key/remount change; they cannot merely assert key presence. No live browser IME, native Tab destination, ResizeObserver positioning, inert isolation, popup/assistive-technology or accepted workspace focus destination was exercised.

## Return

Only this report changed. Environment executable plan remains complete/held; supervisor favors omitting the outside-connected trap branch unless exact isolation ownership is cleanly proved. This consumer audit adds real close-intent/entry findings without reopening or duplicating environment implementation. Source/test freeze, Claude/private/backend/live boundaries preserved; no heavy/broad/browser/provider/panel commands or commits.
