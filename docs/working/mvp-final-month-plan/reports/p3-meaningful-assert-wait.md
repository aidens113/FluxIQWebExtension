# P3 meaningful assert and wait
Status: Independently verified; integration pending
Task: t306
Worker: p0_build_identity
Date: 2026-10-07

## Current State

Approved ownership and provisioning completed (shared Core dc5c1aa2 read-only). Fail-first negatives observed; scoped fixes and final narrow checks complete. Source frozen for supervisor. Scope: missing authored absent target and text expectation false-pass, preserving literal text and genuine selector predicates. Hidden-first/any-match semantics excluded.

## Findings

assertion-evaluation evaluateOnce guards exists with no target but absent has no matching guard; no target produces held:true. Text request falls through expected??empty, then includes(empty) is true on any page. Gateway preserves missing/empty expectation rather than synthesizing real text; content boundary can validate without changing domain normalization.

wait-conditions requireText already throws missing/empty text. Its truthiness guard permits whitespace-only strings, which can match rendered normalized page spacing. The dispatch regression below reproduced whitespace-only success; missing/empty waits already refused. Literal null can be a real page substring and must remain supported.

## Validation ledger

Baseline owning Node tests18/23 passed, five failures: empty-target absent, missing text expectation, whitespace wait request, and two focus inference guards. Baseline production Chromium1failed (23.1s): missing/empty text assertions succeeded with passed validation; whitespace-only wait succeeded; no-target absent spent6071ms checking implicit focus; whole-page literal-null assertion failed when an unrelated field was focused. Missing/empty waits already refused (preserved). Empty-target evaluator absent passed; actual dispatch no-target absent did not pass in this fixture and must not be described as a reproduced browser false-success.

Implemented evaluator malformed guards, wait trim-empty guard, and assertionTarget authored predicate/focus bypass. Only absent/text without an authored target bypass focus; targeted/row scope continues ordinary resolver.

Exact target fields: nonblank action.selector, action.coordinates, visualTarget.documentBounds/bounds/anchor.bounds, or nonempty object action.element/options.element. This follows generic resolver's recorded object signal acceptance; it does not introduce hidden/any-match semantics or reject literal words. Valid whole-page text evaluates document.body. Malformed assertion returns existing closed STATE_MISMATCH failure without polling; invalid text wait follows existing closed failure builder. No new protocol vocabulary.


## Final validation and reproduction

- Extension source check: pnpm.cmd exec tsc -p tsconfig.json --noEmit, exit0.
- Extension test check: pnpm.cmd exec tsc -p tsconfig.test.json --noEmit, exit0.
- Five owning/integration test files bundled by existing esbuild Node/ESM/external-package pattern into ignored .test-build-scratch/t306-final, then node --test. Entries: content/action-runtime/tests/{assertion-evaluation,wait-conditions} and content/actions/tests/{assert,execute,gate-refusal}. 33/33 passed18.89s. Existing timing/state mismatch and row-scoped resolution regressions passed.
- Repository structure audit: node scripts/structure-audit.mjs, observed passed176 warnings117baselined; no baseline changes. Initial command redirected output to temporary report and inspection confirmed actual audit summary.
- Build from apps/extension: node scripts/build-extension.mjs, exit0; chrome/firefox/e2e-chromium each22 files verified.
- Production probe from apps/extension: pnpm.cmd exec playwright test -c e2e/playwright.config.ts e2e/runtime/tests/meaningful-assert-wait.spec.ts --workers=1. 1/1 passed19.4s (fixture16.4s), after final production build. Seven malformed dispatches all failed with closed code, no passed validation and <2000ms each despite5000ms authored windows. Four positives: targeted absent, targeted exists, literal-null whole-page assertion while unrelated input focused, literal-null text wait.
- Git diff whitespace check passed. No commits, merges, provider calls, full suites, user panel, Core/identity/host/storage/permission edits or debugger.

## Build identity and intended pair

Downstream base2ad3085c1a82697757bf48dbb98413ad72a8ea34 plus uncommitted t306 source; read-only shared Core dc5c1aa209bb507c862dadc46f9261d671add26c. Production artifact apps/extension/dist/e2e-chromium/build-info.json; no custom build-root environment.

Actual running background and top-frame content both matched the expected bundle before fixture dispatch:
- schema1; target e2e-chromium; version0.1.0; protocol fluxiq.build-identity.v1
- inputsDigest c3175ae56031c11de66e81db50aafab82b3ee1677273719d8565d853e725bf2b
- coreInputsDigest 2079970af3bbedb532763bef559d975ab79eae4937b2b36087567950866b531b
- domainInputsDigest 0be6326dd122f1943deb2a099fa4597c08a2dfe0dbac61045dd634a9304ae0d1

Chromium UA Chrome/134.0.0.0 Windows10 Win64; full binary patch version not captured. Ignored proof: apps/extension/e2e/test-results/artifacts/runtime-tests-meaningful-a-657c1-erves-authored-literal-text/running-build-identity.json. Bundled Core digest identifies contract inputs, not a connected running Core server.

## Boundaries and remaining evidence

The production fixture loads the actual unpacked extension on isolated local HTTP DOM, with runtime test driver invoking existing worker/content dispatch. It does not cover Core graph playback/domain gateway transport or real provider/site qualification. Gateway source inspection confirmed absent/empty expectations are preserved; no domain normalization change was needed. Firefox/Edge live sessions not run; three target builds do not prove their live behavior.

Literal words are not censored: null is positively exercised. Missing/empty wait text already refused before this change; only trim-empty wait guard is new. Blank equality is not added: the existing assertion is contains, so empty substring cannot become equality proof. Valid state mismatch/timeout behavior remains in existing tests. No hidden first-match, any-match, shadow-page-text, selector semantics or observer policy expansion.

Read inventory: current working state/brief, node backlog6 and reading A1/A2/W1/W5; extension assertion-evaluation, assert action/target/dependencies/tests, wait conditions/engine/text action, actual execute dispatcher and target resolver; domain gateway-action-parameters/gateway-mapping/action wire types; production runtime harness/fixture/config and prior content assertion/wait fixture seams. Written owners only: assertion-evaluation + owning test; wait-conditions + new owning test; actions/assert + owning test; new production probe; scoped web-capabilities paragraph; this report.

## Supervisor verification

Current dev (including t304) merged before independent checks. Five owning ESM/external-package bundles passed33/33; extension source/test typechecks, structure audit and all three22-file target builds passed. Supervisor reran the actual unpacked Chromium fixture:1/1 passed17.2s (fixture15.5s), including seven malformed failures without polling and four valid predicates. This verifies the content dispatch on an isolated fixture, not domain-gateway playback, real sites, Firefox/Edge or paid qualification. No user panel or providers used.
