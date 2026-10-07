# P3 typed browser readiness

Status: Complete — source frozen; supervisor verification pending
Date: 2026-10-06
Task: t301
Worker: p0_build_identity
Tree: C:/Users/osrs_/FluxStuff/fxwork/t301-typed-browser-readiness
Core: sibling fxwork/!FluxIQ, read-only intended revision 7717ff42

## Current State

Provisioning completed before edits. Implemented and verified three bounded blockers: desired-state native check with real application handlers; same-row in-place Next semantic change and bounded ended distinction; type submit consequences through existing Core permission gate. Source is frozen for independent supervisor verification/integration. No protocol/Core/identity/Stop/facade edits, provider runs, debugger input, git mutation or full suites.

## Inspection findings

- checkable-state currently assigns checked then emits input/change; a click-only controlled handler never receives its gesture. Already-correct and radio-uncheck guards exist and must remain.
- list-change compares connection/count/first identity only; equal-count mutation in the same rows is invisible. Detached pager alone counts as changed, so a semantic proof must distinguish pager churn from list advancement.
- step-permission's committing set omits type with submit:true. Resolved parameters reach the gate, allowing a scoped condition without a wire/Core change. Unsent typing must remain compatible.

## Validation ledger

- Fail-first production extension, `pnpm.cmd exec playwright test -c e2e/playwright.config.ts e2e/runtime/tests/typed-browser-readiness.spec.ts --workers=1 --reporter=list`: controlled check returned failed instead of succeeded because application click handler did not run; in-place Next failed its succeeded assertion. Both before-change tests failed. Initial local HTTP teardown waited for keep-alive connections and additionally hit the 30s test timeout; fixture teardown now closes its own connections. These were genuine action assertion failures, not claimed browser startup failures.
- Fail-first real Core permission-seam file: 11/12 passed, undeclared submitting type incorrectly built (`true !== false`). Existing declared consequence gating already passed; the defect was the missing mandatory declaration.
- After change: owning extension checkable-state/gate-refusal/list-change/move-page files **19/19 passed**; permission seam **12/12 passed**, including zero type/submit callback dispatch on undeclared refusal, allowed/denied/empty declaration and unsent compatibility.
- Extension and domain source typechecks passed; extension and domain test typechecks passed. Structure audit passed with existing advisory warnings, no new hard violation. No full suites were run.
- Production Chromium browser fixture after changes **2/2 passed** (20.9s), then running background/content/disk identity assertions **2/2 passed** (23.6s). Artifact retention **2/2 passed** (20.3s). Final fixture includes radio activation/no extra click, browser metadata and retained identity snapshots: **2/2 passed, 24.6s**. Narrow reruns followed fixture/evidence changes, not package-wide suites. Browser user-agent reports `Chrome/134.0.0.0` on Windows; full patch version was not queried.

## Implementation

`checkable-state.ts` keeps native checkbox/radio recognition, disabled checks, radio-uncheck refusal and already-held no-op. A changed state uses exactly one native `input.click()` so click-controlled application state and browser input/change order agree. It observes for a 50ms timer window, reads checked after microtasks/render handlers, and refuses a detached control rather than certifying stale DOM. `check.ts` awaits this; dependency typing admits synchronous mocks or asynchronous setter. Hidden-label/actionability logic is preserved. A revert yields a failed postcondition with no second activation from the setter. This does not create trusted events.

`list-change.ts` captures normalized record text and link addresses before pressing; comparing live Elements after the press would lose the previous values. Equal-count semantic change in the same row Elements now counts, while detached/replaced pager alone does not. No style/class/animation attributes are used as movement evidence and no signature enters wire logs. Existing bounded timeout, document-navigation continuation, disabled/no-following-page ended semantics and one-press behavior remain. New unit tests cover in-place text, address-only change and pager churn; existing move tests cover ended/no press and navigation continuation.

`step-permission.ts` takes resolved parameters when deciding mandatory declaration. Only type with strict boolean `submit: true` joins committing click/keypress/dialog; unsent type remains compatible. Declarations, including explicit empty, go through the existing real Core check. No Core authorization shortcuts or protocol changes were introduced.

## Exact changed ownership

- `apps/extension/src/content/action-runtime/checkable-state.ts`
- `apps/extension/src/content/action-runtime/tests/checkable-state.test.ts` (new)
- `apps/extension/src/content/actions/check.ts`
- `apps/extension/src/content/actions/types.ts`
- `apps/extension/src/content/actions/tests/gate-refusal.test.ts`
- `apps/extension/src/content/extraction/page-advance/list-change.ts`
- `apps/extension/src/content/extraction/page-advance/tests/list-change.test.ts` (new)
- `apps/extension/e2e/runtime/tests/typed-browser-readiness.spec.ts` (new)
- `domain/src/runtime/llm-evidence/plan-resolution/step-permission.ts`
- `domain/src/runtime/llm-evidence/plan-resolution/tests/plan-step-permission.test.ts`
- `docs/architecture/web-capabilities.md` (scoped behavior documentation)
- This report.

No edit was needed in page-render, continuation, existing move-page tests, shared protocol, identity, Stop or facade. Additional actions/types and gate-refusal async ownership was approved by supervisor before edit. Core stayed read-only.

## Reproduction commands

Run from the task's `apps/extension`:

```powershell
node scripts/build-extension.mjs
pnpm.cmd exec playwright test -c e2e/playwright.config.ts e2e/runtime/tests/typed-browser-readiness.spec.ts --workers=1 --reporter=list
pnpm.cmd exec tsc -p tsconfig.json --noEmit
pnpm.cmd exec tsc -p tsconfig.test.json --noEmit
```

The direct build script regenerates production chrome/firefox/e2e-chromium bundles; this is not the repository-wide build suite. Browser loads `apps/extension/dist/e2e-chromium`, headed isolated persistent profile, fresh local HTTP fixture, no Core server or provider. It executes shipped production content via the existing separately bundled runtime harness. Therefore background routing is represented by the source runtime harness, not a paired gateway request; running background stamp is obtained from the packaged worker independently. No product debugger input fallback is used.

Owning Node tests were bundled with esbuild `bundle:true, platform:node, format:esm`, external `fluxiq`, `fluxiq/*`, websocket package/subpaths, into ignored `apps/extension/.test-build-scratch/t301/` and `domain/.test-build-scratch/t301/`. Exact extension entries: checkable-state.test.ts, actions gate-refusal.test.ts, page-advance list-change.test.ts and move-page.test.ts. Exact domain entry: plan-resolution/tests/plan-step-permission.test.ts. Each bundle was imported and its observed node:test result counted; no package-wide discovery/suite was called. Structure command from task root: `node scripts/structure-audit.mjs`. Source/test typechecks use each touched package's corresponding tsconfig.

## Identity and limitations

Final tested e2e-chromium build identity: schema1, version0.1.0, protocol `fluxiq.build-identity.v1`; exact inputsDigest `d579809644e78fbb4f17c84e74b591c16a7a4a1ba0889f70c9f0bf5d4a745509`; reached Core input digest `2079970af3bbedb532763bef559d975ab79eae4937b2b36087567950866b531b`; domain input digest `45d42570c7f3cb2d9f9caf932014b75bd2fc3a86c6dfd24ca9cf97644465ff39`. Intended sibling Core revision7717ff42 is a disk pairing record, not a running Core-server proof. Both browser tests assert packaged background and active top-frame content stamps equal intended disk identity before commands and retain a screened identity JSON in run-scoped ignored evidence. Verified both retained JSON receipts directly: identities match. Paths under `apps/extension/e2e/test-results/artifacts/`: `runtime-tests-typed-browse-e620d-and-reverts-remain-truthful/running-build-identity.json` and `runtime-tests-typed-browse-a06ab-d-end-and-unchanged-timeout/running-build-identity.json`. These are ignored evidence, not tracked report data.

The controlled fixture is an explicit application-state simulation, **not React**. It proves real native browser activation/application listeners, checkbox/radio no-op counts, radio refusal, synchronous and microtask revert, detached readback; it does not qualify every React/editor/component framework. Only Chromium is live-tested; Firefox and Edge product behavior remains unexercised. The 50ms timer cannot detect changes scheduled after the window, and event-loop scheduling is not a hard wall-clock bound. Setter has no abort signal/deadline dependency; cancellation cannot interrupt that single post-activation observation, but no further press is dispatched by it. Detached controls fail instead of guessing/re-resolving a replacement.

Paging uses normalized text/link semantics, not a complete stable page/dataset digest; changing dynamic text inside a record may require stronger field-specific identity later. In-place Next currently can pay the existing page-render settle because its unread-item callback is Element-identity based; no extra arrival owner was changed. Submit tests cover resolved literal boolean true/false; dynamic submit bindings and executing previously saved Flows were not exercised. No universal extraction completeness, duplicate-page prevention, 67-task qualification, captcha/consent recovery or paid A-D acceptance is claimed. The frozen navigation/gaps audits retain those follow-ups. No commits/pushes or main/shared edits by this worker.
