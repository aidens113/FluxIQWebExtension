# Selected-card field inference

Status: final source frozen; 22 owning units, actual realistic nonempty browser proof, extension typecheck and audit passed. Supervisor independent review pending. No paid launch, Core rebuild, commit/merge/push. Existing t563 auction/debug/report evidence preserved.

Source ownership approved before edits: content/extraction/infer-fields.ts; its tests/infer-fields.test.ts; existing e2e/content/tests/extraction/tests/structure-detection.spec.ts. Supervisor additionally approved content/extraction/field-path-equivalence.ts because infer-fields.ts was already 786 lines; helper is consumed, not extract-and-drop. No unrelated owner edited.

Generic mechanism: infer-fields collects bounded sources as before, then helper prunes a narrower field only when a broader candidate has the identical leaf, reading kind/attribute/header/line behavior and sensitivity, differs solely by extra ancestor CSS classes with at least one retained shared class, and resolves to exactly the same DOM element on every overlapping sampled row plus at least one additional row. No text/value equality, class-name semantics, global class stripping, or blanket partial suppression. Optional marks and leaf-class subtype fields remain; existing mixed-template and sensitive-source tests retained. Table inference remains unchanged.

Fail-first owning unit command exited1:20passed/1failed. Primary selected-ancestor assertion reproduced duplicate partial field. Post-fix all 21 passed, 498 ms. Controls retain optional mark, same-text distinct subtype leaf, all prior mixed templates, positional lines, bounds, semantic names and sensitive exclusion cases. The fake DOM does not instantiate real input controls; its safety assertion checks private value is not exposed, while existing proposed-field sensitivity tests cover exclusion policies.

New actual-browser test uses only realistic job-board, opens nonempty employer search, selects one card, calls real structure detection, proves one full-coverage company field, changes selected card, then runs actual extract_list using inferred company/title fields plus equality condition and checks nonempty exact rows against the site's rendered cards. No fixture edits or synthetic browser page. Not yet executed; provider-free compilation needs current Core dist.

Core currency guard currently refuses old t567 dist after source integration; observed correctly, no bypass or rebuild. Exact logs: C:/Users/osrs_/AppData/Local/Temp/t567-selected-fields-failfirst.log, C:/Users/osrs_/AppData/Local/Temp/t567-selected-fields-tests.log, C:/Users/osrs_/AppData/Local/Temp/t567-selected-fields-audit.log. Supervisor coordinating final dependencies before package/browser checks. No live acceptance claimed from units.

## Supervisor refinement and integrated dependency gate

The first helper placement failed audit: root source-file/prefix budgets and catch-as-empty. Supervisor approved mechanical substitution to content/extraction/path-equivalence/{prune.ts,index.ts}; own old field-path-equivalence.ts removed, no root barrel change. Invalid generated selectors now propagate. No exception is interpreted as an absent field.

Supervisor required complete-run equivalence proof: discovery remains bounded, but pruning resolves every candidate selector across the complete run and explicit item if absent. A conflicting uniquely selected element after the first12 sampled items must retain the partial field. New control failed first:21passed/1failed; passing full-run proof now gives22passed (615.769ms). Source proof uses actual element object identity, strict additional coverage and same leaf/reading semantics. Same-text distinct leaves and optional subtype marks remain.

After readers exited, supervisor synced t567 Core e58e4cf9 / downstream ce720fc8; dirty approved source preserved. Authorized cache-off Core three-library build started (libraries only, no web/root build), exact output C:/Users/osrs_/AppData/Local/Temp/t567-selected-fields-core-build.log. Downstream audit rerun active. Extension check/realistic browser test wait for successful dist currency. No shared Core tree touched, no paid run.

## Final source and observed gates

Final source paths (all downstream in t567): apps/extension/src/content/extraction/infer-fields.ts; apps/extension/src/content/extraction/path-equivalence/prune.ts; apps/extension/src/content/extraction/path-equivalence/index.ts; apps/extension/src/content/extraction/tests/infer-fields.test.ts; apps/extension/e2e/content/tests/extraction/tests/structure-detection.spec.ts. No root barrel edit. Field reading equivalence explicitly includes accessible-name behavior in addition to sensitivity/attribute/line semantics.

Core libraries-only build exited0: actual fluxiq compile117.467s, contracts/gateway matched stamps. Final owning units22/22 passed,1018.638ms. Final extension package check exited0, actual compiler43.775s, with Core-currentness guard passed. Final downstream audit exited0,211warnings/638baseline. git diff --check clean.

Realistic Chromium browser test passed: actual inference on nonempty job-board search; one full-coverage company field; selection changed; actual extract_list returned exact nonempty matching rows. First pass5.2s/test,1.1m total. This pass preceded only the later conservative accessible-name equality comparison; job fields have no accessibleName source flag. Same-case final browser rerun was already in flight when supervisor said reuse would suffice; record its result below rather than claiming an unfinished result. No paid/model calls or synthetic browser page.

Exact unit command from apps/extension: EXTENSION_TEST_BUILD_LABEL=codex-selected-fields node scripts/test-extension.mjs content/extraction/tests/infer-fields.test. Exact browser command: pnpm.cmd test:content -- extraction/tests/structure-detection.spec.ts --grep "selected cards keep one shared company field" --workers=1. Exact package command from downstream root: process-only FLUXIQ_BUILD_CACHE_DIR=off then pnpm.cmd --filter @fluxiq-web-extension/extension check. Audit: node scripts/structure-audit.mjs.

Raw logs absolute C:/Users/osrs_/AppData/Local/Temp/t567-selected-fields-{failfirst,fullrun-red,tests,core-build,extension-check,browser,audit}.log. All source is frozen for supervisor review. No commit/merge/push, paid launch or t563 mutation.

Final exact-source browser rerun completed exit 0: same realistic job-board case passed in 4.5 s (30.6 s total), including the restrictive accessible-name comparison. No browser check remains active. This removes the earlier source-timing caveat for final acceptance. All assigned checks passed; supervisor independent verification still required.
