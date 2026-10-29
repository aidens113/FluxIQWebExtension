# t795 w5-prompt-docs report

Outcome: Done.

## What changed and why
- runtime/llm/diagnosis-instructions.ts (result verification instruction only; the build-test text has no "Hold every row" sentence): the held-rows rule now also names rows several conditions left out together (each read's leftOutTogether); one sentence added after it: resultSummary.computedFacts are facts Core measured in its own record, each true as said; do not decide them again or answer no over them.
- llm/deepseek/tests/system-prompt-pins.json: the two verification pins (loop_verification, loop_verification_build_test) moved by exactly that clause and sentence; header note added in system-prompt.test.ts. The other two named prompt tests needed no change.
- llm/tests/diagnosis-channel.test.ts: new test that the instruction names leftOutTogether and computedFacts.
- docs/architecture/automation-studio/llm-flow-bootstrap.md: new "Computed facts first" section (eight kinds, conclusive-only fails as Core no, holds said to judge, pass needs model yes, every-result rule, presence "(no value)" locate rule, answer.rows K2, verbatim and date-field order waiting on paired W5). Reference docs regenerated.

## Commands and results
- vitest (4 targets, under the lock): first run 4 failed (the two pins x 2 tests); after pin update 30 files, 568 tests passed.
- pnpm docs:reference: wrote reference (4294 declarations). pnpm docs:check: structure-audit passed, "Deterministic framework reference is current".
- node scripts/check/model-text.mjs (downstream t795): ok, exit 0.

## Not verified
No tsc run; no full suites; no live model behaviour of the new sentence.

## Open questions
None. The generated reference diff (docs/reference/framework-reference.md, packages/fluxiq/docs/reference/) also carries other workers' declaration changes in the shared tree.
