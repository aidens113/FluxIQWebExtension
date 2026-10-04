# P5 earlier-output binding preflight

## Current State

Supervisor bounded readonly source inspection during A8/B7 freeze. No source/test/runtime change. P5 remains unimplemented; no earlier-output authoring acceptance claim.

## Verified current owner facts

- Core runtime/flow-draft/binding-forms.ts explicitly refuses every model $step form as step_binding_not_yet. Translation currently supports $row and $input into existing $state bindings. StoredBindingKind recognizes only row/input.
- runtime/flow-bootstrap/authoring/draft-bindings.ts validates actual assembled graph loop bodies and rejects Flow input names shadowed by any output port; it has no earlier-step source/ordering validation.
- programs/automation-studio/nodes/parameter-bindings.ts already resolves own dotted keys with longest-prefix matching, explicitly supporting nodeId.outputId keys even when node IDs contain dots. This is a reusable runtime seam, not proof that draft steps publish stable correctly mapped output identities.

## Required next bounded investigation

Trace actual draft execution output storage and assembled persisted node identity mapping before choosing $step grammar. A form must resolve a prior stable step and real registered output port, keep nested path separate, reject future/self/missing/dropped/reordered-out-of-order sources, preserve correct identities through assembly/repair/persistence and avoid stale prior-run/row output. No fallback may fabricate missing output. Actual public saved Flow and repair tests must establish correct value handoff, not parser success alone.

No new generic execution path, browser-specific interpretation, public export or output/state mutation is authorized by this report. Existing row/input behavior and C4 current-versus-historical proof separation must remain intact. Narrow owning tests/types/builds follow a written implementation brief after both live ending reviews.
