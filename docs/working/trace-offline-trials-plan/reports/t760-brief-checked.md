# t760 brief-checked report

Outcome: Done. The test was stale, not production.

## What changed and why
Only `packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/tests/brief-checked.test.ts` (Core, task/t760).
Cause: commit 534c41fb (t752, grounded judging) makes a current negative verdict list `diagnosis.defects`
(`llm/harness/provider-result.ts`, code `llm_output.verification_defects_required`) and Core takes a no only
when it finds a defect in its own record (`result-verification/located-defects`). The test's mock judge answered
with no `defects`, so the reply was rejected, the verdict became unsure/model_unavailable, no repair directive
carried `checked`, and `checked.length` was 0.
Fix: the mock judge now lists one located defect (kept_not_asked: the duplicated Lumo Audio Drift row, request words
"list each pair only once..."). The asserted behaviour (Core's checked lines in the brief, step 3 wording) is unchanged and
not loosened. I did not list the B0J5MCMBAY/B07Z1RZGJG claim as a defect: those rows are in the result, so Core cannot
locate an asked_missing defect for them; that is the contradiction the test exercises.

## Commands run
- Before: `pnpm test src/programs/automation-studio/runtime/recovery/refuted-result` -> parallel "Test Files 1 failed | 11 passed (12)" (AssertionError expected 0 > 0, test line 39).
- After: same command -> parallel "Test Files 12 passed (12)"; "[vitest-groups] all groups passed: parallel, real-sql" (real-sql printed no separate Test Files line in my filter).
- `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p tsconfig.json` in packages/fluxiq -> exit 0, no output.
- `pnpm structure:check` -> "structure-audit: passed (443 warning(s), 1152 baselined)".

## Not verified
Prompt-contract tests not run (no model-facing text changed). Subject dir had no production change.

## Open questions
None.
