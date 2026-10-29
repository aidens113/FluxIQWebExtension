# W-contradicted-words
Outcome: Done.
Changed (Core, packages/fluxiq/src/programs/automation-studio/runtime): result-verification/site-change/held.ts (NOT_PROOF gains contradicted; held logic already filters by NOT_PROOF so it covers it), site-change/tests/held.test.ts (new case), llm/diagnosis-instructions.ts (one sentence on contradicted), llm/deepseek/tests/system-prompt-pins.json + system-prompt.test.ts header comment (both verification pins re-pinned by exactly that sentence; the pin test failed until then).
Validation: vitest on site-change + llm + trial-change: 241 files, 2279 tests pass. Prompt-contract tests (system-prompt, extraction-vocabulary, issue-feedback) pass. pnpm check and structure:check: no failures (warnings only; structure-audit passed).
Not verified: pnpm docs:reference/docs:check not run (no exports changed).
