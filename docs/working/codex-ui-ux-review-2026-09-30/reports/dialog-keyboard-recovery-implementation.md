# Confirmation keyboard and dialog entry recovery

Status: Complete — exact four source/test paths frozen for supervisor review
Owner: deployment_docs_audit worker
Date: 2026-10-01

## Scope

Exact Core source Modal.tsx and ModalContent.tsx, new owning overlays/tests/Modal-keyboard.test.tsx and ModalContent-focus.test.tsx. Parent Current State and released brief read. Shared overlay audit F1/F2/F3 guides implementation. Environment/Menu/auth/Alert source, helpers, styles, OperationGate and protected areas remain unchanged. Operational twelve-path unit stays frozen.

## Progress

Auth/alert wrapper tests exercise real Modal/ModalContent through a bounded synthetic portal/document fixture. Native controls, quick-submit types, prevented/modified/composing events, current focus and nested/form/disabled ownership are covered. Entry fixture reproduces combined-selector DOM-order Close selection and invalid explicit candidate fallback. No real authorization or mutation executes. Initial narrow native1 reproduced 35 failures/14 passes in 1.42s, including Cancel/Close confirmation and explicit autofocus.

Modal now limits convenience Enter to an owned focused enabled editable single-line text/password/search/email/url/tel/number input, in a visible focused document and nonbusy dialog. Forms retain native submission. Native control events, composing/keyCode229/handled/modifier events, read-only inputs and nested/portalled targets cannot invoke confirmation. Submission candidates must belong to this dialog and be effectively enabled, rendered and outside hidden/inert/aria-hidden ancestors. Effective disabled checks preserve native fieldset/first-legend behavior. CSS visibility hidden/collapse is rejected separately from rendered geometry.

ModalContent uses panel.ownerDocument for environment acquisition and initiating focus capture. It independently checks eligible data-autofocus, native autofocus, content inputs, content controls, heading button and panel fallback, so Close no longer wins selector-list DOM order. Busy or otherwise all-disabled controls leave focus on panel. Existing environment acquisition/return/trap contract remains unchanged; shared environment Escape composition guard and broader trap/return/Menu findings stay deferred.

## Validation evidence

- Tests first: native1, 35 failed/14 passed, 1.42s. Initial postchange retry exposed a test fixture closure referencing the previous unmounted renderer; fixed by snapshotting disabled state and resetting the fixture per mount, without product relaxation. Four suites then passed70/native0/2.11s.
- Final narrow native0/session30822: five files88 tests, 2.93s: new Modal42 + ModalContent15, unchanged component-contracts20 + use-operation-lock1 + Studio overlay-hardening10. No existing assertions changed, skipped or replaced. Actual Studio path is features/automation-studio/workspace/overlays/tests/overlay-hardening.test.ts; first four-suite retry's programs/automation-studio path did not select it, final run explicitly did.
- Actual web tsconfig scoped to exact four roots: first run native1 on new test mock implicit-any/return typing only; corrected those types. Final native0, 4.18s, temporary external config removed. No compiler settings relaxed except disabling incremental cache for isolated temporary check.
- Exact Core whitespace diff check passed; source/test paths now frozen. Parent owns independent review, full types/build/test gates, authored documentation, integration and any commit.

## Changed paths

- apps/web/src/features/programs/components/overlays/Modal.tsx
- apps/web/src/features/programs/components/overlays/ModalContent.tsx
- apps/web/src/features/programs/components/overlays/tests/Modal-keyboard.test.tsx (new)
- apps/web/src/features/programs/components/overlays/tests/ModalContent-focus.test.tsx (new)
- This downstream report only; shared audit report already completed before this implementation unit.

## Limits

Synthetic focus and handler tests do not certify native browser Tab/inert/IME/assistive-technology behavior. No broad checks, live/provider/panel operations, shared docs or commits.
