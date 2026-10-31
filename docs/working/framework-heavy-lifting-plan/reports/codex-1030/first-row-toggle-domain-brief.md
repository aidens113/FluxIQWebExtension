Role: Standard implementation worker, gpt-6.1-sol, Medium. No spawning, git mutations or shared-document edits.
Goal: preserve observed toggle pre-state across downstream boundaries, per accepted first-row-toggle-design.md. Task roots supplied on dispatch.
Stable interface: wrapped toggle retains signature(after), adds beforeSignature; CC9 control adds shown(actual state), retains ensures(press result). Browser raw toggle stays, raw toggleBefore added.
Own domain/src/actions/toggle-signature/output.ts, actions/types.ts,actions/schemas.ts and owning toggle tests.
Own domain/src/runtime/llm-evidence/node-run/press-effect/toggle-signature.ts,node-run/outcome.ts,control-spot/control-view.ts and their owning tests.
Own domain/src/client/gateway-mapping.ts,io/gateway-output-dispatcher.ts,output-nodes/definitions.ts and owning toggle/catalog tests.
Own apps/extension/src/content/actions/click.ts and its tests/click/tests/press-toggle.test.ts,ensure-state.test.ts.
Own authored docs/architecture/build-loop.md,page-evidence.md for new evidence/explicit-choice contract.
Must not touch: Core files, package versions, shared working docs, e2e specs, fixtures, scenario tasks/oracles, allow lists, actual env/browser/runtime data.
Read design report + relevant Current State, then exact owned code. Verify report claims as needed.
Fail-first owning tests must show both actual states retained through extension raw result, gateway parse/dispatch and exploration output.
Compute reverse-direction signature using existing guarded actual before/after readings, never invent inverses in Core or infer task intent.
Populate shown only from readable actual state; ensures keeps current predicted result. Preserve failure/skipped/navigation/target guard behavior.
Expose existing ensureState in model-facing parameter catalog as exact observed-state selection, with generic guidance only; no fixture-shaped example.
Notify lead of any interface uncertainty before changing contract. Code in parallel with Core worker; Core public shapes/build arrive before final types.
Run narrow source/unit checks where existing tools permit; do not improvise bundling or use stale Core types as final acceptance.
No heavy type/build checks until root grants marker after parent sync and fresh Core libraries; freeze source before checks shared with native author.
Final owning tests, domain and extension types, structure/model-text, standard extension/e2e builds under granted marker. No full suite, paid calls or panel management.
Native proof is a separate worker's ownership; preserve its files during validation and coordinate freeze through lead.
Report paired downstream reports/codex-1030/first-row-toggle-domain-result.md; do not edit Current State/ledger.
Finish Outcome/Changed/Validation/Not verified/Report/Notes contract.
