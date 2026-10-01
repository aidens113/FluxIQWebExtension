# Twelfth coordinated UI verification

Status: Active
Owner: senior supervisor
Date: 2026-10-01

## Current State

Three workers implementing released, disjoint units: recording_controls owns seven extraction-binding sources/four NEW suites/five fixture-only paths in extraction-session-id-implementation.md; runtime_contracts owns floating wrapper/subscribers/new suite/entry-fixture reconciliation in floating-close-intent-implementation.md; deployment_docs_audit owns Tooltip/new suite/selector-local CSS in core-tooltip-interaction-implementation.md. Workers do not edit shared docs or commit. No broad gates until owning source freezes; claims require root source review and independently observed results.

Last accepted integrated source is eleventh: Core10ce95a7/0e868679 and downstream92decca0/86913bca. Core full344files2706tests/types/build native0, structure only inherited protected4506/4505. Extension2028/types/build/structure native0; exact sessions/timings and original failures remain in eleventh-supervisor-verification.md. Authored docs/progress checkpoints17089f56 and71fe1279. Subsequent working-docs/docs-links gates pass native0 in both trees,0warnings/Core16baseline/downstream2baseline. No browser certification, merge or push.

Claude workload t216/t217/t219/t220/t221 remains locally verified and handed off in t221 de2096b1. Read-only main status clean; its original task list unstarted text is stale relative to that handoff. Main/Claude integration/protected trees remain untouched. Other lanes use shared heavy slots; leave their processes/slots alone. Progress persists on disk and local checkpoints.

## Review requirements

- Extraction: actual bound ID for new panel preview/Confirm/cancel; active-tab discovery; malformed/missing/mismatched safe handling; immutable identity/operation fences; first-binding prepare/lock preservation; exact original assertion comparison; current preview erasure. Legacy optional callers remain deliberate limitation; ID is not authorization. Receiver ordering/idempotence separate.
- Floating: real request/gate behavior; current cancellation return; outside/action/teardown suppression; original native-target eligibility through proxy; busy/refusal/reentrant dispatch; retired A-B-A entry/completion guards; preserved entry assertions. No issued-action cancellation claim.
- Tooltip: native child behavior and merged descriptions; separate hover/focus/dismissal lifetime; current anchor/document/listener cleanup; non-exclusive Escape; selector-local CSS. Synthetic events do not certify physical hover bridge/viewport clipping.
- Root updates authored docs, observes narrow tests and all dependency diagnostics, then owning full/type/build/structure after freeze. Protected Core violation reported without waiver. No live/browser/Lab/provider/panel/private actions.
