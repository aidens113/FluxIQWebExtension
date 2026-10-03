# t243-w5: web step effect

## Outcome

Done. The domain signs a step's effect as `web-effect.v1` and judges whether it holds on an observed route state.
The host runtime binds both as `signRouteEffect` and `routeEffectHolds`. There are two layout deviations from the
brief, both forced by the structure audit (see Open questions).

## What changed and why

- `domain/src/runtime/route-state/page-features.ts` (new, internal, not in the barrel). `webRoutePageFeatures(state)`
  returns `{ path, layers, controlHashes, controlCount }`. It contains W3's normalisation and hashing moved
  verbatim out of `signature.ts`: pathOf, pathShape, listOf, distinctNames, hex8, and the FNV-1a + fmix32 control
  hash (renamed `sketchHash` -> `controlHash`). `controlHashes` is every distinct hash, sorted, with no sketch
  cut-off. Both signer and effect read it, so nothing is copied.
- `route-state/signature.ts` is now a thin reader of the features. It takes the first 64 of `controlHashes`, which
  is the same computation as before. All 10 signature tests pass unchanged.
- `route-state/effect/format.ts`: `WEB_ROUTE_EFFECT_FORMAT = { version: "web-effect.v1", sampleSize: 16 }`.
- `route-state/effect/sign.ts`: `webAutomationRouteEffect(before, after)` returns `{ v, added, removed, path? }`.
  - `added` is up to 16 of the smallest sorted hashes in after minus before.
  - `removed` is the reverse difference, with the same limit.
  - `path` is after's path-shape hash, present only when it differs from before's.
- `route-state/effect/holds.ts`: `webAutomationRouteEffectHolds(effect, observed)` is true only when all of these
  hold:
  - `v` matches;
  - `added` is a non-empty string array;
  - every added hash is in the observed page's exact (unsketched) control-hash set;
  - when `path` is present, it is a string equal to the observed path shape.

  A malformed effect returns false. The header comment explains why `removed` is not tested: a layer the run
  opened, such as the store picker, may still show controls the recorded step removed.
- `route-state/effect/index.ts` is the barrel. `route-state/index.ts` re-exports it with `export * from "./effect"`.
- `domain/src/runtime/host-runtime.ts` binds `signRouteEffect` and `routeEffectHolds` next to the signature
  members. Capabilities are unchanged.
- Tests:
  - `route-state/effect/tests/effect.test.ts` (6 tests): the bigbox chooser case, out of stock (including half the
    effect present), an effect that added nothing, navigation path shape, another version or a malformed effect,
    and no page text / under 2,048 characters / 16 smallest / sorted.
  - One test added to `runtime/tests/host-runtime.test.ts`: both members are bound and agree with the functions.
- `docs/architecture/page-evidence.md`: three sentences appended to W3's signature paragraph on effects (fields,
  holds rule, why `removed` is untested).

## Commands run and observed results

The bundle ran from `domain/` with the same options as `scripts/test-domain.mjs`: esbuild with `--bundle
--platform=node --target=node22 --format=esm`, `fluxiq` / `fluxiq/*` / `@fluxiq/client-gateway-websocket[/*]`
external, outbase `src/runtime`, outdir `.test-build-scratch/t243-w5`, and `.mjs` extension.

- **Failing first.** Both test files and the host-runtime change were written before any source change. The
  bundle of effect.test.ts, signature.test.ts and host-runtime.test.ts printed
  `X [ERROR] No matching export in "src/runtime/route-state/index.ts" for import "webAutomationRouteEffect"` and
  the same error for `webAutomationRouteEffectHolds`, in both effect.test.ts and host-runtime.test.ts. Exit 1.
- **After.** This ran after the move into `effect/` and a fresh rebundle:
  `node --test .test-build-scratch/t243-w5/route-state/effect/tests/effect.test.mjs
  .test-build-scratch/t243-w5/route-state/tests/signature.test.mjs .test-build-scratch/t243-w5/tests/host-runtime.test.mjs`
  printed `# tests 29`, `# pass 29`, `# fail 0`.
- **Typecheck.** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t243-w5 check" pnpm --filter
  @fluxiq-web-extension/domain check` exited 0 with no tsc errors. It ran twice; the second run was after the move.
- **Structure audit.** `node scripts/structure-audit.mjs` from the repo root:
  - First run: `FAIL [naming] domain/src/runtime/route-state/: 3 files share the prefix "effect-"`. Fixed by the
    move into `effect/`.
  - Final run: `structure-audit: passed (157 warning(s), 118 baselined).` with no finding naming route-state or
    host-runtime. Exit 0.

## Not verified

- I did not run the full domain suite. The state-digest tests did not run this time, although `fnv1a` was not
  touched.
- No Lab, browser or provider call was made. I did not exercise Core's use of the members against a real recorded
  Flow.
- The bigbox control names in the test are modelled on `shell/store-picker.ts`, not captured from a live page. On
  the real page every store's button is named "Set as my store", so the names collapse to one distinct name. The
  test models that collapse.

## Open questions or contradictions found

- **Where the effect code lives.** The brief put the functions directly in `route-state/`. With `effect.ts`,
  `effect-format.ts` and `effect-holds.ts` the audit failed its naming rule (3 files sharing a prefix). They now
  live in `route-state/effect/` as `sign.ts`, `holds.ts`, `format.ts` and `index.ts`.
- **Where the effect test lives.** Following the test-placement rule, the test is in
  `route-state/effect/tests/effect.test.ts` instead of `route-state/tests/`.
- **What the chooser case adds.** In the bigbox chooser case the effect's `added` holds exactly one hash, the chip
  reading Millbrook. The effect therefore holds on any page whose chip names Millbrook. That is intended, but it
  means a single-name effect is as strong as the evidence gets.
