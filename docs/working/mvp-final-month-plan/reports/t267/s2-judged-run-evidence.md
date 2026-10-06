# t267 S2: the judged whole run is evidence for a target override that proved nothing

Worker report for brief `t267-s2-judged-run-evidence` (lead: t267-adaptation-unblock, Stage S2, blocker 4).
Core worktree: `C:/Users/osrs_/FluxStuff/fxwork/t267/!FluxIQ`, branch `task/t267-adaptation-loop-unblock`. Nothing committed.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. All five steps of the contract are implemented with one marker, `verification.awaitsJudgedRun`. Every named test was written first and seen failing, then passed. The end-to-end harness could express both scenarios.
- A target override on a node that declares no evidence is auto-promoted, the run resumes from the Flow's start through the patched step, the run is judged `answers`, and the adaptation ends `applied` with the judged-run validation result.
- The same run judged refuted leaves the adaptation unapplied with `notAppliedReason: "refuted"` and no validation result.

## What changed and why

1. `R/live-patch.ts`
   - The `unverifiable` variant of `AutomationStudioRuntimePatchVerification` gains `awaitsJudgedRun?: true`. The marker is set in `runtimePatchVerification` (it now takes the patch) only when all three hold: the patch kind is `temporary_target_override`, `verdict.outcome === "unverifiable"`, and `verdict.notResumableCode === "no_evidence"`.
   - A new private `runtimePatchRetriesOriginalAction(verification, patch)` is the single rule for `retryOriginalAction`, on both the result and the adaptation's `metadata.retryOriginalAction`. It is true for `verified` or awaitsJudgedRun, and never for `temporary_action_sequence`.
   - `restoredExpectedState`, status `testing`, the absence of a validation result and the absence of a change proposal are unchanged. I removed an unused local, `restoredExpectedState`, in `adaptationFromRuntimePatch`. The doc comments are updated.
2. `R/training-modes.ts`
   - `AutomationStudioAdaptationPromotionGateInput` gains `awaitsJudgedRun?: boolean`.
   - In `decideAutomationStudioAdaptationPromotionGate` only, the trial-evidence refusal is skipped when all of these hold: `awaitsJudgedRun === true`, the tier is `unverified`, and there is no `lastFailure`.
   - I added the `tier === "unverified"` condition on top of the brief, so the gate fails closed: a missing or garbage confidence decision is still refused. The marker only ever arises on an unverified change.
   - Shared refusals (manual mode, first manual review) and the `mixed` structural or high-risk routing still apply.
   - The autoApply reason is now: "A change whose trial proved nothing either way is applied only once a whole run from the Flow's start, which ran it, is judged to answer: that judged run is its evidence."
   - `decideAutomationStudioBootstrapApplyGate` is unchanged.
3. **The helper** (the brief asked where it lives): `R/service/adaptations/verification-awaits-judged-run.ts` exports `automationStudioVerificationAwaitsJudgedRun(verification: unknown): boolean`. It is re-exported from `R/service/adaptations/index.ts`.
   - `adaptive-retry.ts` imports it as a sibling file.
   - `runtime-promotion.ts` and `judged-promotion.ts` import it through `../adaptations/index.ts`, which both already imported.
   - There is no cycle, and the structure audit passes. `service/` is not a public export, so the helper is not public API.
4. `R/service/runtime-adaptation/runtime-promotion.ts`: `awaitsJudgedRun` is read from `adaptation.metadata.verification` and passed to the gate. The decision record gets `evidence: "judged_whole_run"` only when the gate allowed autoApply on the marker. It is absent for refusals, so a refused decision does not claim evidence it never got.
5. `R/service/adaptations/adaptive-retry.ts`: in `resumePointOfAttempt`, a receipt with `resumable !== true` passes the first check only when `notResumableCode === "no_evidence"` and the helper reads its `verification` as awaiting. The point-missing, subflow-mismatch, completed, malformed and points-disagree rules are unchanged.
6. `R/service/runtime-adaptation/judged-promotion.ts`
   - In `settleOne`, on `apply`, `withJudgedRunEvidence` appends `{ runId, status: "succeeded", checkedAt, kind: "trial", basis: ["judged_whole_run"], detail }` to `validationResults`. This happens in the save before `applyFlowAdaptation`, so `evaluateFlowAdaptationPromotionGates` reads tier `provisional`.
   - Nothing changes on non-apply outcomes or for adaptations without the marker.
   - If the apply itself then throws (`apply_failed` or `store_unavailable`), the recorded judged-run result stays, because the run really was judged to answer.
   - The header comment is updated.
7. `docs/architecture/package-boundaries.md`: a new first entry under Migration Notes, "Next minor (unreleased): a target override that proved nothing is kept on its judged whole run". It lists what was added and what changed.
8. The generated reference was rebuilt with `node scripts/docs-reference.mjs`. It writes both `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`; the second file was regenerated by the same script. Both changed because two public types changed: their doc text and their source line numbers.

Tests:
- `R/tests/live-patch-target-override.test.ts`: a new describe, "whose trial proved nothing either way", with 4 tests.
  - The marker is set.
  - The marker is not set when a check is unknown: an expected state with no host evaluator gives `check_unknown` and `evidence_unevaluated`.
  - It is not set for a contradicted trial: the changed policy action fails.
  - It is not set for another kind: `temporary_wait_retry` with `no_evidence`.
- `R/tests/training-modes.test.ts`: 2 tests.
  - With the marker: autoApply.
  - Refused with `lastFailure`, without the marker (false or absent), under manual mode, under first manual review, under mixed with high risk, and with promotion disabled.
  - The bootstrap gate ignores a claimed marker.
- `R/service/adaptations/tests/adaptive-retry.test.ts`: 3 tests for the resume rules with the marker, plus 1 direct test of the helper.
- `R/service/runtime-adaptation/tests/runtime-promotion.test.ts` (new): 4 tests.
  - The marker gives autoApply with `evidence: "judged_whole_run"`.
  - Each of these is refused and records no evidence: no marker, a recorded failure, manual mode.
- `R/service/runtime-adaptation/tests/judged-promotion.test.ts`: 4 tests.
  - The judged run is recorded before the apply, and the real `evaluateFlowAdaptationPromotionGates` passes on it.
  - Earlier results are kept.
  - Nothing is recorded on refuted or unjudged runs.
  - Without the marker, nothing is recorded and the real gate refuses the apply.
- `R/tests/service-adaptation/tests/judged-run-evidence.test.ts` (new, end to end): the harness of `judged-promotion.test.ts`, with the drift step replaced by a `press` action that declares nothing and succeeds only on the replacement target. The model writes a `temporary_target_override` with `consequences: []`, and the domain check answers `matched`. Two tests, as specified above.

## Commands run and observed results

Fail-first, each before its implementation, from `packages/fluxiq`:
- live-patch: 1 failed (the marker test: received verification without `awaitsJudgedRun`), 3 passed (the negative guards).
- training-modes: 1 failed, 14 passed.
- adaptive-retry: 2 failed, 12 passed.
- runtime-promotion: 2 failed, 2 passed. The marker test failed, and so did the manual-mode test, because before the change the evidence refusal was reported ahead of manual mode.
- judged-promotion (unit): 2 failed, 24 passed.
- End to end: the file was written after the implementation. To show it fails without it, I temporarily set the live-patch marker to `false` from a backup copy. Both tests failed: the receipt was not `autoApply`. I then restored the file byte for byte from the backup and confirmed it with grep.

Final validation, on the final tree:
- From `packages/fluxiq`: `npx vitest run` over the 6 brief files plus `R/tests/live-patch.test.ts`, `R/service/runtime-adaptation/tests/repair-rerun.test.ts`, `R/tests/service-adaptation/tests/judged-promotion.test.ts`, `R/tests/service-adaptation/tests/promotion-tier.test.ts` and `R/tests/service-adaptation/tests/adaptive-loop.test.ts`.
  - Run 1: `Test Files 11 passed (11)`, `Tests 157 passed (157)`, exit 0.
  - Run 2: `Test Files 11 passed (11)`, `Tests 157 passed (157)`, exit 0.
  - The same set also passed twice before the last two test-only edits (157 / 157 each).
- `node scripts/build-cache/cli.mjs fluxiq:check` (Core root): exit 0. An earlier run failed with exit 2 on `runtime-promotion.test.ts(44,34): TS7006 implicit any`; I fixed it by typing the callback parameter.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (247 warning(s), 349 baselined).`, exit 0. An earlier run failed because `live-patch-target-override.test.ts` reached 809 lines, over the 800 limit. I tightened my added block, and the file is now 791 lines.
- `pnpm.cmd docs:check`: `structure-audit: passed (0 warning(s), 0 baselined).` and `Deterministic framework reference is current.`, exit 0.
- Extra, not in the brief, run once: the other files that exercise target overrides or receipts (`deepseek-recovery-requests`, `refuted-result/failed-step-reauthor`, `iterating-recovery`, `llm-diagnosis`, `runtime-patches`, `step-failure-port`, `summaries/run-detail-merge`, `summaries/run-detail-preservation`, `adaptive-retry-resume`, `policy-action-target-repair`). Result: `Test Files 10 passed (10)`, `Tests 51 passed (51)`, exit 0.
- `git diff --check`: clean. The new files have LF endings. Edited files kept the worktree's CRLF; the index is LF under `core.autocrlf=true`.

## Not verified

- Full suites (`pnpm check`, `pnpm test`, `pnpm build`): not run, per the twice-a-day rule.
- No live or browser run. The real A8 Flow (10 nodes, instruction-built) was not replayed. The end-to-end test uses a 4-node stand-in with the same property: no node declares expected state, route, outputs, assertion or records.
- Downstream (web-extension) consumers of `runtimePatchAttempts`, `approvalDecision` or `retryOriginalAction` were not checked, because they are outside the brief.
- Behaviour when one run holds a mix of an awaiting receipt and a `verified` receipt at different resume points: only the "points disagree" refusal was tested, at unit level.

## Open questions or contradictions found

- **Fail-closed tightening in the gate.** The brief said to skip the refusal when the marker is set and there is no `lastFailure`. I also require `confidence.tier === "unverified"`, so a missing or malformed confidence decision is still refused. This does not change any case the brief describes.
- **Where `evidence` is recorded.** It is recorded on the decision only when autoApply was allowed. The brief's "record it on the decision record" left this open.
- **The judged result outlives a failed apply.** It stays recorded when the apply throws after a judged `answers`. The brief said "on `apply`". I read that as the outcome, which is what I implemented. Change it if the lead wants the result recorded only on a successful apply.
- **Advisory size warnings.** These are not failures, but the counts crossed or stayed past the 400-line advisory: `R/service/runtime-adaptation/tests/judged-promotion.test.ts` is 408 lines (was 329), `R/tests/training-modes.test.ts` is 405 (was 369), and `R/training-modes.ts` is 453 (was 436, already over). `R/tests/live-patch-target-override.test.ts` is 791 lines, close to the hard 800 limit, so the next addition there will need a split.
- No must-not-touch path was needed: no changes to `flow-change/**`, `recovery/**`, `model/**`, `service.ts` or any t264 path.
