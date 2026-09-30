# t193-wM: five repair-ladder fixes in Core's recovery annotation

## Outcome

Done. C3, C5, C6, C9 and K7 are fixed in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`. Nothing was committed and no build was run.

There is one deviation from the ownership list. C9 needed a new skip code, and the skip-code type lives in `recovery/diagnosis-chain.ts`, which the brief did not list. That file was not on the must-not-touch list either, so I added one entry to it (6 lines).

## What changed and why

Paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- **C3: the patch call now carries the allowed kinds.**
  - `recovery/annotation/annotate.ts`: the `runtime_patch` request metadata now includes `allowedPatchKinds: [...plan.allowedPatchKinds]`.
  - `llm/harness/runtime-patch-schema.ts`: the five variants are now a map keyed by kind. `automationStudioRuntimePatchOutputSchema` takes `allowedKinds?` and offers only those kinds.
    - When the list is absent, all five kinds are offered, as before.
    - When the list is empty on a run that is not proposal-only, the only shape offered is `no_repair`.
    - Proposal-only runs are unchanged.
  - `llm/deepseek/output-schema.ts`: reads `request.metadata.allowedPatchKinds`, keeping string entries only, and passes it on.
  - The `outputSchema` in the user message and the system prompt's schema choice both come from this function, so both are narrowed.
- **C5: the recovery context budget scales with the call's input allowance.**
  - `annotate.ts` passes `byteBudget: min(16000, floor(maxInputTokens * 3 / 3))`, which is one third of the input allowance.
  - At the default 8,000-token allowance this gives 8,000 bytes, the same as today. At 48,000 tokens it gives 16,000.
  - Smaller allowances now scale down: 4,000 tokens gives 4,000 bytes, the same way the failure-evidence packet scales.
  - `context.ts` is unchanged, so its 8,000-byte default still applies to callers that pass nothing.
- **C6: a named deterministic recovery now leads to a patch request.**
  - In `recovery/plan.ts` `decidePatchRequest`, the `diagnosis_asked_for_none` stop is skipped when `deterministicRecoveryPossible === "yes"` and at least one patch kind is allowed.
  - The check sits after the `model_required` check and the `stillAchievable === "no"` check, so the model rung has already been selected and the goal is not gone. The plan then requests the patch and its steps are `[request_patch]`.
- **C9: no diagnosis call when there is no failed attempt.**
  - New code in `recovery/diagnosis-chain.ts`: `no_failed_attempt: "llm.runtime_patch_no_failed_attempt"`.
  - `plan.ts` `unclassifiedPlan()` no longer passes the chain decision through. It always returns `{request:false, code: no_failed_attempt, rung:"diagnosis"}`.
  - `annotate.ts` returns early when there is neither a `failedTraceAttempt` nor a failed or unknown `actionAttempts` entry. That return comes before provider resolution, so the Flow's standing repair authority is not drawn on.
  - That early return records `llmGate {invoked:false, code, patchSkipped, patchSkippedCode, patchSkippedRung:"diagnosis"}` and a four-stage trace whose resolution `skipCode` is the new code. No provider call is made.
- **K7: the ladder's model-rung record no longer reads as a failed call.**
  - In `service/summaries/conversions.ts`, the ladder's model-rung intervention keeps kind `diagnosis`, is now `validation.ok: true`, and uses the code `recovery.ladder_model_rung_selected`.
  - The export is renamed from `AUTOMATION_STUDIO_LADDER_DIAGNOSIS_UNANSWERED_CODE` to `AUTOMATION_STUDIO_LADDER_MODEL_RUNG_SELECTED_CODE`. Nothing else in Core imports it.
  - The Lab reader needs no change. `harness-recovery.ts:50` copies `validationOk` and `validationCodes` as they are, and the control parser (`existing-fluxiq-control.ts:535-561`) extracts codes whether `ok` is true or false. The only Lab occurrence of the old code is a hand-written fixture in `flow-lane/tests/harness-recovery.test.ts:402,427`, which is not affected.

Tests:
- New: `llm/deepseek/tests/output-schema.test.ts` (5 tests) and `recovery/annotation/tests/ladder-fixes.test.ts` (3 tests: C3, C5 and C9 through the whole annotate path).
- Extended: `recovery/tests/plan.test.ts` (5 tests for C6 and C9).
- Updated: `service/summaries/tests/conversions.test.ts` (K7).

## Commands run and observed results

- **New and changed tests against old code.** I temporarily restored the HEAD versions of the 6 source files, ran `npx vitest run` on the 4 test files, then restored my versions (checked with `cmp`).
  - Result: `Tests 9 failed | 36 passed (45)`.
  - The 9 failures are exactly the new or changed tests: 3 output-schema, 2 plan (C6, C9), 1 conversions (K7) and 3 ladder-fixes.
  - Of the 5 new plan tests, the 3 that guard behaviour that should not change passed on the old code, as they should.
- **Same tests with my code:** `Tests 45 passed (45)`. After a later barrel-import edit, the ladder-fixes file alone gave `3 passed`.
- **The brief's vitest scope,** run through `heavy.sh "t193 wM vitest"` over `recovery`, `llm/harness`, `llm/deepseek`, `service/summaries` and `tests/refuted-result`.
  - Result: `Test Files 2 failed | 67 passed (69)`, `Tests 3 failed | 754 passed (757)`. All 3 failures were timeouts:
    - `run-detail-preservation.test.ts`: 2 tests hit the 15 s limit.
    - `reauthor-service.test.ts`: 1 test hit the 60 s limit.
  - I reran each alone to check whether my change caused them:
    - `reauthor-service`: `7 passed`.
    - `run-detail-preservation` at HEAD source: also times out (`1 failed | 2 passed`; the other test took 13.9 s against its 15 s limit).
    - `run-detail-preservation` with my source and `--testTimeout=180000`: `3 passed` (18.9 s, 5.5 s, 2.6 s).
  - So these are timing-bound tests, and the timeouts are not caused by this change.
- **`npx tsc --noEmit -p .`** (packages/fluxiq, through heavy.sh):
  - First run: 1 error, in `service/runtime-adaptation/tests/step-failure-port.test.ts:113`. That file belongs to another worker.
  - Rerun: no output, i.e. clean.
- **`node scripts/structure-audit.mjs`** (Core root):
  - First run flagged my `ladder-fixes.test.ts` for importing `llm/deepseek/output-schema.ts` directly instead of through its barrel. I fixed it to use the `llm/index.ts` barrel.
  - Final run: `1 violation(s)`, in `tests/refuted-result/tests/failed-step-reauthor.test.ts:10`, which is not my file.

## Not verified

- No live Lab run, so the effect on DeepSeek's actual choice of kinds is unmeasured. DeepSeek uses `json_object` mode, so the schema is guidance and is not enforced.
- The full `packages/fluxiq` suite outside the brief's scope was not run.
- `run-detail-preservation.test.ts` passes only with a longer timeout. It times out at HEAD too.

## Open questions or contradictions found

1. **`recovery/diagnosis-chain.ts` edit.** It was outside the owned list but necessary for C9's code type. Please accept it or move the code.
2. **Prompt text still describes target overrides when that kind is not allowed.** `llm/deepseek/system-prompt.ts:13,16`, which I did not own, still adds the instructions "For a target override, fill target.handles..." and "For a target override or an action sequence, say in consequences..." to every non-proposal patch request.
   - They do not list kinds, and they never use the `temporary_*` names.
   - They do still mention a target override when the plan forbids one, as for `output_not_observed`.
   - Suggested follow-up: add each sentence only when its kind is in `request.metadata.allowedPatchKinds`.
3. **C9 condition.** The early return fires only when there is neither a trace attempt nor a failed or unknown detail attempt, which is the case in munyzo8z.
   - A run with a failed detail attempt but no `failedTraceAttempt` (for example an `unknown`-status attempt; `service.ts:2759` captures `failed` only) still makes the diagnosis call.
   - Its plan now ends `llm.runtime_patch_no_failed_attempt` at `diagnosis` instead of `llm.runtime_patch_unavailable` at `resolution`.
   - I kept that call deliberately, so that a `diagnosis_only` run still gets its diagnosis. Say if it should be skipped too.
4. **C6 interaction with an explicit `patchNeeded: false`.** C6 overrides a model's explicit `patchNeeded: false` when it also says `deterministicRecoveryPossible: "yes"`. That is what the brief asked for.
   - I did not add the brief-adjacent sentence to `llm/diagnosis-instructions.ts` ("the deterministic rungs have already run"). That file is on the must-not-touch list.
