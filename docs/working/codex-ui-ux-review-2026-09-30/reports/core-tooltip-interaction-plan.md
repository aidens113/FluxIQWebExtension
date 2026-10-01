# Core tooltip interaction plan

Status: Complete — bounded source-based interaction plan; product/test source remains frozen
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief

- Layout audit received; Core product/tests stay frozen for root gates. Own only this report. Read parent Current State and completed core-layout-controls-audit.md Tooltip finding.
- Exact read-only additions: apps/web/src/app/styles/global-foundation/06-controls-and-menus.css tooltip selectors only; existing components/layout/Tooltip.tsx; relevant shared contract assertions; at most two actual Tooltip consumer call sites. No unrelated stylesheet/backend inspection.
- Establish authored visibility, pointer/focus/Escape behavior, hoverable popup geometry and description lifetime. Distinguish explicit source contract gaps from unmeasured browser/layout outcomes and caller styling. Native Tab and descriptions must remain available; do not infer clipped geometry without evidence.
- If a functional gap is confirmed, propose exact Tooltip/source-style/new owning test partition and meaningful actual-event regression matrix, preserving merged caller aria-describedby and native child activation. Keep any proposed dismiss/reopen policy concrete; no speculative visual redesign or tracked test hooks.
- If no confirmed defect, say so and identify narrow browser evidence required; do not invent work to keep busy. No source/tests/checks/shared docs/commits/browser/Lab/providers/panel/private data. Root owns later implementation release after Core gates close.

## Reads and confirmed behavior

Parent Current State and prior layout finding remain available from the immediately preceding bounded audit. Read the exact Tooltip component, relevant shared component-contracts assertion, and only the tooltip selectors at lines237–267 in authored `apps/web/src/app/styles/global-foundation/06-controls-and-menus.css`. Two actual consumers: CodeViewer's wrap/download controls and FieldHandlingControl's two information buttons. No additional consumer or unrelated stylesheet content read; no check/test/browser command executed.

The stylesheet places the popup absolutely above its inline-flex anchor with `bottom: calc(100% + var(--space-sm))`, centered, capped at280px/viewport width, initially visibility:hidden/opacity:0, and pointer-events:none. Anchor hover or focus-within unconditionally makes it visible. Tooltip has no state, keyboard handlers, pointer handlers, document listeners or dismissal mechanism. Its direct-child clone adds the generated tooltip ID to caller aria-describedby and otherwise preserves the child's handlers. Popup text and unique ID exist continuously, including when visually hidden.

Actual CodeViewer wrap/download buttons have their own native labels and actions; tooltips are supplemental. FieldHandlingControl's About Exclude column button exposes a long multi-sentence explanation through this component, so persistence during reading is relevant to a real consumer. Both information buttons are labelled native buttons; this plan does not change their executable behavior.

## Ranked source-confirmed gaps

1. **No visual Escape dismissal while focus/hover remains.** A focused information button satisfies focus-within regardless of the key pressed. No component state or selector suppression exists, so Escape cannot hide the tooltip while the user keeps that focus. This is a source-confirmed absent interaction; it is not a measured browser failure or a claim that Escape already closes a parent incorrectly.
2. **Popup cannot own pointer-hover persistence.** pointer-events:none removes the popup as an interaction target, and no pointer bridge/delay/state is provided. The CSS position deliberately separates it from its trigger by --space-sm. For a positive spacing value, a pointer crossing that gap can leave the trigger before reaching the popup; even at zero gap the popup itself cannot own hit testing. Long information text is a real consumer. Actual travel paths, spacing computed value, clipping and device-specific behavior were not measured, so no geometry screenshot or browser reproduction is claimed.

Description association is not broken: caller descriptions are merged with a unique generated ID and the tooltip content remains present. The new implementation must preserve this accessibility relationship while changing visual interaction. Do not hide/remove supplemental description content from the accessibility relationship merely to implement visual dismissal.

## Exact proposed implementation partition

Release one cohesive three-path unit after current Core gates:

1. Core `apps/web/src/features/programs/components/layout/Tooltip.tsx`.
2. Core `apps/web/src/app/styles/global-foundation/06-controls-and-menus.css` **tooltip selectors only**, preserving all unrelated selector bodies and styling tokens.
3. NEW Core `apps/web/src/features/programs/components/layout/tests/Tooltip-interaction.test.tsx`.

This report additionally remains the worker's own write path. Existing shared assertions, consumers, overlay environment, helpers, styles outside these selectors and other sources are not proposed write paths. No portal, viewport-positioning service, timer, overlay trap or focus-return behavior is needed for this bounded interaction fix. Positioning/overflow redesign is a separate evidence-led unit.

## Concrete minimal interaction contract

- Keep public content/children API, direct-child clone, unique ID, merged caller aria-describedby, role=tooltip and continuous description text unchanged. Child onClick/onKeyDown/onFocus/pointer behavior and native Tab/Enter/Space/Link behavior stay intact; never synthesize activation or take focus.
- Track hover ownership and focus-within independently, plus a dismissal flag. Visual open is `(hoverOwned || focusOwned) && !dismissed`. Use a stable anchor ref for actual current DOM membership and synchronous interaction state/ref so queued old callbacks cannot reopen an unmounted or replaced tooltip before cleanup. Do not use children element object identity as an owner lease: CodeViewer creates new JSX children on ordinary rerenders and changes content when wrapping toggles.
- Pointer entry for mouse/pen and focus entry start visual presentation. Touch entry does not create a sticky hover state. Pointer/focus handoff within the same current anchor, including its popup/bridge, retains ownership. Check relatedTarget membership before clearing focus or hover; a focus move to a different anchor is a genuine departure. Native child handlers continue normally.
- Escape dismisses an open tooltip visually without changing activeElement. Remain dismissed for the whole existing hover/focus interaction: moving pointer away while focus remains, or blurring while pointer remains, cannot immediately reopen it. Once **both** ownership modes end, clear dismissal; a later intentional hover/focus interaction reopens. Changing content during the same interaction updates description text but must not undo dismissal or force a new popup.
- Replace the unconditional CSS hover/focus visibility selectors with a state attribute owned by Tooltip. Hidden content keeps pointer-events:none; visible content accepts pointer events. A transparent popup pseudo-element can bridge the authored gap (`top:100%`, full popup width, height:var(--space-sm)) while remaining a descendant of the same anchor. No interactive control goes in the popup, and the bridge must not expand the hidden tooltip hit area. This is a bounded CSS interaction proposal, not proof of exact rendered geometry.
- Listen for Escape only while the tooltip is visually open, with lifecycle cleanup. Use the current document and current interaction state, not a retained first-render closure. Ignore consumed, composing/229, modified or inactive-document key events. Pointer-only tooltips need a document event path because their trigger need not be focused. Remove the listener on close/unmount and avoid any delayed reopen callback.

### Escape and shared overlay dependency — explicit release decision

The previously completed shared overlay audit established an existing document-capture Escape stack. A Tooltip wrapper's bubble handler cannot promise first consumption ahead of an earlier document-capture overlay handler. Do not claim that adding onKeyDown to the anchor guarantees tooltip-only Escape in a dialog.

**Minimal proposed policy for this three-path unit is non-exclusive dismissal:** Tooltip hides its supplemental popup on an eligible current Escape and does not call preventDefault or stopPropagation. Existing overlay Escape ordering/authorization/busy contracts remain intact. In a dialog, the existing environment may also process Escape; this policy preserves that behavior and must be stated in the written implementation release. It does not certify that a parent remains open.

If root requires **first Escape hides tooltip only**, do not implement a listener-order workaround or global key interception under these three paths. That requires an explicit shared environment coordination design and additional exact owning source/tests. Existing active overlay capture, nested busy/modal and pointer-only tooltip behavior must be tested together before such a change. This report does not authorize that broader unit or an environment edit.

## Tests-first meaningful regression matrix

Use the actual Tooltip component with native button/anchor children and a synthetic document fixture only where node environment requires it. Preserve all original shared tests. A component renderer can exercise actual registered handlers and state; no tracked testing API, implementation text snapshots or false browser event simulation claim.

1. Focus a labelled native button: popup state opens, focus stays on the button, child focus handler runs. Eligible Escape hides it without native activation, focus movement, preventDefault or propagation suppression under the proposed policy.
2. Hover-only opens; current document Escape hides. Pointer departure/reentry clears dismissal only after both hover/focus modes are absent. Cover hover+focus handoff in both orders and unrelated content rerenders after dismissal.
3. Move pointer/focus among trigger, popup and descendant bridge representations: relatedTarget within current anchor retains ownership; genuine departure closes. Hidden popup remains non-owning. Browser validation, not a synthetic Node.contains test, must establish physical bridge hit testing.
4. Native child click/Enter/Space/modified link events keep their original handlers and native contract; no tooltip-generated action, selection or prevented default. Caller aria-describedby tokens persist and supplemental tooltip ID/text remain stable across open/dismiss/reopen/content updates and unique across siblings.
5. Consumed Escape, composition, key229, Ctrl/Alt/Meta/Shift or inactive document do not dismiss unexpectedly. Native blur and pointer leave still close. No blanket focus reclaim or disabled-control rewriting.
6. Retain old anchor and document callbacks, unmount/remount/reopen, then invoke old ones: no new tooltip state/focus changes or orphan listener. Closing removes document listener; synthetic duplicate Escape remains harmless.
7. With a real overlay fixture under an explicitly approved additional test path, verify the chosen non-exclusive policy preserves current overlay/busy behavior. This is a cross-owner validation dependency, not an excuse to mock environment behavior and claim preservation from isolated Tooltip tests.

After a later exact release, run owning Tooltip tests and unchanged relevant component-contracts, scoped strict types with actual web config, authored selector diff/module budgets, then freeze. Root owns integrated overlay checks and broad gates. No such checks ran for this planning task.

## Browser evidence still required

Later authorized Chrome/Firefox/browser evidence should exercise keyboard focus/Escape on CodeViewer and FieldHandlingControl, mouse/pen travel from trigger across the gap into the popup, zoom/narrow viewport, popup edge/corner clipping, focus inside existing dialogs, disabled/native controls and touch. Neither capped width nor dropdown z-index proves freedom from ancestor clipping or offscreen placement. No wall-clock, assistive technology or browser geometry certification is claimed.

## Return

Only this report changed; source and tests remain frozen. Two real consumers substantiate the usefulness of Escape dismissal and hover persistence. The proposed three-path unit is actionable once root confirms non-exclusive Escape; exclusive nested-overlay dismissal is a separate explicitly scoped dependency. No source/test/shared docs, check/heavy/broad/browser/Lab/provider/panel commands, private data or commits were changed/run.
