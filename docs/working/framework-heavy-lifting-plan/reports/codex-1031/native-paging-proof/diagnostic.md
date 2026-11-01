# Paging proof diagnostics — t840

Outcome: Done. Source is frozen for lead validation and installed provider-free replay. This adds diagnostic facts only; it does not fix or relax the still-unmeasured native guard.

Changed source and tests:

- `apps/extension/src/content/extraction/page-advance/loader-progress/settlement.ts`
- `apps/extension/src/content/extraction/page-advance/load-more.ts`
- `apps/extension/src/content/action-runtime/ignored-press/settled-look.ts`
- `apps/extension/src/content/extraction/page-advance/loader-progress/tests/settlement.test.ts`
- `apps/extension/src/content/action-runtime/ignored-press/tests/settled-look.test.ts`

Discovery report: [observer-discovery.md](observer-discovery.md).

The settlement watch retains a closed local rejection code after cleanup. It distinguishes unrecognized binding; missing request/work/look observation; absent/unhealthy request health; request begun; unknown/pending work; another press signal; changed origin; unsafe current control; unavailable/failed settled look; deadline; and explicit stop. Pending observation remains pending when its command window closes.

The settled look's existing boolean/announced result and comparisons are unchanged. An optional additive internal rejection method records unreadable state, outside-scope change, newly reachable open shadow, non-change signal, state not restored, deadline, or stop. It never returns DOM nodes or captured state.

Only the existing generic list-unchanged fallback message appends `[loader-settlement:<closed_code>]`. That existing reason reaches failure.actual through the unchanged action mapper. No wire field, authored input, model-writable proof, cross-command token, target, permission or retry default was added. The code carries no selectors, page text, callback source, URLs, tokens or request data. The preexisting fallback message still has its preexisting target context; the new suffix is closed classification only.

The conditions and order of browser gate evaluation remain the same. The positive proof's WeakMap transfer/consume implementation is untouched, as are physical press paths, first-plus-three Host accounting, request/work observation, exact origin/state comparisons and all lasting-effect uncertainty protections. A rejection string cannot authorize NO_EFFECT.

Direct regressions cover missing/unknown observers, pending at deadline, unsafe control and changed origin, look-reason propagation after stop, counterfeit diagnostic text refusing private proof, genuine unchanged proof remaining single use, and the actual generic fallback issuing one physical press with its fixed code. Existing settled-look tests now check the corresponding reason while retaining their verdicts; notice behavior remains covered.

Validation:
```powershell
$env:EXTENSION_TEST_BUILD_LABEL = 't840-native-paging-diagnostics'
pnpm.cmd --filter @fluxiq-web-extension/extension exec node scripts/test-extension.mjs content/extraction/page-advance/loader-progress/tests/settlement.test content/action-runtime/ignored-press/tests/settled-look.test content/action-runtime/ignored-press/tests/settled-look-notice.test
```

Observed exit 0: 34 tests, 34 pass, 0 fail/cancelled/skipped, `duration_ms 9488.451`. No source changes followed this run.

Not verified: root-owned package types/structure audit/build; cross-world installed delivery; actual native positive-proof rejection reason; successful saved zero-call replay. No browser/provider/full-suite execution, Domain/Core/shared-document changes, UI/manifest/network-guard/fixture/task/oracle/guidance changes, Lab controls or git operations were performed.

Notes: Only the five listed source/test paths were edited. No barrel, suppression or baseline change was needed. Native safety changes await the measured installed guard reason.
