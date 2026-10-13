# t525 bounded result-judge evidence correction

Status: Implemented and owning checks complete; supervisor verification required.
Date: 2026-10-13
Worker: codex-replay
Pair: downstream `6a46e66b`, Core `73550acb`, isolated `task/t525-judge-evidence-recovery`.

## Cause and scope

The frozen t524 canonical debug reproduces the actual defect: affirmative judge explanations lacked the strict row-local name plus request quotation proof. Some replies used shorter aliases; confirmations also omitted required quotation binding. Core converted this deficiency into a semantic no, closing correct candidate revisions. The independently verified private dataset oracle establishes correctness of those particular datasets only; it grants no product acceptance. Accounted estimated spend was corrected in both canonical debug and round-one report; neither claims independently invoiced spend.

Two generic fail-first regressions reproduced the defect: a deficient first explanation followed by valid evidence, and a deficient confirming explanation. Both previously remained unsure instead of correcting the same check and confirming normally. Initial test collection required the narrow public contracts prerequisite; `pnpm.cmd --filter @fluxiq/contracts build` restored its 149 files from the shared cache. No paid provider ran.

## Implementation

Only Core result-verification owners changed. `verdict.ts` identifies affirmative missing-quotation evidence separately, only when no required-row omission, kept-number contradiction, or requested patch is present. Its explicit optional `exclusionEvidenceMissing` carrier contains Core's bounded proof lines, not a graph repair. The result remains `unsure` / `model_unconfirmed`, so runtime records cannot mislabel it refuted or confirmed.

`exclusion-evidence/recheck.ts` builds precise generic corrective feedback from the same evidence. It requires the declared domain denied-key list and checks feedback with the existing credential and denied-key screen. Missing declarations, denied feedback, and credential-shaped values decline corrective publication. Existing context projection passes `resultSummary.recheck` through; the negative screen regression caught that relying on projection alone would be insufficient. No raw timeline, new evidence, scenario-specific guidance, or reply cap was introduced.

`verify.ts` uses the existing two asks per check for correction, sharing that allowance with temporary/truncated replies. Purse, timeout, cancellation, provider refusal and intervention accounting remain on the existing harness. Receipts identify corrective attempts with `verificationEvidenceRecheck`; every ask retains its normal check/ask identity. A corrected yes still needs the ordinary independent confirming check when requested.

`agreement.ts` keeps persistent deficiency unconfirmed. `build-test/judge.ts` maps that exact non-refutation to `not_judged`, never promotion or graph repair. The existing candidate trial port retains evidence under exact revision/digest and rejudges it without repeating execution. Its unchanged owning tests prove this behavior; no candidate source expansion was necessary. Genuine semantic no, unaccounted required rows, kept-number contradictions and strict full-row/four-word ambiguity defenses remain unchanged.

The run-record projection already selects only stable verdict/code/count fields; missing-proof lines are not added to durable run summaries.

## Files

Core `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/`:

- `contracts.ts`, `verdict.ts`, `verify.ts`, `agreement.ts`, `index.ts`.
- New focused owner `exclusion-evidence/{index,recheck}.ts` and `exclusion-evidence/tests/recheck.test.ts`.
- `build-test/judge.ts`, new `build-test/tests/exclusion-evidence.test.ts`.
- Updated adjacent `tests/verify.test.ts`, `tests/verdict.test.ts`.

The Core working-plan change already present in the tree is supervisor-owned; this worker did not edit it. No downstream production source changed.

## Validation

Observed 105/105 tests across nine files before the mechanical owner-directory move. Coverage includes corrected first/confirming explanations, persistent not-judged nonpromotion, exact provider feedback, denied-key and credential decline, shared temporary-fault allowance, refused-key accounting, genuine no preservation, existing strict quotation matching, Flow purse behavior and exact-candidate no-execution rejudge.

Exact command (run from paired Core; after the move use the final helper test path below):

```powershell
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/tests/verify.test.ts src/programs/automation-studio/runtime/result-verification/tests/verdict.test.ts src/programs/automation-studio/runtime/result-verification/tests/agreement.test.ts src/programs/automation-studio/runtime/result-verification/exclusion-evidence/tests/recheck.test.ts src/programs/automation-studio/runtime/result-verification/tests/flow-purse-check.test.ts src/programs/automation-studio/runtime/result-verification/request-rows/tests/unquoted-rows.test.ts src/programs/automation-studio/runtime/result-verification/build-test/tests/judge-rows.test.ts src/programs/automation-studio/runtime/result-verification/build-test/tests/exclusion-evidence.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/rejudge.test.ts
```

Final mechanical-move selection additionally checks the unchanged short/ambiguous-alias guard:

```powershell
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/tests/verify.test.ts src/programs/automation-studio/runtime/result-verification/exclusion-evidence/tests/recheck.test.ts src/programs/automation-studio/runtime/result-verification/request-rows/tests/rerun-rows.test.ts
pnpm.cmd --filter fluxiq exec tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/t525-check.tsbuildinfo
node scripts/structure-audit.mjs
```

Final mechanical-move selection passed 32/32, including the unchanged fewer-than-four-word and ambiguous-prefix refusal tests. Source/test typecheck passed again on the final frozen tree (exit 0). Scoped diff check passed. Audit initially found a helper-test directory overflow and direct leaf import; the focused owner-directory move and LLM barrel import correct these without baseline growth. Final audit has no source violations; its sole failure is unrelated working-docs README header-index drift. Supervisor owns shared document regeneration. The pipeline-form audit command filters output only and retains its observed failing exit code; no pass is claimed for the overall audit.

No whole suites, live/browser/provider launches, runtime/profile mutations, commits, merges or pushes. Live behavior remains unverified on this changed pair; source and tests are frozen for supervisor review.
