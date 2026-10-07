# P3 browser navigation readiness

Status: Integrated source independently verified; task integration pending
Task: t303
Worker: p0_build_identity
Date: 2026-10-06
Tree: C:/Users/osrs_/FluxStuff/fxwork/t303-browser-navigation-readiness
Core: sibling read-only fxwork/!FluxIQ at 2ee06482e13d3c82b94de11ef11c944dbe3e56c1

## Current State

Implementation and narrow validation complete; source frozen for supervisor review. Provisioning completed at Core 2ee06482. Scope: tab repeat-safety metadata, explicit open landing verification, HTTPS downgrade refusal. Downloads, frame provenance/readiness timeout, shared protocol/Core/Stop/facade are excluded.

## Findings before changes

- Domain output definitions classify all tab operations observe with an incorrect idempotence comment; open always creates a tab and unnamed close can act on the returned-to tab when repeated.
- Explicit tab open compares URL after ready, bypassing navigate's challenge/status/check-wait evaluator. A same-URL404 or captcha can pass.
- URL comparison treats both directions between HTTP and HTTPS as equivalent, including downgrade.
- Existing navigate unread challenge/status can retain passed validation. Shared physical landing verifier will preserve transport vocabulary but make missing proof explicit as validation none/not-yet-validated, not a passed assertion. Click-open uses the same primitives but is outside this evaluator extraction.

## Validation ledger

- Fail first: domain definitions 17/18 (tab observe); navigation outcome+navigate 41/43 (downgrade and unread assertion); production Chromium fixture failed because explicit-open HTTP404 reported succeeded.
- Implemented tab mutate metadata, shared physical landing evaluator for navigate/open, unknown evidence validation:none, scheme downgrade refusal. Existing transport success vocabulary retained for unknown evidence; task completion is not asserted.
- Extracted coherent runtime/navigation/{target,outcome,landing,index}; moved target/outcome tests to navigation/tests. Existing landing primitives are imported through runtime barrel; background frames/sender injected by action-runner; direct tab API requires supplied landing callback for a passed landing assertion.
- Layout move exposed old blanket URL parser catch. Reused shared parsedUrl: malformed URLs still fail comparison, unexpected constructor errors propagate rather than silently absent. No baseline growth.
- Before layout finalization: domain source+test typechecks passed; definitions18/18; extension source check passed; extension60/60; production Chromium1/1.
- Final grouped source: extension source+test typechecks passed; five owning suites95/95 in38.35s; structure passed176 warnings117 baselined (no new violation); three-target production build verified22 files each. Final direct API no-reader test added; browser-tab18/18 in8.96s and extension test typecheck passed. Final production Chromium1/1 in8.1s (fixture6.5s). Git diff whitespace check passed.
- No provider calls, Core edits, full suite, panel launch, debugger, git mutation or shared document edits.


## Reproduction and identity

Task base downstream revision: c018fc820fadf13c6eef1557f6d6098b31a7c3f3 plus this uncommitted worker source. Supervisor must merge current dev, review, and run the narrow gates before integration; this tree predates t301.

From apps/extension:
- Source check: pnpm.cmd exec tsc -p tsconfig.json --noEmit
- Test check: pnpm.cmd exec tsc -p tsconfig.test.json --noEmit
- Production build: node scripts/build-extension.mjs (no custom build-root env)
- Browser probe: pnpm.cmd exec playwright test -c e2e/playwright.config.ts e2e/runtime/tests/browser-navigation-readiness.spec.ts --workers=1
- Five selected Node test entries bundled using existing esbuild pattern into ignored .test-build-scratch/t303-final, then node --test: runtime/navigation/tests/{target,outcome}, runtime/tests/{action-runner,browser-tab,navigate-action}. 95/95 passed before the final additional no-reader test, then browser-tab18/18 passed; 96 distinct tests passed across those observations. No claim of one final combined96 run.
- Structure: node scripts/structure-audit.mjs from repository root, passed; warning count176/baselined117.

Bundle: apps/extension/dist/e2e-chromium/build-info.json. Running background and content matched exactly before fixture actions:
- inputsDigest: 2a06e89a997cb17f768543bdc350caa3aa3faed1175212bdf98e2d1242de14cd
- coreInputsDigest: 2079970af3bbedb532763bef559d975ab79eae4937b2b36087567950866b531b
- domainInputsDigest: 0be6326dd122f1943deb2a099fa4597c08a2dfe0dbac61045dd634a9304ae0d1
- target e2e-chromium; identity protocol fluxiq.build-identity.v1; schema1; version0.1.0.
- Chromium UA: Chrome/134.0.0.0 on Windows10 Win64. Full executable patch version not recorded.
- Ignored proof: apps/extension/e2e/test-results/artifacts/runtime-tests-browser-navi-07b39-s-without-retrying-the-open/running-build-identity.json.

## Evidence limits and follow-up

The provider-free local HTTP fixture exercised actual production background/content code, explicit ordinary200/HTTP404/person-only CAPTCHA landing and blank tab, and tab counts (no repeated creation). Fixture CAPTCHA is diagnostic text, not a real challenge provider. HTTPS downgrade and missing/unread landing evidence are owning Node regressions, not a live TLS redirect probe. Existing self-clearing wait/rate-limit/navigation movement regressions passed in navigate-action; no new paid/real-site checks were performed. Chrome/Edge/Firefox production bundles built; Firefox and Edge browser sessions were not run. Core digest identifies bundled contracts, not independently connected running Core. No broad readiness timeout, download provenance, frame, Stop, protocol or permission work was folded into this brief.

Source inventory: domain output definitions/tests; extension runtime action-runner, automation-tab, browser-tab, action-results, navigation target/outcome/landing, landed challenge/check-wait, served status/rate-limit/quoted path, runtime index, and owning tests; extension build/e2e fixture/harness/config; scoped web-capabilities docs and written brief/current state. Mechanical owner changes remain in approved files; target/outcome tests moved into the feature's tests directory. Authored report and capability docs updated. No commit/push or git mutation.

## Supervisor integration verification

- Merged current dev (including t301 typed changes) into task t303 before checks. Reviewed the shared landing evaluator, injected evidence access, explicit-open path, mutation metadata and moved URL/movement helpers.
- Validation: independent extension owning tests96/96 and domain definitions18/18; domain source/test check0; extension source/test typechecks0; structure audit0. The initial supervisor ad hoc CJS bundle omitted the established external-package boundaries and tried to bundle sqlite's native addon. Corrected the probe to the repository's ESM/external pattern; this was a harness failure, not a product regression.
- Validation: rebuilt Chrome/Firefox/E2E targets (22 files each), then production Chromium explicit-open fixture1/1 (8.4s): ordinary landing passes, HTTP404 and person-only check fail, no repeat tab open, blank-tab behavior preserved. Local fixture and owned browser only; no provider or user-panel management.
- Merged-source E2E inputsDigest: 2d672af15d9289ba02b8ff8a305a2214c756cfa7474f651bbcec700d195a7e19; sibling shared Core2ee06482. Source-level downgrade/unknown-evidence negatives pass, no live TLS redirect proof. Existing report limits remain.
