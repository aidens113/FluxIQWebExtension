# Shared overlay keyboard and focus audit

Status: Complete — read-only, implementation proposed
Date: 2026-10-01
Owner: deployment_docs_audit worker

## Scope / evidence

Read parent Current State and exact Modal.tsx, ModalContent.tsx, AlertDialog.tsx, AuthorizationDialog.tsx and controls/Menu.tsx. Read imported overlay-environment helper, directly consumed Button/IconButton semantics and owning component-contracts/use-operation-lock tests plus the overlay-environment cases in Studio overlay-hardening.test.ts. No unrelated Studio implementation, protected backend/runtime/storage or actual UI state inspected.

All findings are source/call-order evidence. No component tests, type/build/broad gates, browser/provider/panel operations or source edits ran. Existing tests assert accessible markup, inherited busy fieldset, environment scroll/isolation bookkeeping, connected return targets and OperationGate duplicate prevention; they do not execute the confirmation Enter/IME, focus entry or menu Tab sequences below. Preserve all existing authorization/OperationGate/backend contracts.

## F1 — Enter on Cancel or Close invokes the primary confirmation

Modal.tsx submitOnEnter ignores only non-Enter/modifier keys and TEXTAREA/contenteditable targets. It searches currentTarget for the primary submit button, preventDefaults the event and clicks it for every other target. AlertDialog renders Cancel followed by its primary/danger data-modal-submit confirmation; AuthorizationDialog renders Cancel followed by Authorize. Enter bubbling from Cancel, heading Close or another button therefore invokes confirmation instead of native activation of the focused control. This is an actual source handler path and high-priority recovery, especially for destructive confirmation. No destructive action was executed in this audit.

The same problem affects a menu trigger or button action inside a modal. A portalled Menu still has React event ancestry; Enter from its menuitem may bubble through Modal even though the menu DOM is outside the panel. Handler does not verify target is in current dialog's DOM, so it can invoke an underlying dialog action. Nested React modals have the same ancestry risk.

Fix must scope convenience Enter submission to appropriate single-line inputs owned by this dialog, honor already handled/defaultPrevented events and preserve native button/link/select/form semantics. Do not replace it with automatic Enter-anywhere authorization. If a genuine form owns submission, let its normal submit route run once instead of adding a second click. Keep disabled/busy authorization enforced by existing controls/fieldset/OperationGate.

## F2 — IME composition can submit or dismiss during input confirmation

Modal submitOnEnter does not inspect nativeEvent.isComposing or keyboard composition compatibility. A composing Enter in password/PIN/name input can submit a primary action. Menu navigation similarly intercepts arrows/Home/End/Escape with no composing/modifier guards. Shared overlay-environment document capture Escape has no composition/defaultPrevented/modifier check; it can close an authorizing modal while composition Escape is intended for an IME candidate UI (subject to current busy dismissal guard).

Browser-specific composition timing is unverified, but missing source guards are confirmed. Add meaningful native-event composition/defaultPrevented tests; preserve multiline/contenteditable behavior, native shortcuts and top-overlay-only Escape. Legacy keyCode229 support can be considered only if browser compatibility requires it; do not claim a browser result without execution.

## F3 — Autofocus selector prefers Close over explicit data-autofocus

ModalContent's initial query combines [data-autofocus], [autofocus], enabled inputs/selects/textareas/buttons in one selector list. querySelector returns DOM order, not selector-list priority. The enabled heading Close button is before the dialog children, so normal authorization Password data-autofocus loses to Close. native/React autofocus can also be overwritten by the later effect focus.

Query explicit autofocus candidates separately, validate a real focusable/visible/enabled candidate, then choose sensible content input/button fallback, and finally panel. Current explicit data-autofocus clause can select a disabled/hidden element without fallback, leaving no successful initial focus; busy fieldset and hidden ancestor semantics need real candidate checks. Capture/restore focus using panel.ownerDocument rather than unrelated global document when possible. Do not change credential readiness, slicing, token handling, or auth factors.

## F4 — Trap includes hidden/disabled candidates and does not recover panel/outside entry

overlay-environment trapFocus filters only each element's own hidden and aria-hidden attributes. It admits inputs type=hidden, descendants of hidden/inert/display:none ancestors, explicitly negative tabindex values other than-1, and potentially disabled elements matched by the alternate [tabindex] selector. It neither validates actual rendered geometry nor effective disabled fieldset state beyond the CSS selector branches.

The trap wraps only when activeElement is exactly first/last. If no content autofocus succeeds and the section itself is focused, Shift+Tab is not redirected to the final content target; an active element outside the panel or a control removed/disabled during busy transition also has no deterministic fallback. Native browser movement/inert handling may limit consequences; actual escape behavior remains untested. Source should deliberately handle panel/outside/removed focus for both Tab directions using current eligible candidates without stealing passive focus on every render.

Focus trap and entry must share a coherent candidate policy so initial focus cannot choose a node the trap excludes. Keep busy transition semantics and top-overlay ownership explicit.

## F5 — Return-focus cleanup is unconditional beyond connection

acquireOverlayEnvironment release restores focus whenever the released entry was top and returnFocus.isConnected is not false. It ignores document focus/visibility, current active owner focus, target hidden/inert/disabled state and whether a user already moved to another control. Menu's closeMenu(_restoreFocus=false) discards its reason, so outside pointer dismissal, Tab-like dismissal, explicit activation and Escape all eventually receive the same cleanup restoration.

Source sequences that can reclaim focus: a menu closes after an action opens another overlay, then its cleanup focuses its old trigger; outside dismissal cleanup can pull focus back from the new control; route/component teardown while document is hidden can invoke focus on an unrelated still-connected control. Exact browser event order is not certified. Nested overlap must preserve currently verified underlying-overlay restoration and scroll locks while avoiding restoration into a currently isolated root or a newer active overlay.

Use explicit close/return policy and source-owned focus checks, not blanket suppression of all restoration. Escape/explicit dismissal can restore a eligible initiating control; outside pointer/Tab navigation must not undo user's intended focus destination. Lower/non-top release must still make no focus call, and release remains idempotent. Preserve current connected-focus fixture requirements while adding richer owner/document cases rather than weakening them.

## F6 — Menu disabled href options remain actionable

MenuOption.disabled is applied only to button options. The href branch always renders Link with no aria-disabled, tab suppression or activation guard, and the :not(:disabled) menu query includes anchors. A disabled navigation option therefore remains focusable/activatable as an enabled menuitem. Honor the option's existing disabled contract consistently for button and link, without redesigning routing. Disabled links should be announced and excluded from eligible keyboard targets; retained disabled handlers should refuse navigation before any action.

## F7 — Menu entry/Tab/native shortcuts are incomplete

Trigger has click/toggle only; no ArrowDown/ArrowUp opening behavior or deliberate last-item entry. Popover assigns every native menuitem its default tab stop and does not handle Tab; a Tab can leave the menu while it remains top in the environment stack. When a menu is above a modal, the top menu has trapFocus unset, so shared document Tab logic does not apply the underlying modal trap. Existing body inert isolation remains, but there is no intentional menu close/next-focus policy.

Arrow keys/Home/End unconditionally preventDefault even for modified or composing events. moveFocus includes hidden/aria-disabled links and computes ArrowUp from absent activeElement as length-2 rather than a deliberate last-item fallback. If options change while focus is on a removed/now-disabled item, menu has no focus/roving reconciliation. These are keyboard-model gaps; no screen-reader or WCAG certification claim is made.

Improve menu keyboard entry, eligible target selection and explicit Tab exit in a separate bounded unit. Keep native Enter/Space activation, one action call and safe close semantics. A sync onSelect exception currently prevents closeMenu from running; caller owns error presentation, but menu teardown should not depend on a successful action if a focused action has already been dispatched.

## F8 — Dynamically added body siblings can escape current isolation

applyEnvironment isolates current body.children only when entries acquire/release. It does not observe a new sibling added while a modal remains open. A subsequently mounted unrelated portal root can therefore lack the modal's inert/aria-hidden isolation until another environment update. This is a conditional source gap; whether actual registered application portals use this path was not investigated here. Record as a follow-up requiring exact consumer discovery, not an excuse to add global DOM mutation observers or blanket subtree mutation now.

## Proposed implementation ordering / exact partitions

1. **Confirmation keyboard and entry (highest priority):** existing overlays/Modal.tsx, ModalContent.tsx; new owning overlays/tests/Modal-keyboard.test.tsx and ModalContent-focus.test.tsx. AlertDialog/AuthorizationDialog are read/test subjects; change their source only if concrete behavior cannot be repaired at the owning primitive. Preserve ready/busy/OperationGate contracts. Reproduce Cancel Enter, Close Enter, explicit input Enter, nested/portal-origin Enter, defaultPrevented and composition before changing source. Test actual returned handlers and synthetic DOM/portal boundaries, not duplicate handler code.
2. **Shared environment trap/return policy:** existing programs/overlay-environment.ts plus new owning programs/tests/overlay-environment-focus.test.ts. Read/retain existing overlay-hardening environment assertions unchanged. If reason/return policy must travel from Menu/ModalContent, the related file changes are serialized with partitions1/3 or explicitly co-owned in one unit. No concurrent edits of the same overlay/helper.
3. **Menu keyboard/disabled/close intent:** existing components/controls/Menu.tsx plus new owning controls/tests/Menu-keyboard.test.tsx. Preserve accessible markup and existing component-contracts tests. Use actual Menu with synthetic portal document/node focus and real options, testing disabled href, entry/Arrow/Tab/modifier/IME and close behavior. Link/router behavior belongs to its real public contract, not mocked-away navigation assertions.

Exact paths are proposed, not released; each worker needs a written file-partitioned brief. A focused shared candidate helper may be justified to avoid divergent entry/trap/menu filters, but obtain exact helper/barrel ownership before creating it. No protected backend, policy, auth credential, operation coordinator, generic request or stylesheet changes required for source-confirmed keyboard defects.

## Validation plan / remaining uncertainty

### Narrow first-unit policy requested by supervisor

Own only `components/overlays/Modal.tsx`, `ModalContent.tsx` and their two new owning tests named above. Preserve the shared overlay environment and busy/stack registration unchanged in this unit. If an eligibility helper becomes necessary, request its exact file/barrel ownership before extraction; do not silently expand into overlay-environment.

Convenience Enter eligibility: require unhandled plain Enter, no Ctrl/Alt/Meta/Shift, no native composition (including compatibility keyCode229), and a real enabled single-line input of type text/password/search/email/url/tel/number. Require DOM containment in the current modal and nearest owning modal to be this modal; nested/portalled event ancestry alone does not confer ownership. Respect native form submission by declining the extra click when the input belongs to a form. Preserve native behavior for Cancel/Close/buttons/links/menu items/selects/checkbox/radio/file/date-like controls, textarea and contenteditable. Effective disabled fieldset/inert/hidden ancestry must make input and confirmation ineligible. Find an eligible enabled confirmation only inside this owning dialog; preventDefault only after determining a real convenience submission can occur, then invoke once. Authorization readiness and OperationGate still govern actual acceptance.

Entry focus policy: search valid `[data-autofocus]` candidates first, then valid `[autofocus]`, then eligible content input/select/textarea, then eligible content button/control, then heading Close if eligible, finally panel. Invalid explicit candidates do not stop fallback. Reject disconnected, hidden input, disabled/effectively fieldset-disabled, inert or aria-hidden/hidden ancestors and non-rendered candidates; retain native disabled-fieldset first-legend semantics through effective disabled checks rather than blanket ancestor disabling. Use panel.ownerDocument for active focus ownership. Inherited busy may leave only Close disabled and content fieldset disabled, requiring panel fallback. Do not change subsequent focus trapping/restoration contracts in this first unit.

Tests-first minimum: actual AlertDialog Cancel Enter cannot confirm; heading Close Enter retains close semantics; actual AuthorizationDialog password plain Enter invokes Authorize once when ready, but unready/busy cannot invoke; nested/portal-origin event cannot confirm parent; defaultPrevented/modifier/composition/form/native controls cannot invoke convenience click. Actual initial effect focuses password before Close, skips disabled/hidden/inert/fieldset-disabled explicit candidates, chooses sensible content fallback, and focuses panel if all interactive candidates are disabled. No credential values or real mutation execute.

- Tests first reproduce destructive Cancel Enter and autofocus priority through actual components, including alert and authorization wrappers; no real auth or destructive operation executes.
- Synthetic DOM tests trace nested top ownership, busy all-disabled panel fallback, hidden ancestor candidates, fieldset-disabled controls, panel/outside Shift+Tab, release order/idempotence, current focus destination and document hidden/unfocused teardown.
- Menu tests exercise disabled button/href consistency, native activation once, updated options, Tab exit without trigger reclaim and modal nesting. Preserve existing connected underlying-focus restoration and scroll/isolation bookkeeping exactly unless root explicitly approves a contract change.
- Run narrow tests and actual-config scoped types after release; root independently verifies claims and owns broad gates/authored docs. No source assertions, skips, readiness/security checks or OperationGate constraints may be relaxed to get green output.
- Real browser IME events, inert/native focus, Tab order, portal scheduling and assistive-technology results remain uncertified. A source/component test passing is evidence of guarded behavior, not a live browser result.

## Return

Only this report changed. Operational twelve-path implementation remains frozen for root review. Priority is F1 confirmation misactivation, F2 composition protection and F3 explicit entry focus; trap/return/menu recovery can follow in shared-file-aware units. No tests or live operations ran in this audit.
