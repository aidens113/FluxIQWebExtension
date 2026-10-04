# Core budget investigation

Status: Completed; source frozen for supervisor verification.

Historical default immediately before t230 (`fc26cfd6`) was $0.25 in Core Flow adaptation policy, web UI fallback, runtime ceiling, and standing unattended-repair authorization. Before t218 (`c2864786`) Flow/UI adaptation default was $1. The requested rollback target is the immediately preceding $0.25 policy, not the earlier $1 policy.

Current leakage: model/flows.ts dynamically reads the Lab knob; result-check-authorization/contracts.ts reads it at module evaluation; runtime/llm/flow-execution-limits/run-cost-ceiling.ts provides the resolved value to session defaults, build purse and recovery purse. Current settings UI hardcodes .1. Therefore simply removing the model read does not isolate the ordinary UI/runtime.

Agreed proposed seam: `FLUXIQ_LLM_RUN_COST_CEILING_SCOPE=test` explicitly activates Core's environment ceiling. Without that scope, ignore the knob including malformed values and retain ordinary $0.25 fallback. With test scope, accept the existing knob, default .10, validate >0 and <=10. Lab supplies scope and resolved .env ceiling to its own Core child processes only. Core remains domain neutral.

Model/UI/standing authorization defaults stay .25 regardless of scope. Explicit policy limits remain valid and are narrowed by custom resolver and authorization limits; test scope imposes its own ceiling. The helper's normal .25 is fallback when no positive explicit limits exist, rather than a global clamp. The existing server maximum is $10.

The session resolver currently explicitly supplies .25 as its own total, which would still erase larger user Flow policies. Its existing metadata input can resolve adaptation policy through the generic ceiling helper to return the effective total (and per-call min). This keeps no-policy .25 and test-scope .10, while honoring explicit normal user limits.

Residual fixed .25 bounds are per-call settings checks in api/handlers/llm-execution-settings.ts and runtime/llm/flow-execution-limits/resolution-within-flow-settings.ts. Preserve these existing settings contracts.

Verification not run: source inspection only while task provisioning/build remains in progress. No provider calls, panel operations, environment/private data reads, commits or pushes.

## Implemented seam

Supervisor approved source partition and generic marker `FLUXIQ_LLM_RUN_COST_CEILING_SCOPE=test`.

- Ordinary Core ignores the Lab environment knob, including malformed values. Existing DEFAULT_USD export now denotes the ordinary .25 fallback; new TEST_RUN_COST_CEILING_DEFAULT_USD is .10.
- Runtime explicit positive limits narrow one another up to server maximum10. Only an explicitly scoped test runtime imposes the .env ceiling. Stored model defaults and user-facing standing authorization remain .25 regardless of scope.
- Session resolver uses the Flow adaptation policy in existing metadata, so a user-set1 policy remains1 in an ordinary runtime; test runtime narrows1 to .1. Existing service per-call settings composition narrows1 to configured .05 without changing the whole-run total.
- Recovery source no longer manufactures a multiplied default purse when neither resolver total nor resolver per-call cost exists. No-policy recovery stays .25. Explicit resolver totals remain effective and authorizations still narrow them.

### Owned changed source and tests (Core-relative)

- packages/fluxiq/src/programs/automation-studio/model/run-cost-ceiling/{index.ts,run-cost-ceiling-env.ts,tests/run-cost-ceiling-env.test.ts}
- packages/fluxiq/src/programs/automation-studio/model/flows.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/flow-execution-limits/{run-cost-ceiling.ts,tests/run-cost-ceiling.test.ts}
- packages/fluxiq/src/programs/automation-studio/runtime/llm/{session-key-provider.ts,tests/session-key-provider.test.ts}
- packages/fluxiq/src/programs/automation-studio/runtime/result-check-authorization/{contracts.ts,tests/contracts.test.ts}
- packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/{run-budget.ts,tests/run-budget.test.ts,tests/iteration-guards.test.ts}
- packages/fluxiq/src/programs/automation-studio/runtime/loop-limits/tests/flow-bootstrap-evidence-loop.test.ts
- packages/fluxiq/src/programs/automation-studio/runtime/tests/service-flows/tests/creation.test.ts
- packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/generation.test.ts
- apps/web/src/features/automation-studio/settings/{flow-settings-model.ts,tests/settings-round-trip.test.tsx}

Scope expansions were explicitly approved by supervisor: owning recovery source preserves no-policy fallback, two budget expectation files replace obsolete global-clamp assertions, and one iteration fixture explicitly declares its tested cost boundary. No worker architecture/shared-plan edits, commits or pushes.

## Validation so far

- Core focused initial six files:37 passed.
- Web settings round-trip test:16 passed, only existing react-test-renderer deprecation warnings.
- Core package `pnpm --filter fluxiq check`: passed,28.5seconds.
- Initial affected budget directories:132 passed20failed, exposing old universal-clamp assumptions and absent-recovery fallback bug. Retry after fixes:158passed2failed (one own assertion typo fixed, one old fixture corrected). Final combined focused run pending.
- PowerShell refuses pnpm.ps1 under system execution policy; used pnpm.cmd initially. Subsequent test/check commands use authorized build-slots/heavy.sh through Git Bash. No full suites, provider calls, browser/panel operations or paid Lab runs.

### Final focused result

20 Core owning files /200 tests passed in20.27seconds. Command (Core root, through heavy wrapper):

```powershell
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/model/run-cost-ceiling/tests src/programs/automation-studio/runtime/llm/flow-execution-limits/tests src/programs/automation-studio/runtime/loop-limits/tests src/programs/automation-studio/runtime/recovery/annotation/tests src/programs/automation-studio/runtime/llm/tests/run-budget.test.ts src/programs/automation-studio/runtime/llm/tests/session-key-provider.test.ts src/programs/automation-studio/runtime/result-check-authorization/tests/contracts.test.ts src/programs/automation-studio/runtime/tests/service-flows/tests/creation.test.ts src/programs/automation-studio/runtime/tests/service-bootstrap/tests/generation.test.ts
pnpm --filter @fluxiq/web exec vitest run src/features/automation-studio/settings/tests/settings-round-trip.test.tsx
pnpm --filter fluxiq check
```

The web focused command passed16tests. Core typecheck passed. Web touched package typecheck is running. Source is frozen and ready for supervisor independent verification.

Web package typecheck duplicate stopped gracefully with Ctrl+C at supervisor request; supervisor already owns web check71753. This worker does not claim web typecheck success. Core typecheck and216 focused tests remain verified. Final source frozen; status completed, awaiting supervisor independent verification.

