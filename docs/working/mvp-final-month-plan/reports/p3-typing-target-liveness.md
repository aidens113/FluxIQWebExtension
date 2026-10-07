# Typing target liveness - t319

Status: implemented and independently verified; integration pending. Existing production typeAction reads value from original object but does not check that control remains connected after event handlers.

Owned: content/actions/type.ts; owning type-unsent-form mock fixture connected property; existing actual sanitized-field-typing browser fixture; extension-client scoped paragraph and this report. No keyboard/domain/Core source change, providers, panel or user state.

Two browser negatives replace a text control during input and a numeric control during change with a visible wrong value. The old detached object can retain requested text; second dispatch requests submit and records Enter delivered to the detached target. Prepared actual background/content identity check, current visible field values, zero Enter/submits expected. Fail-first execution pending owning Core dependency/extension rebuild.

Immediate connection readback is the intended boundary; asynchronous app acceptance, replacement-target resolution and React are not claimed.

Actual fail-first after fresh Core build42.809s and extension all-target build15.930s: production unpacked Chromium1test failed in5.7s; BOTH removed text and removed numeric-with-submit returned succeeded even though visible replacements held old/7. Background/content/disk identity assertion passed before dispatch. The source now requires original control isConnected at immediate readback; a detached value cannot pass or authorize Enter. Existing unit mock declares its connected field explicitly. Post-fix checks pending.

Final owning extension build0 actual13.678s, all Chrome/Firefox/e2e targets22files verified; source/e2e TypeScript0. Narrow owning unit bundles via esbuild and node --test:7/7 zero skips0.377s. Production unpacked Chromium134 probe1/1 zero skips21.8s (fixture20.3s), matching intended background/content identities: both detached actions now fail, visible replacements remain old/7, detached Enter0 and form submits0; all existing six native format families, cancellations/readonly/invalid formats, per-character text and password redaction pass. No later async application/React acceptance, installed Chrome/Edge/Firefox run or provider/panel claim. Architecture paragraph records original-control liveness.

Reproduce from repository root (Core owning dist must match sibling source):

```powershell
pnpm.cmd --filter @fluxiq-web-extension/extension build
pnpm.cmd --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.test.json
pnpm.cmd --filter @fluxiq-web-extension/extension exec playwright test -c e2e/playwright.config.ts e2e/runtime/tests/sanitized-field-typing.spec.ts
node scripts/structure-audit.mjs
```

Final supervisor structure audit0,176warnings/117baseline; no baseline edits. Source unchanged between successful browser proof and integration. Narrow unit bundles name only existing actions/tests/{type-unsent-form,gate-refusal}.test.ts, emitted by owning esbuild into ignored .test-build-scratch/t319-root then run with node --test (7cases); this was not the extension whole suite.
