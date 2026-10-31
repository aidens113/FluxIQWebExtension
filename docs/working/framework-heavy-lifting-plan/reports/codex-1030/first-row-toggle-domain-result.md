# First-row toggle downstream source result

Outcome: Partial — source implementation and observed fail-first complete; lead owns final paired acceptance after fresh Core build.

## Implemented

- Extension computes raw `toggleBefore` from actual reverse before/after readings under its existing successful/same-page/connected-target guards. Existing after-state `toggle` keeps its meaning.
- Gateway parses both raw signatures; dispatcher and exploration wrap `signature` plus optional `beforeSignature`. Invalid optional pre-state is dropped; legacy after-only evidence remains supported.
- CC9 `shown` describes the actual readable state; `ensures` still describes another press's result. Unreadable state supplies neither.
- Click catalog exposes `ensureState` with generic exact-observed-copy guidance. Authored architecture docs explain explicit grounded choice and paired deployment.

## Changed paths

```text
apps/extension/src/content/actions/click.ts
apps/extension/src/content/actions/tests/click/tests/ensure-state.test.ts
apps/extension/src/content/actions/tests/click/tests/press-toggle.test.ts
docs/architecture/build-loop.md
docs/architecture/page-evidence.md
domain/src/actions/schemas.ts
domain/src/actions/toggle-signature/output.ts
domain/src/actions/toggle-signature/tests/toggle-signature.test.ts
domain/src/actions/types.ts
domain/src/client/gateway-mapping.ts
domain/src/client/tests/gateway-mapping-toggle.test.ts
domain/src/io/gateway-output-dispatcher.ts
domain/src/io/tests/gateway-output-dispatcher-toggle.test.ts
domain/src/output-nodes/definitions.ts
domain/src/output-nodes/tests/model-facing-catalog.test.ts
domain/src/runtime/llm-evidence/control-spot/control-view.ts
domain/src/runtime/llm-evidence/node-run/outcome.ts
domain/src/runtime/llm-evidence/node-run/press-effect/tests/press-toggle-signature.test.ts
domain/src/runtime/llm-evidence/node-run/press-effect/toggle-signature.ts
domain/src/runtime/llm-evidence/page-view/element/tests/state-tokens-stateful.test.ts
domain/src/runtime/llm-evidence/plan-resolution/handle-control/tests/handle-view-control.test.ts
docs/working/framework-heavy-lifting-plan/reports/codex-1030/first-row-toggle-domain-result.md
```

## Observed validation

- Before production edits, from `domain`: `node scripts/test-domain.mjs client/tests/gateway-mapping-toggle.test.ts` -> exit 1, 2 passed / 1 failed. The new already-on first-control case preserved after `aria-pressed:false` but returned `undefined` for actual before `aria-pressed:true`. This is the intended fail-first assertion.
- After edits, from repository root: `git diff --check` -> exit 0, no whitespace errors (Git emitted an LF conversion warning for the handle-view-control test).
- Final tests, types, audits and builds deliberately not run: root requires fresh paired Core libraries and exclusive heavy marker first, and has taken ownership of final acceptance.

## Exact narrow commands for lead acceptance

From `domain`:

```powershell
node scripts/test-domain.mjs actions/toggle-signature/tests/toggle-signature.test.ts client/tests/gateway-mapping-toggle.test.ts io/tests/gateway-output-dispatcher-toggle.test.ts runtime/llm-evidence/node-run/press-effect/tests/press-toggle-signature.test.ts runtime/llm-evidence/plan-resolution/handle-control/tests/handle-view-control.test.ts runtime/llm-evidence/page-view/element/tests/state-tokens-stateful.test.ts output-nodes/tests/model-facing-catalog.test.ts
```

From `apps/extension`:

```powershell
node scripts/test-extension.mjs content/actions/tests/click/tests/press-toggle.test.ts content/actions/tests/click/tests/ensure-state.test.ts
```

From root, only after parent sync and fresh Core libraries under lead's marker:

```powershell
pnpm.cmd --filter @fluxiq-web-extension/domain check
pnpm.cmd --filter @fluxiq-web-extension/extension check
pnpm.cmd --filter @fluxiq-web-extension/extension build
pnpm.cmd --filter @fluxiq-web-extension/extension test:e2e:build
```

Lead also owns repository structure/model-text/docs checks and separate native worker proof. No full suite, provider call, panel action or real browser data access occurred here.

## Limits and remaining uncertainty

The existing conservative CC9 learned-word/class guard is preserved: it reads only signatures with both nonempty gains and loses. One-sided class/name observations therefore still lack CC9 state views, though paired actual press signatures survive correctly. Broadening this classifier could classify unrelated controls and is outside this change; parent was notified. Unreadable role states remain explicitly unknown.

Source and tests were inspected but have not yet passed final compilation/unit execution against the new Core contract. Native browser behavior and Firefox remain unverified by this worker. No Core or native-spec files were changed, no git mutations were run, and no environment/runtime data was read.

Outcome: Partial
Changed: paths listed above
Validation: fail-first command -> expected 2 pass/1 fail before production edits; `git diff --check` -> exit 0
Not verified: final owning tests/types/audits/builds, native proof and Firefox
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1030/first-row-toggle-domain-result.md
Notes: All owned source frozen. Lead owns final downstream acceptance. Available for bounded follow-up.
