# Provider admission at construction

## Current State

SOURCE FROZEN and named owner tests passed: Core six tests/two owners; web 29 tests/two owners. Root notified immediately after both test sessions exited zero. Independent integration/type/build/audit verification remains root-owned. No runtime/provider/browser/key actions, builds, package checks, audit, or shared-document edits performed by this worker.

The initial tests exposed fixture defects: a nonexistent IdentityAccess close method masked three factory results; the web fixture left discarded inferred-domain instances open and its invalid-value test lacked an explicit host root. These were corrected before counting a meaningful failure. First framework false case did demonstrate current unconditional provider installation. Initial web run: 16 existing tests passed, two new cases failed with fixture errors; these are not claimed as behavioral regression evidence.

## Contract and boundaries

Public `modelProvidersEnabled?: boolean` defaults to enabled. The global factory receives compatible optional second-argument options. False omits standing result-check, session execution, and chat model resolver installation before any reveal or dispatch; original services, authentication, native runtime, storage, and unlocked-session lookup remain intact. This is construction admission, not protection against a trusted later explicit rebinding.

Web `FLUXIQ_MODEL_PROVIDERS_ENABLED` accepts only absent, `true`, or `false`, with absent enabled. Both initial and inferred-domain construction, including reload, receive the resolved setting. Invalid settings refuse before new construction. Root owns downstream activation, preserving stored key identity, and strict zero-provider accounting.

## Owned files and validation

- `packages/fluxiq/src/framework/index.ts` and nearest new framework admission test.
- `packages/fluxiq/src/programs/_shared/runtime.ts` and nearest new runtime admission test.
- `apps/web/src/lib/fluxiq.ts`, existing `tests/fluxiq.test.ts`, focused `model-provider-admission/{resolve,index}.ts` and nearest resolver test.

All named tests run through `C:/Users/osrs_/FluxStuff/build-slots/heavy.sh` with paired Core cwd. Final results and source-freeze signal will be recorded below as observed. Independent integration/type/build/audit verification belongs to root.

## Measured fail-first and implementation

Corrected Core fail-first: six tests, four passed and two meaningful failures. Disabled global construction still installed the standing resolver, and public false still reported the execution resolver configured. Default and explicit true passed. Corrected web forwarding fixture demonstrated two meaningful failures: all four factory options omitted admission, and invalid activation was accepted. Sixteen existing web tests passed.

The web forwarding fixture deliberately mocks only the public `FluxIQ.create` construction boundary while running the real initial/inferred-domain/reload control paths. Using four actual built instances exposed temporary SQLite disposal locking; it obscured the option assertion and was not counted as product-regression evidence. Actual factory wiring is covered by the Core source test, including constructor option capture, default real resolver creation, and disabled reveal/fetch spies established before construction. These tests prove construction admission; they do not prove a saved Flow runtime execution made zero calls. Root's downstream admission/accounting/live unit supplies that separate evidence.

Framework forwarding preserves omission rather than passing an explicitly undefined optional property. Factory false omits all three binding paths while retaining unlocked-session lookup. Web resolves strict admission before root/runtime construction, forwards the same value to both creates, and validates reload before closing the old instance. Invalid reload fixtures assert no additional construction and no old-instance close. Default, explicit true, and false are exercised through both web construction paths and reload.

Exact named-owner commands, each prefixed with `& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' '<label>'`:

```text
pnpm --filter fluxiq exec vitest run src/programs/_shared/tests/model-provider-admission.test.ts src/framework/tests/model-provider-admission.test.ts
pnpm --filter @fluxiq/web exec vitest run src/lib/tests/fluxiq.test.ts src/lib/model-provider-admission/tests/resolve.test.ts
```

## Final owned-file inventory and observed validation

Production:

- `packages/fluxiq/src/framework/index.ts`
- `packages/fluxiq/src/programs/_shared/runtime.ts`
- `apps/web/src/lib/fluxiq.ts`
- `apps/web/src/lib/model-provider-admission/resolve.ts`
- `apps/web/src/lib/model-provider-admission/index.ts`

Tests:

- `packages/fluxiq/src/framework/tests/model-provider-admission.test.ts`
- `packages/fluxiq/src/programs/_shared/tests/model-provider-admission.test.ts`
- `apps/web/src/lib/tests/fluxiq.test.ts`
- `apps/web/src/lib/model-provider-admission/tests/resolve.test.ts`

Final Core owner run: session 15403, six passed, exit zero, 20.22 seconds. Final web owner run: session 41915, 29 passed, exit zero, 20.88 seconds. The parser's nine cases cover omitted/true/false and strict rejection of empty, numeric, uppercase, unrelated, and whitespace-padded values. Tests used fixture-local temporary roots and mocked requests; no actual provider call or user storage/key operation occurred. No build, whole suite, typecheck, audit, commit, or push by this worker. Public web package imports use existing built Core output; root must rebuild the new public option before relying on web type verification against package declarations.

Root's remaining acceptance work: independently observe combined gates and fresh public build, activate admission downstream before ordinary saved-Flow replay construction, compare protected stored key identity sets without publishing identifiers, and prove zero attempts/zero paid calls across all roles using strict accounting. This source unit changes construction bindings only and does not claim those downstream/live checks passed.
