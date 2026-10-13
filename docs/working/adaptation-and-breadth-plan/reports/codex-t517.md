# Codex t517 verification and correction

Status: Done (supervisor verification and integration pending)

## Findings and changes

The original uncommitted t517 implementation is preserved. The dead lasting-action false success reproduced in the existing graph test: `defensive/continuation.ts` checked mutating metadata but ignored `declaredConsequences`. Default continuation now refuses both. Authored optional/continue decisions retain precedence; lifecycle handlers and failed edges still run before default continuation.

The graph regression now requires failed status and no End-node execution after two no-effect presses. Additional cases cover an authored failed edge and explicit optional continuation. Existing lifecycle tests remain in the focused validation selection.

The model receives `press_had_no_effect`, with a fixed next sentence explaining that automatic retries finished and the effect is not established. This required the existing `rejection-next/next-sentence.ts` module in addition to the brief's named feedback files. Failure taxonomy and Core runtime architecture document the failure field and trace marker.

The settled look now observes reachable open shadow roots outside the press region as well as the document. A root attached after the watch starts invalidates certainty, including attachment to an existing host without a document mutation. Stopping during settle cannot later produce certainty. Three focused regressions cover these cases. No whole-page markup comparison was introduced; comparison markup and field values remain local and unpublished.

## Observed validation

- Core executor step-loop, defensive and outside-graph tests: 17 files, 140 passed.
- Contracts failure tests: 10 passed.
- Domain selected tests: 237 passed.
- Extension actions/action-runtime tests before the shadow-root correction: 498 passed. Changed ignored-press directory after correction: 60 passed.
- Core fluxiq/contracts source typechecks, domain source/test typechecks and extension source/test typechecks exited 0. Final extension source/test rechecks also exited 0.
- Both structure audits exited 0 (Core 340 advisory warnings; downstream 195). Downstream audit was rerun after initial shadow-observer correction and still passed.
- Headed real social-network-feed Post harness passed (1 test, 23.8 seconds). Final topology-change rerun also passed (1 test, 12.8 seconds).
- Both git diff checks passed; existing Core CRLF normalization warning only.

## Exact verification commands

From Core `packages/fluxiq`:

```powershell
npx.cmd vitest run src/programs/automation-studio/runtime/executor/step-loop/tests src/programs/automation-studio/runtime/executor/defensive/tests src/programs/automation-studio/runtime/executor/outside-graph/tests
npx.cmd tsc --noEmit
```

From Core `packages/contracts`:

```powershell
npx.cmd vitest run src/failure
npx.cmd tsc --noEmit
```

From downstream `domain`:

```powershell
$env:DOMAIN_TEST_BUILD_LABEL='t517'
node scripts/test-domain.mjs runtime/tests runtime/failure/tests runtime/llm-evidence/action-failure/tests runtime/llm-evidence/node-run/retries/tests client/tests
npx.cmd tsc -p tsconfig.json --noEmit
npx.cmd tsc -p tsconfig.test.json --noEmit
```

From downstream `apps/extension`:

```powershell
$env:EXTENSION_TEST_BUILD_LABEL='t517'
node scripts/test-extension.mjs content/actions/tests content/action-runtime
node scripts/test-extension.mjs content/action-runtime/ignored-press/tests
npx.cmd tsc -p tsconfig.json --noEmit
npx.cmd tsc -p tsconfig.test.json --noEmit
node scripts/test-content.mjs wake-press-post --headed --workers=1 --reporter=line
```

From each repository root: `node scripts/structure-audit.mjs` and `git diff --check`.

## Limits and integration

No full suite, Lab/provider run, commit or merge performed. Chromium content harness exercised the real social-network fixture using its harness content build; full gateway/adapter/Core playback chain and Firefox were not exercised live. Existing Core package dist predates this worker's continuation correction; the supervisor must rebuild after merging current dev before integration tests that consume dist. Both t517 branches are behind dev as reported by the supervisor; integration and post-merge checks remain the supervisor's responsibility.

Closed shadow roots that the extension cannot reach remain unobservable, as in the existing shadow-DOM abstraction. The open-root defect recorded by the original worker is fixed. Shadow topology scanning adds a document element traversal per settle poll; no performance benchmark was run.

