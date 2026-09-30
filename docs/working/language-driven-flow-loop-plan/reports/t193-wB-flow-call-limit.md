# t193-wB: Flow call limit (worker report)

## Outcome

Done. Core now reads a Flow's stored `llmExecutionSettings` into the provider resolution everywhere a provider is resolved for that Flow's model calls. With the Lab's saved `maxCalls: 48`, the build's loop gets `maxIterations` 48 instead of the 64 backstop. No check, refusal or grant was added.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`.

- New leaf `llm/flow-execution-limits/resolution-within-flow-settings.ts` exports one function, `automationStudioLlmResolutionWithinFlowSettings(resolved, flowMetadata)`. It has a barrel, `llm/flow-execution-limits/index.ts`, and is re-exported from `llm/index.ts`. What it does:
  - `maxCalls` becomes `maxCallsPerRun`, or lowers an existing one.
  - Each `tokenLimits` field, `timeoutMs` and `maxEstimatedCostUsd` takes the lower of the Flow's value and the resolution's. Where the resolution leaves a field out, the Flow's value is compared with the harness default instead (tokens 8000/2000/10000, 20 s, $0.25), so a Flow value can never widen a limit.
  - It ignores absent, wrongly typed or out-of-bounds values, using bounds copied from `api/handlers/llm-execution-settings.ts`: calls 1..64, tokens 1..64000, timeout 1..25000, cost greater than 0 and at most 0.25. The bounds are copied because runtime must not import from api.
  - It ignores a whole token set whose input plus output exceeds its total.
  - It ignores `maxCalls: 1`, the web app's `FLOW_LLM_UNSET_CALL_COUNT` (value 1, `apps/web/src/features/automation-studio/settings/flow-settings-model.ts:599`).
  - It returns `undefined` and a bare provider unchanged.
  - It was first written as `llm/flow-execution-limits.ts`. I moved it into its own directory because its test put `llm/tests/` at 26 files, over the 25-file limit (structure-audit FAIL).
- Call sites. None of them adds a store read.
  1. The build, `service.ts:1518`, wraps the resolver result with `parent.metadata`; the Flow is already loaded there.
  2. The recovery and diagnosis, `recovery/annotation/annotate.ts` near line 149. I moved the existing single `ports.flowForRecovery` read up from about line 279 to just after provider resolution. It is still read once and still only when a provider exists. `providerResolution` is narrowed with `recoveryFlow?.metadata` before `resolveAutomationStudioRecoveryRunBudget`. This covers both the caller's resolver and the unattended standing authority's resolution, `authority.resolution`.
  3. The result check's caller path, `service.ts:2586` (`resolveCallerProvider`), wraps the result with `canonical?.metadata`. `canonical` is already loaded in that method and is read lazily after the run.
- `service.ts` budget: 4 existing lines changed (the import, one comment, lines 1518 and 2586) and 0 added.
- Sites not changed:
  - `resolveStandingProvider` (the `resultCheckProviderResolver` passed through at `service.ts:2587` for result checks) is a different resolver. I left it alone.
  - `recovery/annotation/ports.ts` is only a type.
  - There are no other `llmProviderResolver` or `resolveLlmProvider` call sites (checked by grep).
- Tests:
  - `llm/flow-execution-limits/tests/resolution-within-flow-settings.test.ts` (new, 10 cases).
  - `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`: a Flow with `maxCalls` 48 on the session-key defaults gives `maxIterations` 48 and `maxToolCalls` 49.
  - `tests/service-bootstrap/tests/flow-call-limit.test.ts` (new): a real `generateFlowBootstrapAdaptation` with `maxCalls` 5 and a model that never completes. It ends `flow_bootstrap.evidence_iteration_limit` after exactly 5 requests, each with `timeoutMs` 25000.
  - `recovery/annotation/tests/annotate.test.ts` plus a `flowMetadata` option in `annotate-harness.ts`: the resolver declares no count, the Flow sets `maxCalls` 2, and the exploration ends `llm_budget.run_call_limit` after 2 calls.

## Commands run and observed results

All run in `packages/fluxiq` unless noted.

- `npx vitest run <4 files> --minWorkers=1 --maxWorkers=2`
  - Before the directory move: 1 failure, which was my own bad fixture (60k+1k tokens against a 64k total, an invalid set). After fixing it: 4 files, 52 tests passed.
  - After the move: 4 files, 52 tests passed.
- Revert probe: I inserted `return resolved;` at the top of the leaf, ran the same 4 files, then restored the file. `grep -c REVERT-PROBE` printed 0. Result: 6 failed, 46 passed. Every new test failed:
  - `expected 64 to be 48`
  - the service build: `expected [...] to have a length of 5 but got 64`, which is the live defect reproduced
  - the annotate exploration did not end on the call limit
  - 3 of the leaf's unit cases.
  - This was run before the directory move. The logic did not change in the move, only import paths.
- Neighbouring suites `recovery/annotation`, `tests/service-bootstrap`, `llm/tests/session-key-provider.test.ts` and `loop-limits`: 27 files, 205 passed, 6 failed.
  - All 6 failures are in `tests/service-bootstrap/tests/rejections.test.ts`, for example "rejects a missing caller before provider resolution".
  - Cause: the diagnostic now carries an extra `issueCodes: ["thrown.Error", "thrown.at:runtime.service.flow-bootstrap-commands.generation-request.ts:50"]`. That field comes from another worker's uncommitted change in this worktree: the untracked `flow-bootstrap/generation-failure/thrown-issue-codes.ts` and the `, error)` edit at `service.ts:1679`.
  - These tests fail at input validation, before my resolver line is reached. Not mine.
- `bash .../heavy.sh "t193-wB tsc" npx tsc --noEmit -p tsconfig.json` -> no output, exit 0 (both before and after the move).
- `bash .../heavy.sh "t193-wB structure" node scripts/structure-audit.mjs` (Core root)
  - First run: exit 1, `FAIL [directory-files] .../runtime/llm/tests/: 26 source files exceeds the 25-file limit`.
  - After the move: exit 0, with the note "1 baseline entries can be lowered". I did not run `pnpm structure:baseline` because the baseline is a shared file.
- `bash .../heavy.sh "t193-wB build" pnpm --filter fluxiq build` -> exit 0.

## Not verified

- No Lab or browser run, per the brief. A live build has not yet been shown to stop at 48.
- The result-check narrowing at `service.ts:2586` has no dedicated test. It type-checks, and the existing suites pass through it.
- The full `packages/fluxiq` test suite was not run, only the suites listed above.

## Open questions or contradictions found

1. Token narrowing affects Flows saved from the web app. The web form's defaults write `tokenLimits` 8000/2000/10000 and `timeoutMs` 20000 (`flow-settings-model.ts:526`). A web-saved Flow is therefore now held to 8000 input tokens per call where the session-key resolver allows 48000, and to 20 s instead of 45 s. The comments on the session-key defaults say a real page needs that room. The brief's rule (per-field minimum) requires this, but it may shorten or break builds of web-configured Flows. The Lab's saved values equal the resolver defaults, so the Lab is unaffected. The supervisor should decide whether the web defaults should be treated as unset the way `maxCalls: 1` is.
2. Because 1 means unset, a user who deliberately configures exactly 1 call gets the default count instead.
3. The web comment says "no run reads the saved `maxCalls`". That is now false, so the comment is stale. I did not edit it because `apps/web` is outside my scope.
