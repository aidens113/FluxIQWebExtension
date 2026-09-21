# w2 multi-action contract slice

## Outcome

Complete. Core now has a strict, reusable `tool_calls` contract surface, but current production behavior remains singleton-only. No evidence executor, service, permission, state-recorder, downstream product, provider, or browser code changed.

## Implemented contract

- Added `runtime/llm/evidence-batch/` with a canonical decision shape:
  `{kind:"tool_calls",calls:[{toolId,input}, ...]}`. List items carry no model-authored call ID; Core's executor slice will assign collision-safe IDs.
- The parser is fail-closed and checks the complete list before returning a decision. It accepts 2–16 items only, rejects aliases and extra fields, accepts only bounded JSON-object inputs and valid tool IDs, and can be given the exact eligible tool IDs plus a pure tool-input predicate. A bad later item returns no decision and therefore no executable prefix.
- The schema builder returns `undefined` at the effective default of one. When explicitly enabled, it emits one closed `tool_calls` variant whose `calls.items.oneOf` repeats each eligible tool's exact input schema; it does not weaken inputs to a generic object.
- `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxActionsPerDecision` is 16 and `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_DEFAULT_MAX_ACTIONS_PER_DECISION` is separately fixed at 1.
- The structured response union, metadata stripping, and safe summary understand `tool_calls`. Summaries contain only `kind`, `decisionKind`, `actionCount`, and ordered `toolIds`; they never contain action inputs.
- Provider-result and direct-output validation take an optional batch-parse policy. Their default is one action, so a list response is rejected as `llm_output.evidence_batch_disabled`. Enabled validation reports later ineligible/invalid actions at indexed paths.
- The LLM barrel exports the contract. The current evidence-loop decision type/parser, executor, and DeepSeek decision-schema validation were deliberately not changed.

## Proof that execution is still disabled

Current production has three closed gates:

1. `buildAutomationStudioLlmEvidenceLoopDecisionSchema` in `runtime/llm/evidence-loop.ts` is unchanged and emits only `complete` and per-tool `tool_call` variants.
2. `runtime/llm/harness/run.ts` is unchanged and calls provider-result parsing without an opt-in, so `tool_calls` is rejected at the default maximum of one.
3. The private `parseDecision` and execution branch in `runtime/llm/evidence-loop.ts` are unchanged and recognize only `complete` and `tool_call`.

Existing singleton fixtures therefore retain their exact response/summary shapes. The existing provider test continues to assert the emitted variant order `complete`, `tool_call` and passed unchanged.

## Core files changed

- `runtime/llm/evidence-batch/decision.ts`
- `runtime/llm/evidence-batch/schema.ts`
- `runtime/llm/evidence-batch/index.ts`
- `runtime/llm/evidence-batch/tests/contract.test.ts`
- `runtime/llm/harness/provider-result.ts`
- `runtime/llm/harness/structured-response.ts`
- `runtime/llm/harness/output-validation.ts`
- `runtime/llm/harness/tests/evidence-batch-result.test.ts`
- `runtime/llm/index.ts`
- `runtime/loop-limits/evidence-loop.ts`
- `runtime/loop-limits/tests/evidence-loop.test.ts`

The existing modification to Core's `docs/working/multi-action-exploration-reconcile.md` belongs to the supervisor and was not changed by this worker.

## Exact slice-2 seam

Slice 2 should add one `maxActionsPerDecision` value to the evidence-loop input/context and make that same value control all four gates together:

1. `buildAutomationStudioLlmEvidenceLoopDecisionSchema` appends `buildAutomationStudioLlmEvidenceBatchDecisionSchema(eligibleTools, maxActionsPerDecision)` only when it returns a variant.
2. The evidence-loop task context carries the effective maximum so `deepseek-provider.ts` can recompute and authenticate the same dynamic schema rather than rejecting it as altered.
3. `harness/run.ts` passes the effective maximum, exact current eligible tool IDs, and tool-input validation into `parseAutomationStudioLlmProviderResult`.
4. The loop's private decision parser accepts the already-validated canonical list and routes singleton/list through one shared single-action transition. No list should be accepted until this last executor path and its atomic whole-list preflight exist.

The effective default must remain one through this wiring. Enabling only the schema, only provider parsing, or only execution would recreate the feature-control mismatch identified in the reconciliation map.

## Validation

- Focused Vitest run: 7 files, 79 tests passed. This included the new contract/provider/limit tests plus current `evidence-loop-provider`, harness, evidence-loop, and Flow Bootstrap limit suites.
- `pnpm --filter fluxiq check`: passed.
- `pnpm --filter fluxiq build`: passed.
- `git diff --check` on the owned Core paths: passed.
- `pnpm structure:check`: the owned import violation found on the first run was fixed. The rerun has no owned structural violations, but the command remains nonzero because the supervisor-edited `docs/working/multi-action-exploration-reconcile.md` has made `docs/working/README.md` stale. The brief forbids editing either shared document/index, so no baseline regeneration was performed.
- The first attempted focused Vitest command used repository-relative paths under a package-rooted `pnpm --filter ... exec`; it found no tests. The corrected package-relative command is the passing run above.

No provider call, browser/panel action, full suite, commit, or push was performed.
